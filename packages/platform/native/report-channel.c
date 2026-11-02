/* Linux account authentication and bounded byte relay; no application requests are interpreted. */
#define _GNU_SOURCE
#include <errno.h>
#include <fcntl.h>
#include <limits.h>
#include <poll.h>
#include <signal.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/socket.h>
#include <sys/stat.h>
#include <sys/un.h>
#include <unistd.h>

static void fail(const char *stage) {
  fprintf(stderr, "report-channel:%s:%d\n", stage, errno);
  exit(120);
}

static uid_t uid(const char *text) {
  char *end;
  errno = 0;
  unsigned long value = strtoul(text, &end, 10);
  if (errno || !*text || *end || *text == '-' || value >= UINT32_MAX) fail("uid");
  return (uid_t)value;
}

static struct ucred peer(int fd, uid_t expected) {
  struct ucred result;
  socklen_t size = sizeof(result);
  int type;
  socklen_t type_size = sizeof(type);
  struct sockaddr_un address;
  socklen_t address_size = sizeof(address);
  if (getsockopt(fd, SOL_SOCKET, SO_TYPE, &type, &type_size) || type != SOCK_STREAM ||
      getpeername(fd, (struct sockaddr *)&address, &address_size) || address.sun_family != AF_UNIX ||
      getsockopt(fd, SOL_SOCKET, SO_PEERCRED, &result, &size) || size != sizeof(result) ||
      result.uid != expected || result.pid <= 0) fail("peer");
  return result;
}

/* Pin every parent without following links. The owner comes from trusted installation, never RPC. */
static int parent(const char *path, uid_t owner, char *leaf) {
  if (path[0] != '/' || strlen(path) >= sizeof(((struct sockaddr_un *)0)->sun_path)) fail("path");
  char copy[108];
  strcpy(copy, path + 1);
  char *part = copy;
  int fd = open("/", O_PATH | O_DIRECTORY | O_CLOEXEC);
  if (fd < 0) fail("root");
  for (;;) {
    struct stat info;
    if (fstat(fd, &info) || (info.st_uid != 0 && info.st_uid != owner) || (info.st_mode & 0022)) fail("parent");
    char *slash = strchr(part, '/');
    if (slash) *slash = 0;
    if (!*part || !strcmp(part, ".") || !strcmp(part, "..")) fail("component");
    if (!slash) {
      strcpy(leaf, part);
      return fd;
    }
    int next = openat(fd, part, O_PATH | O_DIRECTORY | O_NOFOLLOW | O_CLOEXEC);
    if (next < 0) fail("directory");
    close(fd);
    fd = next;
    part = slash + 1;
  }
}

struct buffer { unsigned char bytes[65536]; size_t offset, size; };

static size_t room(struct buffer *buffer) {
  if (buffer->offset && buffer->size) memmove(buffer->bytes, buffer->bytes + buffer->offset, buffer->size);
  buffer->offset = 0;
  return sizeof(buffer->bytes) - buffer->size;
}

static int read_into(int fd, struct buffer *buffer) {
  ssize_t count = read(fd, buffer->bytes + buffer->size, sizeof(buffer->bytes) - buffer->size);
  if (count > 0) buffer->size += (size_t)count;
  else if (count == 0) return 0;
  else if (errno != EAGAIN && errno != EWOULDBLOCK && errno != EINTR) fail("read");
  return 1;
}

static void write_from(int fd, struct buffer *buffer) {
  ssize_t count = write(fd, buffer->bytes + buffer->offset, buffer->size);
  if (count > 0) { buffer->offset += (size_t)count; buffer->size -= (size_t)count; }
  else if (count < 0 && errno != EAGAIN && errno != EWOULDBLOCK && errno != EINTR) fail("write");
}

static void relay(int socket) {
  int descriptors[] = {STDIN_FILENO, STDOUT_FILENO, socket};
  for (size_t i = 0; i < sizeof(descriptors) / sizeof(descriptors[0]); i++) {
    int flags = fcntl(descriptors[i], F_GETFL);
    if (flags < 0 || fcntl(descriptors[i], F_SETFL, flags | O_NONBLOCK)) fail("nonblock");
  }
  struct buffer outgoing = {0}, incoming = {0};
  int input = 1, remote = 1, half_closed = 0;
  while (remote || incoming.size) {
    size_t out_room = room(&outgoing), in_room = room(&incoming);
    if (!input && !outgoing.size && !half_closed) {
      if (shutdown(socket, SHUT_WR)) fail("shutdown");
      half_closed = 1;
    }
    struct pollfd wait[] = {
      {.fd = input && out_room ? STDIN_FILENO : -1, .events = POLLIN},
      {.fd = (remote && in_room) || outgoing.size ? socket : -1, .events = (remote && in_room ? POLLIN : 0) | (outgoing.size ? POLLOUT : 0)},
      {.fd = incoming.size ? STDOUT_FILENO : -1, .events = POLLOUT},
    };
    if (poll(wait, 3, -1) < 0) { if (errno == EINTR) continue; fail("poll"); }
    for (size_t i = 0; i < 3; i++) if (wait[i].revents & (POLLERR | POLLNVAL)) fail("poll-fd");
    if (input && out_room && (wait[0].revents & (POLLIN | POLLHUP))) input = read_into(STDIN_FILENO, &outgoing);
    if (remote && in_room && (wait[1].revents & (POLLIN | POLLHUP))) remote = read_into(socket, &incoming);
    if (outgoing.size && (wait[1].revents & POLLOUT)) write_from(socket, &outgoing);
    if (incoming.size && (wait[2].revents & POLLOUT)) write_from(STDOUT_FILENO, &incoming);
  }
}

int main(int argc, char **argv) {
  signal(SIGPIPE, SIG_IGN);
  if (argc == 3 && !strcmp(argv[1], "--peer")) {
    struct ucred credentials = peer(STDIN_FILENO, uid(argv[2]));
    printf("{\"pid\":%d,\"uid\":%u,\"gid\":%u}\n", credentials.pid, credentials.uid, credentials.gid);
    return 0;
  }
  if (argc != 5 || strcmp(argv[1], "--connect")) fail("arguments");
  uid_t owner = uid(argv[3]), server = uid(argv[4]);
  char leaf[108];
  int directory = parent(argv[2], owner, leaf);
  struct stat before, after;
  if (fstatat(directory, leaf, &before, AT_SYMLINK_NOFOLLOW) || !S_ISSOCK(before.st_mode) ||
      before.st_uid != owner || (before.st_mode & 0002)) fail("socket-node");
  int socket_fd = socket(AF_UNIX, SOCK_STREAM | SOCK_CLOEXEC, 0);
  if (socket_fd < 0) fail("socket");
  struct sockaddr_un address = {.sun_family = AF_UNIX};
  strcpy(address.sun_path, argv[2]);
  if (connect(socket_fd, (struct sockaddr *)&address, sizeof(address))) fail("connect");
  struct ucred credentials = peer(socket_fd, server);
  if (fstatat(directory, leaf, &after, AT_SYMLINK_NOFOLLOW) || before.st_dev != after.st_dev || before.st_ino != after.st_ino)
    fail("socket-replaced");
  close(directory);
  if (dprintf(3, "{\"pid\":%d,\"uid\":%u,\"gid\":%u}\n", credentials.pid, credentials.uid, credentials.gid) < 0)
    fail("ready");
  close(3);
  relay(socket_fd);
  close(socket_fd);
  return 0;
}

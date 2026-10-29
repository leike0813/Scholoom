/* Fixed T1.0 observation only: no exec, manager calls, mount or policy changes. */
#define _GNU_SOURCE
#include <errno.h>
#include <fcntl.h>
#include <inttypes.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/resource.h>
#include <sys/stat.h>
#include <sys/statvfs.h>
#include <unistd.h>
#include "calibration-config.h"

#if !defined(__linux__) || !defined(__x86_64__) || defined(__ILP32__)
#error Linux x86_64 LP64 required
#endif

struct expected { uint64_t dev, ino, uid, type; };
struct manifest { char magic[8]; struct expected object[3]; };
_Static_assert(sizeof(struct manifest) == 104, "fixed Linux x64 fixture format");

static int read_text(const char *path, char *buffer, size_t size) {
  int fd = open(path, O_RDONLY | O_CLOEXEC | O_NOFOLLOW);
  if (fd < 0) return errno;
  size_t used = 0;
  while (used < size - 1) {
    ssize_t n = read(fd, buffer + used, size - used - 1);
    if (n < 0 && errno == EINTR) continue;
    if (n < 0) { int error = errno; close(fd); return error; }
    if (!n) break;
    used += (size_t)n;
  }
  buffer[used] = 0;
  char extra;
  ssize_t more;
  do { more = read(fd, &extra, 1); } while (more < 0 && errno == EINTR);
  int result = more > 0 ? EOVERFLOW : more < 0 ? errno : 0;
  close(fd);
  return result;
}

static void hex(const char *value) {
  putchar('"');
  for (const unsigned char *p = (const unsigned char *)value; *p; p++) printf("%02x", *p);
  putchar('"');
}

static void identity(int offline) {
  char status[8192] = {0}, label[512] = {0}, group[1024] = {0};
  char eff[17] = {0}, prm[17] = {0}, bnd[17] = {0};
  int status_error = read_text("/proc/self/status", status, sizeof(status));
  int label_error = read_text("/proc/self/attr/current", label, sizeof(label));
  int group_error = read_text("/proc/self/cgroup", group, sizeof(group));
  const char *p;
  int nnp = -1, seccomp = -1, tracer = -1;
  if ((p = strstr(status, "CapEff:"))) sscanf(p + 7, " %16[0-9a-f]", eff);
  if ((p = strstr(status, "CapPrm:"))) sscanf(p + 7, " %16[0-9a-f]", prm);
  if ((p = strstr(status, "CapBnd:"))) sscanf(p + 7, " %16[0-9a-f]", bnd);
  if ((p = strstr(status, "NoNewPrivs:"))) sscanf(p + strlen("NoNewPrivs:"), "%d", &nnp);
  if ((p = strstr(status, "Seccomp:"))) sscanf(p + strlen("Seccomp:"), "%d", &seccomp);
  if ((p = strstr(status, "TracerPid:"))) sscanf(p + strlen("TracerPid:"), "%d", &tracer);
  printf("\"numericFdSimulation\":%s,\"pid\":%jd,\"ppid\":%jd,\"uid\":%ju,\"euid\":%ju,\"gid\":%ju,\"egid\":%ju,",
         offline ? "true" : "false", (intmax_t)getpid(), (intmax_t)getppid(), (uintmax_t)getuid(), (uintmax_t)geteuid(),
         (uintmax_t)getgid(), (uintmax_t)getegid());
  gid_t groups[32];
  int count = getgroups(32, groups), groups_error = count < 0 ? errno : 0;
  printf("\"groupsErrno\":%d,\"groups\":[", groups_error);
  for (int i = 0; i < count; i++) printf("%s%ju", i ? "," : "", (uintmax_t)groups[i]);
  printf("],\"statusErrno\":%d,\"capEff\":\"%s\",\"capPrm\":\"%s\",\"capBnd\":\"%s\"",
         status_error, eff, prm, bnd);
  printf(",\"noNewPrivs\":%d,\"seccomp\":%d,\"tracerPid\":%d", nnp, seccomp, tracer);
  printf(",\"labelErrno\":%d,\"labelHex\":", label_error); hex(label);
  printf(",\"selfCgroupErrno\":%d,\"selfCgroupHex\":", group_error); hex(group);
}

static int matches(const struct stat *actual, const struct expected *expected) {
  return (uint64_t)actual->st_dev == expected->dev &&
         (uint64_t)actual->st_ino == expected->ino &&
         (uint64_t)actual->st_uid == expected->uid &&
         (uint64_t)(actual->st_mode & S_IFMT) == expected->type && actual->st_nlink == 1;
}

static int inherited(int *input, int *contract, int offline) {
  if (offline) { *input = 3; *contract = 4; return 1; }
  const char *pid = getenv("LISTEN_PID"), *fds = getenv("LISTEN_FDS");
  const char *names = getenv("LISTEN_FDNAMES");
  char wanted[32]; snprintf(wanted, sizeof(wanted), "%ju", (uintmax_t)getpid());
  if (!pid || strcmp(pid, wanted) || !fds || strcmp(fds, "2") || !names) return 0;
  if (!strcmp(names, "approved:expected")) { *input = 3; *contract = 4; return 1; }
  if (!strcmp(names, "expected:approved")) { *input = 4; *contract = 3; return 1; }
  return 0;
}

static int probe(int offline) {
  int input, contract;
  struct manifest expected;
  struct stat state[5];
  if (!inherited(&input, &contract, offline)) return 64;
  const int fds[] = {0, 1, 2, input, contract};
  for (unsigned i = 0; i < 5; i++) if (fstat(fds[i], &state[i])) return 64;
  if (!S_ISREG(state[4].st_mode) || state[4].st_nlink != 1 ||
      state[4].st_size != (off_t)sizeof(expected) || (fcntl(contract, F_GETFL) & O_ACCMODE) != O_RDONLY ||
      pread(contract, &expected, sizeof(expected), 0) != (ssize_t)sizeof(expected) ||
      memcmp(expected.magic, "T10OBJ1", 8)) return 64;
  for (unsigned i = 0; i < 3; i++) if (expected.object[i].uid != state[4].st_uid) return 64;
  if (expected.object[0].type != S_IFIFO || expected.object[1].type != S_IFREG ||
      expected.object[2].type != S_IFREG) return 64;
  /* Do not send diagnostics to an object other than the prechecked log. */
  if (!matches(&state[1], &expected.object[1]) || !matches(&state[2], &expected.object[1]) ||
      (fcntl(1, F_GETFL) & O_ACCMODE) != O_WRONLY ||
      (fcntl(2, F_GETFL) & O_ACCMODE) != O_WRONLY) return 65;
  int objects_match = matches(&state[0], &expected.object[0]) &&
                      matches(&state[3], &expected.object[2]) &&
                      (fcntl(0, F_GETFL) & O_ACCMODE) == O_RDONLY &&
                      (fcntl(input, F_GETFL) & O_ACCMODE) == O_RDONLY;
  int flags = fcntl(0, F_GETFL);
  if (flags < 0 || fcntl(0, F_SETFL, flags & ~O_NONBLOCK)) return 64;
  if (objects_match) {
    char permit[2];
    size_t used = 0;
    for (;;) {
      ssize_t n = read(0, permit + used, sizeof(permit) - used);
      if (n < 0 && errno == EINTR) continue;
      if (n < 0) return 66;
      if (!n) break;
      used += (size_t)n;
      if (used != 1 || permit[0] != 'G') return 66;
    }
    if (!used) return 66;
  }
  static const char approved[] = "approved report bytes\n";
  char bytes[sizeof(approved)] = {0};
  int input_match = objects_match && state[3].st_size == (off_t)(sizeof(approved) - 1) &&
                    pread(input, bytes, sizeof(bytes), 0) == (ssize_t)(sizeof(approved) - 1) &&
                    !memcmp(bytes, approved, sizeof(approved) - 1);
  printf("{\"kind\":\"probe\","); identity(offline);
  printf(",\"manifestOwner\":%ju,\"objectsMatch\":%s,\"inputMatch\":%s,\"fds\":[",
         (uintmax_t)state[4].st_uid, objects_match ? "true" : "false", input_match ? "true" : "false");
  for (unsigned i = 0; i < 5; i++)
    printf("%s{\"fd\":%d,\"dev\":\"%ju\",\"ino\":\"%ju\",\"uid\":%ju,\"type\":%u}",
           i ? "," : "", fds[i], (uintmax_t)state[i].st_dev, (uintmax_t)state[i].st_ino,
           (uintmax_t)state[i].st_uid, (unsigned)(state[i].st_mode & S_IFMT));
  puts("]}");
  return objects_match && input_match ? 0 : 65;
}

static int observe(void) {
  struct stat scope;
  int scope_error = stat(TARGET_CGROUP, &scope) ? errno : 0;
  char events[1024] = {0};
  int events_error = read_text(TARGET_CGROUP "/cgroup.events", events, sizeof(events));
  struct statvfs filesystem;
  int mount_error = statvfs("/sys/fs/cgroup", &filesystem) ? errno : 0;
  printf("{\"kind\":\"observer\","); identity(0);
  printf(",\"targetUnit\":\"%s\",\"scopeErrno\":%d,\"eventsErrno\":%d,\"eventsHex\":",
         TARGET_UNIT, scope_error, events_error); hex(events);
  printf(",\"mountErrno\":%d,\"cgroupMountReadOnly\":%s", mount_error,
         !mount_error && (filesystem.f_flag & ST_RDONLY) ? "true" : "false");
  if (!scope_error) printf(",\"scopeDev\":\"%ju\",\"scopeIno\":\"%ju\"",
                           (uintmax_t)scope.st_dev, (uintmax_t)scope.st_ino);
  puts("}");
  return scope_error || events_error ? 2 : 0;
}

int main(int argc, char **argv) {
  struct rlimit output = {65536, 65536};
  if (setrlimit(RLIMIT_FSIZE, &output)) return 64;
  if (argc == 2 && !strcmp(argv[1], "--observe")) return observe();
  if (argc == 2 && !strcmp(argv[1], "--offline")) return probe(1);
  if (argc != 1) return 64;
  return probe(0);
}

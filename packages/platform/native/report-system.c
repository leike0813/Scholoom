/* Fixed system-service scope operations; no names, commands, or D-Bus properties are supplied by reports. */
#define _GNU_SOURCE
#include <errno.h>
#include <fcntl.h>
#include <inttypes.h>
#include <linux/magic.h>
#include <signal.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/stat.h>
#include <sys/statvfs.h>
#include <sys/vfs.h>
#include <time.h>
#include <unistd.h>
#include <systemd/sd-bus.h>

static const char *destination = "org.freedesktop.systemd1";
static const char *manager = "/org/freedesktop/systemd1";
static const char *unit_interface = "org.freedesktop.systemd1.Unit";

static void fail(const char *stage) {
  fprintf(stderr, "report-system:%s:%d\n", stage, errno);
  exit(120);
}
static int hex(char c) { return c >= '0' && c <= '9' ? c - '0' : c >= 'a' && c <= 'f' ? c - 'a' + 10 : -1; }
static void uuid(const char *value) {
  if (strlen(value) != 36) fail("uuid");
  for (int i = 0; i < 36; i++) {
    if (i == 8 || i == 13 || i == 18 || i == 23) { if (value[i] != '-') fail("uuid"); }
    else if (hex(value[i]) < 0) fail("uuid");
  }
}
static uint64_t number(const char *value) {
  if (!*value) fail("number");
  for (const char *p = value; *p; p++) if (*p < '0' || *p > '9') fail("number");
  char *end;
  errno = 0;
  uint64_t result = strtoull(value, &end, 10);
  if (errno || *end) fail("number");
  return result;
}
static void invocation(const char *text, uint8_t bytes[16]) {
  if (strlen(text) != 32) fail("invocation");
  int any = 0;
  for (int i = 0; i < 16; i++) {
    int a = hex(text[i * 2]), b = hex(text[i * 2 + 1]);
    if (a < 0 || b < 0) fail("invocation");
    bytes[i] = (uint8_t)((a << 4) | b);
    any |= bytes[i];
  }
  if (!any) fail("invocation");
}
static void boot(const char *expected) {
  char actual[38] = {0};
  int fd = open("/proc/sys/kernel/random/boot_id", O_RDONLY | O_CLOEXEC | O_NOFOLLOW);
  if (fd < 0 || read(fd, actual, sizeof(actual) - 1) != 37 || strncmp(actual, expected, 36) || actual[36] != '\n') fail("boot");
  close(fd);
}
static uint64_t milliseconds(void) {
  struct timespec now;
  if (clock_gettime(CLOCK_MONOTONIC, &now)) fail("clock");
  return (uint64_t)now.tv_sec * 1000 + (uint64_t)now.tv_nsec / 1000000;
}
static int empty(int directory) {
  char buffer[256] = {0};
  int fd = openat(directory, "cgroup.events", O_RDONLY | O_CLOEXEC | O_NOFOLLOW);
  if (fd < 0) return -1;
  ssize_t size = read(fd, buffer, sizeof(buffer) - 1);
  close(fd);
  if (size <= 0 || size == (ssize_t)sizeof(buffer) - 1) fail("events");
  if (!strncmp(buffer, "populated 0\n", 12) || strstr(buffer, "\npopulated 0\n")) return 1;
  if (!strncmp(buffer, "populated 1\n", 12) || strstr(buffer, "\npopulated 1\n")) return 0;
  fail("populated");
  return 0;
}
static char *property(sd_bus *bus, const char *path, const char *interface, const char *name) {
  char *value = NULL;
  if (sd_bus_get_property_string(bus, destination, path, interface, name, NULL, &value) < 0 || !value)
    fail("property");
  return value;
}
static char *unit_path(sd_bus *bus, const char *unit) {
  sd_bus_message *reply = NULL;
  if (sd_bus_call_method(bus, destination, manager, "org.freedesktop.systemd1.Manager",
                        "GetUnit", NULL, &reply, "s", unit) < 0) fail("capture-unit");
  const char *path = NULL;
  if (sd_bus_message_read(reply, "o", &path) <= 0 || !path) fail("capture-path");
  char *copy = strdup(path);
  if (!copy) fail("memory");
  sd_bus_message_unref(reply);
  return copy;
}
/* An active per-instance slice survives service teardown, including dying child cgroups. */
static void retained_slice(sd_bus *bus, const char *slice, const char *cgroup) {
  char *object = unit_path(bus, slice);
  char *name = property(bus, object, unit_interface, "Id");
  char *group = property(bus, object, "org.freedesktop.systemd1.Slice", "ControlGroup");
  char *state = property(bus, object, unit_interface, "ActiveState");
  int automatic_stop = 1;
  if (sd_bus_get_property_trivial(bus, destination, object, unit_interface, "StopWhenUnneeded",
                                  NULL, 'b', &automatic_stop) < 0 || automatic_stop ||
      strcmp(name, slice) || strcmp(group, cgroup) || strcmp(state, "active")) fail("retained-slice");
  free(object); free(name); free(group); free(state);
}
static char *lookup_original(sd_bus *bus, const uint8_t id[16], int wait_only) {
  sd_bus_message *request = NULL, *reply = NULL;
  if (sd_bus_message_new_method_call(bus, &request, destination, manager,
      "org.freedesktop.systemd1.Manager", "GetUnitByInvocationID") < 0 ||
      sd_bus_message_append_array(request, 'y', id, 16) < 0 ||
      sd_bus_call(bus, request, 5000000, NULL, &reply) < 0) {
    sd_bus_message_unref(request); sd_bus_message_unref(reply);
    if (wait_only) return NULL;
    fail("original-invocation");
  }
  const char *path = NULL;
  if (sd_bus_message_read(reply, "o", &path) <= 0 || !path) fail("invocation-path");
  char *copy = strdup(path);
  if (!copy) fail("memory");
  sd_bus_message_unref(request);
  sd_bus_message_unref(reply);
  return copy;
}
static char *original(sd_bus *bus, const uint8_t id[16]) { return lookup_original(bus, id, 0); }
static int scope_directory(const char *path, struct stat *info) {
  int directory = open(path, O_RDONLY | O_DIRECTORY | O_NOFOLLOW | O_CLOEXEC);
  struct statvfs mount;
  struct statfs filesystem;
  if (directory < 0 || fstat(directory, info) || info->st_uid != 0 ||
      fstatvfs(directory, &mount) || !(mount.f_flag & ST_RDONLY) ||
      fstatfs(directory, &filesystem) || filesystem.f_type != CGROUP2_SUPER_MAGIC)
    fail("scope-object");
  return directory;
}

static void read_at(int directory, const char *name, char *buffer, size_t capacity) {
  int fd = openat(directory, name, O_RDONLY | O_CLOEXEC | O_NOFOLLOW);
  if (fd < 0) fail("observation-open");
  size_t used = 0;
  for (;;) {
    char extra;
    ssize_t n = read(fd, used < capacity - 1 ? buffer + used : &extra,
                     used < capacity - 1 ? capacity - used - 1 : 1);
    if (n < 0 && errno == EINTR) continue;
    if (n < 0 || (n > 0 && used == capacity - 1)) fail("observation-size");
    if (!n) break;
    used += (size_t)n;
  }
  close(fd);
  buffer[used] = 0;
  if (!used) fail("observation-empty");
}

static void current_invocation(sd_bus *bus, const char *unit, uint8_t id[16]) {
  char *path = unit_path(bus, unit);
  sd_bus_message *value = NULL;
  if (sd_bus_get_property(bus, destination, path, unit_interface, "InvocationID",
                          NULL, &value, "ay") < 0) fail("capture-invocation");
  const void *bytes = NULL;
  size_t size = 0;
  if (sd_bus_message_read_array(value, 'y', &bytes, &size) <= 0 || size != 16)
    fail("capture-invocation");
  memcpy(id, bytes, 16);
  int any = 0;
  for (size_t i = 0; i < 16; i++) any |= id[i];
  if (!any) fail("capture-invocation");
  sd_bus_message_unref(value);
  free(path);
}

static uint32_t main_pid(sd_bus *bus, const char *object) {
  uint32_t pid = 0;
  if (sd_bus_get_property_trivial(bus, destination, object,
      "org.freedesktop.systemd1.Service", "MainPID", NULL, 'u', &pid) < 0 ||
      pid <= 1 || pid > INT32_MAX) fail("capture-pid");
  return pid;
}

static uint64_t birth(int process) {
  char text[4096];
  read_at(process, "stat", text, sizeof(text));
  char *end = strrchr(text, ')');
  if (!end || end[1] != ' ') fail("capture-birth");
  char *cursor = end + 2, *save = NULL, *token = strtok_r(cursor, " ", &save);
  for (int field = 3; field < 22; field++) {
    if (!token || (field == 3 && (*token == 'Z' || *token == 'X'))) fail("capture-birth");
    token = strtok_r(NULL, " ", &save);
  }
  if (!token) fail("capture-birth");
  uint64_t value = number(token);
  if (!value) fail("capture-birth");
  return value;
}

static uint32_t account(const char *text, const char *field) {
  const char *line = strstr(text, field);
  uint64_t values[4];
  char extra;
  if (!line || (line != text && line[-1] != '\n')) fail("capture-account");
  line += strlen(field);
  if (sscanf(line, "%" SCNu64 " %" SCNu64 " %" SCNu64 " %" SCNu64 "%c",
             &values[0], &values[1], &values[2], &values[3], &extra) != 5 || extra != '\n' ||
      !values[0] || values[0] >= UINT32_MAX || values[0] != values[1] ||
      values[0] != values[2] || values[0] != values[3]) fail("capture-account");
  return (uint32_t)values[0];
}

static uint64_t limit(int directory, const char *file) {
  char text[64];
  read_at(directory, file, text, sizeof(text));
  size_t size = strlen(text);
  if (text[size - 1] != '\n') fail("capture-limit");
  text[size - 1] = 0;
  return number(text);
}

/* Observations alone never authorize a gate or assert a no-migration policy. */
static void capture(sd_bus *bus, const char *unit, const char *slice, const char *cgroup,
                    const char *child, const char *path) {
  uint8_t id[16];
  current_invocation(bus, unit, id);
  char *object = original(bus, id);
  char *name = property(bus, object, unit_interface, "Id");
  char *group = property(bus, object, "org.freedesktop.systemd1.Service", "ControlGroup");
  char *parent = property(bus, object, "org.freedesktop.systemd1.Service", "Slice");
  if (strcmp(name, unit) || strcmp(group, child) || strcmp(parent, slice)) fail("scope-binding");
  free(parent);
  free(name); free(group);
  retained_slice(bus, slice, cgroup);
  struct stat info;
  int directory = scope_directory(path, &info);
  if (empty(directory) != 0) fail("scope-object");
  uint32_t pid = main_pid(bus, object);
  char proc_path[64];
  snprintf(proc_path, sizeof(proc_path), "/proc/%" PRIu32, pid);
  int process = open(proc_path, O_RDONLY | O_DIRECTORY | O_NOFOLLOW | O_CLOEXEC);
  if (process < 0) fail("capture-process");
  uint64_t started = birth(process);
  char status[8192], membership[512], boot_id[38], cpu[128];
  read_at(process, "status", status, sizeof(status));
  uint32_t uid = account(status, "Uid:"), gid = account(status, "Gid:");
  read_at(process, "cgroup", membership, sizeof(membership));
  char wanted[512];
  snprintf(wanted, sizeof(wanted), "0::%s\n", child);
  if (strcmp(membership, wanted)) fail("capture-membership");
  read_at(AT_FDCWD, "/proc/sys/kernel/random/boot_id", boot_id, sizeof(boot_id));
  if (strlen(boot_id) != 37 || boot_id[36] != '\n') fail("boot");
  boot_id[36] = 0;
  uuid(boot_id);
  read_at(directory, "cpu.max", cpu, sizeof(cpu));
  uint64_t quota, period;
  char extra;
  if (sscanf(cpu, "%" SCNu64 " %" SCNu64 "%c", &quota, &period, &extra) != 3 ||
      extra != '\n' || !quota || !period) fail("capture-cpu");
  uint64_t memory = limit(directory, "memory.max"), swap = limit(directory, "memory.swap.max"),
           tasks = limit(directory, "pids.max");
  if (!memory || !tasks) fail("capture-limit");
  /* Recheck the original invocation, process and pinned scope before returning one observation. */
  char *still_original = original(bus, id);
  struct stat current;
  if (strcmp(object, still_original) || main_pid(bus, object) != pid ||
      birth(process) != started || lstat(path, &current) ||
      current.st_dev != info.st_dev || current.st_ino != info.st_ino || empty(directory) != 0)
    fail("capture-changed");
  boot(boot_id);
  retained_slice(bus, slice, cgroup);
  char invocation_id[33];
  for (size_t i = 0; i < 16; i++) snprintf(invocation_id + i * 2, 3, "%02x", id[i]);
  printf("{\"scope\":{\"bootId\":\"%s\",\"invocationId\":\"%s\",\"dev\":\"%ju\",\"ino\":\"%ju\","
         "\"controllerPid\":%" PRIu32 ",\"controllerBirth\":\"%" PRIu64 "\"},"
         "\"runtimeUid\":%" PRIu32 ",\"runtimeGid\":%" PRIu32 ","
         "\"limits\":{\"cpuQuota\":\"%" PRIu64 "\",\"cpuPeriod\":\"%" PRIu64 "\","
         "\"memoryBytes\":\"%" PRIu64 "\",\"swapBytes\":\"%" PRIu64 "\",\"tasks\":\"%" PRIu64 "\"}}\n",
         boot_id, invocation_id, (uintmax_t)info.st_dev, (uintmax_t)info.st_ino, pid, started,
         uid, gid, quota, period, memory, swap, tasks);
  close(process); close(directory);
  free(still_original); free(object);
}

int main(int argc, char **argv) {
  int check = argc == 2 && !strcmp(argv[1], "--check");
  int observe = argc == 4 && !strcmp(argv[1], "--capture");
  int inspect = argc == 4 && !strcmp(argv[1], "--parent");
  int recover = argc == 7 && !strcmp(argv[1], "--recover");
  int empty_only = argc == 7 && !strcmp(argv[1], "--empty");
  if (!check && !observe && !inspect && !recover && !empty_only &&
      (argc != 9 || strcmp(argv[1], "--kill"))) fail("arguments");
  uint8_t id[16];
  char unit[160], slice[128], cgroup[192], child[384], path[224];
  uint64_t device = 0, inode = 0, wait = 0;
  if (!check) {
    if (geteuid() != 0) fail("manager-identity");
    uuid(argv[2]); uuid(argv[3]);
    if (!observe && !inspect) {
      uuid(argv[4]);
      if (!recover && !empty_only) {
        invocation(argv[5], id);
        device = number(argv[6]); inode = number(argv[7]); wait = number(argv[8]);
        if (!inode || !wait || wait > 10000) fail("limits");
      }
      boot(argv[4]);
      if (recover || empty_only) {
        device = number(argv[5]); inode = number(argv[6]);
        if (!inode) fail("limits");
        wait = 10000;
      }
    }
    snprintf(unit, sizeof(unit), "scholoom-report-%s-v1@%s.service", argv[2], argv[3]);
    char identity[65];
    size_t at = 0;
    for (int arg = 2; arg <= 3; arg++)
      for (const char *p = argv[arg]; *p; p++) if (*p != '-') identity[at++] = *p;
    identity[at] = 0;
    snprintf(slice, sizeof(slice), "system-scholoomreport%s.slice", identity);
    snprintf(cgroup, sizeof(cgroup), "/system.slice/%s", slice);
    snprintf(child, sizeof(child), "%s/%s", cgroup, unit);
    snprintf(path, sizeof(path), "/sys/fs/cgroup%s", cgroup);
  }
  // Neither caller environment nor a report can redirect the system bus connection.
  if (clearenv()) fail("environment");
  sd_bus *bus = NULL;
  if (sd_bus_open_system(&bus) < 0 || sd_bus_set_method_call_timeout(bus, 5000000) < 0) fail("system-bus");
  if (check) {
    // PID1 defines the zero ID as a read-only lookup of the caller's own unit.
    const uint8_t self[16] = {0};
    char *object = original(bus, self);
    free(object);
    sd_bus_unref(bus);
    puts("available");
    return 0;
  }
  if (observe) {
    capture(bus, unit, slice, cgroup, child, path);
    sd_bus_unref(bus);
    return 0;
  }
  if (inspect) {
    retained_slice(bus, slice, cgroup);
    struct stat info, current;
    int directory = scope_directory(path, &info);
    if (empty(directory) != 1 || lstat(path, &current) ||
        current.st_dev != info.st_dev || current.st_ino != info.st_ino) fail("scope-changed");
    char boot_id[38];
    read_at(AT_FDCWD, "/proc/sys/kernel/random/boot_id", boot_id, sizeof(boot_id));
    if (strlen(boot_id) != 37 || boot_id[36] != '\n') fail("boot");
    boot_id[36] = 0; uuid(boot_id); boot(boot_id);
    printf("{\"bootId\":\"%s\",\"dev\":\"%ju\",\"ino\":\"%ju\"}\n",
           boot_id, (uintmax_t)info.st_dev, (uintmax_t)info.st_ino);
    close(directory);
    sd_bus_unref(bus);
    return 0;
  }
  retained_slice(bus, slice, cgroup);
  /* M's verified no-migration/no-restart template is required: D-Bus supplies no external inode CAS. */
  struct stat info;
  int directory = scope_directory(path, &info);
  if ((uint64_t)info.st_dev != device || (uint64_t)info.st_ino != inode)
    fail("scope-object");
  if (empty(directory) != 1) {
    if (empty_only) fail("stop-unconfirmed");
    // Without an original invocation, recovery can only wait on its saved original parent.
    char *object = recover ? NULL : lookup_original(bus, id, 1);
    if (object) {
      char *name = property(bus, object, unit_interface, "Id");
      char *group = property(bus, object, "org.freedesktop.systemd1.Service", "ControlGroup");
      char *parent = property(bus, object, "org.freedesktop.systemd1.Service", "Slice");
      if (strcmp(name, unit) || (*group && strcmp(group, child)) || strcmp(parent, slice)) fail("scope-binding");
      // Invocation-addressed Kill is handled immediately; an asynchronous name-based stop job is insufficient.
      sd_bus_message *reply = NULL;
      if (*group && sd_bus_call_method(bus, destination, object, unit_interface, "Kill", NULL, &reply,
          "si", "all", SIGKILL) < 0) fail("kill-original");
      sd_bus_message_unref(reply);
      free(object);
      free(name); free(group); free(parent);
    }
  }
  uint64_t deadline = milliseconds() + wait;
  for (;;) {
    int state = empty(directory);
    if (state == 1) break;
    // Removal alone does not become a stop receipt; leave this uncertain for C to reconcile.
    if (state < 0 || milliseconds() >= deadline) fail("stop-unconfirmed");
    struct timespec pause = {.tv_nsec = 10000000};
    while (nanosleep(&pause, &pause) && errno == EINTR) {}
  }
  boot(argv[4]);
  retained_slice(bus, slice, cgroup);
  struct stat current;
  if (lstat(path, &current) || current.st_dev != info.st_dev || current.st_ino != info.st_ino)
    fail("scope-changed");
  close(directory);
  sd_bus_unref(bus);
  puts("stopped");
  return 0;
}

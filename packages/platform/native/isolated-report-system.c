/* PID1 supplies fixed named descriptors; C's sealed manifest binds their original objects. */
#define main report_user_scope_main
#include "isolated-report-scope.c"
#undef main
#include <systemd/sd-json.h>

static sd_json_variant *field(sd_json_variant *object, const char *name) {
  sd_json_variant *value = sd_json_variant_by_key(object, name);
  if (!value) fail("manifest-field");
  return value;
}
static const char *string_field(sd_json_variant *object, const char *name) {
  sd_json_variant *value = field(object, name);
  if (!sd_json_variant_is_string(value)) fail("manifest-string");
  return sd_json_variant_string(value);
}
static int same_stamp(int fd, const char *stamp, uid_t owner) {
  struct stat info;
  unsigned long long dev, ino, size, mtime, ctime;
  char extra;
  return fd >= 0 && !fstat(fd, &info) && S_ISREG(info.st_mode) &&
      info.st_uid == owner && info.st_nlink == 1 && (info.st_mode & 0777) == 0400 &&
      (fcntl(fd, F_GETFL) & O_ACCMODE) == O_RDONLY &&
      sscanf(stamp, "%llu:%llu:%llu:%llu:%llu%c", &dev, &ino, &size, &mtime, &ctime, &extra) == 5 &&
      dev == (unsigned long long)info.st_dev && ino == (unsigned long long)info.st_ino &&
      size == (unsigned long long)info.st_size &&
      mtime == (unsigned long long)info.st_mtim.tv_sec * 1000000000ULL + info.st_mtim.tv_nsec &&
      ctime == (unsigned long long)info.st_ctim.tv_sec * 1000000000ULL + info.st_ctim.tv_nsec;
}
static void bound_file(int fd, sd_json_variant *expected, uid_t owner, int type, int access) {
  struct stat info;
  if (fstat(fd, &info) || (info.st_mode & S_IFMT) != (mode_t)type ||
      info.st_uid != owner || info.st_nlink != 1 || (info.st_mode & 0777) != 0600 ||
      (fcntl(fd, F_GETFL) & O_ACCMODE) != access ||
      (unsigned long long)info.st_dev != number(string_field(expected, "dev")) ||
      (unsigned long long)info.st_ino != number(string_field(expected, "ino")))
    fail("manifest-object");
}

int main(int argc, char **argv) {
  int node = argc == 9 && !strcmp(argv[8], "--node");
  if ((!node && argc != 8) || getuid() == 0 || getuid() != geteuid()) fail("system-entry");
  unsigned long long owner = number(argv[3]), output = number(argv[5]), grace = number(argv[6]);
  /* The final argument binds this invocation's fixed service name; it is not a command. */
  char unit[160];
  snprintf(unit, sizeof(unit), "scholoom-report-%s-v1@%s.service", argv[1], argv[2]);
  if (!owner || owner >= UINT32_MAX || !output || grace > 10000 || strcmp(unit, argv[7]))
    fail("system-binding");
  const char *listen_pid = getenv("LISTEN_PID"), *listen_fds = getenv("LISTEN_FDS");
  const char *listen_names = getenv("LISTEN_FDNAMES");
  if (!listen_pid || number(listen_pid) != (unsigned long long)getpid() || !listen_fds || !listen_names)
    fail("system-descriptors");
  unsigned long long count = number(listen_fds);
  if (count < 5 || count > (node ? 47 : 37)) fail("system-descriptors");
  char *names = strdup(listen_names), *save = NULL;
  if (!names) fail("memory");
  int manifest_fd = -1, events_fd = -1;
  struct report_system_source provided = {.owner = (uid_t)owner, .node = node};
  for (unsigned i = 0; i < 35; i++) provided.inputs[i] = -1;
  for (unsigned i = 0; i < 8; i++) provided.runtime[i] = -1;
  provided.data[0] = provided.data[1] = -1;
  unsigned used = 0;
  for (char *name = strtok_r(names, ":", &save); name; name = strtok_r(NULL, ":", &save)) {
    if (used >= count) fail("system-descriptors");
    int fd = 3 + (int)used++, *slot;
    if (!strcmp(name, "manifest")) slot = &manifest_fd;
    else if (!strcmp(name, "events")) slot = &events_fd;
    else if (!strcmp(name, "program")) slot = &provided.inputs[0];
    else if (!strcmp(name, "gate")) slot = &provided.inputs[1];
    else if (node && !strcmp(name, "renderInput")) slot = &provided.data[0];
    else if (node && !strcmp(name, "renderOutput")) slot = &provided.data[1];
    else {
      unsigned index;
      char extra;
      if (node && sscanf(name, "runtime%u%c", &index, &extra) == 1 && index < 8) {
        slot = &provided.runtime[index];
      } else {
      if (sscanf(name, "asset%u%c", &index, &extra) != 1 || index >= 33) fail("descriptor-name");
      slot = &provided.inputs[index + 2];
      }
    }
    if (*slot != -1) fail("descriptor-duplicate");
    *slot = fd;
  }
  free(names);
  if (used != count || manifest_fd < 0 || events_fd < 0 || !same_stamp(manifest_fd, argv[4], (uid_t)owner))
    fail("manifest-binding");
  struct stat info;
  if (fstat(manifest_fd, &info) || info.st_size < 2 || info.st_size > 65536) fail("manifest-size");
  char *text = calloc((size_t)info.st_size + 1, 1);
  if (!text) fail("memory");
  size_t at = 0;
  while (at < (size_t)info.st_size) {
    ssize_t n = pread(manifest_fd, text + at, (size_t)info.st_size - at, (off_t)at);
    if (n < 0 && errno == EINTR) continue;
    if (n <= 0) fail("manifest-read");
    at += (size_t)n;
  }
  sd_json_variant *manifest = NULL;
  if (memchr(text, 0, at) || !same_stamp(manifest_fd, argv[4], (uid_t)owner) ||
      sd_json_parse(text, 0, &manifest, NULL, NULL) < 0) fail("manifest-json");
  free(text);
  close(manifest_fd);
  if (sd_json_variant_unsigned(field(manifest, "version")) != 1 ||
      sd_json_variant_unsigned(field(manifest, "ownerUid")) != owner ||
      strcmp(string_field(manifest, "configId"), argv[1]) ||
      strcmp(string_field(manifest, "storageId"), argv[2])) fail("manifest-identity");
  sd_json_variant *stage = field(manifest, "stage"), *assets = field(stage, "assets"),
                  *stamps = field(manifest, "stamps"), *arguments = field(manifest, "args"),
                  *sealed = field(manifest, "sealed"), *files = field(manifest, "files");
  size_t n_assets = sd_json_variant_elements(assets), n_args = sd_json_variant_elements(arguments);
  if (!sd_json_variant_is_array(assets) || !sd_json_variant_is_array(stamps) ||
      !sd_json_variant_is_array(arguments) || n_assets < 1 || n_assets > 33 ||
      sd_json_variant_elements(stamps) != n_assets || n_args > 16 || count != n_assets + 4 + (node ? 10 : 0))
    fail("manifest-arrays");
  for (unsigned i = 0; i < n_assets + 2; i++) if (provided.inputs[i] < 0) fail("descriptor-missing");
  bound_file(0, field(files, "permit"), (uid_t)owner, S_IFIFO, O_RDONLY);
  bound_file(1, field(files, "stdout"), (uid_t)owner, S_IFREG, O_WRONLY);
  bound_file(2, field(files, "stderr"), (uid_t)owner, S_IFREG, O_WRONLY);
  bound_file(events_fd, field(files, "events"), (uid_t)owner, S_IFREG, O_RDWR);
  sd_json_variant *runtime = sd_json_variant_by_key(manifest, "node");
  if (!!runtime != !!node) fail("runtime-profile");
  if (node) {
    sd_json_variant *runtime_files = field(runtime, "files");
    if (!sd_json_variant_is_array(runtime_files) || sd_json_variant_elements(runtime_files) != 8)
      fail("runtime-files");
    bound_file(provided.data[0], field(runtime, "input"), (uid_t)owner, S_IFIFO, O_RDONLY);
    bound_file(provided.data[1], field(runtime, "output"), (uid_t)owner, S_IFIFO, O_RDWR);
    for (unsigned i = 0; i < 2; i++) {
      int moved = fcntl(provided.data[i], F_DUPFD_CLOEXEC, 200);
      if (moved < 0) fail("runtime-pipe");
      close(provided.data[i]); provided.data[i] = moved;
    }
    unsigned nodes = 0;
    for (unsigned i = 0; i < 8; i++) {
      sd_json_variant *file = sd_json_variant_by_index(runtime_files, i);
      const char *target = string_field(file, "target");
      if (*target != '/' || !safe_path(target + 1) ||
          (strcmp(target, "/runtime/node") && strncmp(target, "/lib/", 5) && strncmp(target, "/lib64/", 7)))
        fail("runtime-target");
      if (!strcmp(target, "/runtime/node")) nodes++;
      for (unsigned j = 0; j < i; j++)
        if (!strcmp(target, provided.runtime_paths[j])) fail("runtime-duplicate");
      if (provided.runtime[i] < 0) fail("runtime-missing");
      provided.runtime_paths[i] = target;
      provided.runtime_stamps[i] = string_field(file, "stamp");
    }
    if (nodes != 1) fail("runtime-node");
  }
  provided.out = dup(1); provided.err = dup(2); provided.count = (unsigned)n_assets;
  if (provided.out < 0 || provided.err < 0 || dup2(events_fd, 1) < 0 || dup2(events_fd, 2) < 0)
    fail("event-sink");
  close(events_fd);
  char assets_count[16], args_count[16];
  snprintf(assets_count, sizeof(assets_count), "%zu", n_assets);
  snprintf(args_count, sizeof(args_count), "%zu", n_args);
  char *legacy[100] = {argv[0], "", "0", "0", unit, "1", "1", "0", "1", argv[5], argv[6],
                      assets_count, args_count, (char *)string_field(stage, "entryPath"),
                      (char *)string_field(sealed, "program"), (char *)string_field(sealed, "gate")};
  size_t n = 16;
  for (unsigned i = 0; i < n_assets; i++) {
    sd_json_variant *stamp = sd_json_variant_by_index(stamps, i);
    if (!sd_json_variant_is_string(stamp)) fail("manifest-stamp");
    legacy[n++] = (char *)string_field(sd_json_variant_by_index(assets, i), "path");
    legacy[n++] = (char *)sd_json_variant_string(stamp);
  }
  for (unsigned i = 0; i < n_args; i++) {
    sd_json_variant *arg = sd_json_variant_by_index(arguments, i);
    if (!sd_json_variant_is_string(arg) || strlen(sd_json_variant_string(arg)) > 512) fail("manifest-argument");
    legacy[n++] = (char *)sd_json_variant_string(arg);
  }
  system_source = &provided;
  if (clearenv()) fail("environment");
  int result = report_user_scope_main((int)n, legacy);
  sd_json_variant_unref(manifest);
  return result;
}

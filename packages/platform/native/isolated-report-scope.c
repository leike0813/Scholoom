/* Linux-only controller: every untrusted descriptor and executable is fixed before the gate. */
#define _GNU_SOURCE
#include <errno.h>
#include <fcntl.h>
#include <linux/audit.h>
#include <linux/filter.h>
#include <linux/memfd.h>
#include <linux/seccomp.h>
#include <poll.h>
#include <signal.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/prctl.h>
#include <sys/ptrace.h>
#include <sys/mman.h>
#include <sys/resource.h>
#include <sys/stat.h>
#include <sys/syscall.h>
#include <sys/wait.h>
#include <sys/file.h>
#include <limits.h>
#include <time.h>
#include <unistd.h>
#include <stddef.h>
#if !defined(__x86_64__)
#error Only the calibrated Linux x86_64 policy is supported
#endif

static volatile sig_atomic_t stopping;
static int root_failure;
static pid_t payload_pid = -1;
static int exec_seen;
static int command_sent;
static int payload_ended;

static void stop_signal(int n) {
  (void)n;
  stopping = 1;
}

static void wake(int n) {
  (void)n;
}

static void fail(const char *stage) {
  fprintf(stderr, "{\"stage\":\"%s\",\"errno\":%d}\n", stage, errno);
  exit(120);
}

static unsigned long long number(const char *s) {
  char *end;
  errno = 0;
  unsigned long long n = strtoull(s, &end, 10);
  if (errno || !*s || *end)
    fail("number");
  return n;
}

static void text(const char *path, char *out, size_t size) {
  FILE *f = fopen(path, "r");
  if (!f)
    fail("readback");
  size_t n = fread(out, 1, size - 1, f);
  out[n] = 0;
  fclose(f);
  out[strcspn(out, "\n")] = 0;
}

static void limits(const char *unit, const char **wanted) {
  char group[4096], path[8192], value[128];
  text("/proc/self/cgroup", group, sizeof(group));
  if (strncmp(group, "0::", 3) || strlen(group) <= strlen(unit) ||
      strcmp(group + strlen(group) - strlen(unit), unit)) {
    errno = EPERM;
    fail("scope");
  }
  const char *names[] = {
    "cpu.max", "memory.max", "memory.swap.max", "pids.max"
  };
  for (int i = 0; i < 4; i++) {
    snprintf(path, sizeof(path), "/sys/fs/cgroup%s/%s", group + 3, names[i]);
    text(path, value, sizeof(value));
    if (strcmp(value, wanted[i])) {
      errno = EPERM;
      fail("limit");
    }
  }
  printf("{\"event\":\"armed\",\"pid\":%ld}\n", (long)getpid());
  fflush(stdout);
}

static int snapshot(int directory, const char *name, const char *stamp) {
  int source = openat(directory, name, O_RDONLY | O_CLOEXEC | O_NOFOLLOW);
  struct stat before, after;
  unsigned long long dev, ino, size, mtime, ctime;
  if (source < 0 || fstat(source, &before) < 0 || !S_ISREG(before.st_mode) ||
      before.st_nlink != 1 || before.st_uid != getuid() ||
      sscanf(stamp, "%llu:%llu:%llu:%llu:%llu", &dev, &ino, &size, &mtime, &ctime) != 5 ||
      dev != (unsigned long long)before.st_dev ||
      ino != (unsigned long long)before.st_ino ||
      size != (unsigned long long)before.st_size ||
      mtime != (unsigned long long)before.st_mtim.tv_sec * 1000000000ULL +
                 (unsigned long long)before.st_mtim.tv_nsec ||
      ctime != (unsigned long long)before.st_ctim.tv_sec * 1000000000ULL +
                 (unsigned long long)before.st_ctim.tv_nsec) {
    errno = ESTALE;
    fail("input");
  }
  int fd = memfd_create("isolated-bytes", MFD_CLOEXEC | MFD_ALLOW_SEALING);
  if (fd < 0)
    fail("memfd");
  char buffer[65536];
  unsigned long long copied = 0;
  for (;;) {
    ssize_t n = read(source, buffer, sizeof(buffer));
    if (n < 0 && errno == EINTR)
      continue;
    if (n < 0)
      fail("input-read");
    if (!n)
      break;
    copied += (unsigned long long)n;
    if (copied > size)
      fail("input-size");
    ssize_t at = 0;
    while (at < n) {
      ssize_t wrote = write(fd, buffer + at, (size_t)(n - at));
      if (wrote <= 0)
        fail("snapshot-write");
      at += wrote;
    }
  }
  if (copied != size || fstat(source, &after) < 0 ||
      before.st_mtim.tv_sec != after.st_mtim.tv_sec ||
      before.st_mtim.tv_nsec != after.st_mtim.tv_nsec ||
      before.st_ctim.tv_sec != after.st_ctim.tv_sec ||
      before.st_ctim.tv_nsec != after.st_ctim.tv_nsec ||
      before.st_size != after.st_size)
    fail("input-changed");
  close(source);
  if (lseek(fd, 0, SEEK_SET) < 0 || fchmod(fd, 0555) < 0 ||
      fcntl(fd, F_ADD_SEALS,
            F_SEAL_WRITE | F_SEAL_GROW | F_SEAL_SHRINK | F_SEAL_SEAL) < 0)
    fail("seal");
  return fd;
}

#define DENY (SECCOMP_RET_ERRNO|EACCES)
#define ALLOW(n) BPF_JUMP(BPF_JMP|BPF_JEQ|BPF_K,n,0,1),BPF_STMT(BPF_RET|BPF_K,SECCOMP_RET_ALLOW)

static int policy(void) {
  struct sock_filter code[] = {
    BPF_STMT(BPF_LD | BPF_W | BPF_ABS, offsetof(struct seccomp_data, arch)),
    BPF_JUMP(BPF_JMP | BPF_JEQ | BPF_K, AUDIT_ARCH_X86_64, 1, 0),
    BPF_STMT(BPF_RET | BPF_K, SECCOMP_RET_KILL_PROCESS),
    BPF_STMT(BPF_LD | BPF_W | BPF_ABS, offsetof(struct seccomp_data, nr)),

    BPF_JUMP(BPF_JMP | BPF_JEQ | BPF_K, __NR_read, 0, 5),
    BPF_STMT(BPF_LD | BPF_W | BPF_ABS, offsetof(struct seccomp_data, args[0])),
    BPF_JUMP(BPF_JMP | BPF_JEQ | BPF_K, 0, 1, 0),
    BPF_JUMP(BPF_JMP | BPF_JEQ | BPF_K, 3, 0, 1),
    BPF_STMT(BPF_RET | BPF_K, SECCOMP_RET_ALLOW),
    BPF_STMT(BPF_RET | BPF_K, DENY),

    BPF_JUMP(BPF_JMP | BPF_JEQ | BPF_K, __NR_write, 0, 6),
    BPF_STMT(BPF_LD | BPF_W | BPF_ABS, offsetof(struct seccomp_data, args[0])),
    BPF_JUMP(BPF_JMP | BPF_JEQ | BPF_K, 1, 2, 0),
    BPF_JUMP(BPF_JMP | BPF_JEQ | BPF_K, 2, 1, 0),
    BPF_JUMP(BPF_JMP | BPF_JEQ | BPF_K, 100, 0, 1),
    BPF_STMT(BPF_RET | BPF_K, SECCOMP_RET_ALLOW),
    BPF_STMT(BPF_RET | BPF_K, DENY),

    BPF_JUMP(BPF_JMP | BPF_JEQ | BPF_K, __NR_openat, 0, 7),
    BPF_STMT(BPF_LD | BPF_W | BPF_ABS, offsetof(struct seccomp_data, args[0])),
    BPF_JUMP(BPF_JMP | BPF_JEQ | BPF_K, (unsigned)AT_FDCWD, 0, 4),
    BPF_STMT(BPF_LD | BPF_W | BPF_ABS, offsetof(struct seccomp_data, args[2])),
    BPF_JUMP(BPF_JMP | BPF_JEQ | BPF_K, 0, 1, 0),
    BPF_JUMP(BPF_JMP | BPF_JEQ | BPF_K, O_CLOEXEC, 0, 1),
    BPF_STMT(BPF_RET | BPF_K, SECCOMP_RET_ALLOW),
    BPF_STMT(BPF_RET | BPF_K, DENY),

    BPF_JUMP(BPF_JMP | BPF_JEQ | BPF_K, __NR_fcntl, 0, 9),
    BPF_STMT(BPF_LD | BPF_W | BPF_ABS, offsetof(struct seccomp_data, args[0])),
    BPF_JUMP(BPF_JMP | BPF_JEQ | BPF_K, 100, 0, 6),
    BPF_STMT(BPF_LD | BPF_W | BPF_ABS, offsetof(struct seccomp_data, args[1])),
    BPF_JUMP(BPF_JMP | BPF_JEQ | BPF_K, F_SETFD, 0, 4),
    BPF_STMT(BPF_LD | BPF_W | BPF_ABS, offsetof(struct seccomp_data, args[2])),
    BPF_JUMP(BPF_JMP | BPF_JEQ | BPF_K, FD_CLOEXEC, 0, 2),
    BPF_STMT(BPF_RET | BPF_K, SECCOMP_RET_ALLOW),
    BPF_STMT(BPF_RET | BPF_K, DENY),
    BPF_STMT(BPF_RET | BPF_K, DENY),

    ALLOW(__NR_execve),
    ALLOW(__NR_close),
    ALLOW(__NR_getpid),
    ALLOW(__NR_fork),
    ALLOW(__NR_setsid),
    ALLOW(__NR_pause),
    ALLOW(__NR_wait4),
    ALLOW(__NR_exit),
    ALLOW(__NR_exit_group),
    ALLOW(__NR_rt_sigreturn),
    BPF_STMT(BPF_RET | BPF_K, DENY)
  };
  int fd = memfd_create("isolated-policy", MFD_CLOEXEC | MFD_ALLOW_SEALING);
  if (fd < 0 || write(fd, code, sizeof(code)) != (ssize_t)sizeof(code) ||
      lseek(fd, 0, SEEK_SET) < 0 ||
      fcntl(fd, F_ADD_SEALS,
            F_SEAL_WRITE | F_SEAL_GROW | F_SEAL_SHRINK | F_SEAL_SEAL) < 0)
    fail("policy");
  return fd;
}

static int children(pid_t root, int force) {
  int status;
  for (unsigned i = 0; i < 4096; i++) {
    pid_t r = waitpid(-1, &status, WNOHANG | __WALL);
    if (r > 0 && r == payload_pid && WIFSTOPPED(status)) {
      if ((unsigned)status >> 16 == PTRACE_EVENT_EXEC) {
        if (!command_sent) { errno = EPERM; fail("unexpected-exec"); }
        if (!exec_seen) {
          exec_seen = 1;
          puts("{\"event\":\"running\"}");
          fflush(stdout);
        }
        if (ptrace(PTRACE_CONT, r, NULL, NULL) < 0) fail("exec-continue");
      } else {
        int signal = WSTOPSIG(status);
        if (ptrace(PTRACE_CONT, r, NULL, (void *)(long)signal) < 0 && errno != ESRCH) fail("signal-continue");
      }
      continue;
    }
    if (r > 0 && r == payload_pid && (WIFEXITED(status) || WIFSIGNALED(status))) {
      root_failure |= !WIFEXITED(status) || WEXITSTATUS(status) != 0;
      stopping = 1;
      payload_ended = 1;
    }
    if (r == root) {
      root_failure |= !WIFEXITED(status) || WEXITSTATUS(status) != 0;
      stopping = 1;
    }
    if (r < 0)
      return errno == ECHILD;
    if (!r)
      break;
  }
  if (force) {
    char path[96];
    snprintf(path, sizeof(path), "/proc/self/task/%ld/children", (long)getpid());
    FILE *f = fopen(path, "r");
    if (!f)
      fail("children");
    long pid;
    unsigned n = 0;
    while (n++ < 4096 && fscanf(f, "%ld", &pid) == 1)
      if (pid > 0 && kill((pid_t)pid, SIGKILL) < 0 && errno != ESRCH)
        fail("child-stop");
    if (ferror(f))
      fail("children-read");
    fclose(f);
  }
  return 0;
}

static int safe_path(const char *s) {
  if (!*s || *s == '/' || strlen(s) > 512)
    return 0;
  const char *p = s;
  while (*p) {
    const char *e = strchr(p, '/');
    size_t n = e ? (size_t)(e - p) : strlen(p);
    if (!n || (n == 1 && *p == '.') || (n == 2 && p[0] == '.' && p[1] == '.'))
      return 0;
    for (size_t i = 0; i < n; i++)
      if (p[i] == '\\' || p[i] == ':' || (unsigned char)p[i] < 32)
        return 0;
    if (!e)
      break;
    p = e + 1;
    if (!*p)
      return 0;
  }
  return 1;
}

/* Only trusted bwrap/gate code has run here. Pin the waiting gate before allowing exec. */
static int gate_watch(pid_t parent, unsigned depth) {
  if (depth > 8) {
    errno = E2BIG;
    fail("gate-depth");
  }
  char path[128];
  snprintf(path, sizeof(path), "/proc/%ld/task/%ld/children", (long)parent, (long)parent);
  FILE *f = fopen(path, "r");
  if (!f)
    fail("gate-children");
  long pid;
  unsigned count = 0;
  int found = -1;
  while (fscanf(f, "%ld", &pid) == 1) {
    if (++count > 4096) {
      errno = E2BIG;
      fail("gate-count");
    }
    char executable[4096];
    snprintf(path, sizeof(path), "/proc/%ld/exe", pid);
    ssize_t n = readlink(path, executable, sizeof(executable) - 1);
    if (n < 0) {
      if (errno == ENOENT)
        continue;
      fail("gate-executable");
    }
    executable[n] = 0;
    int candidate = -1;
    if (!strcmp(executable, "/gate")) {
      candidate = (int)syscall(SYS_pidfd_open, (pid_t)pid, 0);
      if (candidate < 0)
        fail("gate-pidfd");
      struct pollfd alive = {candidate, POLLIN, 0};
      if (poll(&alive, 1, 0) != 0) {
        errno = ESRCH;
        fail("gate-exited");
      }
      if (payload_pid != -1) { errno = EPERM; fail("gate-ambiguous"); }
      if (ptrace(PTRACE_SEIZE, (pid_t)pid, NULL, (void *)(long)(PTRACE_O_TRACEEXEC | PTRACE_O_EXITKILL)) < 0) fail("gate-trace");
      payload_pid = (pid_t)pid;
    } else
      candidate = gate_watch((pid_t)pid, depth + 1);
    if (candidate >= 0) {
      if (found >= 0) {
        errno = EPERM;
        fail("gate-ambiguous");
      }
      found = candidate;
    }
  }
  if (ferror(f))
    fail("gate-children-read");
  fclose(f);
  return found;
}

int main(int argc, char **argv) {
  if (argc == 7 && !strcmp(argv[1], "--settle")) {
    unsigned long long budget = number(argv[5]);
    if (budget > 10000 || strcmp(argv[6], "native-v1")) {
      errno = EPERM;
      fail("stop-policy");
    }
    if (strncmp(argv[2], "/sys/fs/cgroup/user.slice/", 26) ||
        !strstr(argv[2], "/scholoom-report-") || strstr(argv[2], "..")) {
      errno = EPERM;
      fail("stop-path");
    }
    int dirfd = open(argv[2], O_RDONLY | O_DIRECTORY | O_NOFOLLOW | O_CLOEXEC);
    struct stat identity;
    if (dirfd < 0 || fstat(dirfd, &identity) < 0 ||
        (unsigned long long)identity.st_dev != number(argv[3]) ||
        (unsigned long long)identity.st_ino != number(argv[4]))
      fail("stop-identity");
    int events = openat(dirfd, "cgroup.events", O_RDONLY | O_CLOEXEC | O_NOFOLLOW),
        stopfd = openat(dirfd, "cgroup.kill", O_WRONLY | O_CLOEXEC | O_NOFOLLOW);
    if (events < 0 || stopfd < 0 || write(stopfd, "1", 1) != 1)
      fail("stop-range");
    struct timespec start, now;
    clock_gettime(CLOCK_MONOTONIC, &start);
    for (;;) {
      char value[256];
      if (lseek(events, 0, SEEK_SET) < 0)
        fail("stop-read");
      ssize_t n = read(events, value, sizeof(value) - 1);
      if (n < 0)
        fail("stop-read");
      value[n] = 0;
      if (strstr(value, "populated 0\n")) {
        puts("stopped");
        return 0;
      }
      clock_gettime(CLOCK_MONOTONIC, &now);
      long elapsed = (now.tv_sec - start.tv_sec) * 1000 +
                     (now.tv_nsec - start.tv_nsec) / 1000000;
      if (elapsed >= (long)budget) {
        errno = ETIMEDOUT;
        fail("stop-unconfirmed");
      }
      struct pollfd change = {events, POLLPRI | POLLERR, 0};
      if (poll(&change, 1, (int)(budget - (unsigned long long)elapsed)) < 0 &&
          errno != EINTR)
        fail("stop-observe");
    }
  }
  if (argc == 3 && !strcmp(argv[1], "--lock")) {
    int fd = open(argv[2], O_RDWR | O_CREAT | O_NOFOLLOW | O_CLOEXEC, 0600);
    struct stat info;
    if (fd < 0 || fstat(fd, &info) < 0 || !S_ISREG(info.st_mode) ||
        info.st_nlink != 1 || info.st_uid != getuid() ||
        flock(fd, LOCK_EX | LOCK_NB) < 0)
      fail("lock");
    puts("locked");
    fflush(stdout);
    char byte;
    while (read(0, &byte, 1) < 0 && errno == EINTR) {}
    close(fd);
    return 0;
  }
  if (argc < 16)
    return 64;
  unsigned assets = (unsigned)number(argv[11]),
           arguments = (unsigned)number(argv[12]);
  if (assets < 1 || assets > 33 || arguments > 16 ||
      argc != 16 + (int)assets * 2 + (int)arguments || !safe_path(argv[13]))
    return 64;
  const char *wanted[4];
  char cpu[80];
  snprintf(cpu, sizeof(cpu), "%s 100000", argv[5]);
  wanted[0] = cpu;
  wanted[1] = argv[6];
  wanted[2] = argv[7];
  wanted[3] = argv[8];
  struct stat dir;
  int directory = open(argv[1], O_RDONLY | O_DIRECTORY | O_NOFOLLOW | O_CLOEXEC);
  if (directory < 0 || fstat(directory, &dir) < 0 || dir.st_uid != getuid() ||
      (unsigned long long)dir.st_dev != number(argv[2]) ||
      (unsigned long long)dir.st_ino != number(argv[3]))
    fail("directory");
  if (prctl(PR_SET_CHILD_SUBREAPER, 1L) < 0)
    fail("subreaper");
  pid_t parent = getppid();
  struct sigaction action = {.sa_handler = stop_signal},
                   notify = {.sa_handler = wake};
  sigemptyset(&action.sa_mask);
  sigemptyset(&notify.sa_mask);
  if (sigaction(SIGTERM, &action, NULL) < 0 ||
      sigaction(SIGCHLD, &notify, NULL) < 0 ||
      prctl(PR_SET_PDEATHSIG, SIGTERM) < 0)
    fail("watch");
  if (parent <= 1 || getppid() != parent)
    fail("parent");
  sigset_t block, previous;
  sigemptyset(&block);
  sigaddset(&block, SIGCHLD);
  sigaddset(&block, SIGTERM);
  if (sigprocmask(SIG_BLOCK, &block, &previous) < 0)
    fail("signals");
  limits(argv[4], wanted);
  char command;
  struct pollfd input = {0, POLLIN | POLLHUP, 0};
  struct timespec timeout = {10, 0};
  if (ppoll(&input, 1, &timeout, &previous) <= 0 ||
      read(0, &command, 1) != 1 || command != 'P' || stopping)
    return 0;
  int images[35];
  images[0] = snapshot(directory, "program.bin", argv[14]);
  images[1] = snapshot(directory, "gate.bin", argv[15]);
  for (unsigned i = 0; i < assets; i++) {
    char name[40];
    snprintf(name, sizeof(name), "asset-%u.bin", i);
    if (!safe_path(argv[16 + i * 2]))
      return 64;
    images[2 + i] = snapshot(directory, name, argv[17 + i * 2]);
  }
  int filter = policy(), control[2], statuspipe[2];
  if (pipe2(control, O_CLOEXEC) < 0 || pipe2(statuspipe, O_CLOEXEC) < 0)
    fail("pipes");
  int out = openat(directory, "stdout",
                   O_WRONLY | O_CREAT | O_EXCL | O_NOFOLLOW | O_CLOEXEC, 0600),
      err = openat(directory, "stderr",
                   O_WRONLY | O_CREAT | O_EXCL | O_NOFOLLOW | O_CLOEXEC, 0600);
  if (out < 0 || err < 0)
    fail("output");
  pid_t controller = getpid(), root = fork();
  if (root < 0)
    fail("fork");
  if (!root) {
    if (sigprocmask(SIG_SETMASK, &previous, NULL) < 0 ||
        prctl(PR_SET_PDEATHSIG, SIGKILL) < 0 || getppid() != controller)
      _exit(120);
    if (dup2(control[0], 0) < 0 || dup2(out, 1) < 0 || dup2(err, 2) < 0 ||
        dup3(statuspipe[1], 100, 0) < 0)
      _exit(120);
    struct rlimit output = {number(argv[9]), number(argv[9])};
    if (setrlimit(RLIMIT_FSIZE, &output) < 0)
      _exit(120);
    char *args[18000];
    char numbers[36][24], destinations[33][540], parents[33][540];
    int n = 0;
#define ADD(x) do { if(n>=17999)_exit(120);args[n++]=(char*)(x); } while(0)
    ADD("/usr/bin/bwrap");
    ADD("--unshare-user");
    ADD("--unshare-net");
    ADD("--unshare-pid");
    ADD("--unshare-ipc");
    ADD("--unshare-uts");
    ADD("--unshare-cgroup");
    ADD("--die-with-parent");
    ADD("--new-session");
    ADD("--dir");
    ADD("/resources");
    for (unsigned i = 0; i < assets + 2; i++) {
      if (fcntl(images[i], F_SETFD, 0) < 0)
        _exit(120);
      snprintf(numbers[i], sizeof(numbers[i]), "%d", images[i]);
      if (i < 2) {
        ADD("--perms");
        ADD("0555");
        ADD("--file");
        ADD(numbers[i]);
        ADD(i == 0 ? "/program" : "/gate");
      } else {
        unsigned k = i - 2;
        snprintf(destinations[k], sizeof(destinations[k]),
                 "/resources/%s", argv[16 + k * 2]);
        strcpy(parents[k], destinations[k]);
        for (char *p = parents[k] + 11; *p; p++)
          if (*p == '/') {
            *p = 0;
            ADD("--dir");
            ADD(strdup(parents[k]));
            *p = '/';
          }
        ADD("--file");
        ADD(numbers[i]);
        ADD(destinations[k]);
      }
    }
    if (fcntl(filter, F_SETFD, 0) < 0)
      _exit(120);
    snprintf(numbers[35], sizeof(numbers[35]), "%d", filter);
    ADD("--remount-ro");
    ADD("/");
    ADD("--seccomp");
    ADD(numbers[35]);
    ADD("--clearenv");
    ADD("--chdir");
    ADD("/");
    ADD("--");
    ADD("/gate");
    ADD("/program");
    char entry[540];
    snprintf(entry, sizeof(entry), "/resources/%s", argv[13]);
    ADD(entry);
    for (unsigned i = 0; i < arguments; i++)
      ADD(argv[16 + assets * 2 + i]);
    args[n] = NULL;
    /* Only sealed input/policy, gate pipes and fixed output sinks survive exec of trusted bwrap. */
    for (int fd = 3; fd < 100; fd++) {
      int keep = fd == filter;
      for (unsigned i = 0; i < assets + 2; i++)
        if (fd == images[i])
          keep = 1;
      if (!keep)
        close(fd);
    }
    if (syscall(SYS_close_range, 101U, ~0U, 0U) < 0)
      _exit(120);
    char *environment[] = {"PATH=/usr/bin:/bin", "LANG=C", NULL};
    execve(args[0], args, environment);
    _exit(120);
  }
  close(control[0]);
  close(statuspipe[1]);
  close(out);
  close(err);
  close(directory);
  close(filter);
  for (unsigned i = 0; i < assets + 2; i++)
    close(images[i]);
  int announced = 0, failed = 0, finished = 0,
      payload = -1;
  long stop_elapsed = 0;
  struct timespec before;
  clock_gettime(CLOCK_MONOTONIC, &before);
  while (!finished) {
    if (getppid() != parent)
      stopping = 1;
    finished = children(root, stopping && stop_elapsed >= (long)number(argv[10]));
    if (finished)
      break;
    if (stopping) {
      if (!payload_ended)
        kill(root, SIGTERM);
      struct timespec now;
      clock_gettime(CLOCK_MONOTONIC, &now);
      stop_elapsed = (now.tv_sec - before.tv_sec) * 1000 +
                     (now.tv_nsec - before.tv_nsec) / 1000000;
    } else
      clock_gettime(CLOCK_MONOTONIC, &before);
    struct pollfd watches[3] = {
      {0, POLLIN | POLLHUP, 0},
      {statuspipe[0], POLLIN | POLLHUP, 0},
      {payload, POLLIN, 0}
    };
    struct timespec tick = {0, 10000000};
    int ready = ppoll(watches, 3, &tick, &previous);
    if (ready < 0 && errno != EINTR)
      fail("poll");
    if (watches[2].revents) {
      payload_ended = 1;
      stopping = 1;
      close(payload);
      payload = -1;
    }
    if (watches[0].revents) {
      ssize_t got = read(0, &command, 1);
      if (got != 1 || command == 'S')
        stopping = 1;
      else if (command == 'G' && announced && !command_sent && !stopping) {
        if (write(control[1], "G", 1) != 1)
          stopping = 1;
        else command_sent = 1;
      } else
        stopping = 1;
    }
    if (watches[1].revents) {
      char value;
      ssize_t got = read(statuspipe[0], &value, 1);
      if (got == 1 && value == 'R' && !announced) {
        payload = gate_watch(getpid(), 0);
        if (payload < 0) {
          errno = ESRCH;
          fail("gate-missing");
        }
        announced = 1;
        puts("{\"event\":\"ready\"}");
        fflush(stdout);
      } else if (got == 1) {
        failed = 1;
        stopping = 1;
      } else if (got == 0) {
        close(statuspipe[0]);
        statuspipe[0] = -1;
        if (!announced)
          stopping = 1;
      }
    }
  }
  close(control[1]);
  if (statuspipe[0] >= 0)
    close(statuspipe[0]);
  if (payload >= 0)
    close(payload);
  printf("{\"event\":\"stopped\",\"gateReleased\":%s,\"failed\":%s}\n",
         exec_seen ? "true" : "false", (failed || root_failure) ? "true" : "false");
  fflush(stdout);
  return 0;
}

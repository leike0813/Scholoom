/* Independent fixed oracle: no libc, domain authority, or controller protocol. */
#if !defined(__linux__) || !defined(__x86_64__) || defined(__ILP32__)
#error Linux x86_64 LP64 required
#endif
#include <asm/unistd.h>

enum { EACCES_VALUE = 13, EBADF_VALUE = 9, EINTR_VALUE = 4, AT_CWD = -100 };

static long call(long number, long a, long b, long c, long d, long e, long f) {
  register long r10 __asm__("r10") = d;
  register long r8 __asm__("r8") = e;
  register long r9 __asm__("r9") = f;
  long result;
  __asm__ volatile("syscall"
                   : "=a"(result)
                   : "a"(number), "D"(a), "S"(b), "d"(c), "r"(r10), "r"(r8), "r"(r9)
                   : "rcx", "r11", "memory");
  return result;
}

__attribute__((noreturn)) static void finish(int code) {
  call(__NR_exit, code, 0, 0, 0, 0, 0);
  __builtin_unreachable();
}

static int equal(const char *left, const char *right) {
  while (*left && *left == *right) {
    left++;
    right++;
  }
  return *left == *right;
}

static void approved_bytes(const char *path) {
  static const char expected[] = "approved report bytes\n";
  char bytes[sizeof(expected)];
  long fd = call(__NR_openat, AT_CWD, (long)path, 0, 0, 0, 0);
  if (fd != 0 && fd != 3) finish(10);
  unsigned long used = 0;
  for (;;) {
    long count = call(__NR_read, fd, (long)(bytes + used), sizeof(bytes) - used, 0, 0, 0);
    if (count == -EINTR_VALUE) continue;
    if (count < 0) finish(11);
    if (!count) break;
    used += (unsigned long)count;
    if (used == sizeof(bytes)) finish(12);
  }
  if (used != sizeof(expected) - 1) finish(12);
  for (unsigned long i = 0; i < used; i++) {
    if (bytes[i] != expected[i]) finish(12);
  }
  if (call(__NR_write, fd, (long)expected, 1, 0, 0, 0) != -EACCES_VALUE) finish(13);
  if (call(__NR_close, fd, 0, 0, 0, 0, 0) != 0) finish(14);
}

static void denied_capabilities(void) {
  /* Arguments stay fixed; seccomp denial must precede syscall argument validation. */
  static const struct {
    long number, a, b, c, d, e, f;
  } attempts[] = {
    {__NR_socket, 2, 1, 0, 0, 0, 0},
    {__NR_socketpair, 1, 1, 0, 0, 0, 0},
    {__NR_connect, 0, 0, 0, 0, 0, 0},
    {__NR_recvmsg, 0, 0, 0, 0, 0, 0},
    {__NR_recvmmsg, 0, 0, 1, 0, 0, 0},
    {__NR_recvfrom, 0, 0, 1, 0, 0, 0},
    {__NR_sendmsg, 1, 0, 0, 0, 0, 0},
    {__NR_unshare, 0x10000000, 0, 0, 0, 0, 0},
    {__NR_setns, -1, 0, 0, 0, 0, 0},
    {__NR_open_by_handle_at, -1, 0, 0, 0, 0, 0},
    {__NR_name_to_handle_at, AT_CWD, 0, 0, 0, 0, 0},
    {__NR_pidfd_open, 1, 0, 0, 0, 0, 0},
    {__NR_pidfd_getfd, -1, 100, 0, 0, 0, 0},
    {__NR_io_uring_setup, 1, 0, 0, 0, 0, 0},
    {__NR_io_uring_enter, -1, 0, 0, 0, 0, 0},
    {__NR_io_uring_register, -1, 0, 0, 0, 0, 0},
    {__NR_ptrace, 0, 0, 0, 0, 0, 0},
    {__NR_process_vm_readv, 1, 0, 0, 0, 0, 0},
    {__NR_mount, 0, 0, 0, 0, 0, 0},
    {__NR_clone, 0, 0, 0, 0, 0, 0},
    {__NR_clone3, 0, 0, 0, 0, 0, 0},
    {__NR_dup, 0, 0, 0, 0, 0, 0},
    {__NR_dup2, 0, 100, 0, 0, 0, 0},
    {__NR_fcntl, 0, 0, 100, 0, 0, 0},
    {__NR_bpf, 0, 0, 0, 0, 0, 0},
  };
  for (unsigned long i = 0; i < sizeof(attempts) / sizeof(attempts[0]); i++) {
    if (call(attempts[i].number, attempts[i].a, attempts[i].b, attempts[i].c,
             attempts[i].d, attempts[i].e, attempts[i].f) != -EACCES_VALUE) {
      finish(100 + (int)i);
    }
  }
  char byte;
  static const long descriptors[] = {1, 2, 100, 101, 4096, 65535};
  for (unsigned long i = 0; i < sizeof(descriptors) / sizeof(descriptors[0]); i++) {
    long result = call(__NR_read, descriptors[i], (long)&byte, 1, 0, 0, 0);
    if (result != -EACCES_VALUE && result != -EBADF_VALUE) finish(50 + (int)i);
  }
  long gate = call(__NR_write, 100, (long)"x", 1, 0, 0, 0);
  if (gate != -EBADF_VALUE && gate != -EACCES_VALUE) finish(56);
  static const char *const paths[] = {
    "/etc/passwd", "/proc/self/environ", "/proc/self/fd/100", "/proc/self/fd/3",
    "/sys/fs/cgroup/cgroup.procs", "/dev/null", "/resources/unapproved-report.txt",
    "/resources/../etc/passwd",
  };
  for (unsigned long i = 0; i < sizeof(paths) / sizeof(paths[0]); i++) {
    long fd = call(__NR_openat, AT_CWD, (long)paths[i], 0, 0, 0, 0);
    if (fd >= 0) {
      call(__NR_close, fd, 0, 0, 0, 0, 0);
      finish(70 + (int)i);
    }
  }
}

static void wait_child(long child) {
  int status = 0;
  long result;
  do {
    result = call(__NR_wait4, child, (long)&status, 0, 0, 0, 0);
  } while (result == -EINTR_VALUE);
  if (result != child || status != 0) finish(82);
}

__attribute__((noreturn)) static void detached(int exit_root) {
  for (int generation = 0; generation < 3; generation++) {
    long child = call(__NR_fork, 0, 0, 0, 0, 0, 0);
    if (child < 0) finish(80);
    if (child > 0) {
      if (exit_root) {
        /* Reaping intermediates ensures the third fork exists before root exit. */
        if (generation < 2) wait_child(child);
        finish(0);
      }
      for (;;) call(__NR_pause, 0, 0, 0, 0, 0, 0);
    }
    if (call(__NR_setsid, 0, 0, 0, 0, 0, 0) < 0) finish(81);
  }
  for (;;) call(__NR_pause, 0, 0, 0, 0, 0, 0);
}

__attribute__((used, noreturn)) void probe_entry(unsigned long *stack) {
  if (stack[0] != 3) finish(64);
  char **arguments = (char **)(stack + 1);
  int normal = equal(arguments[2], "normal");
  int fail = equal(arguments[2], "fail");
  int detach = equal(arguments[2], "detached");
  int detach_exit = equal(arguments[2], "detached-exit");
  if (!normal && !fail && !detach && !detach_exit) finish(64);
  approved_bytes(arguments[1]);
  denied_capabilities();
  if (detach || detach_exit) detached(detach_exit);
  finish(fail ? 42 : 0);
}

__asm__(".text\n.global _start\n_start:\nmov %rsp,%rdi\nand $-16,%rsp\ncall probe_entry\nud2\n");

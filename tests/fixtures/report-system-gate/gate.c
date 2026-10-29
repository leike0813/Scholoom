/* Offline fixed gate; the fixture observer is not an OS readiness channel. */
#define _GNU_SOURCE
#include <errno.h>
#include <fcntl.h>
#include <limits.h>
#include <linux/audit.h>
#include <linux/filter.h>
#include <linux/memfd.h>
#include <linux/seccomp.h>
#include <stddef.h>
#include <stdio.h>
#include <stdlib.h>
#include <sys/mman.h>
#include <sys/prctl.h>
#include <sys/resource.h>
#include <sys/stat.h>
#include <sys/syscall.h>
#include <unistd.h>
#include "fixture-config.h"

#if !defined(__linux__) || !defined(__x86_64__) || defined(__ILP32__)
#error Linux x86_64 LP64 required
#endif

static void fail(const char *stage) {
  (void)stage;
  _exit(67);
}

/* Generated verbatim from the existing native controller's policy function. */
#include "native-policy.h"

static int bound_stdio(void) {
  struct stat input, input_path, out, err, output_path;
  if (fstat(0, &input) || lstat(PERMIT_PATH, &input_path) ||
      !S_ISFIFO(input.st_mode) || input.st_uid != getuid() || input.st_nlink != 1 ||
      input.st_dev != input_path.st_dev || input.st_ino != input_path.st_ino ||
      (fcntl(0, F_GETFL) & O_ACCMODE) != O_RDONLY ||
      fstat(1, &out) || fstat(2, &err) || lstat(LOG_PATH, &output_path) ||
      !S_ISREG(out.st_mode) || out.st_uid != getuid() || out.st_nlink != 1 ||
      out.st_dev != err.st_dev || out.st_ino != err.st_ino ||
      out.st_dev != output_path.st_dev || out.st_ino != output_path.st_ino ||
      (fcntl(1, F_GETFL) & O_ACCMODE) != O_WRONLY ||
      (fcntl(2, F_GETFL) & O_ACCMODE) != O_WRONLY)
    return 0;
  int flags = fcntl(0, F_GETFL);
  struct rlimit bytes = {65536, 65536};
  return flags >= 0 && fcntl(0, F_SETFL, flags & ~O_NONBLOCK) == 0 &&
         setrlimit(RLIMIT_FSIZE, &bytes) == 0;
}

static void install_policy(void) {
  int fd = policy();
  struct stat info;
  struct sock_filter code[256];
  if (fstat(fd, &info) || info.st_size <= 0 ||
      (unsigned long)info.st_size > sizeof(code) ||
      info.st_size % sizeof(code[0]))
    fail("policy-size");
  size_t at = 0;
  while (at < (size_t)info.st_size) {
    ssize_t n = read(fd, (char *)code + at, (size_t)info.st_size - at);
    if (n < 0 && errno == EINTR) continue;
    if (n <= 0) fail("policy-read");
    at += (size_t)n;
  }
  if (close(fd)) fail("policy-close");
  struct sock_fprog filter = {(unsigned short)(at / sizeof(code[0])), code};
  if (prctl(PR_SET_NO_NEW_PRIVS, 1, 0, 0, 0) ||
      prctl(PR_SET_SECCOMP, SECCOMP_MODE_FILTER, &filter))
    fail("policy-install");
}

int main(int argc, char **argv) {
  (void)argv;
  if (argc != 1 || !bound_stdio()) return 64;
  /* FD3 is a fixture-only socketpair, closed before reading the actual FIFO. */
  if (write(3, "R", 1) != 1 || close(3)) return 67;
  char permit[2];
  size_t used = 0;
  for (;;) {
    ssize_t n = read(0, permit + used, sizeof(permit) - used);
    if (n < 0 && errno == EINTR) continue;
    if (n < 0) return 67;
    if (!n) break;
    used += (size_t)n;
    if (used > 1 || permit[0] != 'G') return 66;
  }
  if (!used) return 65;
  if (close(0) || syscall(SYS_close_range, 3U, UINT_MAX, 0)) return 67;
  install_policy();
  char *const arguments[] = {PROBE_PATH, INPUT_PATH, "normal", NULL};
  char *const environment[] = {NULL};
  execve(PROBE_PATH, arguments, environment);
  return 68;
}

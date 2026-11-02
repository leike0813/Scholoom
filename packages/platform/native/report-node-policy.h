/* Shared Node policy for an exact, read-only runtime file view. */
#ifndef REPORT_NODE_POLICY_H
#define REPORT_NODE_POLICY_H

#include <errno.h>
#include <fcntl.h>
#include <linux/audit.h>
#include <linux/filter.h>
#include <linux/seccomp.h>
#include <sched.h>
#include <stddef.h>
#include <linux/memfd.h>
#include <unistd.h>
#include <sys/ioctl.h>
#include <sys/prctl.h>
#include <sys/syscall.h>
#include <termios.h>

#if !defined(__linux__) || !defined(__x86_64__) || defined(__ILP32__)
#error Linux x86_64 LP64 required
#endif

#define REPORT_NODE_ALLOW(n) BPF_JUMP(BPF_JMP|BPF_JEQ|BPF_K, __NR_##n, 0, 1), BPF_STMT(BPF_RET|BPF_K, SECCOMP_RET_ALLOW)
#define REPORT_NODE_DENY (SECCOMP_RET_ERRNO | EACCES)
#define REPORT_NODE_ARG(n) (offsetof(struct seccomp_data, args[n]))
#define REPORT_NODE_THREAD_FLAGS (CLONE_VM | CLONE_FS | CLONE_FILES | CLONE_SIGHAND | CLONE_THREAD | CLONE_SYSVSEM | CLONE_SETTLS | CLONE_PARENT_SETTID | CLONE_CHILD_CLEARTID)
#define REPORT_NODE_READ_FLAGS (O_CLOEXEC | O_NOFOLLOW | O_NONBLOCK | O_DIRECTORY | O_LARGEFILE | O_PATH)

static int report_node_policy(void) {
  const struct sock_filter code[] = {
    BPF_STMT(BPF_LD|BPF_W|BPF_ABS, offsetof(struct seccomp_data, arch)),
    BPF_JUMP(BPF_JMP|BPF_JEQ|BPF_K, AUDIT_ARCH_X86_64, 1, 0),
    BPF_STMT(BPF_RET|BPF_K, SECCOMP_RET_KILL_PROCESS),
    BPF_STMT(BPF_LD|BPF_W|BPF_ABS, offsetof(struct seccomp_data, nr)),

    /* clone3's pointed-to flags cannot be checked by classic BPF. libc retries clone. */
    BPF_JUMP(BPF_JMP|BPF_JEQ|BPF_K, __NR_clone3, 0, 1),
    BPF_STMT(BPF_RET|BPF_K, SECCOMP_RET_ERRNO | ENOSYS),
    BPF_JUMP(BPF_JMP|BPF_JEQ|BPF_K, __NR_clone, 0, 4),
    BPF_STMT(BPF_LD|BPF_W|BPF_ABS, REPORT_NODE_ARG(0)),
    BPF_JUMP(BPF_JMP|BPF_JEQ|BPF_K, REPORT_NODE_THREAD_FLAGS, 0, 1),
    BPF_STMT(BPF_RET|BPF_K, SECCOMP_RET_ALLOW),
    BPF_STMT(BPF_RET|BPF_K, REPORT_NODE_DENY),

    BPF_JUMP(BPF_JMP|BPF_JEQ|BPF_K, __NR_openat, 0, 4),
    BPF_STMT(BPF_LD|BPF_W|BPF_ABS, REPORT_NODE_ARG(2)),
    BPF_JUMP(BPF_JMP|BPF_JSET|BPF_K, ~REPORT_NODE_READ_FLAGS, 1, 0),
    BPF_STMT(BPF_RET|BPF_K, SECCOMP_RET_ALLOW),
    BPF_STMT(BPF_RET|BPF_K, REPORT_NODE_DENY),

    BPF_JUMP(BPF_JMP|BPF_JEQ|BPF_K, __NR_ioctl, 0, 7),
    BPF_STMT(BPF_LD|BPF_W|BPF_ABS, REPORT_NODE_ARG(1)),
    BPF_JUMP(BPF_JMP|BPF_JEQ|BPF_K, TCGETS, 4, 0),
    BPF_JUMP(BPF_JMP|BPF_JEQ|BPF_K, TIOCGWINSZ, 3, 0),
    BPF_JUMP(BPF_JMP|BPF_JEQ|BPF_K, FIONBIO, 2, 0),
    BPF_JUMP(BPF_JMP|BPF_JEQ|BPF_K, FIONREAD, 1, 0),
    BPF_STMT(BPF_RET|BPF_K, REPORT_NODE_DENY),
    BPF_STMT(BPF_RET|BPF_K, SECCOMP_RET_ALLOW),

    BPF_JUMP(BPF_JMP|BPF_JEQ|BPF_K, __NR_prctl, 0, 8),
    BPF_STMT(BPF_LD|BPF_W|BPF_ABS, REPORT_NODE_ARG(0)),
    BPF_JUMP(BPF_JMP|BPF_JEQ|BPF_K, PR_SET_NAME, 5, 0),
    BPF_JUMP(BPF_JMP|BPF_JEQ|BPF_K, PR_GET_NAME, 4, 0),
    BPF_JUMP(BPF_JMP|BPF_JEQ|BPF_K, PR_GET_SECCOMP, 3, 0),
    BPF_JUMP(BPF_JMP|BPF_JEQ|BPF_K, PR_SET_NO_NEW_PRIVS, 2, 0),
    BPF_JUMP(BPF_JMP|BPF_JEQ|BPF_K, PR_GET_NO_NEW_PRIVS, 1, 0),
    BPF_STMT(BPF_RET|BPF_K, REPORT_NODE_DENY),
    BPF_STMT(BPF_RET|BPF_K, SECCOMP_RET_ALLOW),

    REPORT_NODE_ALLOW(read), REPORT_NODE_ALLOW(pread64), REPORT_NODE_ALLOW(readv), REPORT_NODE_ALLOW(write), REPORT_NODE_ALLOW(writev), REPORT_NODE_ALLOW(close),
    REPORT_NODE_ALLOW(fstat), REPORT_NODE_ALLOW(newfstatat), REPORT_NODE_ALLOW(statx), REPORT_NODE_ALLOW(access), REPORT_NODE_ALLOW(faccessat2),
    REPORT_NODE_ALLOW(readlink), REPORT_NODE_ALLOW(readlinkat), REPORT_NODE_ALLOW(getcwd), REPORT_NODE_ALLOW(getdents64), REPORT_NODE_ALLOW(lseek),
    REPORT_NODE_ALLOW(fcntl), REPORT_NODE_ALLOW(dup), REPORT_NODE_ALLOW(dup2), REPORT_NODE_ALLOW(dup3),
    REPORT_NODE_ALLOW(mmap), REPORT_NODE_ALLOW(mprotect), REPORT_NODE_ALLOW(munmap), REPORT_NODE_ALLOW(mremap), REPORT_NODE_ALLOW(madvise), REPORT_NODE_ALLOW(brk),
    REPORT_NODE_ALLOW(futex), REPORT_NODE_ALLOW(set_robust_list), REPORT_NODE_ALLOW(set_tid_address), REPORT_NODE_ALLOW(rseq), REPORT_NODE_ALLOW(arch_prctl),
    REPORT_NODE_ALLOW(rt_sigaction), REPORT_NODE_ALLOW(rt_sigprocmask), REPORT_NODE_ALLOW(rt_sigreturn), REPORT_NODE_ALLOW(sigaltstack), REPORT_NODE_ALLOW(tgkill),
    REPORT_NODE_ALLOW(epoll_create1), REPORT_NODE_ALLOW(epoll_ctl), REPORT_NODE_ALLOW(epoll_wait), REPORT_NODE_ALLOW(epoll_pwait),
    REPORT_NODE_ALLOW(eventfd2), REPORT_NODE_ALLOW(pipe2), REPORT_NODE_ALLOW(poll), REPORT_NODE_ALLOW(ppoll), REPORT_NODE_ALLOW(pselect6),
    REPORT_NODE_ALLOW(clock_gettime), REPORT_NODE_ALLOW(clock_getres), REPORT_NODE_ALLOW(gettimeofday), REPORT_NODE_ALLOW(nanosleep),
    REPORT_NODE_ALLOW(clock_nanosleep), REPORT_NODE_ALLOW(restart_syscall), REPORT_NODE_ALLOW(sched_yield), REPORT_NODE_ALLOW(sched_getaffinity),
    REPORT_NODE_ALLOW(sched_getparam), REPORT_NODE_ALLOW(sched_getscheduler),
    REPORT_NODE_ALLOW(getuid), REPORT_NODE_ALLOW(geteuid), REPORT_NODE_ALLOW(getgid), REPORT_NODE_ALLOW(getegid), REPORT_NODE_ALLOW(getpid), REPORT_NODE_ALLOW(getppid),
    REPORT_NODE_ALLOW(gettid), REPORT_NODE_ALLOW(uname), REPORT_NODE_ALLOW(sysinfo), REPORT_NODE_ALLOW(prlimit64), REPORT_NODE_ALLOW(getrlimit),
    REPORT_NODE_ALLOW(getrandom), REPORT_NODE_ALLOW(wait4), REPORT_NODE_ALLOW(execve), REPORT_NODE_ALLOW(exit), REPORT_NODE_ALLOW(exit_group),
    BPF_STMT(BPF_RET|BPF_K, REPORT_NODE_DENY),
  };
  int fd = syscall(__NR_memfd_create, "report-node-policy", MFD_CLOEXEC | MFD_ALLOW_SEALING);
  if (fd < 0)
    return -1;
  size_t offset = 0;
  while (offset < sizeof(code)) {
    ssize_t n = write(fd, (const char *)code + offset, sizeof(code) - offset);
    if (n < 0 && errno == EINTR)
      continue;
    if (n <= 0) {
      if (!n)
        errno = EIO;
      goto failed;
    }
    offset += (size_t)n;
  }
  if (lseek(fd, 0, SEEK_SET) != 0 ||
      fcntl(fd, F_ADD_SEALS, F_SEAL_SEAL | F_SEAL_SHRINK | F_SEAL_GROW | F_SEAL_WRITE) < 0)
    goto failed;
  return fd;
failed: {
    int saved = errno;
    close(fd);
    errno = saved;
    return -1;
  }
}

#undef REPORT_NODE_ALLOW
#undef REPORT_NODE_DENY
#undef REPORT_NODE_ARG
#undef REPORT_NODE_THREAD_FLAGS
#undef REPORT_NODE_READ_FLAGS

#endif

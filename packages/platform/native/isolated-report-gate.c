/* Static trusted pre-exec gate. FD100 is consumed with CLOEXEC, never exposed to the program. */
#if !defined(__linux__) || !defined(__x86_64__) || defined(__ILP32__)
#error Linux x86_64 LP64 required
#endif

#include <fcntl.h>
#include <sys/resource.h>
#include <sys/stat.h>

static long call(long n, long a, long b, long c) {
  long r;
  register long fourth __asm__("r10") = 0;
  __asm__ volatile("syscall"
                   : "=a"(r)
                   : "a"(n), "D"(a), "S"(b), "d"(c), "r"(fourth)
                   : "rcx", "r11", "memory");
  return r;
}

__attribute__((used, noreturn)) void entry(unsigned long *stack) {
  char **args = (char **)(stack + 1);
  char ready = 'R', command = 0, error = 'E';
  char *env[] = {0};
  if (stack[0] < 2)
    goto failed;
  int node = args[1][0] == '-' && args[1][1] == '-' && args[1][2] == 'n' &&
             args[1][3] == 'o' && args[1][4] == 'd' && args[1][5] == 'e' && !args[1][6];
  unsigned long output_bytes = 0;
  if (node) {
    if (stack[0] < 4 || !*args[2])
      goto failed;
    for (const char *p = args[2]; *p; p++) {
      if (*p < '0' || *p > '9' || output_bytes > (9007199254740991UL - (*p - '0')) / 10)
        goto failed;
      output_bytes = output_bytes * 10 + (*p - '0');
    }
    if (!output_bytes)
      goto failed;
    struct stat input, output;
    long input_flags = call(72, 3, F_GETFL, 0), output_flags = call(72, 4, F_GETFL, 0);
    if (call(5, 3, (long)&input, 0) < 0 ||
        call(5, 4, (long)&output, 0) < 0 || !S_ISFIFO(input.st_mode) ||
        !S_ISFIFO(output.st_mode) || input_flags < 0 || output_flags < 0 ||
        (input_flags & O_ACCMODE) != O_RDONLY ||
        ((output_flags & O_ACCMODE) != O_WRONLY && (output_flags & O_ACCMODE) != O_RDWR))
      goto failed;
  }
  if (call(1, 100, (long)&ready, 1) != 1 ||
      call(0, 0, (long)&command, 1) != 1 || command != 'G')
    goto failed;
  if (call(3, 0, 0, 0) < 0)
    goto failed;
  if (node && (call(33, 3, 0, 0) < 0 || call(33, 4, 1, 0) < 0 ||
               call(3, 3, 0, 0) < 0 || call(3, 4, 0, 0) < 0))
    goto failed;
  if (node) {
    struct rlimit output = {output_bytes, output_bytes};
    if (call(302, 0, RLIMIT_FSIZE, (long)&output) < 0)
      goto failed;
  }
  if (call(72, 100, F_SETFD, FD_CLOEXEC) < 0)
    goto failed;
  call(59, (long)args[node ? 3 : 1], (long)(args + (node ? 3 : 1)), (long)env);
failed:
  call(1, 100, (long)&error, 1);
  call(231, 127, 0, 0);
  __builtin_unreachable();
}

__asm__(".text\n.global _start\n_start:\nmov %rsp,%rdi\nand $-16,%rsp\ncall entry\nud2\n");

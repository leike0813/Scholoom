/* Static trusted pre-exec gate. FD100 is consumed with CLOEXEC, never exposed to the program. */
#if !defined(__linux__) || !defined(__x86_64__) || defined(__ILP32__)
#error Linux x86_64 LP64 required
#endif

static long call(long n, long a, long b, long c) {
  long r;
  __asm__ volatile("syscall"
                   : "=a"(r)
                   : "a"(n), "D"(a), "S"(b), "d"(c)
                   : "rcx", "r11", "memory");
  return r;
}

__attribute__((used, noreturn)) void entry(unsigned long *stack) {
  char **args = (char **)(stack + 1);
  char ready = 'R', command = 0, error = 'E';
  char *env[] = {0};
  if (stack[0] < 2 || call(1, 100, (long)&ready, 1) != 1 ||
      call(0, 0, (long)&command, 1) != 1 || command != 'G')
    goto failed;
  if (call(3, 0, 0, 0) < 0 || call(72, 100, 2, 1) < 0)
    goto failed;
  call(59, (long)args[1], (long)(args + 1), (long)env);
failed:
  call(1, 100, (long)&error, 1);
  call(231, 127, 0, 0);
  __builtin_unreachable();
}

__asm__(".text\n.global _start\n_start:\nmov %rsp,%rdi\nand $-16,%rsp\ncall entry\nud2\n");

#define _POSIX_C_SOURCE 200809L
#include <stdio.h>
#include <stdlib.h>
#include <unistd.h>

#ifndef HELPER_PATH
#error Compile with the fixed production helper path
#endif

int main(int argc, char **argv) {
  char pid[32];
  if (argc != 8) return 64;
  snprintf(pid, sizeof(pid), "%ld", (long)getpid());
  if (setenv("LISTEN_PID", pid, 1)) {
    perror("LISTEN_PID");
    return 120;
  }
  execv(HELPER_PATH, argv);
  perror("execv fixed production helper");
  return 120;
}

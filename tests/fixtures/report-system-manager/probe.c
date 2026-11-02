/* Trusted synthetic workload: a detached child must remain in the same system cgroup. */
#define _GNU_SOURCE
#include <signal.h>
#include <stdio.h>
#include <sys/types.h>
#include <unistd.h>

int main(void) {
  int ready[2];
  if (pipe(ready)) return 1;
  pid_t child = fork();
  if (child < 0) return 1;
  if (!child) {
    close(ready[0]);
    if (setsid() < 0 || write(ready[1], "R", 1) != 1) return 2;
    close(ready[1]);
    for (;;) pause();
  }
  close(ready[1]);
  char state;
  if (read(ready[0], &state, 1) != 1 || state != 'R') {
    kill(child, SIGKILL);
    return 2;
  }
  close(ready[0]);
  printf("{\"pid\":%ld,\"child\":%ld}\n", (long)getpid(), (long)child);
  if (fflush(stdout)) return 3;
  for (;;) pause();
}

#define _GNU_SOURCE
#include <errno.h>
#include <fcntl.h>
#include <signal.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/prctl.h>
#include <sys/wait.h>
#include <time.h>
#include <unistd.h>

#ifndef HELPER_PATH
#error Compile with the fixed production helper path
#endif

static pid_t helper;
static void stop(int signal) {
  if (helper > 0) kill(helper, signal);
}

/* Only children adopted by this fixture's subreaper are eligible for cleanup. */
static int cleanup(FILE *evidence) {
  char path[128];
  snprintf(path, sizeof(path), "/proc/self/task/%ld/children", (long)getpid());
  for (unsigned attempt = 0; attempt < 500; attempt++) {
    int status;
    pid_t reaped;
    while ((reaped = waitpid(-1, &status, WNOHANG)) > 0)
      fprintf(evidence, "{\"reaped\":%ld,\"status\":%d}\n", (long)reaped, status);
    if (reaped < 0 && errno == ECHILD) return 0;
    FILE *children = fopen(path, "re");
    if (!children) return -1;
    long pid;
    while (fscanf(children, "%ld", &pid) == 1) {
      if (pid <= 0 || kill((pid_t)pid, SIGKILL) < 0) {
        if (errno == ESRCH) continue;
        fclose(children);
        return -1;
      }
      fprintf(evidence, "{\"cleanupKill\":%ld}\n", pid);
    }
    if (ferror(children) || fclose(children)) return -1;
    struct timespec tick = {0, 10000000};
    nanosleep(&tick, NULL);
  }
  return -1;
}

int main(int argc, char **argv) {
  const char *path = getenv("NODE_LAUNCH_EVIDENCE");
  if (argc != 9 || strcmp(argv[8], "--node") || !path || getuid() == 0 ||
      getuid() != geteuid() || prctl(PR_SET_CHILD_SUBREAPER, 1L) < 0)
    return 64;
  int fd = open(path, O_WRONLY | O_CREAT | O_EXCL | O_CLOEXEC, 0600);
  if (fd < 0) return 120;
  struct sigaction action = {.sa_handler = stop};
  sigemptyset(&action.sa_mask);
  if (sigaction(SIGTERM, &action, NULL) || sigaction(SIGINT, &action, NULL)) return 120;
  helper = fork();
  if (helper < 0) return 120;
  if (!helper) {
    char pid[32];
    snprintf(pid, sizeof(pid), "%ld", (long)getpid());
    if (setenv("LISTEN_PID", pid, 1)) _exit(120);
    execv(HELPER_PATH, argv);
    perror("execv fixed Node launcher");
    _exit(120);
  }
  for (int descriptor = 0; descriptor < 1024; descriptor++)
    if (descriptor != 2 && descriptor != fd) close(descriptor);
  FILE *evidence = fdopen(fd, "w");
  if (!evidence) { kill(helper, SIGKILL); return 120; }
  fprintf(evidence, "{\"helperPid\":%ld,\"supervisorPid\":%ld}\n", (long)helper, (long)getpid());
  fflush(evidence);
  int status;
  pid_t result;
  do { result = waitpid(helper, &status, 0); } while (result < 0 && errno == EINTR);
  if (result != helper) return 120;
  helper = 0;
  int cleaned = cleanup(evidence);
  fprintf(evidence, "{\"helperStatus\":%d,\"cleanupComplete\":%s}\n", status, cleaned ? "false" : "true");
  if (fclose(evidence) || cleaned) return 121;
  return WIFEXITED(status) ? WEXITSTATUS(status) : 128 + WTERMSIG(status);
}

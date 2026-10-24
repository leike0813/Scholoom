/* One supervisor owns one execution. A successful exit proves its native scope is empty. */
#define _GNU_SOURCE
#include <errno.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>

#ifdef _WIN32
#include <windows.h>
#include <fcntl.h>
#include <io.h>
#include <process.h>
#include <wchar.h>
static HANDLE job;
static HANDLE root;
static int root_exited;
static int initialize(void) {
  JOBOBJECT_EXTENDED_LIMIT_INFORMATION limits = {0};
  job = CreateJobObjectW(NULL, NULL);
  if (!job) return -1;
  limits.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
  return SetInformationJobObject(job, JobObjectExtendedLimitInformation, &limits, sizeof(limits)) ? 0 : -1;
}
static unsigned long launch(wchar_t **arguments) {
  /* The CRT joins argv without quoting; both file paths may contain spaces. */
  wchar_t *quoted[3] = {NULL, NULL, NULL};
  for (unsigned i = 0; i < 2; i++) {
    size_t length = wcslen(arguments[i]);
    quoted[i] = malloc((length + 3) * sizeof(wchar_t));
    if (!quoted[i]) {
      free(quoted[0]);
      return 0;
    }
    swprintf(quoted[i], length + 3, L"\"%ls\"", arguments[i]);
  }
  intptr_t process = _wspawnv(_P_NOWAIT, arguments[0], (const wchar_t *const *)quoted);
  free(quoted[0]);
  free(quoted[1]);
  if (process == -1) return 0;
  root = (HANDLE)process;
  if (!AssignProcessToJobObject(job, root)) {
    TerminateProcess(root, 1);
    WaitForSingleObject(root, INFINITE);
    CloseHandle(root);
    root = NULL;
    return 0;
  }
  return GetProcessId(root);
}
static int arm(void) { return 0; }
static int control(void) {
  DWORD available;
  char byte;
  if (!PeekNamedPipe((HANDLE)_get_osfhandle(4), NULL, 0, NULL, &available, NULL)) return 'S';
  if (!available) return 0;
  return _read(4, &byte, 1) == 1 ? byte : 'S';
}
static int sweep(int stopping) {
  JOBOBJECT_BASIC_ACCOUNTING_INFORMATION accounting;
  root_exited = root && WaitForSingleObject(root, 0) == WAIT_OBJECT_0;
  if (stopping || root_exited) {
    if (!TerminateJobObject(job, 1)) return -1;
  }
  if (!QueryInformationJobObject(job, JobObjectBasicAccountingInformation, &accounting, sizeof(accounting), NULL)) return -1;
  return accounting.ActiveProcesses == 0;
}
static void pause_scope(void) { Sleep(10); }
static void close_scope(void) {
  if (root) CloseHandle(root);
  if (job) CloseHandle(job);
}
#define close _close
#define write _write
#else
#include <fcntl.h>
#include <signal.h>
#include <sys/types.h>
#include <sys/wait.h>
#include <unistd.h>
static pid_t root;
static int root_exited;
static int control(void) {
  char byte;
  ssize_t count = read(4, &byte, 1);
  if (count == 1) return byte;
  if (count == 0) return 'S';
  return errno == EAGAIN || errno == EINTR ? 0 : 'S';
}
static unsigned long launch(char **arguments) {
  root = fork();
  if (root == 0) {
    /* Reserve these descriptor numbers until bootstrap, before Node allocates its own handles. */
    if (fcntl(4, F_SETFD, 0) < 0 || fcntl(5, F_SETFD, 0) < 0) _exit(127);
    execv(arguments[0], arguments);
    _exit(127);
  }
  return root > 0 ? (unsigned long)root : 0;
}
static void pause_scope(void) {
  struct timespec delay = {0, 10000000};
  nanosleep(&delay, NULL);
}

#ifdef __linux__
#include <sys/prctl.h>
static int initialize(void) {
  char path[96];
  snprintf(path, sizeof(path), "/proc/self/task/%ld/children", (long)getpid());
  FILE *children = fopen(path, "r");
  if (!children) return -1;
  fclose(children);
  return prctl(PR_SET_CHILD_SUBREAPER, 1L, 0L, 0L, 0L);
}
static int arm(void) { return 0; }
static int sweep(int stopping) {
  pid_t child;
  int status;
  unsigned reaped = 0;
  while (reaped++ < 4096 && (child = waitpid(-1, &status, WNOHANG)) > 0)
    if (child == root) root_exited = 1;
  if (child < 0) return errno == ECHILD ? 1 : -1;
  if (stopping || root_exited) {
    char path[96];
    snprintf(path, sizeof(path), "/proc/self/task/%ld/children", (long)getpid());
    FILE *children = fopen(path, "r");
    if (!children) return -1;
    long pid;
    unsigned count = 0;
    /* Only this single-threaded parent reaps these children; their PIDs cannot be reused here. */
    while (count++ < 4096 && fscanf(children, "%ld", &pid) == 1) {
      if (pid <= 0 || (kill((pid_t)pid, SIGKILL) < 0 && errno != ESRCH)) {
        fclose(children);
        return -1;
      }
    }
    int failed = ferror(children);
    fclose(children);
    if (failed) return -1;
  }
  return 0;
}
static void close_scope(void) {}
#elif defined(__APPLE__)
static int initialize(void) { return -1; }
static int arm(void) { return -1; }
static int sweep(int stopping) { (void)stopping; return -1; }
static void close_scope(void) {}
#else
#error Unsupported process scope platform
#endif
#endif

static void status(const char *message) {
  size_t remaining = strlen(message);
  while (remaining) {
    int written = (int)write(5, message, (unsigned)remaining);
    if (written < 0 && errno == EINTR) continue;
    if (written <= 0) return;
    message += written;
    remaining -= (size_t)written;
  }
}
static double now(void) {
#ifdef _WIN32
  return (double)GetTickCount64() / 1000.0;
#else
  struct timespec time;
  clock_gettime(CLOCK_MONOTONIC, &time);
  return (double)time.tv_sec + (double)time.tv_nsec / 1000000000.0;
#endif
}
#ifdef _WIN32
int wmain(int argc, wchar_t **argv) {
#else
int main(int argc, char **argv) {
#endif
  if (argc != 3) return 2;
#ifdef _WIN32
  if (_setmode(4, _O_BINARY) < 0 || _setmode(5, _O_BINARY) < 0) return 2;
#else
  signal(SIGPIPE, SIG_IGN);
  if (fcntl(4, F_SETFL, O_NONBLOCK) < 0) return 2;
#endif
  if (initialize() < 0) {
    status("E native scope unavailable\n");
    return 0;
  }
  unsigned long pid = launch(argv + 1);
  close(3);
  if (!pid) {
    status("E native execution startup failed\n");
    close_scope();
    return 0;
  }
  char identity[64];
  snprintf(identity, sizeof(identity), "P %lu\n", pid);
  status(identity);
  int stopping = 0;
  double deadline = 0;
  for (;;) {
    int byte = control();
    if (byte == 'G' && !stopping) {
      if (arm() < 0) {
        status("E native process control unavailable\n");
        stopping = 1;
      } else status("R\n");
    } else if (byte == 'S') stopping = 1;
    int empty = sweep(stopping);
    if (empty == 1) {
      close_scope();
      return 0;
    }
    if (empty < 0) stopping = 1;
    if (root_exited) stopping = 1;
    if (stopping && !deadline) deadline = now() + 5;
    if (deadline && now() > deadline) {
      close_scope();
      return 1;
    }
    pause_scope();
  }
}

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
static unsigned long launch(char **arguments) {
  intptr_t process = _spawnv(_P_NOWAIT, arguments[0], (const char *const *)arguments);
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
#include <mach/mach.h>
#include <sys/event.h>
enum { MAX_TRACKED = 4096 };
struct tracked_process { pid_t pid; mach_port_t task; };
static struct tracked_process tracked[MAX_TRACKED];
static unsigned tracked_count;
static int queue = -1;
static int tracking_failed;
static int armed;
static int initialize(void) {
  queue = kqueue();
  if (queue < 0) return -1;
  return fcntl(queue, F_SETFD, FD_CLOEXEC);
}
static int track(pid_t pid) {
  for (unsigned i = 0; i < tracked_count; ++i)
    if (tracked[i].pid == pid) return 0;
  if (tracked_count == MAX_TRACKED) return -1;
  tracked[tracked_count++] = (struct tracked_process){pid, MACH_PORT_NULL};
  return 0;
}
static int attach_root(void) {
  struct kevent event;
  EV_SET(&event, root, EVFILT_PROC, EV_ADD | EV_ENABLE | EV_CLEAR,
    NOTE_EXIT | NOTE_FORK | NOTE_TRACK | NOTE_EXEC, 0, NULL);
  if (kevent(queue, &event, 1, NULL, 0, NULL) < 0) return -1;
  return track(root);
}
static int arm(void) {
  for (unsigned i = 0; i < tracked_count; ++i) {
    if (tracked[i].pid == root &&
      task_for_pid(mach_task_self(), root, &tracked[i].task) == KERN_SUCCESS) {
      armed = 1;
      return 0;
    }
  }
  return -1;
}
static void untrack(pid_t pid) {
  for (unsigned i = 0; i < tracked_count; ++i) {
    if (tracked[i].pid != pid) continue;
    if (tracked[i].task != MACH_PORT_NULL)
      mach_port_deallocate(mach_task_self(), tracked[i].task);
    tracked[i] = tracked[--tracked_count];
    return;
  }
}
static int drain(void) {
  struct kevent events[128];
  struct timespec immediate = {0, 0};
  for (unsigned batch = 0; batch < 32; ++batch) {
    int count = kevent(queue, NULL, 0, events, 128, &immediate);
    if (count < 0) return errno == EINTR ? 0 : -1;
    if (!count) return 1;
    for (int i = 0; i < count; ++i) {
      pid_t pid = (pid_t)events[i].ident;
      if (events[i].flags & EV_ERROR || events[i].fflags & NOTE_TRACKERR)
        tracking_failed = 1;
      if (events[i].fflags & NOTE_EXIT) untrack(pid);
      else if (events[i].fflags & NOTE_CHILD && track(pid) < 0) tracking_failed = 1;
      if (events[i].fflags & NOTE_EXEC) {
        for (unsigned j = 0; j < tracked_count; ++j) {
          if (tracked[j].pid != pid || tracked[j].task == MACH_PORT_NULL) continue;
          mach_port_deallocate(mach_task_self(), tracked[j].task);
          tracked[j].task = MACH_PORT_NULL;
        }
      }
    }
  }
  return 0;
}
static int sweep(int stopping) {
  int status;
  pid_t exited = waitpid(root, &status, WNOHANG);
  if (exited == root || (exited < 0 && errno == ECHILD)) root_exited = 1;
  if (drain() < 0) tracking_failed = 1;
  /* Take task rights, then drain exits again before using them: a recycled PID cannot grant control. */
  for (unsigned i = 0; i < tracked_count; ++i)
    if (tracked[i].task == MACH_PORT_NULL)
      task_for_pid(mach_task_self(), tracked[i].pid, &tracked[i].task);
  int drained = drain();
  if (drained < 0) tracking_failed = 1;
  if (stopping || root_exited) {
    if (!armed && !root_exited) kill(root, SIGKILL);
    for (unsigned i = 0; i < tracked_count; ++i)
      if (tracked[i].task != MACH_PORT_NULL) task_terminate(tracked[i].task);
  }
  return root_exited && drained == 1 && tracked_count == 0 && !tracking_failed;
}
static void close_scope(void) {
  for (unsigned i = 0; i < tracked_count; ++i)
    if (tracked[i].task != MACH_PORT_NULL) mach_port_deallocate(mach_task_self(), tracked[i].task);
  if (queue >= 0) close(queue);
}
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
int main(int argc, char **argv) {
  if (argc < 3) return 2;
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
#ifdef __APPLE__
  if (attach_root() < 0) {
    status("E native fork tracking unavailable\n");
    kill(root, SIGKILL);
    while (waitpid(root, NULL, 0) < 0 && errno == EINTR) {}
    close_scope();
    return 0;
  }
#endif
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

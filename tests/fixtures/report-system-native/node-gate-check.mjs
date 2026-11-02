import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { appendFileSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

test('static report gate with shared Node policy and real anonymous pipes', async (t) => {
  assert.equal(process.platform, 'linux');
  assert.equal(process.arch, 'x64');
  assert.ok(process.getuid() > 0 && process.geteuid() > 0);
  const cwd = fileURLToPath(new URL('../../../', import.meta.url));
  const base = join(homedir(), '.cache', 'scholoom-report-system-native');
  mkdirSync(base, { recursive: true });
  const cache = mkdtempSync(join(base, 'node-gate-'));
  t.diagnostic(`Evidence: ${cache}`);
  const source = join(cache, 'check.c');
  const gate = join(cache, 'gate');
  const payload = join(cache, 'payload');
  const driver = join(cache, 'driver');
  const regular = join(cache, 'regular-file');
  writeFileSync(regular, 'synthetic regular file\n');
  writeFileSync(
    source,
    String.raw`#define _GNU_SOURCE
#include <assert.h>
#include <errno.h>
#include <fcntl.h>
#include <limits.h>
#include <poll.h>
#include <pthread.h>
#include <signal.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/prctl.h>
#include <sys/resource.h>
#include <sys/socket.h>
#include <sys/stat.h>
#include <sys/syscall.h>
#include <sys/wait.h>
#include <unistd.h>

#ifdef PAYLOAD
static void *thread(void *value) { return value; }

int main(int argc, char **argv, char **env) {
  assert(argc == 3 && !strcmp(argv[2], "sentinel") && !env[0]);
  for (int fd = 3; fd <= 100; fd++) {
    errno = 0;
    assert(fcntl(fd, F_GETFD) == -1 && errno == EBADF);
  }
  assert(write(1, "EXEC\n", 5) == 5);
  if (!strcmp(argv[1], "legacy")) {
    errno = 0;
    assert(read(0, argv, 1) == -1 && errno == EBADF);
    assert(write(1, "legacy\n", 7) == 7);
    return 0;
  }
  assert(!strcmp(argv[1], "node"));
  struct rlimit limit;
  assert(!getrlimit(RLIMIT_FSIZE, &limit));
  assert(limit.rlim_cur == 65536 && limit.rlim_max == 65536);
  assert(!syscall(SYS_prlimit64, 0, RLIMIT_FSIZE, NULL, &limit));
  assert(limit.rlim_cur == 65536 && limit.rlim_max == 65536);
  struct stat input, output;
  assert(!fstat(0, &input) && !fstat(1, &output));
  assert(S_ISFIFO(input.st_mode) && S_ISFIFO(output.st_mode));
  assert((fcntl(0, F_GETFL) & O_ACCMODE) == O_RDONLY);
  int mode = fcntl(1, F_GETFL) & O_ACCMODE;
  assert(mode == O_WRONLY || mode == O_RDWR);
  pthread_t worker;
  void *result;
  assert(!pthread_create(&worker, NULL, thread, &input));
  assert(!pthread_join(worker, &result) && result == &input);
  struct sched_param scheduling;
  assert(!sched_getparam(0, &scheduling) && sched_getscheduler(0) >= 0);
  errno = 0;
  assert(waitpid(-1, NULL, WNOHANG) == -1 && errno == ECHILD);
  const long denied[] = {SYS_socket, SYS_socketpair, SYS_recvmsg, SYS_ptrace,
                         SYS_unshare, SYS_setns};
  for (size_t i = 0; i < sizeof(denied) / sizeof(denied[0]); i++) {
    errno = 0;
    assert(syscall(denied[i], -1L, -1L, -1L, -1L) == -1 && errno == EACCES);
  }
  errno = 0;
  assert(syscall(SYS_clone3, NULL, 0) == -1 && errno == ENOSYS);
  errno = 0;
  assert(syscall(SYS_clone, CLONE_THREAD, 0, 0, 0, 0) == -1 && errno == EACCES);
  errno = 0;
  assert(open(argv[0], O_WRONLY) == -1 && errno == EACCES);
  char buffer[128];
  ssize_t n;
  while ((n = read(0, buffer, sizeof(buffer))) > 0)
    assert(write(1, buffer, (size_t)n) == n);
  assert(n == 0);
  return 0;
}
#else
#include "report-node-policy.h"

static void readable(int fd) {
  struct pollfd p = {.fd = fd, .events = POLLIN};
  assert(poll(&p, 1, 2000) == 1 && !(p.revents & (POLLERR | POLLNVAL)));
}

static char byte(int fd) {
  readable(fd);
  char value;
  assert(read(fd, &value, 1) == 1);
  return value;
}

static void quiet(int fd) {
  struct pollfd p = {.fd = fd, .events = POLLIN};
  assert(poll(&p, 1, 100) == 0);
}

static int reserve(int fd) {
  if (fd < 0) return -1;
  int copy = fcntl(fd, F_DUPFD_CLOEXEC, 110);
  assert(copy >= 110);
  return copy;
}

int main(int argc, char **argv) {
  assert(argc == 5);
  alarm(10);
  const char *scenario = argv[4];
  int legacy = !strcmp(scenario, "legacy");
  int reject = !strncmp(scenario, "reject-", 7);
  int denied = !strcmp(scenario, "bad-command") || !strcmp(scenario, "control-eof") ||
               !strcmp(scenario, "exec-error");
  int control[2], ready[2], input[2], output[2];
  assert(!pipe2(control, O_CLOEXEC) && !pipe2(ready, O_CLOEXEC));
  assert(!pipe2(input, O_CLOEXEC) && !pipe2(output, O_CLOEXEC));
  int data_in = input[0], data_out = output[1], sockets[2] = {-1, -1};
  if (strstr(scenario, "socket"))
    assert(!socketpair(AF_UNIX, SOCK_STREAM | SOCK_CLOEXEC, 0, sockets));
  if (!strcmp(scenario, "reject-input-file")) data_in = open(argv[3], O_RDONLY | O_CLOEXEC);
  if (!strcmp(scenario, "reject-output-file")) data_out = open(argv[3], O_WRONLY | O_CLOEXEC);
  if (!strcmp(scenario, "reject-input-socket")) data_in = sockets[0];
  if (!strcmp(scenario, "reject-output-socket")) data_out = sockets[0];
  if (!strcmp(scenario, "reject-input-writable")) data_in = input[1];
  if (!strcmp(scenario, "reject-output-readonly")) data_out = output[0];
  if (!strcmp(scenario, "rdwr")) {
    char path[64];
    assert(snprintf(path, sizeof(path), "/proc/self/fd/%d", output[1]) > 0);
    data_out = open(path, O_RDWR | O_CLOEXEC);
  }
  assert(data_in >= 0 && data_out >= 0);
  if (!strcmp(scenario, "reject-input-missing")) data_in = -1;
  if (!strcmp(scenario, "reject-output-missing")) data_out = -1;
  int policy = report_node_policy();
  assert(policy >= 0 && lseek(policy, 0, SEEK_CUR) == 0);
  int seals = F_SEAL_SEAL | F_SEAL_SHRINK | F_SEAL_GROW | F_SEAL_WRITE;
  assert(fcntl(policy, F_GET_SEALS) == seals);
  assert(fcntl(policy, F_GETFD) & FD_CLOEXEC);
  errno = 0;
  assert(write(policy, "x", 1) == -1 && errno == EPERM);
  errno = 0;
  assert(ftruncate(policy, 0) == -1 && errno == EPERM);
  struct sock_filter code[4096];
  ssize_t size = read(policy, code, sizeof(code));
  assert(size > 0 && size < (ssize_t)sizeof(code) && size % sizeof(code[0]) == 0);
  struct sock_fprog filter = {.len = (unsigned short)(size / sizeof(code[0])), .filter = code};
  assert(!close(policy));

  pid_t child = fork();
  assert(child >= 0);
  if (!child) {
    alarm(5);
    int commands = reserve(control[0]), events = reserve(ready[1]);
    int in = reserve(data_in), out = reserve(data_out), stdout_fd = reserve(output[1]);
    assert(dup2(commands, 0) == 0 && dup2(events, 100) == 100);
    assert(dup2(stdout_fd, 1) == 1);
    if (!legacy) {
      if (in >= 0) assert(dup2(in, 3) == 3);
      if (out >= 0) assert(dup2(out, 4) == 4);
    }
    for (int fd = 3; fd < 256; fd++)
      if (fd != 100 && (legacy || (fd != 3 && fd != 4))) close(fd);
    if (!legacy && in < 0) close(3);
    if (!legacy && out < 0) close(4);
    assert(!prctl(PR_SET_NO_NEW_PRIVS, 1, 0, 0, 0));
    assert(!prctl(PR_SET_SECCOMP, SECCOMP_MODE_FILTER, &filter));
    char *target = !strcmp(scenario, "exec-error") ? "/missing-fixed-payload" : argv[2];
    char *limit = !strcmp(scenario, "reject-limit") ? "9007199254740992" : "65536";
    char *node_args[] = {argv[1], "--node", limit, target, "node", "sentinel", NULL};
    char *legacy_args[] = {argv[1], target, "legacy", "sentinel", NULL};
    char *missing_args[] = {argv[1], "--node", "65536", NULL};
    char *no_args[] = {argv[1], NULL};
    char *environment[] = {"GATE_MUST_CLEAR=this", NULL};
    char **args = legacy ? legacy_args : node_args;
    if (!strcmp(scenario, "reject-node-no-target")) args = missing_args;
    if (!strcmp(scenario, "reject-no-target")) args = no_args;
    execve(argv[1], args, environment);
    _exit(126);
  }
  assert(!close(control[0]) && !close(ready[1]));
  assert(!close(input[0]) && !close(output[1]));
  if (data_in >= 0 && data_in != input[0] && data_in != input[1] && data_in != sockets[0])
    assert(!close(data_in));
  if (data_out >= 0 && data_out != output[0] && data_out != output[1] && data_out != sockets[0])
    assert(!close(data_out));
  if (sockets[0] >= 0) assert(!close(sockets[0]) && !close(sockets[1]));
  if (reject) {
    assert(byte(ready[0]) == 'E');
  } else {
    assert(byte(ready[0]) == 'R');
    quiet(output[0]);
    int status;
    assert(waitpid(child, &status, WNOHANG) == 0);
    if (!legacy) assert(write(input[1], "dedicated input\n", 16) == 16);
    quiet(output[0]);
    if (strcmp(scenario, "control-eof"))
      assert(write(control[1], !strcmp(scenario, "bad-command") ? "X" : "Gcontrol-only", !strcmp(scenario, "bad-command") ? 1 : 13) > 0);
    if (denied && strcmp(scenario, "control-eof")) assert(byte(ready[0]) == 'E');
  }
  assert(!close(control[1]) && !close(input[1]));
  if (!strcmp(scenario, "control-eof")) assert(byte(ready[0]) == 'E');
  readable(ready[0]);
  char event;
  assert(read(ready[0], &event, 1) == 0);
  assert(!close(ready[0]));
  char actual[256] = {0};
  size_t used = 0;
  for (;;) {
    readable(output[0]);
    ssize_t n = read(output[0], actual + used, sizeof(actual) - used - 1);
    assert(n >= 0);
    if (!n) break;
    used += (size_t)n;
    assert(used < sizeof(actual) - 1);
  }
  assert(!close(output[0]));
  int status;
  assert(waitpid(child, &status, 0) == child && WIFEXITED(status));
  assert(WEXITSTATUS(status) == (reject || denied ? 127 : 0));
  const char *expected = reject || denied ? "" : legacy ? "EXEC\nlegacy\n" : "EXEC\ndedicated input\n";
  assert(!strcmp(actual, expected));
  puts(scenario);
  return 0;
}
#endif
`,
  );
  function run(name, command, args) {
    const result = spawnSync(command, args, {
      cwd,
      env: { ...process.env, TMPDIR: cache },
      encoding: 'utf8',
      timeout: 20_000,
      killSignal: 'SIGKILL',
    });
    appendFileSync(
      join(cache, 'commands.jsonl'),
      `${JSON.stringify({ name, command: [command, ...args], status: result.status, signal: result.signal, stdout: result.stdout, stderr: result.stderr, error: result.error?.message })}\n`,
    );
    assert.ifError(result.error);
    assert.equal(result.signal, null, result.stderr);
    assert.equal(result.status, 0, result.stderr);
  }
  const cc = process.env.CC ?? 'cc';
  const flags = ['-std=c11', '-O2', '-Wall', '-Wextra', '-Werror', '-static'];
  run('build gate', cc, [
    ...flags,
    '-nostdlib',
    '-fno-stack-protector',
    '-fno-builtin',
    '-fno-pie',
    '-no-pie',
    '-Wl,-e,_start',
    'packages/platform/native/isolated-report-gate.c',
    '-o',
    gate,
  ]);
  run('build fixed payload', cc, [...flags, '-DPAYLOAD', '-pthread', source, '-o', payload]);
  run('build driver', cc, [
    ...flags,
    '-I',
    join(cwd, 'packages/platform/native'),
    source,
    '-o',
    driver,
  ]);
  run('build calibration policy emitter', cc, [
    ...flags,
    'tests/fixtures/report-node-runtime/policy.c',
    '-o',
    join(cache, 'policy'),
  ]);
  for (const scenario of [
    'node',
    'rdwr',
    'legacy',
    'bad-command',
    'control-eof',
    'exec-error',
    'reject-limit',
    'reject-input-file',
    'reject-output-file',
    'reject-input-socket',
    'reject-output-socket',
    'reject-input-writable',
    'reject-output-readonly',
    'reject-input-missing',
    'reject-output-missing',
    'reject-node-no-target',
    'reject-no-target',
  ]) {
    await t.test(scenario, () => run(scenario, driver, [gate, payload, regular, scenario]));
  }
});

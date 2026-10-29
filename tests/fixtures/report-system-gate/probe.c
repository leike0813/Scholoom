/* Reuse the unchanged static byte oracle, without replaying its whole OS matrix. */
#define probe_entry original_probe_entry
#include "../isolated-report-native/probe.c"
#undef probe_entry

__attribute__((used, noreturn)) void probe_entry(unsigned long *stack) {
  char **arguments = (char **)(stack + 1);
  if (stack[0] != 3 || !equal(arguments[2], "normal")) finish(64);
  /* close is allowed by the original policy: EBADF proves closure, not filter denial. */
  if (call(__NR_close, 42, 0, 0, 0, 0, 0) != -EBADF_VALUE) finish(90);
  approved_bytes(arguments[1]);
  static const char output[] = "fixed probe consumed approved report bytes\n";
  if (call(__NR_write, 1, (long)output, sizeof(output) - 1, 0, 0, 0) !=
      (long)sizeof(output) - 1) finish(91);
  finish(0);
}

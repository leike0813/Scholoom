/* Emit the production policy for runtime calibration. */
#define _GNU_SOURCE
#include "../../../packages/platform/native/report-node-policy.h"

int main(void) {
  int fd = report_node_policy();
  if (fd < 0)
    return 1;
  char buffer[4096];
  for (;;) {
    ssize_t n = read(fd, buffer, sizeof(buffer));
    if (n < 0 && errno == EINTR)
      continue;
    if (n < 0) {
      close(fd);
      return 1;
    }
    if (!n)
      return close(fd) < 0 ? 1 : 0;
    size_t offset = 0;
    while (offset < (size_t)n) {
      ssize_t written = write(STDOUT_FILENO, buffer + offset, (size_t)n - offset);
      if (written < 0 && errno == EINTR)
        continue;
      if (written <= 0) {
        close(fd);
        return 1;
      }
      offset += (size_t)written;
    }
  }
}

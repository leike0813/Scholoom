#define main report_system_main
#include HEADER_SOURCE
#undef main

#include <assert.h>

int main(int argc, char **argv) {
  assert(getuid() != 0 && geteuid() != 0);
  assert(argc == 3 || argc == 4);
  int directory = open(argv[2], O_RDONLY | O_DIRECTORY | O_NOFOLLOW | O_CLOEXEC);
  assert(directory >= 0);
  if (!strcmp(argv[1], "proc") || !strcmp(argv[1], "account")) {
    char status[8192];
    read_at(directory, argc == 3 ? "status" : argv[3], status, sizeof(status));
    uint32_t uid = account(status, "Uid:"), gid = account(status, "Gid:");
    if (!strcmp(argv[1], "proc")) printf("%" PRIu64 " ", birth(directory));
    printf("%" PRIu32 " %" PRIu32 "\n", uid, gid);
  } else if (!strcmp(argv[1], "birth")) {
    printf("%" PRIu64 "\n", birth(directory));
  } else if (!strcmp(argv[1], "limit")) {
    assert(argc == 4);
    printf("%" PRIu64 "\n", limit(directory, argv[3]));
  } else {
    assert(argc == 4 && !strcmp(argv[1], "read"));
    char text[16];
    read_at(directory, argv[3], text, sizeof(text));
    fputs(text, stdout);
  }
  assert(close(directory) == 0);
  return 0;
}

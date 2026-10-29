/* Host-only Windows metadata adapter. No writes, ACL repair, or launch fallback. */
#define WIN32_LEAN_AND_MEAN
#define _WIN32_WINNT 0x0602
#include <windows.h>
#include <winternl.h>
#include <aclapi.h>
#include <sddl.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <stddef.h>
#include <string.h>
#include <wchar.h>
#include <fcntl.h>
#include <io.h>

#ifndef OBJ_DONT_REPARSE
#define OBJ_DONT_REPARSE 0x00001000L
#endif
#ifndef FILE_OPEN_REPARSE_POINT
#define FILE_OPEN_REPARSE_POINT 0x00200000
#endif
#ifndef FILE_SYNCHRONOUS_IO_NONALERT
#define FILE_SYNCHRONOUS_IO_NONALERT 0x00000020
#endif
#ifndef FILE_OPEN
#define FILE_OPEN 1
#endif

#define MAX_MEMBERS 4096
#define MAX_DEPTH 128
#define MAX_PATH_CHARS 32700
#define MAX_WITNESS (8U * 1024U * 1024U)
#define MAX_READ (256U * 1024U)
#define REFUSED 11
#define TOO_LARGE 12
#define CHANGED 13

typedef NTSTATUS (NTAPI *CreateRelative)(PHANDLE, ACCESS_MASK, POBJECT_ATTRIBUTES,
  PIO_STATUS_BLOCK, PLARGE_INTEGER, ULONG, ULONG, ULONG, ULONG, PVOID, ULONG);
typedef ULONG (WINAPI *StatusError)(NTSTATUS);
static CreateRelative create_relative;
static StatusError status_error;
static HANDLE token;
static TOKEN_USER *user;
static PSID system_sid, administrators_sid, installer_sid, owner_rights_sid, everyone_sid;
static int failure;

typedef struct {
  HANDLE handle;
  wchar_t *path;
  FILE_ID_INFO identity;
  FILE_BASIC_INFO basic;
  FILE_STANDARD_INFO standard;
  BYTE *security;
  DWORD security_length;
  int directory;
} Entry;
typedef struct {
  Entry *entries;
  size_t count, capacity, root, witness_bytes;
  DWORD members, maximum;
  int single_file;
} Scan;
typedef struct { BYTE *bytes; size_t length, capacity; } Bytes;
typedef struct { wchar_t *name; ULONGLONG identity; } Name;

static int refuse(const char *stage, int code) {
  if (!failure) {
    failure = code;
    fprintf(stderr, "resource-tree:%s Win32=%lu\n", stage, (unsigned long)GetLastError());
  }
  return 0;
}
static void *allocate(size_t size) {
  void *value = calloc(1, size);
  if (!value) { SetLastError(ERROR_NOT_ENOUGH_MEMORY); refuse("memory", REFUSED); }
  return value;
}
static wchar_t *copy_name(const wchar_t *value, size_t length) {
  wchar_t *result;
  if (length > MAX_PATH_CHARS) { refuse("path-limit", TOO_LARGE); return NULL; }
  result = allocate((length + 1) * sizeof(wchar_t));
  if (result) memcpy(result, value, length * sizeof(wchar_t));
  return result;
}
static wchar_t *join_path(const wchar_t *parent, const wchar_t *name) {
  size_t a = wcslen(parent), b = wcslen(name);
  wchar_t *result;
  int slash = a && parent[a - 1] != L'\\';
  if (a + b + (size_t)slash > MAX_PATH_CHARS) { refuse("path-limit", TOO_LARGE); return NULL; }
  result = allocate((a + b + (size_t)slash + 1) * sizeof(wchar_t));
  if (!result) return NULL;
  memcpy(result, parent, a * sizeof(wchar_t));
  if (slash) result[a++] = L'\\';
  memcpy(result + a, name, (b + 1) * sizeof(wchar_t));
  return result;
}
static int component(const wchar_t *name) {
  size_t length = wcslen(name), stem;
  if (!length || length > 255 || name[length - 1] == L'.' || name[length - 1] == L' ' ||
      wcspbrk(name, L"\\/:*?\"<>|") || !wcscmp(name, L".") || !wcscmp(name, L".."))
    return refuse("component", REFUSED);
  stem = wcscspn(name, L".");
  if ((stem == 3 && (!_wcsnicmp(name, L"CON", 3) || !_wcsnicmp(name, L"PRN", 3) ||
      !_wcsnicmp(name, L"AUX", 3) || !_wcsnicmp(name, L"NUL", 3))) ||
      (stem == 4 && (!_wcsnicmp(name, L"COM", 3) || !_wcsnicmp(name, L"LPT", 3)) &&
      name[3] >= L'1' && name[3] <= L'9')) return refuse("device-name", REFUSED);
  return 1;
}

static int trusted(PSID sid, int ancestor) {
  return EqualSid(sid, user->User.Sid) || EqualSid(sid, system_sid) ||
    EqualSid(sid, administrators_sid) || (ancestor && EqualSid(sid, installer_sid));
}
static GENERIC_MAPPING mapping = { FILE_GENERIC_READ, FILE_GENERIC_WRITE,
  FILE_GENERIC_EXECUTE, FILE_ALL_ACCESS };
static DWORD ace_mask(ACCESS_ALLOWED_ACE *ace) {
  DWORD mask = ace->Mask;
  MapGenericMask(&mask, &mapping);
  return mask;
}
static PSID ace_sid(ACE_HEADER *header, PSID owner) {
  PSID sid = (BYTE *)header + offsetof(ACCESS_ALLOWED_ACE, SidStart);
  DWORD minimum = (DWORD)offsetof(ACCESS_ALLOWED_ACE, SidStart) + 8;
  if (header->AceSize < minimum ||
      GetSidLengthRequired(((SID *)sid)->SubAuthorityCount) > header->AceSize -
        (DWORD)offsetof(ACCESS_ALLOWED_ACE, SidStart) || !IsValidSid(sid)) return NULL;
  return EqualSid(sid, owner_rights_sid) ? owner : sid;
}
static int access_allowed(PSECURITY_DESCRIPTOR descriptor, int directory, int executable) {
  DWORD desired = FILE_READ_ATTRIBUTES | READ_CONTROL | FILE_READ_DATA;
  DWORD granted = 0, length = 1024;
  BOOL allowed = FALSE;
  PRIVILEGE_SET *privileges;
  if (directory || executable) desired |= FILE_EXECUTE;
  privileges = allocate(length);
  if (!privileges) return 0;
  if (!AccessCheck(descriptor, token, desired, &mapping, privileges, &length, &granted, &allowed)) {
    free(privileges); return refuse("access-query", REFUSED);
  }
  free(privileges);
  return allowed ? 1 : refuse("access-denied", REFUSED);
}

static int security(Entry *entry, int ancestor, int executable) {
  PSECURITY_DESCRIPTOR descriptor = NULL;
  PSID owner = NULL, group = NULL;
  PACL dacl = NULL;
  BOOL present = FALSE, defaulted = FALSE;
  DWORD result, revision = 0, owner_length, group_length;
  SECURITY_DESCRIPTOR_CONTROL control = 0;
  /* System ancestors may create unrelated siblings. They must not replace this path. */
  DWORD dangerous = DELETE | WRITE_DAC | WRITE_OWNER | FILE_WRITE_EA | FILE_WRITE_ATTRIBUTES;
  if (entry->directory) dangerous |= FILE_DELETE_CHILD;
  if (!ancestor) dangerous |= FILE_WRITE_DATA | FILE_APPEND_DATA;
  result = GetSecurityInfo(entry->handle, SE_FILE_OBJECT,
    OWNER_SECURITY_INFORMATION | GROUP_SECURITY_INFORMATION | DACL_SECURITY_INFORMATION,
    &owner, &group, &dacl, NULL, &descriptor);
  if (result != ERROR_SUCCESS) { SetLastError(result); return refuse("security", REFUSED); }
  if (!owner || !IsValidSid(owner) || !group || !IsValidSid(group) ||
      (ancestor ? !trusted(owner, 1) : !EqualSid(owner, user->User.Sid)) ||
      !GetSecurityDescriptorDacl(descriptor, &present, &dacl, &defaulted) || !present || !dacl ||
      !IsValidAcl(dacl)) { refuse("owner-dacl", REFUSED); goto failed; }
  for (DWORD i = 0; i < dacl->AceCount; i++) {
    ACE_HEADER *header;
    PSID sid;
    DWORD mask, denied = 0;
    if (!GetAce(dacl, i, (void **)&header) ||
        (header->AceType != ACCESS_ALLOWED_ACE_TYPE && header->AceType != ACCESS_DENIED_ACE_TYPE) ||
        (header->AceFlags & ~(OBJECT_INHERIT_ACE | CONTAINER_INHERIT_ACE |
          NO_PROPAGATE_INHERIT_ACE | INHERIT_ONLY_ACE | INHERITED_ACE)) ||
        ((header->AceFlags & (NO_PROPAGATE_INHERIT_ACE | INHERIT_ONLY_ACE)) &&
          !(header->AceFlags & (OBJECT_INHERIT_ACE | CONTAINER_INHERIT_ACE))) ||
        !(sid = ace_sid(header, owner)) ||
        (ace_mask((ACCESS_ALLOWED_ACE *)header) & ~(DWORD)FILE_ALL_ACCESS)) { refuse("ace", REFUSED); goto failed; }
    if (header->AceType == ACCESS_DENIED_ACE_TYPE || (header->AceFlags & INHERIT_ONLY_ACE)) continue;
    mask = ace_mask((ACCESS_ALLOWED_ACE *)header) & dangerous;
    if (!mask || trusted(sid, ancestor)) continue;
    /* Only earlier denies for the same trustee or Everyone prove a grant ineffective.
       Unknown group relationships never become an optimistic permission exception. */
    for (DWORD j = 0; j < i; j++) {
      ACE_HEADER *previous;
      PSID previous_sid;
      if (!GetAce(dacl, j, (void **)&previous)) { refuse("ace", REFUSED); goto failed; }
      if (previous->AceType != ACCESS_DENIED_ACE_TYPE || (previous->AceFlags & INHERIT_ONLY_ACE)) continue;
      previous_sid = ace_sid(previous, owner);
      if (!previous_sid) { refuse("ace", REFUSED); goto failed; }
      if (EqualSid(previous_sid, sid) || EqualSid(previous_sid, everyone_sid))
        denied |= ace_mask((ACCESS_ALLOWED_ACE *)previous);
    }
    if (mask & ~denied) { refuse("untrusted-mutation", REFUSED); goto failed; }
  }
  if (!access_allowed(descriptor, entry->directory, executable)) goto failed;
  if (!GetSecurityDescriptorControl(descriptor, &control, &revision)) {
    refuse("security-control", REFUSED); goto failed;
  }
  /* GetSecurityInfo's descriptor may be self-relative. Serialize actual owner/DACL
     values, never absolute pointers or a second security-descriptor conversion. */
  owner_length = GetLengthSid(owner);
  group_length = GetLengthSid(group);
  entry->security_length = (DWORD)sizeof(control) + owner_length + group_length + dacl->AclSize;
  entry->security = allocate(entry->security_length);
  if (!entry->security) goto failed;
  memcpy(entry->security, &control, sizeof(control));
  memcpy(entry->security + sizeof(control), owner, owner_length);
  memcpy(entry->security + sizeof(control) + owner_length, group, group_length);
  memcpy(entry->security + sizeof(control) + owner_length + group_length, dacl, dacl->AclSize);
  LocalFree(descriptor);
  return 1;
failed:
  LocalFree(descriptor);
  return 0;
}

static HANDLE child_handle(HANDLE parent, wchar_t *name) {
  HANDLE result = INVALID_HANDLE_VALUE;
  UNICODE_STRING string;
  OBJECT_ATTRIBUTES attributes;
  IO_STATUS_BLOCK io;
  NTSTATUS status;
  size_t bytes = wcslen(name) * sizeof(wchar_t);
  if (!component(name) || bytes > 65534) return INVALID_HANDLE_VALUE;
  memset(&attributes, 0, sizeof(attributes));
  memset(&io, 0, sizeof(io));
  string.Buffer = name;
  string.Length = (USHORT)bytes;
  string.MaximumLength = (USHORT)bytes;
  attributes.Length = (ULONG)sizeof(attributes);
  attributes.RootDirectory = parent;
  attributes.ObjectName = &string;
  attributes.Attributes = OBJ_DONT_REPARSE;
  status = create_relative(&result, READ_CONTROL | FILE_READ_ATTRIBUTES | FILE_READ_DATA | SYNCHRONIZE,
    &attributes, &io, NULL, 0, FILE_SHARE_READ | FILE_SHARE_WRITE | FILE_SHARE_DELETE,
    FILE_OPEN, FILE_OPEN_REPARSE_POINT | FILE_SYNCHRONOUS_IO_NONALERT, NULL, 0);
  if (status < 0) {
    SetLastError(status_error(status)); refuse("open-child", REFUSED);
    return INVALID_HANDLE_VALUE;
  }
  return result;
}
static void free_scan(Scan *scan) {
  if (!scan) return;
  for (size_t i = 0; i < scan->count; i++) {
    if (scan->entries[i].handle != INVALID_HANDLE_VALUE) CloseHandle(scan->entries[i].handle);
    free(scan->entries[i].path);
    free(scan->entries[i].security);
  }
  free(scan->entries);
  free(scan);
}
static int add_entry(Scan *scan, HANDLE handle, wchar_t *path, int ancestor, int must_directory) {
  Entry *entry;
  FILE_ATTRIBUTE_TAG_INFO tag;
  if (scan->count == scan->capacity) {
    size_t capacity = scan->capacity ? scan->capacity * 2 : 32;
    Entry *next = realloc(scan->entries, capacity * sizeof(Entry));
    if (!next) {
      CloseHandle(handle); free(path); SetLastError(ERROR_NOT_ENOUGH_MEMORY);
      return refuse("memory", REFUSED);
    }
    scan->entries = next; scan->capacity = capacity;
  }
  entry = &scan->entries[scan->count++];
  memset(entry, 0, sizeof(*entry));
  entry->handle = handle; entry->path = path;
  memset(&tag, 0, sizeof(tag));
  if (!GetFileInformationByHandleEx(handle, FileAttributeTagInfo, &tag, sizeof(tag)) ||
      (tag.FileAttributes & FILE_ATTRIBUTE_REPARSE_POINT) ||
      !GetFileInformationByHandleEx(handle, FileIdInfo, &entry->identity, sizeof(entry->identity)) ||
      !GetFileInformationByHandleEx(handle, FileBasicInfo, &entry->basic, sizeof(entry->basic)) ||
      !GetFileInformationByHandleEx(handle, FileStandardInfo, &entry->standard, sizeof(entry->standard)))
    return refuse("object-info", REFUSED);
  entry->directory = !!entry->standard.Directory;
  if ((must_directory && !entry->directory) || entry->standard.DeletePending ||
      (!entry->directory && entry->standard.NumberOfLinks != 1) || GetFileType(handle) != FILE_TYPE_DISK)
    return refuse("object-type", REFUSED);
  if (!security(entry, ancestor, 0)) return 0;
  {
    size_t bytes = 72 + wcslen(path) * sizeof(wchar_t) + entry->security_length;
    if (bytes > MAX_WITNESS - scan->witness_bytes) return refuse("witness-limit", TOO_LARGE);
    scan->witness_bytes += bytes;
  }
  return 1;
}
static int append_path(Scan *scan, wchar_t *relative, int configuration_path) {
  wchar_t *cursor = relative;
  size_t depth = 0;
  while (*cursor) {
    wchar_t *separator = wcschr(cursor, L'\\');
    wchar_t saved = separator ? *separator : 0;
    wchar_t *full;
    HANDLE handle;
    if (separator) *separator = 0;
    if (++depth > MAX_DEPTH || !component(cursor)) return refuse("path-depth", REFUSED);
    full = join_path(scan->entries[scan->count - 1].path, cursor);
    if (!full) return 0;
    handle = child_handle(scan->entries[scan->count - 1].handle, cursor);
    if (separator) *separator = saved;
    if (handle == INVALID_HANDLE_VALUE) { free(full); return 0; }
    if (!add_entry(scan, handle, full, configuration_path && separator,
          configuration_path || separator != NULL || !scan->single_file)) return 0;
    cursor = separator ? separator + 1 : cursor + wcslen(cursor);
  }
  return 1;
}
static int compare_names(const void *left, const void *right) {
  return wcscmp(((const Name *)left)->name, ((const Name *)right)->name);
}
static int enumerate(Scan *scan, size_t parent, unsigned depth) {
  const DWORD buffer_bytes = 65536;
  BYTE *buffer;
  Name *names = NULL;
  size_t count = 0;
  int first = 1, ok = 0;
  if (depth > MAX_DEPTH) return refuse("tree-depth", TOO_LARGE);
  buffer = allocate(buffer_bytes);
  if (!buffer) return 0;
  for (;;) {
    size_t offset = 0;
    memset(buffer, 0, buffer_bytes);
    if (!GetFileInformationByHandleEx(scan->entries[parent].handle,
        first ? FileIdBothDirectoryRestartInfo : FileIdBothDirectoryInfo, buffer, buffer_bytes)) {
      if (GetLastError() == ERROR_NO_MORE_FILES) break;
      refuse("enumerate", REFUSED); goto done;
    }
    first = 0;
    for (;;) {
      FILE_ID_BOTH_DIR_INFO *item;
      wchar_t *name;
      Name *next;
      if (offset > buffer_bytes - offsetof(FILE_ID_BOTH_DIR_INFO, FileName)) {
        refuse("directory-frame", REFUSED); goto done;
      }
      item = (FILE_ID_BOTH_DIR_INFO *)(buffer + offset);
      if (!item->FileNameLength || item->FileNameLength % 2 || item->FileNameLength > 510 ||
          item->FileNameLength > buffer_bytes - offset - offsetof(FILE_ID_BOTH_DIR_INFO, FileName)) {
        refuse("directory-name", REFUSED); goto done;
      }
      name = copy_name(item->FileName, item->FileNameLength / sizeof(wchar_t));
      if (!name) goto done;
      if (!wcscmp(name, L".") || !wcscmp(name, L"..")) free(name);
      else {
        if (count >= scan->maximum - scan->members || !component(name)) {
          free(name); refuse("member-limit", TOO_LARGE); goto done;
        }
        next = realloc(names, (count + 1) * sizeof(Name));
        if (!next) { free(name); SetLastError(ERROR_NOT_ENOUGH_MEMORY); refuse("memory", REFUSED); goto done; }
        names = next;
        names[count].name = name;
        names[count++].identity = (ULONGLONG)item->FileId.QuadPart;
      }
      if (!item->NextEntryOffset) break;
      if (item->NextEntryOffset < offsetof(FILE_ID_BOTH_DIR_INFO, FileName) ||
          item->NextEntryOffset > buffer_bytes - offset) { refuse("directory-offset", REFUSED); goto done; }
      offset += item->NextEntryOffset;
    }
  }
  free(buffer); buffer = NULL;
  if (count > 1) qsort(names, count, sizeof(Name), compare_names);
  scan->members += (DWORD)count;
  for (size_t i = 0; i < count; i++) {
    HANDLE handle;
    wchar_t *path;
    size_t index;
    BY_HANDLE_FILE_INFORMATION opened;
    if (i && !wcscmp(names[i - 1].name, names[i].name)) {
      refuse("enumerated-object-changed", CHANGED); goto done;
    }
    path = join_path(scan->entries[parent].path, names[i].name);
    if (!path) goto done;
    handle = child_handle(scan->entries[parent].handle, names[i].name);
    if (handle == INVALID_HANDLE_VALUE) { free(path); goto done; }
    if (!GetFileInformationByHandle(handle, &opened) ||
        (((ULONGLONG)opened.nFileIndexHigh << 32) | opened.nFileIndexLow) != names[i].identity) {
      CloseHandle(handle); free(path); refuse("enumerated-object-changed", CHANGED); goto done;
    }
    index = scan->count;
    if (!add_entry(scan, handle, path, 0, 0)) goto done;
    if (scan->entries[index].directory && !enumerate(scan, index, depth + 1)) goto done;
  }
  ok = 1;
done:
  free(buffer);
  for (size_t i = 0; i < count; i++) free(names[i].name);
  free(names);
  return ok;
}

static Entry *find_file(Scan *scan, const wchar_t *relative) {
  wchar_t *path = NULL, *normalized = NULL;
  Entry *entry = NULL;
  if (scan->single_file && !wcscmp(relative, L".")) return &scan->entries[scan->root];
  normalized = copy_name(relative, wcslen(relative));
  if (!normalized) return NULL;
  for (wchar_t *p = normalized; *p; p++) if (*p == L'/') *p = L'\\';
  path = join_path(scan->entries[scan->root].path, normalized);
  free(normalized);
  if (!path) return NULL;
  for (size_t i = scan->root; i < scan->count; i++)
    if (!wcscmp(scan->entries[i].path, path)) { entry = &scan->entries[i]; break; }
  free(path);
  return entry;
}
static int check_executable(Scan *scan, const wchar_t *relative) {
  Entry *entry = find_file(scan, relative);
  Entry checked;
  int ok;
  if (!entry || entry->directory) return refuse("executable-member", REFUSED);
  memset(&checked, 0, sizeof(checked));
  /* This is the already enumerated object, not another open by caller-supplied path. */
  checked.handle = entry->handle;
  ok = security(&checked, 0, 1);
  if (ok && (checked.security_length != entry->security_length ||
      memcmp(checked.security, entry->security, entry->security_length)))
    ok = refuse("executable-security-changed", CHANGED);
  free(checked.security);
  return ok;
}

static Scan *scan_tree(const wchar_t *configuration, const wchar_t *relative, DWORD maximum,
    int single_file, const wchar_t *executable) {
  wchar_t full[MAX_PATH_CHARS + 1], volume[4] = L"C:\\", fs[32];
  wchar_t volume_name[128], *volume_end;
  wchar_t *components = NULL, *resource = NULL;
  HANDLE root;
  Scan *scan = allocate(sizeof(Scan));
  DWORD length;
  if (!scan) return NULL;
  scan->maximum = maximum; scan->single_file = single_file;
  length = GetFullPathNameW(configuration, MAX_PATH_CHARS + 1, full, NULL);
  if (length < 4 || length > MAX_PATH_CHARS || full[1] != L':' || full[2] != L'\\' ||
      !((full[0] >= L'A' && full[0] <= L'Z') || (full[0] >= L'a' && full[0] <= L'z'))) {
    refuse("local-path", REFUSED); goto failed;
  }
  while (length > 3 && full[length - 1] == L'\\') full[--length] = 0;
  volume[0] = full[0];
  if (GetDriveTypeW(volume) != DRIVE_FIXED) { refuse("local-volume", REFUSED); goto failed; }
  root = CreateFileW(volume, READ_CONTROL | FILE_READ_ATTRIBUTES | FILE_LIST_DIRECTORY | SYNCHRONIZE,
    FILE_SHARE_READ | FILE_SHARE_WRITE | FILE_SHARE_DELETE, NULL, OPEN_EXISTING,
    FILE_FLAG_BACKUP_SEMANTICS | FILE_FLAG_OPEN_REPARSE_POINT, NULL);
  if (root == INVALID_HANDLE_VALUE) { refuse("open-volume", REFUSED); goto failed; }
  length = GetFinalPathNameByHandleW(root, volume_name, 128, FILE_NAME_NORMALIZED | VOLUME_NAME_GUID);
  volume_end = length && length < 128 ? wcschr(volume_name, L'}') : NULL;
  if (!volume_end || wcsncmp(volume_name, L"\\\\?\\Volume{", 11) ||
      volume_end[1] != L'\\' || volume_end[2]) {
    CloseHandle(root); refuse("volume-root", REFUSED); goto failed;
  }
  if (!GetVolumeInformationByHandleW(root, NULL, 0, NULL, NULL, NULL, fs, 32) || wcscmp(fs, L"NTFS")) {
    CloseHandle(root); refuse("ntfs", REFUSED); goto failed;
  }
  {
    wchar_t *root_name = copy_name(volume, 3);
    if (!root_name) { CloseHandle(root); goto failed; }
    if (!add_entry(scan, root, root_name, 1, 1)) goto failed;
  }
  components = copy_name(full + 3, wcslen(full + 3));
  resource = copy_name(relative, wcslen(relative));
  if (!components || !resource) goto failed;
  for (wchar_t *p = resource; *p; p++) if (*p == L'/') *p = L'\\';
  if (!append_path(scan, components, 1) || !append_path(scan, resource, 0)) goto failed;
  scan->root = scan->count - 1; scan->members = 1;
  if (!single_file && !enumerate(scan, scan->root, 0)) goto failed;
  if (single_file && scan->entries[scan->root].directory) { refuse("file-required", REFUSED); goto failed; }
  if (!single_file && !check_executable(scan, executable)) goto failed;
  free(components); free(resource);
  return scan;
failed:
  free(components); free(resource); free_scan(scan);
  return NULL;
}
static int put(Bytes *output, const void *value, size_t length) {
  size_t need = output->length + length;
  if (need > MAX_WITNESS) return refuse("witness-limit", TOO_LARGE);
  if (need > output->capacity) {
    size_t capacity = output->capacity ? output->capacity * 2 : 4096;
    BYTE *next;
    if (capacity < need) capacity = need;
    if (capacity > MAX_WITNESS) capacity = MAX_WITNESS;
    next = realloc(output->bytes, capacity);
    if (!next) { SetLastError(ERROR_NOT_ENOUGH_MEMORY); return refuse("memory", REFUSED); }
    output->bytes = next; output->capacity = capacity;
  }
  memcpy(output->bytes + output->length, value, length); output->length = need;
  return 1;
}
static int witness(Scan *scan, Bytes *output) {
  for (size_t i = 0; i < scan->count; i++) {
    Entry *entry = &scan->entries[i];
    DWORD name_bytes = (DWORD)(wcslen(entry->path) * sizeof(wchar_t));
    int ancestor = entry->directory && i < scan->root;
    LONGLONG write_time = ancestor ? 0 : entry->basic.LastWriteTime.QuadPart;
    LONGLONG change_time = ancestor ? 0 : entry->basic.ChangeTime.QuadPart;
    LONGLONG size = entry->directory ? 0 : entry->standard.EndOfFile.QuadPart;
    if (!put(output, &name_bytes, 4) || !put(output, entry->path, name_bytes) ||
        !put(output, &entry->identity.VolumeSerialNumber, 8) ||
        !put(output, entry->identity.FileId.Identifier, 16) ||
        !put(output, &entry->basic.FileAttributes, 4) ||
        !put(output, &entry->basic.CreationTime.QuadPart, 8) || !put(output, &write_time, 8) ||
        !put(output, &change_time, 8) || !put(output, &size, 8) ||
        !put(output, &entry->standard.NumberOfLinks, 4) ||
        !put(output, &entry->security_length, 4) || !put(output, entry->security, entry->security_length)) return 0;
  }
  return 1;
}
static int read_file(Scan *scan, const wchar_t *relative, DWORD maximum, Bytes *data) {
  Entry *entry = find_file(scan, relative);
  LARGE_INTEGER zero;
  DWORD received = 0, total = 0;
  if (!entry || entry->directory) return refuse("read-member", REFUSED);
  if (entry->standard.EndOfFile.QuadPart < 0 || (ULONGLONG)entry->standard.EndOfFile.QuadPart > maximum)
    return refuse("read-limit", TOO_LARGE);
  data->bytes = allocate((size_t)maximum + 1);
  if (!data->bytes) return 0;
  data->capacity = (size_t)maximum + 1;
  zero.QuadPart = 0;
  if (!SetFilePointerEx(entry->handle, zero, NULL, FILE_BEGIN)) return refuse("read-position", REFUSED);
  do {
    if (!ReadFile(entry->handle, data->bytes + total, maximum + 1 - total, &received, NULL))
      return refuse("read", REFUSED);
    total += received;
  } while (received && total <= maximum);
  if (total != (ULONGLONG)entry->standard.EndOfFile.QuadPart) return refuse("read-changed", CHANGED);
  data->length = total;
  return 1;
}

static int initialize(void) {
  HANDLE process_token;
  DWORD length = 0, domain_length = 0;
  SID_NAME_USE use;
  wchar_t *domain = NULL;
  FARPROC address;
  HMODULE library = GetModuleHandleW(L"ntdll.dll");
  if (!library) return refuse("ntdll", REFUSED);
  address = GetProcAddress(library, "NtCreateFile");
  if (!address || sizeof(address) != sizeof(create_relative)) return refuse("nt-create", REFUSED);
  memcpy(&create_relative, &address, sizeof(create_relative));
  address = GetProcAddress(library, "RtlNtStatusToDosError");
  if (!address || sizeof(address) != sizeof(status_error)) return refuse("nt-status", REFUSED);
  memcpy(&status_error, &address, sizeof(status_error));
  if (!OpenProcessToken(GetCurrentProcess(), TOKEN_QUERY | TOKEN_DUPLICATE, &process_token))
    return refuse("token", REFUSED);
  if (!DuplicateToken(process_token, SecurityImpersonation, &token)) {
    CloseHandle(process_token); return refuse("token-copy", REFUSED);
  }
  CloseHandle(process_token);
  GetTokenInformation(token, TokenUser, NULL, 0, &length);
  if (!length || length > 4096) return refuse("token-size", REFUSED);
  user = allocate(length);
  if (!user || !GetTokenInformation(token, TokenUser, user, length, &length)) return refuse("token-user", REFUSED);
  if (!ConvertStringSidToSidW(L"S-1-5-18", &system_sid) ||
      !ConvertStringSidToSidW(L"S-1-5-32-544", &administrators_sid) ||
      !ConvertStringSidToSidW(L"S-1-3-4", &owner_rights_sid) ||
      !ConvertStringSidToSidW(L"S-1-1-0", &everyone_sid)) return refuse("well-known-sid", REFUSED);
  length = 0;
  LookupAccountNameW(NULL, L"NT SERVICE\\TrustedInstaller", NULL, &length, NULL, &domain_length, &use);
  if (!length || length > SECURITY_MAX_SID_SIZE || !domain_length || domain_length > 256)
    return refuse("installer-sid", REFUSED);
  installer_sid = allocate(length);
  domain = allocate((size_t)domain_length * sizeof(wchar_t));
  if (!installer_sid || !domain) { free(domain); return 0; }
  if (!LookupAccountNameW(NULL, L"NT SERVICE\\TrustedInstaller", installer_sid, &length,
      domain, &domain_length, &use) || !IsValidSid(installer_sid) ||
      *GetSidSubAuthorityCount(installer_sid) != 6 || *GetSidSubAuthority(installer_sid, 0) != 80 ||
      _wcsicmp(domain, L"NT SERVICE")) {
    free(domain); return refuse("installer-sid", REFUSED);
  }
  free(domain);
  return 1;
}
int wmain(int argc, wchar_t **argv) {
  Scan *first = NULL, *second = NULL;
  Bytes original = {0}, current = {0}, data = {0};
  wchar_t *end;
  unsigned long maximum;
  DWORD header[3];
  int single_file, ok = 0, read_failure = 0;
  if (_setmode(_fileno(stdout), _O_BINARY) == -1) return REFUSED;
  if ((argc != 6 && argc != 8) || !initialize()) goto done;
  maximum = wcstoul(argv[3], &end, 10);
  if (*end || !maximum || maximum > MAX_MEMBERS) { refuse("argument-limit", REFUSED); goto done; }
  single_file = !wcscmp(argv[4], L"file");
  if ((!single_file && (wcscmp(argv[4], L"tree") || !*argv[5])) ||
      (single_file && (maximum != 1 || *argv[5]))) {
    refuse("argument-mode", REFUSED); goto done;
  }
  first = scan_tree(argv[1], argv[2], (DWORD)maximum, single_file, argv[5]);
  if (!first || !witness(first, &original)) goto done;
  if (argc == 8) {
    unsigned long bytes = wcstoul(argv[7], &end, 10);
    if (*end || !bytes || bytes > MAX_READ) { refuse("argument-read", REFUSED); goto done; }
    if (!read_file(first, argv[6], (DWORD)bytes, &data)) {
      read_failure = failure ? failure : REFUSED;
      failure = 0;
      data.length = 0;
    }
  }
  second = scan_tree(argv[1], argv[2], (DWORD)maximum, single_file, argv[5]);
  if (!second || !witness(second, &current)) goto done;
  if (original.length != current.length || memcmp(original.bytes, current.bytes, original.length)) {
    refuse("scan-changed", CHANGED); goto done;
  }
  header[0] = (DWORD)original.length; header[1] = (DWORD)data.length; header[2] = (DWORD)read_failure;
  if (fwrite("PRT1", 1, 4, stdout) != 4 || fwrite(header, 1, 12, stdout) != 12 ||
      fwrite(original.bytes, 1, original.length, stdout) != original.length ||
      (data.length && fwrite(data.bytes, 1, data.length, stdout) != data.length) || fflush(stdout)) {
    refuse("response", REFUSED); goto done;
  }
  ok = 1;
done:
  free_scan(first); free_scan(second);
  free(original.bytes); free(current.bytes); free(data.bytes);
  if (token) CloseHandle(token);
  free(user); free(installer_sid);
  if (system_sid) LocalFree(system_sid);
  if (administrators_sid) LocalFree(administrators_sid);
  if (owner_rights_sid) LocalFree(owner_rights_sid);
  if (everyone_sid) LocalFree(everyone_sid);
  return ok ? 0 : (failure ? failure : REFUSED);
}

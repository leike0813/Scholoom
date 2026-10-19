import type { ImportEntry } from '@scholoom/protocol';

export type ImportSelection = { entries: ImportEntry[]; files: Map<string, File> };
const paths = new WeakMap<ImportSelection, Set<string>>();
const add = (selection: ImportSelection, entry: ImportEntry) => {
  let known = paths.get(selection);
  if (!known) {
    known = new Set();
    paths.set(selection, known);
  }
  if (!known.has(entry.path)) {
    selection.entries.push(entry);
    known.add(entry.path);
  }
  if (selection.entries.length > 10000) throw new Error('一次最多导入10000个文件或目录。');
};
const addFile = (selection: ImportSelection, file: File, path: string) => {
  const parts = path.split('/');
  for (let depth = 1; depth < parts.length; depth++)
    add(selection, { path: parts.slice(0, depth).join('/'), kind: 'dir' });
  add(selection, { path, kind: 'file', size: file.size });
  selection.files.set(path, file);
};
export function selectFiles(files: FileList | readonly File[]): ImportSelection {
  const result: ImportSelection = { entries: [], files: new Map() };
  for (const file of Array.from(files)) addFile(result, file, file.webkitRelativePath || file.name);
  return result;
}
export async function selectDrop(data: DataTransfer): Promise<ImportSelection> {
  // Capture entries synchronously: the browser clears drag data after this event.
  const entries = Array.from(data.items)
    .map((item) => item.webkitGetAsEntry?.())
    .filter((entry) => !!entry);
  const fallback = Array.from(data.files);
  if (!entries.length) return selectFiles(fallback);
  const result: ImportSelection = { entries: [], files: new Map() };
  const walk = async (entry: FileSystemEntry, parent = ''): Promise<void> => {
    const path = parent ? `${parent}/${entry.name}` : entry.name;
    if (entry.isFile) {
      const file = await new Promise<File>((resolve, reject) =>
        (entry as FileSystemFileEntry).file(resolve, reject),
      );
      addFile(result, file, path);
    } else if (entry.isDirectory) {
      add(result, { path, kind: 'dir' });
      const reader = (entry as FileSystemDirectoryEntry).createReader();
      while (true) {
        const children = await new Promise<FileSystemEntry[]>((resolve, reject) =>
          reader.readEntries(resolve, reject),
        );
        if (!children.length) break;
        for (const child of children) await walk(child, path);
      }
    }
  };
  for (const entry of entries) await walk(entry);
  return result;
}
export function encodeChunk(bytes: Uint8Array): string {
  const parts: string[] = [];
  for (let offset = 0; offset < bytes.length; offset += 8192)
    parts.push(String.fromCharCode(...bytes.subarray(offset, offset + 8192)));
  return btoa(parts.join(''));
}

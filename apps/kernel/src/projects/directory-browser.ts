import { opendir, realpath, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import type { BusinessParams, BusinessResult } from '@scholoom/protocol';
import { OperationError } from '../errors.js';
import { within } from './store.js';

export class DirectoryBrowser {
  constructor(private readonly applicationDirectory: string) {}

  async browse(
    input: BusinessParams<'project.browseDirectories'>,
  ): Promise<BusinessResult<'project.browseDirectories'>> {
    let path: string;
    try {
      path = await realpath(input.path ? resolve(input.path) : homedir());
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT')
        throw new OperationError('notFound', '目录不存在。');
      throw error;
    }
    if (!(await stat(path)).isDirectory())
      throw new OperationError('invalidRequest', '目标不是目录。');
    const directories: { name: string; path: string }[] = [];
    const handle = await opendir(path);
    for await (const entry of handle) {
      if (entry.name.startsWith('.') || entry.isSymbolicLink() || !entry.isDirectory()) continue;
      const child = join(path, entry.name);
      if (within(this.applicationDirectory, child)) continue;
      directories.push({ name: entry.name, path: child });
    }
    directories.sort((a, b) => a.name.localeCompare(b.name));
    const parent = dirname(path);
    return {
      path,
      ...(parent !== path ? { parent } : {}),
      directories: directories.slice(0, input.limit ?? 100),
      truncated: directories.length > (input.limit ?? 100),
    };
  }
}

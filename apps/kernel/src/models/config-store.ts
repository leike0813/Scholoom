import { lstat, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Effort } from '@scholoom/protocol';
import { OperationError } from '../errors.js';
import { atomicPrivateFile, privateDirectory } from '../storage/private-files.js';
import { factoryDefaults, minimaxEfforts, minimaxModels } from './minimax.js';

export interface ModelDefaults {
  model: string;
  effort: Effort;
}

const parse = (value: unknown): ModelDefaults => {
  const candidate = value as Partial<ModelDefaults> | null;
  if (
    typeof candidate?.model !== 'string' ||
    !minimaxModels.some((item) => item.id === candidate.model) ||
    typeof candidate.effort !== 'string' ||
    !(minimaxEfforts as readonly string[]).includes(candidate.effort)
  )
    throw new Error('Unrecognized defaults');
  return { model: candidate.model, effort: candidate.effort as Effort };
};

// Application model defaults live next to the provider credential under the same private
// permissions; a missing file means the factory default, a damaged file is reported and
// left untouched instead of being silently replaced.
export class ModelConfigStore {
  private tail = Promise.resolve();
  constructor(private readonly directory: string) {}

  private path(): string {
    return join(this.directory, 'provider.json');
  }

  async load(): Promise<ModelDefaults> {
    let raw: string;
    try {
      const path = this.path();
      const stat = await lstat(path);
      if (
        !stat.isFile() ||
        stat.isSymbolicLink() ||
        (process.platform !== 'win32' && (stat.mode & 0o077) !== 0)
      )
        throw new Error('Unsafe config permissions');
      raw = await readFile(path, 'utf8');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { ...factoryDefaults };
      throw new OperationError(
        'unavailable',
        `默认模型配置 ${this.path()} 不可读或权限不安全；已保留原文件，重新保存默认配置即可修复。`,
      );
    }
    try {
      return parse(JSON.parse(raw));
    } catch {
      throw new OperationError(
        'unavailable',
        `默认模型配置 ${this.path()} 已损坏；已保留原文件，重新保存默认配置即可修复。`,
      );
    }
  }

  save(defaults: ModelDefaults): Promise<void> {
    const run = this.tail.then(async () => {
      parse(defaults);
      await privateDirectory(this.directory);
      await atomicPrivateFile(
        this.directory,
        'provider.json',
        JSON.stringify({ version: 1, model: defaults.model, effort: defaults.effort }),
      );
    });
    this.tail = run.then(
      () => {},
      () => {},
    );
    return run;
  }
}

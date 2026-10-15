import { matchesGlob } from 'node:path';
import type {
  BackendProtocolV2,
  EditResult,
  FileInfo,
  GlobResult,
  GrepResult,
  LsResult,
  ReadRawResult,
  ReadResult,
  WriteResult,
} from 'deepagents';
import { failure } from '../errors.js';
import type { ProjectStore } from '../projects/store.js';

export class ProjectBackend implements BackendProtocolV2 {
  private readBases = new Map<string, { basis: string; content: string }>();
  constructor(
    private readonly project: ProjectStore,
    private readonly signal: AbortSignal,
    private readonly used: (path: string) => void,
    private readonly saved: (path: string) => void | Promise<void>,
  ) {}
  private local(path: string): string {
    return path.replace(/^\/+/, '');
  }
  private guard(): void {
    this.signal.throwIfAborted();
    this.project.check('send');
  }
  private error(error: unknown): { error: string } {
    const info = failure(error);
    return { error: `${info.code}: ${info.message}` };
  }

  async ls(path: string): Promise<LsResult> {
    try {
      this.guard();
      const result = await this.project.list(this.local(path));
      return {
        files: result.entries.map((entry) => ({
          path: `/${entry.path}${entry.kind === 'dir' ? '/' : ''}`,
          is_dir: entry.kind === 'dir',
        })),
      };
    } catch (error) {
      return this.error(error);
    }
  }

  async read(path: string, offset = 0, limit = 500): Promise<ReadResult> {
    try {
      this.guard();
      const local = this.local(path);
      const result = await this.project.read(local);
      if (!result.truncated)
        this.readBases.set(local, { basis: result.basis, content: result.content });
      this.used(local);
      const lines = result.content.split('\n');
      const selected = lines.slice(offset, offset + Math.min(limit, 500));
      const output: ReadResult = {
        content: selected.join('\n').slice(0, 16384),
        mimeType: 'text/plain',
        totalLines: lines.length,
        startLine: offset + 1,
        endLine: offset + selected.length,
      };
      if (offset + selected.length < lines.length) output.nextOffset = offset + selected.length;
      return output;
    } catch (error) {
      return this.error(error);
    }
  }

  async readRaw(path: string): Promise<ReadRawResult> {
    const result = await this.read(path, 0, 500);
    if (result.error) return { error: result.error };
    const now = new Date().toISOString();
    return {
      data: {
        content: result.content ?? '',
        mimeType: 'text/plain',
        created_at: now,
        modified_at: now,
      },
    };
  }

  async write(path: string, content: string): Promise<WriteResult> {
    try {
      this.guard();
      const local = this.local(path);
      await this.project.save(local, content);
      await this.saved(local);
      return { path };
    } catch (error) {
      return this.error(error);
    }
  }

  async edit(
    path: string,
    oldString: string,
    newString: string,
    replaceAll = false,
  ): Promise<EditResult> {
    try {
      this.guard();
      const local = this.local(path);
      const read = this.readBases.get(local);
      if (!read) return { error: 'contentChanged: 请先重新读取整份文件，再提出修改。' };
      const occurrences = oldString ? read.content.split(oldString).length - 1 : 0;
      if (!occurrences || (!replaceAll && occurrences !== 1))
        return { error: 'targetAmbiguous: 修改目标不存在或不唯一，请重新读取并明确目标。' };
      await this.project.save(
        local,
        replaceAll
          ? read.content.replaceAll(oldString, newString)
          : read.content.replace(oldString, newString),
        read.basis,
      );
      this.readBases.delete(local);
      await this.saved(local);
      return { path, occurrences: replaceAll ? occurrences : 1 };
    } catch (error) {
      return this.error(error);
    }
  }

  private async walk(path: string): Promise<{ files: FileInfo[]; truncated: boolean }> {
    const queue = [this.local(path)];
    const files: FileInfo[] = [];
    while (queue.length && files.length < 500) {
      this.guard();
      const directory = queue.shift() as string;
      const result = await this.project.list(directory);
      for (const entry of result.entries) {
        files.push({ path: `/${entry.path}`, is_dir: entry.kind === 'dir' });
        if (entry.kind === 'dir') queue.push(entry.path);
        if (files.length >= 500) break;
      }
      if (result.nextOffset !== undefined) return { files, truncated: true };
    }
    return { files, truncated: queue.length > 0 };
  }

  async glob(pattern: string, path = '/'): Promise<GlobResult> {
    try {
      const result = await this.walk(path);
      return {
        files: result.files.filter((file) =>
          matchesGlob(file.path.slice(1), pattern.replace(/^\//, '')),
        ),
        truncated: result.truncated,
      };
    } catch (error) {
      return this.error(error);
    }
  }

  async grep(
    pattern: string,
    path: string | null = '/',
    glob: string | null = null,
    maxCount: number | null = 100,
  ): Promise<GrepResult> {
    try {
      const result = await this.walk(path ?? '/');
      const matches: Array<{ path: string; line: number; text: string }> = [];
      for (const file of result.files) {
        if (file.is_dir || (glob && !matchesGlob(file.path.slice(1), glob))) continue;
        const read = await this.read(file.path);
        if (typeof read.content !== 'string') continue;
        for (const [index, line] of read.content.split('\n').entries()) {
          if (line.includes(pattern))
            matches.push({ path: file.path, line: index + 1, text: line.slice(0, 1024) });
          if (matches.length >= Math.min(maxCount ?? 100, 100)) return { matches, truncated: true };
        }
      }
      return { matches, truncated: result.truncated };
    } catch (error) {
      return this.error(error);
    }
  }
}

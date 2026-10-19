import { matchesGlob, resolve } from 'node:path';
import { failure } from '@scholoom/platform/node';
import type { ErrorInfo } from '@scholoom/protocol/core';
import { OperationError } from '@scholoom/protocol/core';
import type { ProjectFilePort } from '@scholoom/protocol/projects';
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

export class ProjectBackend implements BackendProtocolV2 {
  private readBases = new Map<string, { basis: string; content: string }>();
  constructor(
    private readonly files: ProjectFilePort,
    private readonly projectId: string,
    private readonly signal: AbortSignal,
    private readonly used: (path: string, fileId: string) => void | Promise<void>,
    private readonly saved: (path: string, fileId?: string) => void | Promise<void>,
    private readonly onError?: (error: ErrorInfo) => void | Promise<void>,
    private readonly expectedOutput?: { path: string; fileId: string },
  ) {}
  private local(path: string): string {
    return path.replace(/^\/+/, '');
  }
  private async guard(): Promise<void> {
    this.signal.throwIfAborted();
    await this.files['project.check']({ projectId: this.projectId, access: 'send' });
  }
  private async expectedIdentity(path: string): Promise<string | undefined> {
    if (
      this.expectedOutput &&
      (await this.files['project.path']({
        projectId: this.projectId,
        path,
        allowMissing: true,
      })) ===
        resolve(
          await this.files['project.path']({
            projectId: this.projectId,
            path: '',
            allowMissing: true,
          }),
          this.expectedOutput.path,
        )
    )
      return this.expectedOutput.fileId;
    return undefined;
  }
  private async error(error: unknown): Promise<{ error: string }> {
    const info = failure(error);
    await this.onError?.(info);
    return { error: `${info.code}: ${info.message}` };
  }

  async ls(path: string): Promise<LsResult> {
    try {
      await this.guard();
      const result = await this.files['files.list']({
        projectId: this.projectId,
        path: this.local(path),
      });
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
      await this.guard();
      const local = this.local(path);
      const result = await this.files['files.read']({ projectId: this.projectId, path: local });
      const lines = result.content.split('\n');
      const selected = lines.slice(offset, offset + Math.min(limit, 500));
      if (offset < 0 || limit <= 0 || !selected.length)
        throw new OperationError('invalidRequest', '材料读取范围无效或已超出正文。');
      const output: ReadResult = {
        content: selected.join('\n').slice(0, 16384),
        mimeType: 'text/plain',
        totalLines: lines.length,
        startLine: offset + 1,
        endLine: offset + selected.length,
      };
      if (!result.truncated)
        this.readBases.set(local, { basis: result.basis, content: result.content });
      if (output.content?.length)
        await this.used(
          local,
          result.fileId ??
            (await this.files['project.material']({ projectId: this.projectId, path: local }))
              .fileId,
        );
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
      await this.guard();
      const local = this.local(path);
      const expectedFileId = await this.expectedIdentity(local);
      const edit = await this.files['project.saveFile']({
        projectId: this.projectId,
        path: local,
        content,
        ...(expectedFileId ? { expectedFileId } : {}),
      });
      try {
        await this.saved(local, edit.fileId);
      } catch {
        throw new OperationError('outcomeUnknown', '文件已保存，进展登记待核查。');
      }
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
      await this.guard();
      const local = this.local(path);
      const read = this.readBases.get(local);
      if (!read)
        return this.error(
          new OperationError('contentChanged', '请先重新读取整份文件，再提出修改。'),
        );
      const occurrences = oldString ? read.content.split(oldString).length - 1 : 0;
      if (!occurrences || (!replaceAll && occurrences !== 1))
        return this.error(
          new OperationError('targetAmbiguous', '修改目标不存在或不唯一，请重新读取并明确目标。'),
        );
      const expectedFileId = await this.expectedIdentity(local);
      const edit = await this.files['project.saveFile']({
        projectId: this.projectId,
        path: local,
        content: replaceAll
          ? read.content.replaceAll(oldString, newString)
          : read.content.replace(oldString, newString),
        basis: read.basis,
        ...(expectedFileId ? { expectedFileId } : {}),
      });
      this.readBases.delete(local);
      try {
        await this.saved(local, edit.fileId);
      } catch {
        throw new OperationError('outcomeUnknown', '文件已保存，进展登记待核查。');
      }
      return { path, occurrences: replaceAll ? occurrences : 1 };
    } catch (error) {
      return this.error(error);
    }
  }

  private async walk(path: string): Promise<{ files: FileInfo[]; truncated: boolean }> {
    const queue = [this.local(path)];
    const files: FileInfo[] = [];
    while (queue.length && files.length < 500) {
      await this.guard();
      const directory = queue.shift() as string;
      const result = await this.files['files.list']({ projectId: this.projectId, path: directory });
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

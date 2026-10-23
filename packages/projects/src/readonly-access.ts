import { type BigIntStats, constants } from 'node:fs';
import { lstat, open } from 'node:fs/promises';
import { join, sep } from 'node:path';
import { fileFingerprint } from '@scholoom/platform/node';
import { OperationError } from '@scholoom/protocol/core';
import {
  type ProjectTargetReadInputs,
  type ProjectTargetReadOutputs,
  projectLimits,
} from '@scholoom/protocol/projects';
import { asc, eq, sql } from 'drizzle-orm';
import { byteBasis } from './files.js';
import * as tables from './schema.js';
import type { ProjectStore } from './store.js';

type Request = ProjectTargetReadInputs['project.readTarget']['request'];
type Result = ProjectTargetReadOutputs['project.readTarget'];
type Descriptor = Extract<Result, { kind: 'describe' }>;
const changed = () => new OperationError('contentChanged', '读取期间文件或登记身份已变化。');

/** Uses existing identities only; no registration, cache or save basis is created. */
export class ProjectTargetReader {
  constructor(private readonly store: ProjectStore) {}

  async read(request: Request): Promise<Result> {
    this.store.check('read');
    if (request.kind === 'list') {
      const { offset, limit } = this.range(request.offset, request.limit ?? 100, 100);
      const rows = this.store.db
        .select()
        .from(tables.fileReferences)
        .where(
          sql`json_extract(${tables.fileReferences.value}, '$.state') = 'present' AND json_extract(${tables.fileReferences.value}, '$.kind') = 'file'`,
        )
        .orderBy(asc(tables.fileReferences.path), asc(tables.fileReferences.id))
        .limit(limit + 1)
        .offset(offset)
        .all();
      const entries: Omit<Descriptor, 'kind'>[] = [];
      for (const row of rows.slice(0, limit)) {
        try {
          const entry = await this.inspect(row.id);
          const { kind: _kind, ...descriptor } = entry;
          entries.push(descriptor);
        } catch (error) {
          this.store.check('read');
          if (
            !(error instanceof OperationError) ||
            ![
              'permissionDenied',
              'notFound',
              'contentChanged',
              'targetAmbiguous',
              'resourceLimit',
            ].includes(error.code)
          )
            throw error;
        }
      }
      this.store.check('read');
      return {
        kind: 'list',
        entries,
        ...(rows.length > limit ? { nextOffset: offset + limit } : {}),
      };
    }
    const path = this.location(request.fileId);
    return this.store.files.coordinate([join(this.store.project.path, path)], async () => {
      this.store.check('read');
      const descriptor = await this.inspect(request.fileId, path, request.basis);
      if (request.kind === 'describe') return descriptor;
      const { offset, limit } = this.range(request.offset, request.limit);
      if (offset > descriptor.size)
        throw new OperationError('invalidRequest', '读取位置超出文件范围。');
      const absolute = join(this.store.project.path, path);
      const handle = await open(
        absolute,
        constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0) | (constants.O_NONBLOCK ?? 0),
      ).catch((error) => {
        if (['ENOENT', 'ELOOP'].includes((error as NodeJS.ErrnoException).code ?? ''))
          throw changed();
        throw error;
      });
      try {
        const opened = await handle.stat({ bigint: true });
        this.verify(opened, request.basis);
        const buffer = Buffer.alloc(Math.min(limit, descriptor.size - offset));
        const { bytesRead } = await handle.read(buffer, 0, buffer.length, offset);
        const after = await handle.stat({ bigint: true });
        this.verify(after, request.basis);
        if (fileFingerprint(opened) !== fileFingerprint(after)) throw changed();
        await this.inspect(request.fileId, path, request.basis, true);
        const { kind: _kind, ...file } = descriptor;
        let bytes = buffer.subarray(0, bytesRead);
        let content: string | undefined;
        if (request.kind === 'readText') {
          if (offset + bytes.length < descriptor.size)
            bytes = bytes.subarray(0, this.textEnd(bytes));
          if (bytes.length === 0 && offset < descriptor.size)
            throw new OperationError('invalidRequest', '读取范围未包含完整字符。');
          try {
            content = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
          } catch {
            throw new OperationError('invalidRequest', '目标不是有效 UTF-8 文本。');
          }
          if (content.includes('\0'))
            throw new OperationError('invalidRequest', '目标不是文本文件。');
        }
        this.store.check('read');
        const next = offset + bytes.length;
        const range = { offset, ...(next < descriptor.size ? { nextOffset: next } : {}) };
        return request.kind === 'readText'
          ? { kind: 'readText', ...file, ...range, content: content ?? '' }
          : { kind: 'readBytes', ...file, ...range, data: bytes.toString('base64') };
      } finally {
        await handle.close();
        this.store.check('read');
      }
    });
  }

  private range(
    offset = 0,
    limit: number = projectLimits.binaryChunkBytes,
    maximum: number = projectLimits.binaryChunkBytes,
  ) {
    if (
      !Number.isSafeInteger(offset) ||
      offset < 0 ||
      !Number.isSafeInteger(limit) ||
      limit < 1 ||
      limit > maximum
    )
      throw new OperationError('invalidRequest', '读取范围无效。');
    return { offset, limit };
  }

  private location(fileId: string): string {
    const row = this.store.db
      .select()
      .from(tables.fileReferences)
      .where(eq(tables.fileReferences.id, fileId))
      .get();
    if (!row) throw new OperationError('unavailable', '目标项目没有该文件的既有登记身份。');
    if (row.value.state !== 'present')
      throw new OperationError('notFound', '目标文件已不存在或已回收。');
    if (row.value.kind !== 'file')
      throw new OperationError('targetAmbiguous', '目标不是普通文件。');
    return row.path;
  }

  private verify(stats: BigIntStats, basis: string): void {
    if (!stats.isFile() || stats.isSymbolicLink() || byteBasis(stats) !== basis) throw changed();
  }

  private async inspect(
    fileId: string,
    expectedPath?: string,
    basis?: string,
    duringRead = false,
  ): Promise<Descriptor> {
    this.store.check('read');
    const path = this.location(fileId);
    if (expectedPath !== undefined && path !== expectedPath) throw changed();
    const absolute = join(this.store.project.path, path);
    const pending = this.store.db
      .select({ id: tables.fileOperations.id })
      .from(tables.fileOperations)
      .where(
        sql`json_extract(${tables.fileOperations.value}, '$.state') IN ('prepared', 'unknown') AND json_extract(${tables.fileOperations.value}, '$.kind') != 'mkdir' AND (${absolute} = json_extract(${tables.fileOperations.details}, '$.destination') OR substr(${absolute}, 1, length(json_extract(${tables.fileOperations.details}, '$.destination')) + 1) = json_extract(${tables.fileOperations.details}, '$.destination') || ${sep})`,
      )
      .limit(1)
      .get();
    if (pending) throw new OperationError('outcomeUnknown', '该位置有待核查操作，请先核查原回执。');
    let located = false;
    try {
      if ((await this.store.path(path)) !== absolute)
        throw new OperationError('permissionDenied', '目标路径包含链接或越界。');
      const before = await lstat(absolute, { bigint: true });
      located = true;
      if (before.isSymbolicLink() || !before.isFile())
        throw new OperationError('permissionDenied', '目标不是无链接的普通文件。');
      if (before.size > BigInt(projectLimits.binaryFileBytes))
        throw new OperationError('resourceLimit', '目标文件超过128MiB读取上限。');
      const actual = basis ?? byteBasis(before);
      this.verify(before, actual);
      if ((await this.store.path(path)) !== absolute || this.location(fileId) !== path)
        throw changed();
      const after = await lstat(absolute, { bigint: true });
      this.verify(after, actual);
      if (fileFingerprint(before) !== fileFingerprint(after)) throw changed();
      this.store.check('read');
      return { kind: 'describe', fileId, path, basis: actual, size: Number(after.size) };
    } catch (error) {
      this.store.check('read');
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        if (located || duringRead) throw changed();
        throw new OperationError('notFound', '目标文件已不存在。');
      }
      throw error;
    }
  }

  private textEnd(bytes: Buffer): number {
    for (let back = 1; back <= Math.min(4, bytes.length); back++) {
      const byte = bytes[bytes.length - back];
      if (byte === undefined || (byte & 0xc0) === 0x80) continue;
      const width = byte < 0x80 ? 1 : byte >= 0xf0 ? 4 : byte >= 0xe0 ? 3 : byte >= 0xc0 ? 2 : 0;
      return width > back ? bytes.length - back : bytes.length;
    }
    return bytes.length;
  }
}

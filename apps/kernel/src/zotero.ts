import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import type { ProcessAdmission } from '@scholoom/platform/node';
import { type CallArguments, type CallContext, OperationError } from '@scholoom/protocol/core';
import {
  type LibraryInputs,
  type LibraryModuleInputs,
  type LibraryModuleOutputs,
  type LibraryOutputs,
  libraryOperations,
} from '@scholoom/protocol/library';
import {
  journalOriginal,
  type ZoteroInputs,
  type ZoteroInspection,
  type ZoteroOutputs,
  type ZoteroSnapshot,
  zoteroHostCallbacks,
  zoteroOperations,
} from '@scholoom/protocol/zotero';
import type { ManagedCommands } from './commands.js';
import { HostConnection } from './host-connection.js';

export type IsolatedZotero = {
  libraryId: string;
  executable: string;
  args: readonly string[];
  packageDirectory: string;
};
type Methods =
  | 'library.get'
  | 'library.status'
  | 'library.record'
  | 'library.commitRecords'
  | 'library.commitResult';
type Inputs = Pick<LibraryInputs, Methods> & Pick<LibraryModuleInputs, 'library.check'>;
type Outputs = Pick<LibraryOutputs, Methods> & Pick<LibraryModuleOutputs, 'library.check'>;
type Port = { call<A extends CallArguments<Inputs>>(...args: A): Promise<Outputs[A[0]]> };

/** Only explicitly supplied isolated libraries can reach a native host. No product enable switch. */
export class ZoteroOperations {
  private host: HostConnection | undefined;
  private running = false;
  private closing = false;
  constructor(
    private readonly directory: string,
    private readonly commands: ManagedCommands,
    private readonly admission: ProcessAdmission,
    private readonly port: (context: CallContext) => Port,
    private readonly configuration?: IsolatedZotero,
  ) {}
  workspace(id: string) {
    return this.host?.instanceId === id ? this.host.workspace() : undefined;
  }
  private async check(port: Port, libraryId: string, write: boolean, send: boolean) {
    if (!this.configuration || this.configuration.libraryId !== libraryId)
      throw new OperationError('unavailable', '仅开放宿主配置中明确指定的隔离期刊库。');
    await port.call('library.check', { access: 'read' });
    if (write) await port.call('library.check', { access: 'write' });
    if (send) await port.call('library.check', { access: 'send' });
    if ((await port.call('library.status', {})).id !== libraryId)
      throw new OperationError('instanceMismatch', '共同库实例已变化。');
  }
  async result(input: ZoteroInputs['zotero.result'], context: CallContext) {
    const port = this.port(context);
    await this.check(port, input.libraryId, false, context.principal.kind === 'agent');
    return port.call('library.commitResult', input);
  }
  private async read(port: Port, input: ZoteroInputs['zotero.inspect']) {
    if (new Set(input.sources.map((source) => source.sourceId)).size !== input.sources.length)
      throw new OperationError('invalidRequest', '不能重复选择同一条目。');
    const sources: ZoteroInspection[] = [];
    const records: ZoteroSnapshot = [];
    let bytes = 16;
    for (const selected of input.sources) {
      const source = await port.call('library.get', { sourceId: selected.sourceId });
      const record = await port.call('library.record', {
        libraryId: input.libraryId,
        sourceId: selected.sourceId,
      });
      if (source.revision !== record.revision || record.revision !== selected.revision)
        throw new OperationError('contentChanged', 'CSL或原值修订已变化，请重新核对选择。');
      const original = journalOriginal(record);
      if (typeof original.fields.title !== 'string' || !original.fields.title.length)
        throw new OperationError('unavailable', '所选原值缺少准确题名。');
      const item: ZoteroInspection = {
        sourceId: source.id,
        revision: record.revision,
        csl: source.metadata,
        original,
        citationKey: record.citationKey,
        comparison: {
          title: source.metadata.title === original.fields.title ? 'equal' : 'different',
          remaining: 'notComparable',
        },
      };
      bytes += Buffer.byteLength(JSON.stringify(item)) + 1;
      if (bytes > 256 * 1024)
        throw new OperationError('tooLarge', '所选原值及CSL核对结果超过256KiB。');
      sources.push(item);
      records.push(record);
    }
    return { sources, records };
  }
  async inspect(
    input: ZoteroInputs['zotero.inspect'],
    context: CallContext,
  ): Promise<ZoteroOutputs['zotero.inspect']> {
    const request = structuredClone(input);
    const port = this.port(context);
    await this.check(port, request.libraryId, false, context.principal.kind === 'agent');
    const { sources } = await this.read(port, request);
    await this.check(port, request.libraryId, false, context.principal.kind === 'agent');
    return { sources };
  }
  async replaceTitle(
    input: ZoteroInputs['zotero.replaceTitle'],
    context: CallContext,
  ): Promise<ZoteroOutputs['zotero.replaceTitle']> {
    if (this.closing) throw new OperationError('shuttingDown', '隔离宿主正在关闭。');
    if (this.running) throw new OperationError('resourceLimit', '隔离宿主正在执行。');
    this.running = true;
    try {
      const request = structuredClone(input);
      const port = this.port(context);
      const send = context.principal.kind === 'agent';
      await this.check(port, request.libraryId, true, send);
      const previous = await port.call('library.commitResult', {
        libraryId: request.libraryId,
        requestId: request.requestId,
      });
      if (previous.state !== 'notFound')
        return { requestId: request.requestId, state: 'queried', receipt: previous };
      const { sources } = await this.read(port, {
        libraryId: request.libraryId,
        sources: [{ sourceId: request.sourceId, revision: request.revision }],
      });
      const selected = sources[0];
      if (!selected || !isDeepStrictEqual(selected.original.identity, request.identity))
        throw new OperationError('contentChanged', '所选原值身份已变化。');
      await this.check(port, request.libraryId, true, send);
      const commit: LibraryInputs['library.commitRecords'] = {
        libraryId: request.libraryId,
        requestId: request.requestId,
        changes: [
          {
            sourceId: request.sourceId,
            revision: request.revision,
            original: {
              ...selected.original,
              fields: { ...selected.original.fields, title: request.title },
            },
          },
        ],
      };
      let receipt: LibraryOutputs['library.commitRecords'];
      try {
        const result = await port.call('library.commitRecords', commit);
        receipt = result;
      } catch {
        throw new OperationError(
          'outcomeUnknown',
          '原值题名更正结果未确认；请按原requestId查询，不重放。',
        );
      }
      await this.check(port, request.libraryId, false, send);
      return { requestId: request.requestId, state: receipt.state, receipt };
    } finally {
      this.running = false;
    }
  }
  async execute(
    method: 'zotero.fillKeys' | 'zotero.export',
    input: ZoteroInputs['zotero.fillKeys'] | ZoteroInputs['zotero.export'],
    context: CallContext,
  ): Promise<ZoteroOutputs['zotero.fillKeys'] | ZoteroOutputs['zotero.export']> {
    if (this.closing) throw new OperationError('shuttingDown', '隔离宿主正在关闭。');
    if (this.running) throw new OperationError('resourceLimit', '隔离宿主正在执行。');
    this.running = true;
    try {
      return await this.run(method, structuredClone(input), context);
    } finally {
      this.running = false;
    }
  }
  private async run(
    method: 'zotero.fillKeys' | 'zotero.export',
    input: ZoteroInputs['zotero.fillKeys'] | ZoteroInputs['zotero.export'],
    context: CallContext,
  ): Promise<ZoteroOutputs['zotero.fillKeys'] | ZoteroOutputs['zotero.export']> {
    const port = this.port(context);
    const fill = method === 'zotero.fillKeys';
    const send = !fill || context.principal.kind === 'agent';
    await this.check(port, input.libraryId, fill, send);
    if (new Set(input.sources.map((source) => source.sourceId)).size !== input.sources.length)
      throw new OperationError('invalidRequest', '不能重复选择同一条目。');
    const operationId = fill ? (input as ZoteroInputs['zotero.fillKeys']).operationId : undefined;
    if (operationId) {
      const previous = await port.call('library.commitResult', {
        libraryId: input.libraryId,
        requestId: operationId,
      });
      if (previous.state !== 'notFound')
        return { operationId, state: 'queried', receipt: previous, notification: 'notRun' };
    }
    let snapshot: ZoteroSnapshot = [];
    if (!fill) {
      const request = input as ZoteroInputs['zotero.export'];
      const readback = await this.read(port, request);
      for (const [index, source] of request.sources.entries()) {
        if (
          source.expression &&
          !isDeepStrictEqual(source.expression.identity, readback.sources[index]?.original.identity)
        )
          throw new OperationError('contentChanged', '所选导出表达的原值身份已变化。');
      }
      if (request.sources.some((source) => !source.expression)) {
        await this.check(port, request.libraryId, false, true);
        return { state: 'selectionRequired', sources: readback.sources };
      }
      if (readback.records.some((record) => !record.citationKey))
        throw new OperationError('unavailable', '导出前必须明确补齐正式键。');
      snapshot = readback.records;
    } else
      for (const source of input.sources) {
        const record = await port.call('library.record', {
          libraryId: input.libraryId,
          sourceId: source.sourceId,
        });
        if (record.revision !== source.revision)
          throw new OperationError('contentChanged', '所选题录版本已变化。');
        journalOriginal(record);
        snapshot.push(record);
      }
    const configuration = this.configuration;
    if (!configuration) throw new OperationError('unavailable', '未配置隔离宿主。');
    await mkdir(this.directory, { recursive: true, mode: 0o700 });
    const profile = join(this.directory, randomUUID());
    await mkdir(profile, { mode: 0o700 });
    const filename = join(profile, 'operation.json');
    const serialized = JSON.stringify({
      profile,
      packageDirectory: configuration.packageDirectory,
      snapshot,
    });
    if (Buffer.byteLength(serialized) > 256 * 1024)
      throw new OperationError('tooLarge', '期刊投影超过256KiB。');
    await writeFile(filename, serialized, { mode: 0o600, flag: 'wx' });
    let submitted = false;
    if (this.closing) throw new OperationError('shuttingDown', '隔离宿主正在关闭。');
    const host = new HostConnection({
      directory: this.directory,
      kernelInstanceId: randomUUID(),
      scope: 'isolated-library-journals',
      commands: this.commands,
      admission: this.admission,
      executable: configuration.executable,
      args: [...configuration.args, filename],
      operations: { [method]: zoteroOperations[method] },
      callbacks: {
        contracts: {
          ...zoteroHostCallbacks,
          'library.commitRecords': libraryOperations['library.commitRecords'],
          'library.commitResult': libraryOperations['library.commitResult'],
        },
        authorize: (operation, callback) => {
          if (operation.method !== 'zotero.fillKeys' || !isDeepStrictEqual(operation.input, input))
            throw new OperationError('permissionDenied', '回调不属于本次补键。');
          if (callback.method === 'zotero.readCommitted') {
            if (!submitted)
              throw new OperationError('permissionDenied', '提交前不能读回派生结果。');
            return;
          }
          const params = callback.input as Record<string, unknown>;
          if (params.libraryId !== input.libraryId)
            throw new OperationError('permissionDenied', '回调库范围不符。');
          if (params.requestId !== operationId)
            throw new OperationError('permissionDenied', '操作身份不符。');
          if (callback.method === 'library.commitRecords') {
            if (submitted)
              throw new OperationError('outcomeUnknown', '不得重放共同提交；查询原操作。');
            const request = callback.input as LibraryInputs['library.commitRecords'];
            for (const change of request.changes) {
              const record = snapshot.find((record) => record.sourceId === change.sourceId);
              const original = record?.originals[0];
              if (
                !record ||
                change.revision !== record.revision ||
                record.citationKey ||
                !change.key ||
                change.key.intent !== 'candidate' ||
                change.key.pinned ||
                !change.key.value ||
                change.metadata ||
                (change.original &&
                  (!original ||
                    !isDeepStrictEqual(
                      {
                        ...change.original,
                        fields: { ...change.original.fields, extra: original.fields.extra },
                      },
                      { ...original, fields: { ...original.fields, extra: original.fields.extra } },
                    )))
              )
                throw new OperationError(
                  'permissionDenied',
                  '共同提交超出缺键候选及原包Extra清理。',
                );
            }
            submitted = true;
          }
        },
        call: async (method, params, caller) => {
          const current = this.port(caller);
          await this.check(current, input.libraryId, method === 'library.commitRecords', send);
          if (method === 'zotero.readCommitted') {
            const receipt = await current.call('library.commitResult', {
              libraryId: input.libraryId,
              requestId: operationId as string,
            });
            if (receipt.state !== 'committed')
              throw new OperationError('outcomeUnknown', '未确认共同提交，不能刷新投影。');
            const records: ZoteroSnapshot = [];
            let bytes = 2;
            for (const source of snapshot) {
              const record = await current.call('library.record', {
                libraryId: input.libraryId,
                sourceId: source.sourceId,
              });
              bytes += Buffer.byteLength(JSON.stringify(record)) + 1;
              if (bytes > 512 * 1024)
                throw new OperationError('tooLarge', '共同读回超出派生投影预算。');
              records.push(record);
            }
            return records;
          }
          if (method === 'library.commitRecords') {
            return current.call(
              'library.commitRecords',
              params as LibraryInputs['library.commitRecords'],
            );
          }
          if (method === 'library.commitResult')
            return current.call(
              'library.commitResult',
              params as LibraryInputs['library.commitResult'],
            );
          throw new OperationError('permissionDenied', '回调不在本次操作范围。');
        },
      },
    });
    this.host = host;
    let result: ZoteroOutputs['zotero.fillKeys'] | ZoteroOutputs['zotero.export'] | undefined;
    let problem: unknown;
    try {
      await host.start();
      result = (await host.call(method, input, context, operationId)) as
        | ZoteroOutputs['zotero.fillKeys']
        | ZoteroOutputs['zotero.export'];
    } catch (error) {
      problem = error;
    }
    const closed = await host.close();
    if (closed.state !== 'closed')
      throw new OperationError(
        'outcomeUnknown',
        `宿主收尾未确认；核查原操作及监督记录。${String(problem ?? '')} ${closed.reason ?? ''} ${closed.diagnostics}`.slice(
          -512,
        ),
      );
    if (!result) throw problem;
    await this.check(port, input.libraryId, false, send);
    if (!fill) {
      for (const before of snapshot) {
        const after = await port.call('library.record', {
          libraryId: input.libraryId,
          sourceId: before.sourceId,
        });
        if (!isDeepStrictEqual(before, after))
          throw new OperationError('contentChanged', '导出期间题录版本或正式键变化。');
      }
      return {
        ...result,
        sources: snapshot.map((record) => ({
          sourceId: record.sourceId,
          revision: record.revision,
          citationKey: record.citationKey,
          expression: { kind: 'zotero-original', identity: journalOriginal(record).identity },
        })),
      } as ZoteroOutputs['zotero.export'];
    }
    return result;
  }
  async close() {
    this.closing = true;
    const status = await this.host?.close();
    if (status?.pendingCallbacks)
      throw new OperationError('outcomeUnknown', '已受理共同回调尚未结束；保留库及宿主目录。');
  }
}

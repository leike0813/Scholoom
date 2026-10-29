import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { encodeReportHeader } from '../../packages/editor/dist/report-codec.js';
import {
  type ReportResourcePorts,
  ReportResources,
} from '../../packages/editor/dist/report-resources.js';
import { ProcessAdmission } from '../../packages/platform/dist/admission.js';
import {
  type IsolatedReportOptions,
  IsolatedReportProvider,
} from '../../packages/platform/dist/isolated-reports.js';
import { OperationError } from '../../packages/protocol/dist/core.js';
import type { ResourceDescriptor } from '../../packages/protocol/dist/resources.js';

export class CountedAdmission extends ProcessAdmission {
  reservations = 0;
  override reserve(...args: Parameters<ProcessAdmission['reserve']>) {
    this.reservations++;
    return super.reserve(...args);
  }
}
export function barrier() {
  let release = () => {};
  let entered = () => {};
  const waiting = new Promise<void>((resolve) => {
    release = resolve;
  });
  const started = new Promise<void>((resolve) => {
    entered = resolve;
  });
  return {
    started,
    release,
    async wait() {
      entered();
      await waiting;
    },
  };
}

/** Real files, freeze, admission and records; domain authorization/version ports and OS are controlled. */
export async function preparationFixture(root: string) {
  await mkdir(root, { recursive: true });
  const source = join(root, 'source');
  await mkdir(join(source, 'reports', 'assets'), { recursive: true });
  const entry = {
    ref: { source: 'project' as const, projectId: 'p', fileId: 'entry' },
    basis: 'r1',
  };
  const dependency = {
    ref: { source: 'project' as const, projectId: 'p', fileId: 'data' },
    basis: 'd1',
  };
  const manifest = {
    version: 1 as const,
    resources: [
      { ...dependency, path: 'assets/data.json', mediaType: 'application/json' as const },
    ],
    sources: [],
    objects: [],
  };
  const html = `${encodeReportHeader(manifest)}<html><body>真实冻结字节</body></html>`;
  await writeFile(join(source, 'reports', 'index.html'), html);
  // More than one put chunk, including multi-byte content.
  const data = Buffer.from(`{"values":"${'结果'.repeat(50000)}"}`);
  await writeFile(join(source, 'reports', 'assets', 'data.json'), data);
  const descriptors: Record<string, ResourceDescriptor> = {
    entry: {
      ...entry,
      name: 'index.html',
      path: 'reports/index.html',
      format: 'html',
      capabilities: { read: true, write: false, render: false, readingRecords: false },
    },
    data: {
      ...dependency,
      name: 'data.json',
      path: 'reports/assets/data.json',
      format: 'text',
      capabilities: { read: true, write: false, render: false, readingRecords: false },
    },
  };
  const state = {
    granted: true,
    loads: 0,
    reads: 0,
    scopeStarts: 0,
    intentsBeforeScope: [] as boolean[],
    confirmStop: true,
    failStart: false,
    onRead: undefined as undefined | ((id: string) => Promise<void>),
  };
  const authorize = async () => {
    if (!state.granted) throw new OperationError('permissionDenied', 'test authorization revoked');
    if (descriptors.entry?.basis !== entry.basis || descriptors.data?.basis !== dependency.basis)
      throw new OperationError('contentChanged', 'test source version changed');
  };
  const ports: ReportResourcePorts = {
    authorize,
    async describe(locator) {
      const value =
        locator.source === 'project'
          ? locator.fileId
            ? descriptors[locator.fileId]
            : Object.values(descriptors).find((d) => d.path === locator.path)
          : undefined;
      if (!value) throw new OperationError('notFound', 'test resource missing');
      return structuredClone(value);
    },
    async read(input) {
      state.reads++;
      const id = input.ref.source === 'project' ? input.ref.fileId : '';
      await state.onRead?.(id);
      const descriptor = descriptors[id];
      if (!descriptor?.path) throw new OperationError('notFound', 'test resource missing');
      const bytes = await readFile(join(source, descriptor.path));
      const offset = input.offset ?? 0;
      const end = Math.min(bytes.length, offset + (input.limit ?? 262144));
      return {
        ref: descriptor.ref,
        basis: descriptor.basis,
        data: bytes.subarray(offset, end).toString('base64'),
        offset,
        size: bytes.length,
        unit: 'byte',
        truncated: false,
        ...(end < bytes.length ? { nextOffset: end } : {}),
      };
    },
  };
  const reports = new ReportResources(ports);
  const admission = new CountedAdmission(1, 2);
  const privateRoot = join(root, 'provider');
  const image = Buffer.alloc(120);
  Buffer.from('7f454c46020101', 'hex').copy(image);
  image.writeUInt16LE(2, 16);
  image.writeUInt16LE(62, 18);
  image.writeBigUInt64LE(64n, 32);
  image.writeUInt16LE(56, 54);
  image.writeUInt16LE(1, 56);
  image.writeUInt32LE(1, 64);
  image.writeUInt32LE(1, 68);
  const options: IsolatedReportOptions = {
    admission,
    privateRoot,
    authorize,
    programs: [{ id: 'fixed', version: '1', policyId: 'fixed', image, args: [] }],
    policies: [
      {
        id: 'fixed',
        version: '1',
        profile: 'linux-x64-static-v1',
        cpuPercent: 20,
        memoryBytes: 67108864,
        swapBytes: 0,
        tasks: 16,
        outputBytes: 1048576,
        runtimeMs: 30000,
        stopGraceMs: 200,
      },
    ],
  };
  let locked = false;
  const os: NonNullable<ConstructorParameters<typeof IsolatedReportProvider>[1]> = {
    support: async () => {},
    lock: async () => {
      if (locked) throw new OperationError('unavailable', 'test OS lock busy');
      locked = true;
      return {
        alive: () => locked,
        close: async () => {
          locked = false;
        },
      };
    },
    controller: (o) => ({
      hasExited: false,
      async start() {
        const stored = JSON.parse(await readFile(join(o.path, 'receipt.json'), 'utf8'));
        const index = JSON.parse(await readFile(join(privateRoot, 'index.json'), 'utf8')) as {
          instanceId: string;
        }[];
        state.intentsBeforeScope.push(
          stored.status.phase === 'starting' &&
            index.some((i) => i.instanceId === stored.stage.instanceId),
        );
        o.receipt.scopeIntent = true;
        await o.persist();
        state.scopeStarts++;
        if (state.failStart) throw new OperationError('outcomeUnknown', 'test OS create uncertain');
        await o.authorize();
        o.receipt.launchIntent = true;
        o.receipt.status.gateReleased = true;
        await o.persist();
        await o.running();
      },
      async stop() {
        if (!state.confirmStop) return false;
        await o.stopped(false);
        return true;
      },
    }),
    stopRecovered: async () => {
      if (!state.confirmStop) throw new OperationError('outcomeUnknown', 'test OS stop uncertain');
    },
  };
  const provider = new IsolatedReportProvider(options, os);
  await provider.initialize();
  const input = (instanceId: string) => ({ instanceId, programId: 'fixed', policyId: 'fixed' });
  const load = async () => {
    state.loads++;
    const frozen = await reports.freeze(entry);
    return { entryPath: frozen.snapshot.resource.path as string, files: frozen.files };
  };
  const receipt = async (id: string) => {
    const index = JSON.parse(await readFile(join(privateRoot, 'index.json'), 'utf8')) as {
      instanceId: string;
      storageId: string;
    }[];
    const found = index.find((item) => item.instanceId === id);
    if (!found) throw new Error('test receipt not found');
    const directory = join(privateRoot, found.storageId);
    return {
      directory,
      value: JSON.parse(await readFile(join(directory, 'receipt.json'), 'utf8')),
    };
  };
  return {
    provider,
    admission,
    options,
    os,
    state,
    descriptors,
    privateRoot,
    source,
    load,
    input,
    receipt,
    html,
    data,
  };
}

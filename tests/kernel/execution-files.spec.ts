import { expect, test } from '@playwright/test';
import { RpcPeer } from '../../packages/broker/dist/rpc.js';
import { executionFiles, fileProviders } from '../../packages/harness/dist/files.js';
import { isExecutionControlCall } from '../../packages/protocol/dist/execution.js';

test('the declared file bridge preserves binary data and rejects invalid results after effects', async () => {
  const bytes = new Uint8Array([0, 255, 128, 42]);
  let effects = 0;
  let invalid: 'none' | 'shape' | 'encoding' = 'none';
  const providers = fileProviders({
    ls: () => ({ files: [] }),
    read: () => ({ content: bytes, mimeType: 'application/octet-stream' }),
    readRaw: () => ({
      data: {
        content: bytes,
        mimeType: 'application/octet-stream',
        created_at: 'created',
        modified_at: 'modified',
      },
    }),
    write: () => {
      effects++;
      if (invalid === 'encoding')
        return {
          filesUpdate: {
            '/binary': { content: bytes, created_at: 'created', modified_at: 'modified' },
          },
        } as never;
      return invalid === 'shape'
        ? ({ path: 42 } as never)
        : {
            path: '/file',
            filesUpdate: {
              '/binary': {
                content: bytes,
                mimeType: 'application/octet-stream',
                created_at: 'created',
                modified_at: 'modified',
              },
            },
          };
    },
    edit: () => ({ path: '/file' }),
    glob: () => ({ files: [] }),
    grep: () => ({ matches: [] }),
  });
  let host: RpcPeer;
  const child = new RpcPeer({ send: (frame) => host.receive(frame) });
  host = new RpcPeer(
    { send: (frame) => child.receive(frame) },
    {
      request: (method, input) => {
        const args: readonly [string, unknown] = [method, input];
        if (!isExecutionControlCall(args))
          throw Object.assign(new Error('invalid'), { code: 'invalidRequest' });
        if (args[0] === 'execution.files.read') return providers[args[0]](args[1]);
        if (args[0] === 'execution.files.readRaw') return providers[args[0]](args[1]);
        if (args[0] === 'execution.files.write') return providers[args[0]](args[1]);
        throw new Error('unused operation');
      },
    },
  );
  try {
    const backend = executionFiles(child, () => undefined);
    expect((await backend.read('/binary')).content).toEqual(Buffer.from(bytes));
    expect((await backend.readRaw('/binary')).data?.content).toEqual(Buffer.from(bytes));
    const saved = await backend.write('/file', 'new content');
    expect(saved.filesUpdate?.['/binary']?.content).toEqual(Buffer.from(bytes));
    for (const failure of ['shape', 'encoding'] as const) {
      invalid = failure;
      await expect(backend.write('/file', 'new content')).rejects.toMatchObject({
        code: 'outcomeUnknown',
      });
    }
    expect(effects).toBe(3);
    await expect(
      child.request('execution.files.read', { path: 42 }, { waitMs: 1000 }),
    ).rejects.toMatchObject({ code: 'invalidRequest' });
  } finally {
    child.close();
    host.close();
  }
});

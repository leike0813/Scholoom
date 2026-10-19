import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { ResourceAccess } from '../../packages/platform/dist/node.js';
import { type CallContext, OperationError } from '../../packages/protocol/dist/core.js';

test('resource reads are bounded, scoped to the selected consumer and revocable', async () => {
  const root = await mkdtemp(join(tmpdir(), 'scholoom-resource-'));
  const resources = new ResourceAccess('host');
  const context: CallContext = {
    moduleId: 'compute',
    principal: { kind: 'system', id: 'host' },
    role: 'compute',
  };
  let allowed = true;
  try {
    await mkdir(join(root, 'selected'));
    await writeFile(join(root, 'selected', 'material'), Buffer.alloc(300000, 42));
    await writeFile(join(root, 'secret'), 'secret');
    await symlink(join(root, 'secret'), join(root, 'selected', 'escape'));
    const ref = await resources.bind({
      root: join(root, 'selected'),
      owner: 'library',
      consumers: ['compute'],
      check: () => {
        if (!allowed) throw new OperationError('permissionDenied', 'revoked');
      },
    });
    const first = await resources.read(ref, 'material', context);
    expect(Buffer.from(first.base64, 'base64')).toEqual(Buffer.alloc(262144, 42));
    expect(first.nextOffset).toBe(262144);
    expect(
      (await resources.read(ref, 'material', context, first.nextOffset)).nextOffset,
    ).toBeUndefined();
    for (const path of ['../secret', 'escape'])
      await expect(resources.read(ref, path, context)).rejects.toMatchObject({
        code: 'permissionDenied',
      });
    await expect(
      resources.read(ref, 'material', { ...context, moduleId: 'other' }),
    ).rejects.toMatchObject({ code: 'permissionDenied' });
    allowed = false;
    await expect(resources.read(ref, 'material', context)).rejects.toMatchObject({
      code: 'permissionDenied',
    });
    allowed = true;
    resources.revoke(ref);
    await expect(resources.read(ref, 'material', context)).rejects.toMatchObject({
      code: 'permissionDenied',
    });
  } finally {
    await rm(root, { recursive: true });
  }
});

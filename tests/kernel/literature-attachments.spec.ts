import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { copyFile, lstat, mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { LiteratureCatalog } from '../../packages/library/dist/node.js';
import { fileFingerprint } from '../../packages/platform/dist/node.js';
import type { ProjectMaterialPort } from '../../packages/protocol/dist/projects.js';

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'scholoom-attachments-'));
  const profile = join(root, 'profile');
  const catalog = new LiteratureCatalog(profile, () => {});
  await catalog.initialize();
  catalog.grant({ read: true, write: true, send: false, autoBackup: false });
  return {
    root,
    profile,
    catalog,
    close: async () => {
      await catalog.close();
      await rm(root, { recursive: true });
    },
  };
}

test('managed material retains its bytes and identity after the original moves', async () => {
  const f = await fixture();
  try {
    const path = join(f.root, 'synthetic.bin');
    const bytes = Buffer.from([0, 255, 5, 91, 3, 42, 10]);
    await writeFile(path, bytes);
    const input = {
      batchId: randomUUID(),
      paths: [path],
      purpose: '正文',
      version: 'unspecified',
      origin: 'synthetic',
    };
    const batch = f.catalog.importFiles(input);
    expect(f.catalog.importFiles(input).id).toBe(batch.id);
    await expect.poll(() => f.catalog.batch({ batchId: batch.id }).batch.state).toBe('completed');
    const receipt = f.catalog.batch({ batchId: batch.id }).entries[0];
    expect(receipt?.state).toBe('created');
    const sourceId = receipt?.sourceId as string;
    expect(f.catalog.get(sourceId)).toMatchObject({
      metadataOrigin: 'filename',
      attachmentState: 'recorded',
    });
    const attachments = await f.catalog.attachments({ sourceId });
    expect(attachments.attachments).toHaveLength(1);
    const attachment = attachments.attachments[0];
    assert(attachment);
    expect(attachment).toMatchObject({
      id: receipt?.attachmentId,
      storage: 'managed',
      state: 'available',
      purpose: '正文',
    });
    await rename(path, join(f.root, 'moved.bin'));
    const result: Buffer[] = [];
    for (let offset = 0; offset < bytes.length; offset += 3) {
      const chunk = await f.catalog.readAttachment({
        attachmentId: attachment.id,
        offset,
        limit: 3,
      });
      expect(chunk.materialVersionId).toBe(attachment.materialVersionId);
      result.push(Buffer.from(chunk.base64, 'base64'));
    }
    expect(Buffer.concat(result)).toEqual(bytes);
    expect(await readFile(join(f.root, 'moved.bin'))).toEqual(bytes);
  } finally {
    await f.close();
  }
});

test('linked material relocates only to the same bytes and preserves other attachments', async () => {
  const f = await fixture();
  try {
    const path = join(f.root, 'paper.txt'),
      moved = join(f.root, 'moved.txt');
    await writeFile(path, 'original evidence\n');
    const first = f.catalog.importFiles({
      batchId: randomUUID(),
      paths: [path],
      purpose: '正文',
      storage: 'linked',
      version: 'unspecified',
      origin: 'synthetic',
    });
    await expect.poll(() => f.catalog.batch({ batchId: first.id }).batch.state).toBe('completed');
    const item = f.catalog.batch({ batchId: first.id }).entries[0];
    assert(item?.sourceId && item.attachmentId);
    const sourceId = item.sourceId,
      attachmentId = item.attachmentId;
    const original = (await f.catalog.attachments({ sourceId })).attachments[0];
    assert(original);
    const second = f.catalog.importFiles({
      batchId: randomUUID(),
      sourceId,
      paths: [path, join(f.root, 'missing.txt')],
      purpose: '补充材料',
      version: 'unspecified',
      origin: 'synthetic',
    });
    await expect.poll(() => f.catalog.batch({ batchId: second.id }).batch.state).toBe('completed');
    expect(f.catalog.batch({ batchId: second.id }).batch).toMatchObject({
      processed: 2,
      failed: 1,
    });
    expect((await f.catalog.attachments({ sourceId })).attachments).toHaveLength(2);
    await rename(path, moved);
    expect(
      (await f.catalog.attachments({ sourceId })).attachments.find((a) => a.id === attachmentId)
        ?.state,
    ).toBe('missing');
    await writeFile(path, 'different evidence\n');
    await expect(f.catalog.relocateAttachment({ attachmentId, path })).rejects.toMatchObject({
      code: 'contentChanged',
    });
    const relocated = await f.catalog.relocateAttachment({ attachmentId, path: moved });
    expect(relocated).toMatchObject({
      id: attachmentId,
      materialVersionId: original.materialVersionId,
      state: 'available',
    });
    expect(
      Buffer.from((await f.catalog.readAttachment({ attachmentId })).base64, 'base64').toString(),
    ).toBe('original evidence\n');
    await writeFile(moved, 'tampered evidence\n');
    await expect(f.catalog.readAttachment({ attachmentId })).rejects.toMatchObject({
      code: 'contentChanged',
    });
    const supplemental = (await f.catalog.attachments({ sourceId })).attachments.find(
      (a) => a.purpose === '补充材料',
    );
    assert(supplemental);
    expect(
      Buffer.from(
        (await f.catalog.readAttachment({ attachmentId: supplemental.id })).base64,
        'base64',
      ).toString(),
    ).toBe('original evidence\n');
    const replay = f.catalog.importFiles({
      batchId: randomUUID(),
      sourceId,
      paths: [path],
      purpose: '补充材料',
      version: 'unspecified',
      origin: 'synthetic',
    });
    await expect.poll(() => f.catalog.batch({ batchId: replay.id }).batch.state).toBe('completed');
    expect(f.catalog.batch({ batchId: replay.id }).entries[0]).toMatchObject({ state: 'created' });
    const same = f.catalog.importFiles({
      batchId: randomUUID(),
      sourceId,
      paths: [path],
      purpose: '补充材料',
      version: 'unspecified',
      origin: 'synthetic',
    });
    await expect.poll(() => f.catalog.batch({ batchId: same.id }).batch.state).toBe('completed');
    expect(f.catalog.batch({ batchId: same.id }).entries[0]).toMatchObject({
      state: 'reused',
      attachmentId: f.catalog.batch({ batchId: replay.id }).entries[0]?.attachmentId,
    });
    const pending = f.catalog.readAttachment({ attachmentId: supplemental.id });
    f.catalog.grant({ read: false, write: true, send: false, autoBackup: false });
    await expect(pending).rejects.toMatchObject({ code: 'permissionDenied' });
  } finally {
    await f.close();
  }
});

test('backup restores managed bytes independently and lists external dependencies', async () => {
  const f = await fixture();
  let restored: LiteratureCatalog | undefined;
  try {
    const path = join(f.root, 'evidence.txt');
    await writeFile(path, 'backup evidence\n');
    const batch = f.catalog.importFiles({
      batchId: randomUUID(),
      paths: [path],
      purpose: '正文',
      version: 'unspecified',
      origin: 'synthetic',
    });
    await expect.poll(() => f.catalog.batch({ batchId: batch.id }).batch.state).toBe('completed');
    const item = f.catalog.batch({ batchId: batch.id }).entries[0];
    assert(item?.sourceId && item.attachmentId);
    const linked = f.catalog.importFiles({
      batchId: randomUUID(),
      sourceId: item.sourceId,
      paths: [path],
      storage: 'linked',
      purpose: '外部数据',
      version: 'unspecified',
      origin: 'synthetic',
    });
    await expect.poll(() => f.catalog.batch({ batchId: linked.id }).batch.state).toBe('completed');
    const backup = await f.catalog.backup();
    expect(backup).toMatchObject({ scope: 'catalog-and-managed-files' });
    expect(backup.exclusions?.map((entry) => entry.attachmentId)).toContain(
      f.catalog.batch({ batchId: linked.id }).entries[0]?.attachmentId,
    );
    const later = f.catalog.get(item.sourceId);
    f.catalog.update({
      ...later,
      sourceId: later.id,
      metadata: { ...later.metadata, title: 'later metadata' },
    });
    await rm(path);
    const copy = await f.catalog.restore(backup.id, join(f.root, 'restored'));
    restored = new LiteratureCatalog(copy.directory, () => {});
    await restored.initialize();
    expect(
      Buffer.from(
        (await restored.readAttachment({ attachmentId: item.attachmentId })).base64,
        'base64',
      ).toString(),
    ).toBe('backup evidence\n');
    expect(restored.status()).toMatchObject({ read: true, write: false, send: false });
    expect(restored.status().id).not.toBe(f.catalog.status().id);
    expect(f.catalog.get(later.id).metadata.title).toBe('later metadata');
    expect(restored.get(later.id).metadata.title).toBe('evidence.txt');
    expect(
      (await restored.attachments({ sourceId: later.id })).attachments.find(
        (a) => a.storage === 'linked',
      )?.state,
    ).toBe('missing');
  } finally {
    await restored?.close();
    await f.close();
  }
});

test('v1 migration preserves identities and old receipts while clearing expanded write permission', async () => {
  const root = await mkdtemp(join(tmpdir(), 'scholoom-library-v1-'));
  const profile = join(root, 'profile');
  const { mkdir } = await import('node:fs/promises');
  await mkdir(join(profile, 'library'), { recursive: true });
  const require = createRequire(new URL('../../apps/kernel/package.json', import.meta.url));
  const Database = require('better-sqlite3');
  const database = new Database(join(profile, 'library', 'library.sqlite'));
  const originalSql = await readFile(
    new URL('../../packages/library/src/migrations/0000_strange_micromacro.sql', import.meta.url),
    'utf8',
  );
  const journal = JSON.parse(
    await readFile(
      new URL('../../packages/library/src/migrations/meta/_journal.json', import.meta.url),
      'utf8',
    ),
  );
  database.exec(originalSql);
  database.exec(
    'CREATE TABLE __drizzle_migrations (id INTEGER PRIMARY KEY AUTOINCREMENT, hash text NOT NULL, created_at numeric)',
  );
  database
    .prepare('INSERT INTO __drizzle_migrations(hash,created_at) VALUES(?,?)')
    .run(createHash('sha256').update(originalSql).digest('hex'), journal.entries[0].when);
  const input = {
    batchId: 'old-batch',
    json: JSON.stringify([{ title: 'legacy item' }]),
    version: 'published',
    origin: 'legacy',
  };
  const source = {
    id: 'old-source',
    metadata: { title: 'legacy item' },
    version: 'published',
    revision: 1,
    tags: [],
    collectionIds: [],
    relatedIds: [],
    origins: ['legacy'],
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
    attachmentState: 'unavailable',
    analysisState: 'notGenerated',
  };
  database
    .prepare('INSERT INTO sources(id,version,value) VALUES(?,?,?)')
    .run(source.id, source.version, JSON.stringify(source));
  database.prepare('INSERT INTO batches(id,value,request) VALUES(?,?,?)').run(
    input.batchId,
    JSON.stringify({
      id: input.batchId,
      state: 'completed',
      total: 1,
      processed: 1,
      failed: 0,
      origin: 'legacy',
      version: 'published',
      createdAt: '2026-01-01',
    }),
    JSON.stringify(input),
  );
  for (const [key, value] of [
    ['identity', 'legacy-library'],
    ['grants', JSON.stringify({ read: true, write: true, send: true, autoBackup: false })],
  ])
    database.prepare('INSERT INTO meta(key,value) VALUES(?,?)').run(key, value);
  database.pragma('user_version = 1');
  database.close();
  const catalog = new LiteratureCatalog(profile, () => {});
  try {
    await catalog.initialize();
    expect(catalog.status()).toMatchObject({
      id: 'legacy-library',
      read: true,
      write: false,
      send: false,
    });
    expect(catalog.get(source.id)).toMatchObject({ id: source.id, metadataOrigin: 'provided' });
    expect(catalog.batch({ batchId: input.batchId }).batch).toMatchObject({
      kind: 'metadata',
      state: 'completed',
    });
    catalog.grant({ read: true, write: true, send: true, autoBackup: false });
    expect(catalog.ingest(input).id).toBe(input.batchId);
    const before = new Database(join(profile, 'library', 'before-migration.sqlite'), {
      readonly: true,
    });
    expect(before.pragma('user_version', { simple: true })).toBe(1);
    before.close();
    const backupId = `1000-${randomUUID()}`;
    const backupPath = join(profile, 'library', 'backups', backupId);
    await mkdir(backupPath, { recursive: true });
    await copyFile(
      join(profile, 'library', 'before-migration.sqlite'),
      join(backupPath, 'library.sqlite'),
    );
    await writeFile(
      join(backupPath, 'manifest.json'),
      JSON.stringify({ id: backupId, createdAt: '2026-01-01', scope: 'catalog-database' }),
    );
    const restored = await catalog.restore(backupId, join(root, 'legacy-copy'));
    const copy = new LiteratureCatalog(restored.directory, () => {});
    try {
      await copy.initialize();
      expect(copy.get(source.id).metadata.title).toBe('legacy item');
      expect(copy.status()).toMatchObject({ read: true, write: false, send: false });
    } finally {
      await copy.close();
    }
  } finally {
    await catalog.close();
    await rm(root, { recursive: true });
  }
});

test('process termination preserves committed attachments and resume handles only pending items', async () => {
  const root = await mkdtemp(join(tmpdir(), 'scholoom-material-crash-'));
  const path = join(root, 'input.bin'),
    profile = join(root, 'profile');
  await writeFile(path, Buffer.alloc(256 * 1024, 42));
  const module = new URL('../../packages/library/dist/node.js', import.meta.url).href;
  const code = `const {LiteratureCatalog}=await import(process.argv[1]);
    let sent=false;const catalog=new LiteratureCatalog(process.argv[2],()=>{
      let batch;try{batch=catalog.batch({batchId:'crash'}).batch;}catch{return;}
      if(!sent&&batch.processed>0){sent=true;process.send('committed');}
    });await catalog.initialize();catalog.grant({read:true,write:true,send:false,autoBackup:false});
    catalog.importFiles({batchId:'crash',paths:Array(100).fill(process.argv[3]),purpose:'正文',version:'unspecified',origin:'synthetic'});
    await new Promise(()=>{});`;
  const child = spawn(
    process.execPath,
    ['--input-type=module', '-e', code, module, profile, path],
    { stdio: ['ignore', 'ignore', 'pipe', 'ipc'] },
  );
  // 授权通知早于批次存在；只在回执可查时触发故障。
  let catalog: LiteratureCatalog | undefined;
  try {
    await Promise.race([
      once(child, 'message'),
      once(child, 'exit').then(() => {
        throw new Error('Child ended before a committed receipt');
      }),
    ]);
    const exited = once(child, 'exit');
    child.kill('SIGKILL');
    await exited;
    catalog = new LiteratureCatalog(profile, () => {});
    await catalog.initialize();
    const before = catalog.batch({ batchId: 'crash', limit: 100 });
    expect(before.batch.state).toBe('interrupted');
    expect(before.batch.processed).toBeGreaterThan(0);
    expect(before.batch.processed).toBeLessThan(100);
    const committed = before.entries
      .filter((entry) => entry.state === 'created')
      .map((entry) => [entry.index, entry.attachmentId]);
    catalog.resume('crash');
    await expect.poll(() => catalog?.batch({ batchId: 'crash' }).batch.state).toBe('completed');
    const after = catalog.batch({ batchId: 'crash', limit: 100 });
    expect(after.batch).toMatchObject({ processed: 100, failed: 0 });
    for (const [index, id] of committed)
      expect(after.entries[index as number]?.attachmentId).toBe(id);
    expect(new Set(after.entries.map((entry) => entry.attachmentId)).size).toBe(100);
  } finally {
    if (child.exitCode === null && child.signalCode === null) {
      const exited = once(child, 'exit');
      child.kill('SIGKILL');
      await exited;
    }
    await catalog?.close();
    await rm(root, { recursive: true });
  }
});

test('revocation during project file preparation leaves a pending receipt for explicit restart', async () => {
  const root = await mkdtemp(join(tmpdir(), 'scholoom-material-grants-'));
  const profile = join(root, 'profile'),
    path = join(root, 'input.txt');
  await writeFile(path, 'authorized material\n');
  let permitted = true,
    revokeInPath = true;
  const access: ProjectMaterialPort = {
    'project.checkRead': async () => {
      if (!permitted)
        throw Object.assign(new Error('permission revoked'), { code: 'permissionDenied' });
      return { ok: true };
    },
    'project.material': async () => {
      if (revokeInPath) {
        revokeInPath = false;
        permitted = false;
      }
      return {
        projectId: 'project',
        fileId: 'source',
        nativePath: path,
        basis: fileFingerprint(await lstat(path, { bigint: true })),
      };
    },
  };
  let catalog = new LiteratureCatalog(profile, () => {}, access);
  try {
    await catalog.initialize();
    catalog.grant({ read: true, write: true, send: false, autoBackup: false });
    const input = {
      batchId: 'project-pending',
      projectId: 'project',
      projectPaths: ['input.txt'],
      purpose: '正文',
      version: 'unspecified',
      origin: 'synthetic',
    };
    await catalog.importProjectFiles(input);
    await expect
      .poll(() => catalog.batch({ batchId: input.batchId }).batch.state)
      .toBe('interrupted');
    expect(catalog.batch({ batchId: input.batchId }).batch.processed).toBe(0);
    expect(catalog.list({}).sources).toHaveLength(0);
    await catalog.close();
    catalog = new LiteratureCatalog(profile, () => {}, access);
    await catalog.initialize();
    catalog.resume(input.batchId);
    await expect
      .poll(() => catalog.batch({ batchId: input.batchId }).batch.state)
      .toBe('interrupted');
    expect(catalog.batch({ batchId: input.batchId }).entries[0]?.state).toBe('pending');
    permitted = true;
    catalog.resume(input.batchId);
    await expect
      .poll(() => catalog.batch({ batchId: input.batchId }).batch.state)
      .toBe('completed');
    expect(catalog.batch({ batchId: input.batchId }).batch).toMatchObject({
      failed: 0,
      processed: 1,
    });
    expect(catalog.list({}).sources).toHaveLength(1);
  } finally {
    await catalog.close();
    await rm(root, { recursive: true });
  }
});

test('complete material awaiting publication survives a crash without adopting changed input', async () => {
  const root = await mkdtemp(join(tmpdir(), 'scholoom-publication-crash-'));
  const profile = join(root, 'profile'),
    path = join(root, 'input.txt');
  await writeFile(path, 'material A\n');
  const module = new URL('../../packages/library/dist/node.js', import.meta.url).href;
  const code = `import fs from 'node:fs/promises';import {syncBuiltinESMExports} from 'node:module';
    fs.link=async()=>{setInterval(()=>{},1000);process.send('ready');await new Promise(()=>{});};syncBuiltinESMExports();
    const {LiteratureCatalog}=await import(process.argv[1]);const catalog=new LiteratureCatalog(process.argv[2],()=>{});
    await catalog.initialize();catalog.grant({read:true,write:true,send:false,autoBackup:false});
    catalog.importFiles({batchId:'publication',paths:[process.argv[3]],purpose:'正文',version:'unspecified',origin:'synthetic'});
    await new Promise(()=>{});`;
  const child = spawn(
    process.execPath,
    ['--input-type=module', '-e', code, module, profile, path],
    { stdio: ['ignore', 'ignore', 'pipe', 'ipc'] },
  );
  let catalog: LiteratureCatalog | undefined;
  try {
    await Promise.race([
      once(child, 'message'),
      once(child, 'exit').then(() => {
        throw new Error('Child ended before publication');
      }),
    ]);
    const exit = once(child, 'exit');
    child.kill('SIGKILL');
    await exit;
    await writeFile(path, 'material B\n');
    catalog = new LiteratureCatalog(profile, () => {});
    await catalog.initialize();
    catalog.resume('publication');
    await expect
      .poll(() => catalog?.batch({ batchId: 'publication' }).batch.state)
      .toBe('completed');
    const item = catalog.batch({ batchId: 'publication' }).entries[0];
    assert(item?.sourceId && item.attachmentId);
    expect(item.state).toBe('created');
    expect(
      Buffer.from(
        (await catalog.readAttachment({ attachmentId: item.attachmentId })).base64,
        'base64',
      ).toString(),
    ).toBe('material A\n');
    expect(await readFile(path, 'utf8')).toBe('material B\n');
  } finally {
    if (child.exitCode === null && child.signalCode === null) {
      const exit = once(child, 'exit');
      child.kill('SIGKILL');
      await exit;
    }
    await catalog?.close();
    await rm(root, { recursive: true });
  }
});

test('failed restore never falls back to the original managed material', async () => {
  const f = await fixture();
  let copy: LiteratureCatalog | undefined;
  try {
    const path = join(f.root, 'input.txt');
    await writeFile(path, 'original library bytes');
    const batch = f.catalog.importFiles({
      batchId: randomUUID(),
      paths: [path],
      purpose: '正文',
      version: 'unspecified',
      origin: 'synthetic',
    });
    await expect.poll(() => f.catalog.batch({ batchId: batch.id }).batch.state).toBe('completed');
    const item = f.catalog.batch({ batchId: batch.id }).entries[0];
    assert(item?.sourceId && item.attachmentId);
    const backup = await f.catalog.backup();
    await rm(join(f.profile, 'library', 'backups', backup.id, 'materials', item.attachmentId));
    const destination = join(f.root, 'failed-copy');
    await expect(f.catalog.restore(backup.id, destination)).rejects.toBeDefined();
    copy = new LiteratureCatalog(destination, () => {});
    await copy.initialize();
    await expect(copy.readAttachment({ attachmentId: item.attachmentId })).rejects.toMatchObject({
      code: 'notFound',
    });
    expect((await copy.attachments({ sourceId: item.sourceId })).attachments[0]?.state).toBe(
      'missing',
    );
    expect(
      Buffer.from(
        (await f.catalog.readAttachment({ attachmentId: item.attachmentId })).base64,
        'base64',
      ).toString(),
    ).toBe('original library bytes');
  } finally {
    await copy?.close();
    await f.close();
  }
});

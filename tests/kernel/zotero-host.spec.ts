import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import {
  chmod,
  cp,
  lstat,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  realpath,
  stat,
  symlink,
  unlink,
  writeFile,
} from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { _electron as electron, expect, test } from '@playwright/test';
import { KernelApplication } from '../../apps/kernel/dist/application.js';
import { bootstrapKernel } from '../../apps/kernel/dist/bootstrap.js';
import { inspectKernel, serveKernel } from '../../apps/kernel/dist/lifecycle.js';
import type { IsolatedZotero } from '../../apps/kernel/dist/zotero.js';
import { createKernelClient } from '../../packages/client/dist/index.js';
import type { ZoteroOutputs, ZoteroSnapshot } from '../../packages/protocol/dist/zotero.js';
import { expectExecutionCompleted } from '../execution-diagnostics.js';
import { delegationOutput } from '../fixtures/delegation-model.js';
import { readPluginMember, unpackPlugin } from '../fixtures/zotero-host/archive.js';
import { electronTestCommand } from '../fixtures/zotero-host/display.js';
import { cliPath, runKernel } from '../kernel-fixture.js';
import { createModelServer } from '../model-server.js';

test.skip(process.platform === 'darwin', 'Managed plugin execution remains unavailable on macOS');
const xpi = process.env.SCHOOLOOM_BBT_XPI;
test.skip(!xpi, 'Supply the unchanged local BBT 9.0.68 release');

function originalSources(records: ZoteroSnapshot) {
  return records.map(({ sourceId, revision, originals }) => {
    const original = originals[0];
    if (!original) throw new Error('Missing actual original selection');
    return {
      sourceId,
      revision,
      expression: { kind: 'zotero-original' as const, identity: original.identity },
    };
  });
}
function exported(result: ZoteroOutputs['zotero.export']) {
  if (result.state !== 'exported') throw new Error('Expected explicitly selected original export');
  return result;
}

async function endpointMetadata(directory: string) {
  const path = join(directory, 'runtime', 'endpoint.json');
  try {
    const metadata = await stat(path);
    const observation: Record<string, unknown> = {
      mode: metadata.mode,
      size: metadata.size,
      dev: metadata.dev,
      ino: metadata.ino,
      nlink: metadata.nlink,
    };
    if (process.platform === 'win32') {
      const script = [
        '$ErrorActionPreference="Stop"',
        '$sid=[System.Security.Principal.WindowsIdentity]::GetCurrent().User',
        '$path=$env:SCHOOLOOM_ENDPOINT_TEST_PATH',
        '$result=@()',
        'foreach($kind in @("file","directory")){ if($kind -eq "file"){$acl=[System.IO.File]::GetAccessControl($path)}else{$acl=[System.IO.Directory]::GetAccessControl([System.IO.Path]::GetDirectoryName($path))}; $raw=[System.Security.AccessControl.RawSecurityDescriptor]::new($acl.GetSecurityDescriptorBinaryForm(),0); $aces=@(); foreach($ace in $raw.DiscretionaryAcl){$aces+=\'{"type":\'+[int]$ace.AceType+\',"flags":\'+[int]$ace.AceFlags+\',"mask":\'+[int]$ace.AccessMask+\',"currentUser":\'+$ace.SecurityIdentifier.Equals($sid).ToString().ToLowerInvariant()+\'}\'}; $result+=\'"\'+$kind+\'":{"ownerCurrent":\'+$acl.GetOwner([System.Security.Principal.SecurityIdentifier]).Equals($sid).ToString().ToLowerInvariant()+\',"protected":\'+$acl.AreAccessRulesProtected.ToString().ToLowerInvariant()+\',"aces":[\'+($aces -join ",")+\']}\'}',
        "[System.Console]::WriteLine('{'+($result -join \",\")+',\"attributes\":'+[int][System.IO.File]::GetAttributes($path)+'}')",
      ].join('; ');
      try {
        const { stdout } = await promisify(execFile)(
          'powershell.exe',
          ['-NoProfile', '-NonInteractive', '-Command', script],
          {
            windowsHide: true,
            timeout: 5000,
            maxBuffer: 16384,
            env: {
              SystemRoot: process.env.SystemRoot,
              PATH: process.env.PATH,
              TEMP: process.env.TEMP,
              SCHOOLOOM_ENDPOINT_TEST_PATH: path,
            },
          },
        );
        observation.windows = JSON.parse(stdout);
      } catch (error) {
        const failure = error as NodeJS.ErrnoException & { killed?: boolean };
        observation.windows = { errorCode: failure.code, killed: failure.killed };
      }
    }
    return observation;
  } catch (error) {
    return { errorCode: (error as NodeJS.ErrnoException).code };
  }
}

async function fixture(
  options: ConstructorParameters<typeof KernelApplication>[1] = {},
  count = 3,
  persistent = false,
) {
  const directory = await mkdtemp(join(tmpdir(), 'scholoom-library-bbt-'));
  test.info().annotations.push({ type: 'isolated-fixture', description: directory });
  const packageDirectory = join(directory, 'package');
  unpackPlugin(xpi as string, packageDirectory);
  const configuration: IsolatedZotero = {
    libraryId: '',
    packageDirectory,
    ...(persistent
      ? {
          executable: fileURLToPath(
            new URL('../../node_modules/electron/dist/electron', import.meta.url),
          ),
          args: [
            fileURLToPath(new URL('../../apps/zotero-host/out/main/managed.cjs', import.meta.url)),
          ],
        }
      : await electronTestCommand(
          new URL('../../apps/zotero-host/out/main/managed.cjs', import.meta.url),
        )),
  };
  const root = join(directory, 'configuration');
  const app = new KernelApplication(root, {
    ...options,
    ...(!persistent ? { isolatedZotero: configuration } : {}),
  });
  await app.initialize();
  await app.call('library.grant', { read: true, write: true, send: true, autoBackup: false });
  const libraryId = (await app.call('library.status', {})).id;
  configuration.libraryId = libraryId;
  const instance = await app.call('library.createSourceInstance', {
    requestId: randomUUID(),
    libraryId,
    label: 'Synthetic journal source',
  });
  const batch = await app.call('library.ingest', {
    batchId: randomUUID(),
    origin: 'synthetic',
    version: 'published',
    json: JSON.stringify(
      [
        'Research agents and reproducible literature workflows',
        'Independent journal transaction',
        ...Array.from({ length: count - 3 }, (_, i) => `Additional journal ${i}`),
        'Preserved journal',
      ].map((title) => ({ title })),
    ),
  });
  await expect
    .poll(async () => (await app.call('library.batch', { batchId: batch.id })).batch.state)
    .toBe('completed');
  const rows = (await app.call('library.list', { limit: 100 })).sources;
  const sources = [
    'Research agents and reproducible literature workflows',
    'Independent journal transaction',
    ...Array.from({ length: count - 3 }, (_, i) => `Additional journal ${i}`),
    'Preserved journal',
  ].map((title) => {
    const source = rows.find((row) => row.metadata.title === title);
    if (!source) throw new Error('Missing synthetic journal');
    return source;
  });
  const seed = await app.call('library.commitRecords', {
    libraryId,
    requestId: randomUUID(),
    changes: sources.map((source, i) => ({
      sourceId: source.id,
      revision: source.revision,
      original: {
        identity: { instanceId: instance.id, libraryLocator: 'local', objectKey: `JRNL000${i}` },
        schemaVersion: '44',
        itemType: 'journalArticle',
        fields: {
          title: source.metadata.title,
          date: '2026',
          publicationTitle: 'Isolated Research',
          extra: 'Unrecognized preserved line',
        },
        creators: [
          { firstName: 'Ada', lastName: i === 1 ? 'Wang' : 'Chen', creatorType: 'author' },
        ],
        relations: {},
      },
      ...(i === count - 1
        ? { key: { value: 'ScholoomPreserved2026', pinned: true, intent: 'explicit' as const } }
        : {}),
    })),
  });
  expect(seed.state).toBe('committed');
  const selection = async () =>
    await Promise.all(
      sources.map((source) => app.call('library.record', { libraryId, sourceId: source.id })),
    );
  return { app, directory, root, configuration, libraryId, sources, selection };
}

test('ordinary persistent host settings cold-start the unchanged package and retain the common commit across restart', async () => {
  test.skip(
    process.platform !== 'linux' || process.env.SCHOOLOOM_ZOTERO_NATIVE_COLD !== '1',
    'Explicit offline native-layout calibration',
  );
  const f = await fixture({}, 3, true);
  let preparing = true;
  try {
    const before = await f.selection();
    await f.app.close();
    preparing = false;
    const resourceRoot = join(f.root, 'native-resources', 'zotero-journals-v1');
    await mkdir(resourceRoot, { recursive: true, mode: 0o700 });
    await cp(await realpath('node_modules/electron/dist'), join(resourceRoot, 'electron'), {
      recursive: true,
      dereference: true,
    });
    await cp('apps/zotero-host/out', join(resourceRoot, 'host/out'), { recursive: true });
    await cp('apps/zotero-host/resources', join(resourceRoot, 'host/resources'), {
      recursive: true,
    });
    await cp(f.configuration.packageDirectory, join(resourceRoot, 'bbt'), { recursive: true });
    // Offline preparation of these new, known-source copies; the production resolver never fixes permissions.
    const protectCopy = async (path: string): Promise<void> => {
      const info = await lstat(path);
      if (info.isSymbolicLink()) throw new Error('Unexpected link in offline resource copy');
      await chmod(path, info.mode & 0o777 & ~0o022);
      if (info.isDirectory())
        for (const name of await readdir(path)) await protectCopy(join(path, name));
    };
    await protectCopy(resourceRoot);
    const sandboxHelper = join(resourceRoot, 'electron', 'chrome-sandbox');
    await unlink(sandboxHelper);
    await symlink('/opt/google/chrome/chrome-sandbox', sandboxHelper);
    await writeFile(
      join(f.root, 'host-settings.json'),
      JSON.stringify({
        version: 1,
        kernelDirectory: await realpath(f.root),
        zotero: {
          enabled: true,
          scope: 'isolated-library-journals',
          libraryId: f.libraryId,
          resourceId: 'journals-local-v1',
          resources: [{ id: 'journals-local-v1', layout: 'linux-x64-electron-managed-v1' }],
        },
      }),
      { mode: 0o600 },
    );
    const operationId = randomUUID();
    const unknownOperationId = randomUUID();
    let committed: ZoteroOutputs['zotero.result'] | undefined;
    for (const boundary of ['cold', 'restart']) {
      const running =
        boundary === 'cold'
          ? await runKernel(f.root, 'start')
          : await bootstrapKernel('ensure', {
              dataDirectory: f.root,
              nodeExecutable: process.execPath,
            });
      if (running.state !== 'running') throw new Error(JSON.stringify(running));
      const client = createKernelClient(running.endpoint);
      try {
        await client.connect();
        const rows = () =>
          Promise.all(
            f.sources.map((source) =>
              client.call('library.record', { libraryId: f.libraryId, sourceId: source.id }),
            ),
          );
        expect(
          await client.call('zotero.result', {
            libraryId: f.libraryId,
            requestId: unknownOperationId,
          }),
        ).toMatchObject({ state: 'notFound' });
        if (boundary === 'cold') {
          const { stdout } = await promisify(execFile)(
            process.execPath,
            [
              cliPath,
              'zotero.fillKeys',
              '--data-dir',
              f.root,
              '--input',
              JSON.stringify({
                libraryId: f.libraryId,
                operationId,
                sources: before.map(({ sourceId, revision }) => ({ sourceId, revision })),
              }),
            ],
            { timeout: 30000 },
          );
          const result = JSON.parse(stdout) as ZoteroOutputs['zotero.fillKeys'];
          expect(result.state).toBe('committed');
          committed = result.receipt;
          expect(committed?.state).toBe('committed');
        }
        expect(
          await client.call('zotero.result', { libraryId: f.libraryId, requestId: operationId }),
        ).toEqual(committed);
        const records = await rows();
        expect(records.at(-1)).toEqual(before.at(-1));
        expect(
          records
            .slice(0, -1)
            .map((record, index) => record.revision - (before[index]?.revision ?? 0)),
        ).toEqual([1, 1]);
        expect(records.every((record) => record.citationKey)).toBe(true);
        for (const format of ['bibtex', 'biblatex'] as const) {
          const output = exported(
            await client.call('zotero.export', {
              libraryId: f.libraryId,
              sources: originalSources(records),
              format,
            }),
          );
          expect(output.text).toContain('ScholoomPreserved2026');
          await writeFile(test.info().outputPath(`${boundary}.${format}`), output.text);
        }
        const supervision = JSON.parse(
          await readFile(join(f.root, 'zotero/host-supervision.json'), 'utf8'),
        );
        expect(supervision).toMatchObject({
          kernelInstanceId: running.endpoint.instanceId,
          scopeStopped: true,
          pluginClosed: true,
          unresolved: [],
        });
        await writeFile(
          test.info().outputPath(`${boundary}-receipts.json`),
          JSON.stringify({ records, committed, supervision }, null, 2),
        );
        if (boundary === 'restart') {
          const input = {
            libraryId: f.libraryId,
            sources: originalSources(records),
            format: 'bibtex' as const,
          };
          const pending = client.call('zotero.export', input).then(
            (value) => ({ value }),
            (error: unknown) => ({ error }),
          );
          await expect
            .poll(async () => {
              const current = JSON.parse(
                await readFile(join(f.root, 'zotero/host-supervision.json'), 'utf8'),
              );
              return (
                current.commandInstanceId !== supervision.commandInstanceId &&
                current.scopeStopped === false
              );
            })
            .toBe(true);
          await client.call('library.grant', {
            read: true,
            write: false,
            send: false,
            autoBackup: false,
          });
          const outcome = await pending;
          expect(outcome).toHaveProperty('error');
          if (!('error' in outcome)) throw new Error('Revoked export returned data');
          const code = (outcome.error as { code: string }).code;
          expect(['permissionDenied', 'outcomeUnknown']).toContain(code);
          expect(await rows()).toEqual(records);
          expect(
            await client.call('zotero.result', { libraryId: f.libraryId, requestId: operationId }),
          ).toEqual(committed);
          if (code === 'outcomeUnknown') {
            await client.call('library.grant', {
              read: true,
              write: true,
              send: true,
              autoBackup: false,
            });
            await expect(client.call('zotero.export', input)).rejects.toMatchObject({
              code: 'outcomeUnknown',
            });
          }
          const stopped = JSON.parse(
            await readFile(join(f.root, 'zotero/host-supervision.json'), 'utf8'),
          );
          expect(stopped.scopeStopped).toBe(true);
          await writeFile(
            test.info().outputPath('revoked-export.json'),
            JSON.stringify({ code, supervision: stopped }, null, 2),
          );
        }
      } finally {
        client.dispose();
        expect((await runKernel(f.root, 'stop')).state).toBe('stopped');
      }
    }
  } finally {
    if (preparing) await f.app.close();
    else expect((await runKernel(f.root, 'stop')).state).toBe('stopped');
  }
});

test('explicit original selection and independent title replacement preserve the common CSL and other original values', async () => {
  const f = await fixture();
  try {
    const before = (await f.selection())[2];
    if (!before) throw new Error('Missing pinned journal');
    const source = await f.app.call('library.get', { sourceId: before.sourceId });
    await f.app.call('library.update', {
      sourceId: source.id,
      revision: source.revision,
      metadata: {
        ...source.metadata,
        title: 'Common CSL corrected title',
        issued: {
          'date-parts': [
            [2025, 9],
            [2026, 2],
          ],
          circa: true,
        },
        author: [{ literal: 'Synthetic Research Consortium' }],
      },
      tags: source.tags,
      collectionIds: source.collectionIds,
      relatedIds: source.relatedIds,
    });
    const record = await f.app.call('library.record', {
      libraryId: f.libraryId,
      sourceId: source.id,
    });
    expect(record.originals).toEqual(before.originals);
    expect(record.citationKey).toEqual(before.citationKey);
    const request = {
      libraryId: f.libraryId,
      sources: [{ sourceId: record.sourceId, revision: record.revision }],
      format: 'bibtex' as const,
    };
    const unresolved = await f.app.call('zotero.export', request);
    expect(unresolved).toMatchObject({ state: 'selectionRequired' });
    expect(unresolved).not.toHaveProperty('text');
    const booleanConfirmation = { ...request, confirmed: true };
    await expect(f.app.call('zotero.export', booleanConfirmation)).rejects.toMatchObject({
      code: 'invalidRequest',
    });
    const inspection = await f.app.call('zotero.inspect', {
      libraryId: f.libraryId,
      sources: request.sources,
    });
    const selected = inspection.sources[0];
    if (!selected) throw new Error('Missing inspection');
    expect(selected.comparison).toEqual({ title: 'different', remaining: 'notComparable' });
    expect(selected.csl.title).toBe('Common CSL corrected title');
    expect(selected.original).toEqual(before.originals[0]);
    const expression = { kind: 'zotero-original' as const, identity: selected.original.identity };
    const sources = [{ sourceId: record.sourceId, revision: record.revision, expression }];
    for (const format of ['bibtex', 'biblatex'] as const) {
      const result = await f.app.call('zotero.export', { ...request, sources, format });
      if (result.state !== 'exported') throw new Error('Expected selected export');
      expect(result.text.toLowerCase()).toContain('preserved journal');
      expect(result.text).not.toContain('Common CSL corrected title');
      expect(result.sources[0]?.expression).toEqual(expression);
    }
    const csl = await f.app.call('library.get', { sourceId: source.id });
    const replacement = {
      libraryId: f.libraryId,
      requestId: randomUUID(),
      sourceId: source.id,
      revision: record.revision,
      identity: expression.identity,
      title: 'Explicit original title correction',
    };
    const saved = await f.app.call('zotero.replaceTitle', replacement);
    expect(saved.state).toBe('committed');
    const updated = await f.app.call('library.record', {
      libraryId: f.libraryId,
      sourceId: source.id,
    });
    expect(updated.originals[0]).toEqual({
      ...selected.original,
      fields: { ...selected.original.fields, title: replacement.title },
    });
    expect(updated.citationKey).toEqual(before.citationKey);
    expect((await f.app.call('library.get', { sourceId: source.id })).metadata).toEqual(
      csl.metadata,
    );
    expect(
      await f.app.call('zotero.result', {
        libraryId: f.libraryId,
        requestId: replacement.requestId,
      }),
    ).toEqual(saved.receipt);
    await expect(
      f.app.call('zotero.replaceTitle', { ...replacement, requestId: randomUUID() }),
    ).rejects.toMatchObject({ code: 'contentChanged' });
    expect(
      await f.app.call('zotero.replaceTitle', { ...replacement, title: 'Must not replay' }),
    ).toMatchObject({ state: 'queried', receipt: saved.receipt });
    await expect(f.app.call('zotero.export', { ...request, sources })).rejects.toMatchObject({
      code: 'contentChanged',
    });
    for (const format of ['bibtex', 'biblatex'] as const) {
      const result = await f.app.call('zotero.export', {
        ...request,
        format,
        sources: [{ sourceId: source.id, revision: updated.revision, expression }],
      });
      if (result.state !== 'exported') throw new Error('Expected updated original export');
      expect(result.text.toLowerCase()).toContain('explicit original title correction');
    }
    await writeFile(
      test.info().outputPath('original-title.json'),
      JSON.stringify({ inspection, saved, updated }, null, 2),
    );
  } finally {
    await f.app.close();
  }
});

test('real library/broker/managed original BBT commits missing keys once and exports both formats after restart', async () => {
  const f = await fixture({}, 100);
  try {
    const before = await f.selection();
    const input = {
      libraryId: f.libraryId,
      operationId: randomUUID(),
      sources: before.map(({ sourceId, revision }) => ({ sourceId, revision })),
    };
    const result = await f.app.call('zotero.fillKeys', input);
    await writeFile(test.info().outputPath('fill.json'), JSON.stringify(result, null, 2));
    expect(result).toMatchObject({
      state: 'committed',
      notification: 'delivered',
    });
    expect(result.receipt?.results).toHaveLength(99);
    const records = await f.selection();
    expect(records.slice(0, -1).every((record) => !!record.citationKey?.value)).toBe(true);
    expect(records.at(-1)?.citationKey).toEqual({ value: 'ScholoomPreserved2026', pinned: true });
    expect(records.at(-1)).toEqual(before.at(-1));
    expect(records.slice(0, -1).map((record) => record.revision)).toEqual(
      before.slice(0, -1).map((record) => record.revision + 1),
    );
    expect(
      await f.app.call('zotero.result', { libraryId: f.libraryId, requestId: input.operationId }),
    ).toEqual(result.receipt);
    expect(await f.app.call('zotero.fillKeys', input)).toMatchObject({
      state: 'queried',
      receipt: result.receipt,
    });
    expect(await f.selection()).toEqual(records);
    for (const format of ['bibtex', 'biblatex'] as const) {
      const output = exported(
        await f.app.call('zotero.export', {
          libraryId: f.libraryId,
          sources: originalSources(records),
          format,
        }),
      );
      await writeFile(test.info().outputPath(`${format}.bib`), output.text);
      expect(output.text).toContain('ScholoomPreserved2026');
      expect(output.text.toLowerCase()).toContain(
        'research agents and reproducible literature workflows',
      );
      for (const record of records)
        expect(output.text).toContain(record.citationKey?.value as string);
    }
    const first = records[0];
    if (!first?.originals[0]) throw new Error('Missing raw journal');
    const correction = await f.app.call('library.commitRecords', {
      libraryId: f.libraryId,
      requestId: randomUUID(),
      changes: [
        {
          sourceId: first.sourceId,
          revision: first.revision,
          original: {
            ...first.originals[0],
            fields: {
              ...first.originals[0].fields,
              title: 'Updated research agents after common commit',
            },
          },
        },
      ],
    });
    expect(correction.state).toBe('committed');
    const corrected = await f.selection();
    expect(corrected.map((record) => record.citationKey)).toEqual(
      records.map((record) => record.citationKey),
    );
    const refreshed = exported(
      await f.app.call('zotero.export', {
        libraryId: f.libraryId,
        sources: originalSources(corrected),
        format: 'bibtex',
      }),
    );
    expect(refreshed.text.toLowerCase()).toContain('updated research agents after common commit');
    expect(refreshed.text).toContain(first.citationKey?.value as string);
    await f.app.close();
    const serving = serveKernel(f.root, { isolatedZotero: f.configuration }).then(
      () => ({ failed: false as const }),
      (error: unknown) => ({ failed: true as const, error }),
    );
    let owner: ReturnType<typeof createKernelClient> | undefined;
    try {
      await expect.poll(async () => (await inspectKernel(f.root)).state).toBe('running');
      const running = await inspectKernel(f.root);
      if (running.state !== 'running' || running.endpoint.processId !== process.pid)
        throw new Error('Missing in-process test-owned kernel');
      owner = createKernelClient(running.endpoint);
      await owner.connect();
      const cli = fileURLToPath(new URL('../../apps/kernel/dist/cli.js', import.meta.url));
      const query = await promisify(execFile)(process.execPath, [
        cli,
        'zotero.result',
        '--data-dir',
        f.root,
        '--input',
        JSON.stringify({ libraryId: f.libraryId, requestId: input.operationId }),
      ]);
      expect(JSON.parse(query.stdout)).toEqual(result.receipt);
      const request = {
        libraryId: f.libraryId,
        sources: originalSources(corrected),
        format: 'biblatex',
      };
      const exported = await promisify(execFile)(process.execPath, [
        cli,
        'zotero.export',
        '--data-dir',
        f.root,
        '--input',
        JSON.stringify(request),
      ]);
      expect(JSON.parse(exported.stdout)).toMatchObject({ state: 'exported' });
      expect(JSON.parse(exported.stdout).text).toContain('ScholoomPreserved2026');
    } finally {
      await test.info().attach('endpoint-before-stop', {
        body: JSON.stringify(await endpointMetadata(f.root)),
        contentType: 'application/json',
      });
      try {
        // The test owns this in-process instance; its PID must remain alive after serving ends.
        await owner?.shutdown();
      } finally {
        owner?.dispose();
        const stopped = await serving;
        expect(stopped).toEqual({ failed: false });
      }
    }
  } finally {
    await f.app.close();
  }
});

test('original resetKeyOnChange modify events cannot replace an adopted common key after title correction or restart', async () => {
  const f = await fixture();
  const profile = join(f.directory, 'reset-key-profile');
  await mkdir(profile);
  // Load the production projection in Electron without adding a test-only product export.
  let catalogSource = stripTypeScriptTypes(
    await readFile(
      new URL('../../apps/zotero-host/src/main/journal-catalog.ts', import.meta.url),
      'utf8',
    ),
    { mode: 'transform' },
  );
  for (const name of ['core', 'zotero'])
    catalogSource = catalogSource.replaceAll(
      `'@scholoom/protocol/${name}'`,
      JSON.stringify(new URL(`../../packages/protocol/dist/${name}.js`, import.meta.url).href),
    );
  const moduleUrl = `data:text/javascript;base64,${Buffer.from(catalogSource).toString('base64')}`;
  const root = fileURLToPath(new URL('../../', import.meta.url));
  const launch = async () => {
    const application = await electron.launch({
      args: ['--no-sandbox', join(root, 'tests/fixtures/zotero-host/main.cjs')],
      env: {
        ...process.env,
        SCHOOLOOM_BBT_PACKAGE: f.configuration.packageDirectory,
        SCHOOLOOM_BBT_PROFILE: profile,
        SCHOOLOOM_BBT_MANUAL_START: '1',
      },
    });
    await application.evaluate(async ({ app }) => app.whenReady());
    return application;
  };
  let host = await launch();
  try {
    const before = (await f.selection()).at(-1);
    if (!before?.citationKey || !before.originals[0]) throw new Error('Missing adopted journal');
    const start = async (records: ZoteroSnapshot) => {
      return host.evaluate(
        async (_electron, input) => {
          Reflect.get(globalThis, 'fixture').catalog.close();
          const require = process
            .getBuiltinModule('node:module')
            .createRequire(`${input.root}/apps/zotero-host/package.json`);
          const vm = require('node:vm');
          const { JournalCatalog } = await vm.runInThisContext(
            `import(${JSON.stringify(input.moduleUrl)})`,
            { importModuleDynamically: vm.constants.USE_MAIN_CONTEXT_DEFAULT_LOADER },
          );
          const { ZoteroHost } = require(`${input.root}/apps/zotero-host/out/main/host.cjs`);
          const catalog = new JournalCatalog(input.records);
          const host = new ZoteroHost({
            scope: 'isolated-library-journals',
            catalog,
            packageDirectory: input.packageDirectory,
            profileDirectory: input.profile,
            dateFormats: `${input.root}/apps/zotero-host/resources/dateFormats.json`,
            rendererDirectory: `${input.root}/apps/zotero-host/out/renderer`,
            preload: `${input.root}/apps/zotero-host/out/preload/index.cjs`,
          });
          Reflect.set(globalThis, 'resetKeySample', { catalog, host });
          const status = await host.start();
          host.environment.zotero.Prefs.set('translators.better-bibtex.resetKeyOnChange', true);
          return status;
        },
        { moduleUrl, root, records, packageDirectory: f.configuration.packageDirectory, profile },
      );
    };
    expect((await start([before])).state).toBe('ready');
    const initial = await host.evaluate(async () => {
      const { host, catalog } = Reflect.get(globalThis, 'resetKeySample');
      return host.export([catalog.record(1).sourceId], 'bibtex');
    });
    expect(initial.toLowerCase()).toContain('preserved journal');
    const saved = await f.app.call('zotero.replaceTitle', {
      libraryId: f.libraryId,
      requestId: randomUUID(),
      sourceId: before.sourceId,
      revision: before.revision,
      identity: before.originals[0].identity,
      title: 'Corrected title under automatic key reset',
    });
    expect(saved.state).toBe('committed');
    const corrected = await f.app.call('library.record', {
      libraryId: f.libraryId,
      sourceId: before.sourceId,
    });
    expect(corrected.citationKey).toEqual(before.citationKey);
    const trigger = await host.evaluate(
      async (_electron, input) => {
        const { catalog, host } = Reflect.get(globalThis, 'resetKeySample');
        catalog.refresh([input.corrected]);
        const { zotero } = host.environment;
        const preference = 'translators.better-bibtex.resetKeyOnChange';
        zotero.Prefs.set(preference, true);
        const enabled = zotero.Prefs.get(preference);
        const reads: unknown[] = [];
        const attempts: { field: string; value: unknown; code?: string }[] = [];
        const get = zotero.Prefs.get;
        zotero.Prefs.get = (key: string) => {
          const value = get(key);
          if (key === preference) reads.push(value);
          return value;
        };
        const item = catalog.item(input.corrected.sourceId);
        const setField = item.setField.bind(item);
        item.setField = (field: string, value: unknown) => {
          const attempt: (typeof attempts)[number] = { field, value };
          attempts.push(attempt);
          try {
            return setField(field, value);
          } catch (error) {
            attempt.code = (error as { code: string }).code;
            throw error;
          }
        };
        const event = [
          'modify',
          'item',
          [item.id],
          {
            [item.id]: { libraryID: item.libraryID, changed: { title: input.oldTitle } },
          },
        ];
        await zotero.Notifier.trigger(...event);
        return {
          enabled,
          reads,
          attempts,
          event,
          sql: catalog.fields(item.id),
          pluginKey: zotero.BetterBibTeX.KeyManager.get(item.id),
          status: host.status(),
        };
      },
      { corrected, oldTitle: before.originals[0].fields.title },
    );
    await writeFile(
      test.info().outputPath('reset-key-trigger.json'),
      JSON.stringify({ before, saved, corrected, trigger }, null, 2),
    );
    expect(trigger.enabled).toBe(true);
    expect(trigger.reads).toContain(true);
    expect(trigger.pluginKey).toMatchObject({ citationKey: before.citationKey.value });
    expect(trigger.status.state).toBe('ready');
    expect(trigger.sql.citationKey).toBe(before.citationKey.value);
    for (const boundary of ['after-modify', 'restart'] as const) {
      if (boundary === 'restart') {
        expect(
          (await host.evaluate(() => Reflect.get(globalThis, 'resetKeySample').host.close())).state,
        ).toBe('closed');
        await host.close();
        host = await launch();
        expect((await start([corrected])).state).toBe('ready');
      }
      for (const format of ['bibtex', 'biblatex'] as const) {
        const text = await host.evaluate(
          async (_electron, input) =>
            Reflect.get(globalThis, 'resetKeySample').host.export([input.sourceId], input.format),
          { sourceId: corrected.sourceId, format },
        );
        await writeFile(test.info().outputPath(`${boundary}.${format}`), text);
        expect.soft(text.toLowerCase()).toContain('corrected title under automatic key reset');
        expect.soft(text).toContain(`{${before.citationKey.value},`);
      }
      const readback = await f.app.call('library.record', {
        libraryId: f.libraryId,
        sourceId: before.sourceId,
      });
      expect(readback).toEqual(corrected);
      const state = await host.evaluate(() => {
        const { catalog, host } = Reflect.get(globalThis, 'resetKeySample');
        return {
          status: host.status(),
          preference: host.environment.zotero.Prefs.get(
            'translators.better-bibtex.resetKeyOnChange',
          ),
          sql: catalog.fields(1),
          pluginKey: host.environment.zotero.BetterBibTeX.KeyManager.get(1),
        };
      });
      expect(state.preference).toBe(true);
      expect(state.sql.citationKey).toBe(before.citationKey.value);
      expect(state.pluginKey).toMatchObject({ citationKey: before.citationKey.value });
      await writeFile(
        test.info().outputPath(`${boundary}-record.json`),
        JSON.stringify({ readback, ...state }, null, 2),
      );
    }
    for (const member of [
      'bootstrap.js',
      'content/better-bibtex.js',
      'content/worker/zotero.js',
      'content/resource/Better BibTeX.js',
      'content/resource/Better BibLaTeX.js',
    ])
      expect(
        (await readFile(join(f.configuration.packageDirectory, member))).equals(
          readPluginMember(xpi as string, member),
        ),
      ).toBe(true);
  } finally {
    try {
      await host.evaluate(async () => {
        const sample = Reflect.get(globalThis, 'resetKeySample');
        if (sample) {
          await sample.host.close();
          sample.catalog.close();
        }
      });
    } finally {
      await host.close();
      await f.app.close();
    }
  }
});

test('unselected case-insensitive key collision rejects the entire real transaction; stale versions, missing mapping and revoked access refuse', async () => {
  const f = await fixture();
  try {
    const records = await f.selection();
    const first = records[0];
    const pinned = records[2];
    if (!first || !pinned) throw new Error('Missing samples');
    // Fixed original BBT default-format oracle, independently established in the H1 smoke.
    const candidate = 'chenResearchAgentsReproducible2026';
    await f.app.call('library.commitRecords', {
      libraryId: f.libraryId,
      requestId: randomUUID(),
      changes: [
        {
          sourceId: pinned.sourceId,
          revision: pinned.revision,
          key: { value: candidate.toUpperCase(), pinned: true, intent: 'explicit' },
        },
      ],
    });
    const input = {
      libraryId: f.libraryId,
      operationId: randomUUID(),
      sources: records.slice(0, 2).map(({ sourceId, revision }) => ({ sourceId, revision })),
    };
    const rejected = await f.app.call('zotero.fillKeys', input);
    expect(rejected).toMatchObject({
      state: 'rejected',
      receipt: { error: { code: 'targetAmbiguous' } },
    });
    expect((await f.selection()).slice(0, 2)).toEqual(records.slice(0, 2));
    expect(
      await f.app.call('zotero.result', { libraryId: f.libraryId, requestId: input.operationId }),
    ).toEqual(rejected.receipt);
    expect(
      await f.app.call('zotero.fillKeys', { ...input, sources: input.sources.slice(0, 1) }),
    ).toMatchObject({
      state: 'queried',
      receipt: rejected.receipt,
      notification: 'notRun',
    });
    const batch = await f.app.call('library.ingest', {
      batchId: randomUUID(),
      origin: 'synthetic',
      version: 'published',
      json: JSON.stringify([{ title: 'CSL only without raw mapping' }]),
    });
    await expect
      .poll(async () => (await f.app.call('library.batch', { batchId: batch.id })).batch.state)
      .toBe('completed');
    const rawless = (await f.app.call('library.list', {})).sources.find(
      (source) => source.metadata.title === 'CSL only without raw mapping',
    );
    if (!rawless) throw new Error('Missing rawless sample');
    await expect(
      f.app.call('zotero.fillKeys', {
        ...input,
        operationId: randomUUID(),
        sources: [{ sourceId: rawless.id, revision: rawless.revision }],
      }),
    ).rejects.toMatchObject({ code: 'unavailable' });
    await expect(
      f.app.call('zotero.fillKeys', {
        ...input,
        operationId: randomUUID(),
        sources: [{ sourceId: first.sourceId, revision: first.revision - 1 }],
      }),
    ).rejects.toMatchObject({ code: 'contentChanged' });
    await f.app.call('library.grant', { read: true, write: false, send: false, autoBackup: false });
    await expect(
      f.app.call('zotero.fillKeys', { ...input, operationId: randomUUID() }),
    ).rejects.toMatchObject({ code: 'permissionDenied' });
    await expect(
      f.app.call('zotero.export', {
        libraryId: f.libraryId,
        sources: [{ sourceId: pinned.sourceId, revision: pinned.revision + 1 }],
        format: 'bibtex',
      }),
    ).rejects.toMatchObject({ code: 'permissionDenied' });
    await expect(
      f.app.call('zotero.fillKeys', {
        ...input,
        operationId: randomUUID(),
        libraryId: 'another-library',
      }),
    ).rejects.toMatchObject({ code: 'unavailable' });
  } finally {
    await f.app.close();
  }
});

test('lost post-commit observation queries the real stable operation without replay or clearing unknown supervision', async () => {
  const f = await fixture();
  let armed = true;
  const detach = f.app.subscribe((change) => {
    if (armed && change.libraryChanged) {
      armed = false;
      throw new Error('isolated post-commit consumer failure');
    }
  });
  try {
    const records = await f.selection();
    const input = {
      libraryId: f.libraryId,
      operationId: randomUUID(),
      sources: records.map(({ sourceId, revision }) => ({ sourceId, revision })),
    };
    await expect(f.app.call('zotero.fillKeys', input)).rejects.toMatchObject({
      code: 'outcomeUnknown',
    });
    const receipt = await f.app.call('zotero.result', {
      libraryId: f.libraryId,
      requestId: input.operationId,
    });
    expect(receipt).toMatchObject({ state: 'committed', results: [{}, {}] });
    const committed = await f.selection();
    expect(await f.app.call('zotero.fillKeys', input)).toMatchObject({
      state: 'queried',
      receipt,
    });
    expect(await f.selection()).toEqual(committed);
    await expect(
      f.app.call('zotero.export', {
        libraryId: f.libraryId,
        sources: originalSources(committed),
        format: 'bibtex',
      }),
    ).rejects.toMatchObject({ code: 'outcomeUnknown' });
    await writeFile(
      test.info().outputPath('committed-after-unknown.json'),
      JSON.stringify({ receipt, committed }, null, 2),
    );
  } finally {
    detach();
    await f.app.close();
  }
});

for (const method of ['zotero.fillKeys', 'zotero.export'] as const) {
  test(`${method} rechecks revoked authority after snapshot acceptance`, async () => {
    const f = await fixture();
    try {
      const records = await f.selection();
      const request = {
        libraryId: f.libraryId,
        operationId: randomUUID(),
        sources: (method === 'zotero.fillKeys' ? records.slice(0, 2) : records.slice(2)).map(
          ({ sourceId, revision }) => ({ sourceId, revision }),
        ),
      };
      const pending =
        method === 'zotero.fillKeys'
          ? f.app.call(method, request)
          : f.app.call(method, {
              libraryId: request.libraryId,
              sources: originalSources(records.slice(2)),
              format: 'bibtex',
            });
      const outcome = pending.then(
        (value) => ({ value }),
        (error: unknown) => ({ error }),
      );
      // The real private operation file is created after the common snapshot, before native startup.
      await expect
        .poll(
          async () => {
            try {
              return (await readdir(join(f.root, 'zotero'))).length;
            } catch {
              return 0;
            }
          },
          { intervals: [10] },
        )
        .toBeGreaterThan(0);
      await f.app.call('library.grant', {
        read: true,
        write: false,
        send: false,
        autoBackup: false,
      });
      const result = await outcome;
      expect(result).toMatchObject({
        error: { code: method === 'zotero.fillKeys' ? 'outcomeUnknown' : 'permissionDenied' },
      });
      expect(await f.selection()).toEqual(records);
      expect(
        await f.app.call('zotero.result', {
          libraryId: f.libraryId,
          requestId: request.operationId,
        }),
      ).toMatchObject({ state: 'notFound' });
    } finally {
      await f.app.close();
    }
  });
}

test('actual harness tools use the common authority and original BBT; only the external model is controlled', async () => {
  const titleRequestId = randomUUID();
  let request: {
    libraryId: string;
    operationId: string;
    sources: { sourceId: string; revision: number }[];
  };
  const model = await createModelServer({
    respond: ({ calls }) => {
      if (!calls.includes('fill_zotero_keys'))
        return { tool: { name: 'fill_zotero_keys', input: request } };
      const body = model.requests.at(-1);
      const fill = body ? delegationOutput(body, 'fill_zotero_keys') : undefined;
      const sources = request.sources.map((source) => ({
        ...source,
        revision:
          fill?.receipt?.results?.find(
            (result: { sourceId: string }) => result.sourceId === source.sourceId,
          )?.revision ?? source.revision,
      }));
      if (!calls.includes('inspect_zotero_originals'))
        return {
          tool: {
            name: 'inspect_zotero_originals',
            input: { libraryId: request.libraryId, sources },
          },
        };
      const inspection = body ? delegationOutput(body, 'inspect_zotero_originals') : undefined;
      const first = inspection?.sources?.[0];
      if (!first) throw new Error('Expected actual original inspection result');
      if (!calls.includes('replace_zotero_original_title'))
        return {
          tool: {
            name: 'replace_zotero_original_title',
            input: {
              libraryId: request.libraryId,
              requestId: titleRequestId,
              sourceId: first.sourceId,
              revision: first.revision,
              identity: first.original.identity,
              title: 'Agent explicit journal title',
            },
          },
        };
      const replacement = body
        ? delegationOutput(body, 'replace_zotero_original_title')
        : undefined;
      const selected = inspection?.sources.map(
        (source: { sourceId: string; revision: number; original: { identity: unknown } }) => ({
          sourceId: source.sourceId,
          revision:
            replacement?.receipt?.results?.find(
              (result: { sourceId: string }) => result.sourceId === source.sourceId,
            )?.revision ?? source.revision,
          expression: { kind: 'zotero-original', identity: source.original.identity },
        }),
      );
      if (!calls.includes('export_zotero'))
        return {
          tool: {
            name: 'export_zotero',
            input: { libraryId: request.libraryId, sources: selected, format: 'bibtex' },
          },
        };
      if (calls.filter((call) => call === 'export_zotero').length === 1)
        return {
          tool: {
            name: 'export_zotero',
            input: { libraryId: request.libraryId, sources: selected, format: 'biblatex' },
          },
        };
      if (!calls.includes('read_zotero_result'))
        return {
          tool: {
            name: 'read_zotero_result',
            input: { libraryId: request.libraryId, requestId: request.operationId },
          },
        };
      return { text: '已取得共同回执和两个格式的导出文本。' };
    },
  });
  const f = await fixture({
    modelEndpoint: model.url,
    environment: { MINIMAX_CN_API_KEY: 'synthetic-bbt' },
  });
  try {
    const records = await f.selection();
    request = {
      libraryId: f.libraryId,
      operationId: randomUUID(),
      sources: records.map(({ sourceId, revision }) => ({ sourceId, revision })),
    };
    const project = await f.app.call('project.create', {
      path: join(f.directory, 'project'),
      trust: 'trusted',
    });
    const session = await f.app.call('session.create', { projectId: project.id });
    const scope = { projectId: project.id, sessionId: session.id };
    await f.app.call('session.send', {
      ...scope,
      instructionId: randomUUID(),
      text: '核对隔离期刊并补缺键。独立将第一条原值题名更正为“Agent explicit journal title”，保留CSL。明确采用各条目的Zotero原值导出两个格式。',
      materials: [],
    });
    await expectExecutionCompleted(f.app, scope, model);
    const final = model.requests.at(-1);
    if (!final) throw new Error('No actual model requests');
    expect(delegationOutput(final, 'fill_zotero_keys')).toMatchObject({
      state: 'committed',
      notification: 'delivered',
    });
    expect(delegationOutput(final, 'read_zotero_result')).toMatchObject({ state: 'committed' });
    expect(delegationOutput(final, 'replace_zotero_original_title')).toMatchObject({
      state: 'committed',
    });
    expect(delegationOutput(final, 'export_zotero')).toMatchObject({ state: 'exported' });
    expect(delegationOutput(final, 'export_zotero')?.text).toContain('ScholoomPreserved2026');
    expect(delegationOutput(final, 'export_zotero')?.text.toLowerCase()).toContain(
      'agent explicit journal title',
    );
    const firstSource = request.sources[0];
    if (!firstSource) throw new Error('Missing selected journal');
    expect(
      (await f.app.call('library.get', { sourceId: firstSource.sourceId })).metadata.title,
    ).toBe('Research agents and reproducible literature workflows');
    expect((await f.selection()).every((record) => !!record.citationKey)).toBe(true);
    await writeFile(
      test.info().outputPath('harness.json'),
      JSON.stringify(await f.app.snapshot(scope), null, 2),
    );
  } finally {
    await f.app.close();
    await model.close();
  }
});

test('original title unknown receipts query the real provider without replay', async () => {
  const f = await fixture();
  let armed = true;
  const detach = f.app.subscribe((change) => {
    if (armed && change.libraryChanged) {
      armed = false;
      throw new Error('Post-commit original-title observation failure');
    }
  });
  try {
    const before = (await f.selection())[2];
    const original = before?.originals[0];
    if (!before || !original) throw new Error('Missing pinned original');
    const input = {
      libraryId: f.libraryId,
      requestId: randomUUID(),
      sourceId: before.sourceId,
      revision: before.revision,
      identity: original.identity,
      title: 'Committed despite lost observation',
    };
    await expect(f.app.call('zotero.replaceTitle', input)).rejects.toMatchObject({
      code: 'outcomeUnknown',
    });
    const receipt = await f.app.call('zotero.result', {
      libraryId: f.libraryId,
      requestId: input.requestId,
    });
    expect(receipt).toMatchObject({ state: 'committed' });
    const after = await f.app.call('library.record', {
      libraryId: f.libraryId,
      sourceId: before.sourceId,
    });
    expect(after.revision).toBe(before.revision + 1);
    expect(after.originals[0]).toEqual({
      ...original,
      fields: { ...original.fields, title: input.title },
    });
    expect(after.citationKey).toEqual(before.citationKey);
    expect(await f.app.call('zotero.replaceTitle', input)).toMatchObject({
      state: 'queried',
      receipt,
    });
    expect(
      await f.app.call('library.record', { libraryId: f.libraryId, sourceId: before.sourceId }),
    ).toEqual(after);
  } finally {
    detach();
    await f.app.close();
  }
});

test('original inspection rejects missing values, multiple sources and stale identity without inventing a projection', async () => {
  const f = await fixture();
  try {
    const before = (await f.selection())[2];
    const original = before?.originals[0];
    if (!before || !original) throw new Error('Missing pinned original');
    const selection = {
      libraryId: f.libraryId,
      sources: [{ sourceId: before.sourceId, revision: before.revision }],
    };
    const readback = await f.app.call('zotero.inspect', selection);
    expect(readback.sources[0]?.comparison).toEqual({ title: 'equal', remaining: 'notComparable' });
    const wrong = { ...original.identity, objectKey: 'WRONGKEY' };
    await expect(
      f.app.call('zotero.export', {
        ...selection,
        format: 'bibtex',
        sources: [
          {
            sourceId: before.sourceId,
            revision: before.revision,
            expression: { kind: 'zotero-original', identity: wrong },
          },
        ],
      }),
    ).rejects.toMatchObject({ code: 'contentChanged' });
    const titleInput = {
      libraryId: f.libraryId,
      requestId: randomUUID(),
      sourceId: before.sourceId,
      revision: before.revision,
      identity: original.identity,
      title: 'Concurrent original change',
    };
    const source = await f.app.call('library.get', { sourceId: before.sourceId });
    const outcomes = await Promise.allSettled([
      f.app.call('zotero.replaceTitle', titleInput),
      f.app.call('library.update', {
        sourceId: source.id,
        revision: source.revision,
        metadata: { ...source.metadata, title: 'Competing CSL correction' },
        tags: source.tags,
        collectionIds: source.collectionIds,
        relatedIds: source.relatedIds,
      }),
    ]);
    expect(outcomes[0]).toMatchObject({ status: 'rejected', reason: { code: 'contentChanged' } });
    expect(outcomes[1]?.status).toBe('fulfilled');
    let current = await f.app.call('library.record', {
      libraryId: f.libraryId,
      sourceId: before.sourceId,
    });
    expect(current.originals).toEqual(before.originals);
    const fields = { ...original.fields };
    delete fields.title;
    await f.app.call('library.commitRecords', {
      libraryId: f.libraryId,
      requestId: randomUUID(),
      changes: [
        {
          sourceId: before.sourceId,
          revision: current.revision,
          original: { ...original, fields },
        },
      ],
    });
    current = await f.app.call('library.record', {
      libraryId: f.libraryId,
      sourceId: before.sourceId,
    });
    await expect(
      f.app.call('zotero.inspect', {
        ...selection,
        sources: [{ sourceId: current.sourceId, revision: current.revision }],
      }),
    ).rejects.toMatchObject({ code: 'unavailable' });
    await f.app.call('library.commitRecords', {
      libraryId: f.libraryId,
      requestId: randomUUID(),
      changes: [
        {
          sourceId: current.sourceId,
          revision: current.revision,
          original: { ...original, identity: { ...original.identity, objectKey: 'SECOND01' } },
        },
      ],
    });
    current = await f.app.call('library.record', {
      libraryId: f.libraryId,
      sourceId: before.sourceId,
    });
    await expect(
      f.app.call('zotero.replaceTitle', { ...titleInput, revision: current.revision }),
    ).rejects.toMatchObject({ code: 'unavailable' });
    expect(current.originals).toHaveLength(2);
  } finally {
    await f.app.close();
  }
});

test('Zotero-only model context remains subject to library send authorization across turns and restart', async () => {
  let input: { libraryId: string; sources: ReturnType<typeof originalSources> };
  const model = await createModelServer({
    respond: ({ calls }) =>
      calls.includes('export_zotero')
        ? { text: '已核对隔离期刊导出。' }
        : { tool: { name: 'export_zotero', input: { ...input, format: 'bibtex' } } },
  });
  const options = {
    modelEndpoint: model.url,
    environment: { MINIMAX_CN_API_KEY: 'synthetic-bbt' },
  };
  const f = await fixture(options);
  let app = f.app;
  try {
    const record = (await f.selection()).at(-1);
    if (!record) throw new Error('Missing fixed-key journal');
    input = {
      libraryId: f.libraryId,
      sources: originalSources([record]),
    };
    const project = await app.call('project.create', {
      path: join(f.directory, 'project'),
      trust: 'trusted',
    });
    const session = await app.call('session.create', { projectId: project.id });
    const scope = { projectId: project.id, sessionId: session.id };
    await app.call('session.send', {
      ...scope,
      instructionId: randomUUID(),
      text: '仅通过生态工具，明确采用指定期刊的Zotero原值导出。',
      materials: [],
    });
    await expectExecutionCompleted(app, scope, model);
    const final = model.requests.at(-1);
    if (!final) throw new Error('No actual model requests');
    expect(delegationOutput(final, 'export_zotero')).toMatchObject({ state: 'exported' });
    expect(delegationOutput(final, 'export_zotero')?.text).toContain('ScholoomPreserved2026');
    const requests = model.requests.length;
    await app.call('library.grant', { read: true, write: true, send: false, autoBackup: false });
    for (const boundary of ['next-turn', 'restart']) {
      if (boundary === 'restart') {
        await app.close();
        app = new KernelApplication(f.root, { ...options, isolatedZotero: f.configuration });
        await app.initialize();
      }
      await app.call('session.send', {
        ...scope,
        instructionId: randomUUID(),
        text: `接续核查 ${boundary}`,
        materials: [],
      });
      await expect
        .poll(async () => (await app.snapshot(scope)).run?.state, { timeout: 20_000 })
        .toBe('failed');
      expect(model.requests).toHaveLength(requests);
    }
  } finally {
    await app.close();
    await model.close();
  }
});

import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { ManagedCommands } from '../../apps/kernel/dist/commands.js';
import { HostConnection } from '../../apps/kernel/dist/host-connection.js';
import { ProcessAdmission } from '../../packages/platform/dist/node.js';
import { electronTestCommand } from '../fixtures/zotero-host/display.js';

test.skip(process.platform !== 'linux', 'This isolated display fixture validates Linux only');
const xpi = process.env.SCHOOLOOM_BBT_XPI;
test.skip(!xpi, 'Set SCHOOLOOM_BBT_XPI to the unchanged BBT 9.0.68 release');
const sources = { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 100 } as const;
const scope = {
  type: 'object',
  properties: { sources },
  required: ['sources'],
  additionalProperties: false,
} as const;
const status = {
  params: { type: 'object', properties: {}, additionalProperties: false },
  result: true,
  semantics: { effect: 'read', returns: 'result', waitMs: 30000 },
} as const;
const context = {
  moduleId: 'sample',
  role: 'product',
  principal: { kind: 'human', id: 'sample-user' },
} as const;
for (const mode of ['normal', 'shutdown-error']) {
  test(`actual managed BBT ${mode} separates plugin shutdown from native scope`, async () => {
    const directory = await mkdtemp(join(tmpdir(), 'scholoom-supervised-bbt-'));
    const packageDirectory = join(directory, 'package');
    execFileSync('unzip', ['-q', xpi as string, '-d', packageDirectory]);
    const admission = new ProcessAdmission(1, 1);
    let host: HostConnection;
    const commands = new ManagedCommands(
      admission,
      (id) => {
        if (id !== host.instanceId) throw new Error('unknown host');
        return host.workspace();
      },
      () => {},
    );
    host = new HostConnection({
      directory,
      kernelInstanceId: 'sample-kernel',
      scope: 'injected-adapter',
      commands,
      admission,
      ...(await electronTestCommand(
        new URL('../fixtures/zotero-host/managed-bbt.cjs', import.meta.url),
        [directory, mode, packageDirectory],
      )),
      operations: {
        status,
        fillKeys: {
          params: scope,
          result: { type: 'array', items: true },
          semantics: { effect: 'write', returns: 'result', waitMs: 30000 },
        },
        export: {
          params: {
            type: 'object',
            properties: { sources, format: { enum: ['bibtex', 'biblatex'] } },
            required: ['sources', 'format'],
            additionalProperties: false,
          },
          result: { type: 'string', maxLength: 262144 },
          semantics: status.semantics,
        },
      },
      callbacks: {
        contracts: { 'sample.authority': { ...status, result: { type: 'string' } } },
        authorize(operation, incoming) {
          if (operation.method !== 'status' || incoming.method !== 'sample.authority')
            throw new Error('outside sample status');
        },
        async call(_method, _input, caller) {
          return caller.principal.id;
        },
      },
    });
    try {
      expect((await host.start()).state).toBe('ready');
      const sampleStatus = (await host.call('status', {}, context)) as {
        caller: string;
        production: { available: boolean };
        versions: { bbt: string };
      };
      expect(sampleStatus).toMatchObject({
        caller: 'sample-user',
        production: { available: false },
        versions: { bbt: '9.0.68' },
      });
      await host.call('fillKeys', { sources: ['sample-missing'] }, context, 'isolated-fill-1');
      for (const format of ['bibtex', 'biblatex']) {
        expect(
          await host.call(
            'export',
            { sources: ['sample-missing', 'sample-preserved'], format },
            context,
          ),
        ).toContain('ScholoomPreserved2026');
      }
      expect(await host.close()).toMatchObject({
        state: mode === 'normal' ? 'closed' : 'unknown',
        scopeStopped: true,
        pluginClosed: mode === 'normal',
      });
      expect(admission.status.active).toBe(0);
    } finally {
      await host.close();
      await writeFile(
        test.info().outputPath('supervision.json'),
        JSON.stringify(host.status(), null, 2),
      );
      await commands.close();
    }
  });
}

import { execFileSync } from 'node:child_process';

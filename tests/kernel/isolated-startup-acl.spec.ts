import assert from 'node:assert/strict';
import { fork } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { nodeEnvironment } from '../../packages/platform/dist/processes.js';
import { limits } from '../../packages/protocol/dist/core.js';
import { developmentKernelConnectionTimeout } from '../kernel-fixture.js';

type AclFacts = {
  version: 1;
  processId: number;
  environment: Record<string, boolean>;
  operations: { purpose: string; completed: boolean; elapsedMs: number }[];
  commands: {
    purpose: string;
    executable: string;
    closed: boolean;
    code: number | null;
    signal: string | null;
    argumentShapeMatches: boolean;
  }[];
  permissions?: unknown;
  outcome?: string;
};

// Reversed ordering distinguishes environment choice from the immediately preceding sample.
// The filename and dedicated CI step both follow isolated-kernel's original startup scenarios.
for (const [order, modes] of [
  ['forward', ['minimal', 'node-environment']],
  ['reverse', ['node-environment', 'minimal']],
] as const) {
  for (const mode of modes) {
    test(`real private directory ACL ${order} ${mode} preserves permissions and command receipts`, async () => {
      const root = test.info().outputPath('acl');
      const temporary = join(root, 'temporary');
      await mkdir(temporary, { recursive: true });
      const previous = process.env.SCHOOLOOM_ACL_SECRET;
      process.env.SCHOOLOOM_ACL_SECRET = 'acl-probe-private-marker';
      const startedAt = Date.now();
      let child: ReturnType<typeof fork>;
      try {
        const env = mode === 'minimal' ? {} : nodeEnvironment();
        // Shared overrides keep temporary writes isolated; this is not a literal replay of env:{}.
        Object.assign(env, { TMPDIR: temporary, TEMP: temporary, TMP: temporary });
        child = fork(new URL('../fixtures/isolated-kernel-acl.mjs', import.meta.url), [], {
          execArgv: [],
          stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
          env,
        });
      } finally {
        if (previous === undefined) delete process.env.SCHOOLOOM_ACL_SECRET;
        else process.env.SCHOOLOOM_ACL_SECRET = previous;
      }
      let facts: AclFacts | undefined;
      let invalidMessage = false;
      let reason = 'unknown';
      let cancelRequested = false;
      let nodeKillRequested = false;
      let beforeCleanup: object | undefined;
      let close: { code: number | null; signal: string | null } | undefined;
      let timer: ReturnType<typeof setTimeout> | undefined;
      let killTimer: ReturnType<typeof setTimeout> | undefined;
      const closed = new Promise<void>((resolve) =>
        child.once('close', (code, signal) => {
          close = { code, signal };
          resolve();
        }),
      );
      child.on('error', () => {
        reason = 'processError';
      });
      child.on('message', (message) => {
        const candidate = message as AclFacts;
        if (
          JSON.stringify(message).length > 32 * 1024 ||
          candidate?.version !== 1 ||
          candidate.processId !== child.pid
        ) {
          invalidMessage = true;
          return;
        }
        facts = candidate;
      });
      try {
        child.send({ directory: join(root, 'private') }, (error) => {
          if (error) reason = 'ipcError';
        });
        const completed = await Promise.race([
          closed.then(() => true),
          new Promise<false>((resolve) => {
            timer = setTimeout(() => resolve(false), developmentKernelConnectionTimeout);
          }),
        ]);
        clearTimeout(timer);
        if (reason === 'unknown') reason = completed ? 'closed' : 'probeDeadline';
        beforeCleanup = { at: Date.now(), close: close ?? null };
        if (!completed) {
          // The trusted entry cancels the exact live command handles; no PID reconstruction.
          if (child.connected) {
            cancelRequested = true;
            child.send({ cancel: true }, () => {});
          }
          // Keep forced termination and its close check inside the existing cleanup budget.
          killTimer = setTimeout(() => {
            if (!close) {
              nodeKillRequested = true;
              child.kill('SIGKILL');
            }
          }, limits.lifecycleMs / 2);
          await Promise.race([
            closed,
            new Promise<void>((resolve) => {
              timer = setTimeout(resolve, limits.lifecycleMs);
            }),
          ]);
        }
        expect(reason).toBe('closed');
        expect(close).toEqual({ code: 0, signal: null });
        expect(invalidMessage).toBe(false);
        assert(facts);
        expect(facts.outcome).toBe('completed');
        expect(facts.environment.SCHOOLOOM_ACL_SECRET).toBe(false);
        expect(facts.operations.map((operation) => operation.purpose)).toEqual([
          'set-acl-new',
          'set-acl-existing',
          'verify-acl',
        ]);
        expect(
          facts.operations.every((operation) => operation.completed && operation.elapsedMs >= 0),
        ).toBe(true);
        if (process.platform === 'win32') {
          expect(facts.permissions).toEqual({
            protected: true,
            ownerMatches: true,
            directory: [{ currentUser: true, fullControl: true, inherited: false, allowed: true }],
            file: [{ currentUser: true, fullControl: true, inherited: true, allowed: true }],
          });
          expect(facts.commands.map((command) => command.purpose)).toEqual([
            'set-acl-new',
            'set-acl-existing',
            'verify-acl',
          ]);
          expect(
            facts.commands.every(
              (command) =>
                command.executable === 'powershell.exe' &&
                command.argumentShapeMatches &&
                command.closed &&
                command.code === 0 &&
                command.signal === null,
            ),
          ).toBe(true);
        } else {
          expect(facts.permissions).toEqual({ directoryMode: 0o700, fileMode: 0o600 });
          expect(facts.commands).toEqual([]);
        }
      } finally {
        clearTimeout(timer);
        clearTimeout(killTimer);
        if (child.connected) child.disconnect();
        if (!close) child.unref();
        const artifact = test.info().outputPath('acl-comparison.json');
        await writeFile(
          artifact,
          JSON.stringify({
            mode,
            order,
            startedAt,
            sampledAt: Date.now(),
            reason,
            beforeCleanup,
            cancelRequested,
            nodeKillRequested,
            commandCleanup:
              !nodeKillRequested && facts?.commands.every((command) => command.closed)
                ? 'observedCommandsClosed'
                : 'unknown',
            close,
            invalidMessage,
            facts,
          }),
        );
        await test
          .info()
          .attach('acl-comparison', { path: artifact, contentType: 'application/json' });
      }
    });
  }
}

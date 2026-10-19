import { mkdtemp, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { HumanMessage } from '../../apps/kernel/node_modules/@langchain/core/dist/messages/index.js';
import { FakeListChatModel } from '../../apps/kernel/node_modules/@langchain/core/dist/utils/testing/index.js';
import { createDeepAgent } from '../../apps/kernel/node_modules/deepagents/dist/index.js';
import { createMiddleware } from '../../apps/kernel/node_modules/langchain/dist/index.js';
import { z } from '../../apps/kernel/node_modules/zod/index.js';
import { InstructionSaver } from '../../packages/harness/dist/node.js';

const Database = createRequire(new URL('../../apps/kernel/package.json', import.meta.url))(
  'better-sqlite3',
);

for (const boundary of ['success', 'save', 'ack'] as const) {
  test(`instructions survive disk checkpoint boundary: ${boundary}`, async () => {
    const root = await mkdtemp(join(tmpdir(), 'scholoom-checkpoint-'));
    const db = new Database(join(root, 'checkpoint.sqlite'));
    let consumed = false;
    let calls = 0;
    try {
      const saver = new InstructionSaver(db, async ({ instructionIds }) => {
        if (boundary === 'ack') throw new Error('lost acknowledgement');
        consumed = instructionIds.includes('instruction');
      });
      if (boundary === 'save') {
        const save = saver.put.bind(saver);
        saver.put = async (config, checkpoint, metadata) => {
          if ((checkpoint.channel_values.instructionIds as string[] | undefined)?.length)
            throw new Error('disk unavailable');
          return save(config, checkpoint, metadata);
        };
      }
      const agent = createDeepAgent({
        model: new FakeListChatModel({ responses: ['done'] }),
        checkpointer: saver,
        middleware: [
          createMiddleware({
            name: 'InstructionBoundary',
            stateSchema: z.object({ instructionIds: z.array(z.string()).default([]) }),
            beforeModel: () => ({
              messages: [new HumanMessage({ id: 'instruction', content: 'goal' })],
              instructionIds: ['instruction'],
            }),
            wrapModelCall: async (request, handler) => {
              expect(consumed).toBe(true);
              calls++;
              return handler(request);
            },
          }),
        ],
      });
      const config = { configurable: { thread_id: 'run' }, durability: 'sync' as const };
      if (boundary === 'success') await agent.invoke({ messages: [] }, config);
      else await expect(agent.invoke({ messages: [] }, config)).rejects.toThrow();
      expect(consumed).toBe(boundary === 'success');
      expect(calls).toBe(boundary === 'success' ? 1 : 0);
      db.close();
      const reopened = new Database(join(root, 'checkpoint.sqlite'));
      try {
        let recovered: string[] = [];
        const reader = new InstructionSaver(reopened, async (value) => {
          recovered = value.instructionIds;
        });
        await reader.confirmLatest(config);
        expect(recovered).toEqual(boundary === 'save' ? [] : ['instruction']);
      } finally {
        reopened.close();
      }
    } finally {
      if (db.open) db.close();
      await rm(root, { recursive: true });
    }
  });
}

import { expect, test } from '@playwright/test';
import { toThreadMessages } from '../../apps/desktop/src/renderer/src/workbench/projection.js';
import type { Artifact, Message } from '../../packages/protocol/src/index.js';

function reply(id: string, runId?: string): Message {
  return {
    id,
    sessionId: 'session',
    ...(runId ? { runId } : {}),
    role: 'assistant',
    text: id,
    state: 'complete',
    materials: [],
    createdAt: '2026-10-20T00:00:00Z',
  };
}

function tool(id: string, runId: string): Message {
  return {
    ...reply(id),
    role: 'tool',
    tool: { runId, name: 'write_file', input: '{}', inputTruncated: false },
  };
}

const artifacts: Artifact[] = [
  { runId: 'first', path: 'result.md', state: 'linked' },
  { runId: 'second', path: 'result.md', state: 'unknown' },
];

function attached(messages: Message[], values = artifacts) {
  return toThreadMessages(messages, values).flatMap((message) => {
    const files = message.metadata?.custom?.artifacts as Artifact[];
    return files.map((file) => [message.id, file.runId, file.path]);
  });
}

test('each execution attaches its files only to its last reply, including identical paths', () => {
  expect(
    attached([
      reply('initial', 'first'),
      tool('first-tool', 'first'),
      reply('first-result', 'first'),
      tool('second-tool', 'second'),
      reply('second-result', 'second'),
    ]),
  ).toEqual([
    ['first-result', 'first', 'result.md'],
    ['second-result', 'second', 'result.md'],
  ]);
});

test('legacy files use their explicit tool execution without guessing a nearby reply', () => {
  expect(
    attached(
      [
        tool('older-tool', 'first'),
        tool('last-tool', 'first'),
        reply('legacy-result'),
        reply('unrelated-result', 'second'),
      ],
      artifacts.slice(0, 1),
    ),
  ).toEqual([['last-tool', 'first', 'result.md']]);
});

test('unloaded execution files do not attach to the current page and return with earlier messages', () => {
  const current = [reply('current', 'second')];
  expect(attached(current)).toEqual([['current', 'second', 'result.md']]);
  expect(attached([reply('earlier', 'first'), ...current])).toEqual([
    ['earlier', 'first', 'result.md'],
    ['current', 'second', 'result.md'],
  ]);
});

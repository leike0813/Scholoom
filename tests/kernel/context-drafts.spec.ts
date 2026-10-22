/// <reference lib="dom" />
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import { build } from '../../packages/editor/node_modules/esbuild/lib/main.js';

test('window drafts survive reload and isolate delayed receipts, edited items and legacy recovery', async ({
  context,
}) => {
  const bundle = await build({
    stdin: {
      contents: `import * as drafts from './src/renderer/src/workbench/drafts';
        import * as items from './src/renderer/src/workbench/context-drafts';
        window.fixture={...drafts,...items};`,
      resolveDir: fileURLToPath(new URL('../../apps/desktop/', import.meta.url)),
      loader: 'ts',
    },
    bundle: true,
    write: false,
    platform: 'browser',
    format: 'iife',
  });
  const script = bundle.outputFiles[0]?.text;
  expect(script).toBeTruthy();
  await context.route('https://context-drafts.test/**', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: `<html><body><script>${script}</script></body></html>`,
    }),
  );
  const first = await context.newPage();
  const second = await context.newPage();
  await first.goto('https://context-drafts.test/');
  await second.goto('https://context-drafts.test/');
  const exercise = await first.evaluate(() => {
    const f = (
      window as unknown as {
        fixture: typeof import('../../apps/desktop/src/renderer/src/workbench/context-drafts.js') &
          typeof import('../../apps/desktop/src/renderer/src/workbench/drafts.js');
      }
    ).fixture;
    const identity = f.workbenchInstanceId();
    const key = f.draftKey(identity, 'profile', 'project', 'first', 'context-items');
    const other = f.draftKey(identity, 'profile', 'project', 'second', 'context-items');
    const item = {
      kind: 'text' as const,
      itemId: 'first',
      ref: { source: 'project' as const, projectId: 'project', fileId: 'file' },
      basis: 'version',
      quote: 'original draft',
      contentState: 'draft' as const,
    };
    f.writeContextDraft(key, [item]);
    const sent = f.readContextDraft(key);
    f.writeContextDraft(key, [
      { ...item, comment: 'edited after send' },
      { ...item, itemId: 'later' },
    ]);
    f.writeContextDraft(other, [{ ...item, itemId: 'other session' }]);
    f.confirmContextDraft(key, sent);
    const kept = f.readContextDraft(key);
    const later = kept[1];
    if (!later) throw new Error('later item missing');
    f.confirmContextDraft(key, [later]);
    const afterReceipt = f.readContextDraft(key);
    const legacy = f.draftKey('profile', 'project', 'first');
    f.writeDraft(legacy, 'old unsent text');
    const old = f.legacyConversationDraft('profile', 'project', 'first');
    const emptyFields =
      ['materials', 'context-items'].every((suffix) => f.emptyConversationField(suffix, '[]')) &&
      f.emptyConversationField('material-file-ids', '{}');
    const protectsContent =
      !f.emptyConversationField('materials', '["paper.md"]') &&
      !f.emptyConversationField('', 'text') &&
      !f.emptyConversationField('context-items', 'invalid');
    let invalidRejected = false;
    try {
      f.writeContextDraft(key, [item, item]);
    } catch {
      invalidRejected = true;
    }
    const afterInvalid = f.readContextDraft(key);
    return {
      identity,
      key,
      kept,
      afterReceipt,
      other: f.readContextDraft(other),
      old,
      legacy: f.readDraft(legacy),
      invalidRejected,
      afterInvalid,
      emptyFields,
      protectsContent,
    };
  });
  expect(exercise.kept.map((item) => item.itemId)).toEqual(['first', 'later']);
  expect(exercise.afterReceipt).toMatchObject([
    {
      itemId: 'first',
      comment: 'edited after send',
      quote: 'original draft',
      contentState: 'draft',
    },
  ]);
  expect(exercise.other).toMatchObject([{ itemId: 'other session' }]);
  expect(exercise.invalidRejected).toBe(true);
  expect(exercise.emptyFields && exercise.protectsContent).toBe(true);
  expect(exercise.afterInvalid).toEqual(exercise.afterReceipt);
  expect(exercise.legacy).toBe('old unsent text');
  expect(exercise.old.some((item) => item.value === 'old unsent text')).toBe(true);
  const otherWindow = await second.evaluate((copiedName) => {
    window.name = copiedName;
    const f = (
      window as unknown as {
        fixture: typeof import('../../apps/desktop/src/renderer/src/workbench/context-drafts.js') &
          typeof import('../../apps/desktop/src/renderer/src/workbench/drafts.js');
      }
    ).fixture;
    const identity = f.workbenchInstanceId();
    const key = f.draftKey(identity, 'profile', 'project', 'first', 'context-items');
    return { identity, items: f.readContextDraft(key) };
  }, exercise.identity);
  expect(otherWindow.identity).not.toBe(exercise.identity);
  expect(otherWindow.items).toEqual([]);
  await first.reload();
  expect(
    await first.evaluate(() => {
      const f = (
        window as unknown as {
          fixture: typeof import('../../apps/desktop/src/renderer/src/workbench/context-drafts.js') &
            typeof import('../../apps/desktop/src/renderer/src/workbench/drafts.js');
        }
      ).fixture;
      return {
        identity: f.workbenchInstanceId(),
        items: f.readContextDraft(
          f.draftKey(f.workbenchInstanceId(), 'profile', 'project', 'first', 'context-items'),
        ),
      };
    }),
  ).toEqual({ identity: exercise.identity, items: exercise.afterReceipt });
  await first.close();
  await second.close();
});

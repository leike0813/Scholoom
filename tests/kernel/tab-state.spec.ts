import { expect, test } from '@playwright/test';
import type { ResourceTarget } from '../../apps/desktop/src/renderer/src/workbench/resource-controller.js';
import {
  normalizeLegacyTab,
  openResourceTab,
  type WorkbenchTabState,
} from '../../apps/desktop/src/renderer/src/workbench/tab-state.js';

const project = (
  path: string,
  options: { fileId?: string; openMode?: 'preview' | 'permanent' } = {},
): ResourceTarget => ({
  locator: {
    source: 'project',
    projectId: 'project',
    ...(options.fileId ? { fileId: options.fileId } : {}),
    path,
  },
  name: path.split('/').at(-1) ?? path,
  ...(options.openMode ? { openMode: options.openMode } : {}),
});

const library = (
  attachmentId: string,
  materialVersionId: string,
  name: string,
): ResourceTarget => ({
  locator: { source: 'library', attachmentId, materialVersionId },
  name,
});

const empty: WorkbenchTabState = { groups: [], activeGroupId: null };

test('transient resources replace within the active group and dirty resources become permanent', () => {
  const first = openResourceTab(empty, project('first.md', { openMode: 'preview' }));
  const second = openResourceTab(first, project('second.md', { openMode: 'preview' }));
  expect(second.groups[0]?.tabs.map((tab) => tab.resource?.name)).toEqual(['second.md']);
  const third = openResourceTab(
    second,
    project('third.md', { openMode: 'preview' }),
    (target) => target.name === 'second.md',
  );
  expect(third.groups[0]?.tabs.map((tab) => [tab.resource?.name, tab.transient])).toEqual([
    ['second.md', false],
    ['third.md', true],
  ]);
});

test('stable project identity rebinds a path tab and activates its group', () => {
  const target = project('note.md');
  const state: WorkbenchTabState = {
    activeGroupId: 'b',
    groups: [
      { id: 'a', tabs: [], activeId: null },
      {
        id: 'b',
        activeId: 'old',
        tabs: [
          {
            id: 'old',
            title: 'note.md',
            kind: 'editor',
            resource: {
              ...target,
              locator: {
                source: 'project',
                projectId: 'project',
                path: 'note.md',
                fileId: 'stable-id',
              },
            },
          },
        ],
      },
    ],
  };
  const opened = openResourceTab(state, project('renamed.md', { fileId: 'stable-id' }));
  expect(opened.activeGroupId).toBe('b');
  expect(opened.groups[1]?.activeId).toBe('project:stable-id');
  expect(opened.groups[1]?.tabs).toMatchObject([
    {
      id: 'project:stable-id',
      title: 'renamed.md',
      resource: { locator: { fileId: 'stable-id', path: 'renamed.md' } },
    },
  ]);
});

test('library identity includes material version and format chooses reader or text editor', () => {
  const first = openResourceTab(empty, library('attachment', 'v1', 'paper.pdf'));
  const reopened = openResourceTab(first, library('attachment', 'v1', 'paper.pdf'));
  const nextVersion = openResourceTab(reopened, library('attachment', 'v2', 'paper.pdf'));
  const text = openResourceTab(nextVersion, library('notes', 'v1', 'notes.md'));
  expect(text.groups[0]?.tabs.map(({ id, kind }) => [id, kind])).toEqual([
    ['reader:attachment:v1', 'reader'],
    ['reader:attachment:v2', 'reader'],
    ['reader:notes:v1', 'editor'],
  ]);
});

test('project document formats use readers while project text uses editor tabs', () => {
  const pdf = openResourceTab(empty, project('paper.pdf'));
  const epub = openResourceTab(pdf, project('book.epub'));
  const html = openResourceTab(epub, project('page.html'));
  const text = openResourceTab(html, project('draft.qmd'));
  const preview = openResourceTab(text, project('quick.md', { openMode: 'preview' }));
  expect(preview.groups[0]?.tabs.map(({ id, kind }) => [id, kind])).toEqual([
    ['project:paper.pdf', 'reader'],
    ['project:book.epub', 'reader'],
    ['project:page.html', 'reader'],
    ['project:draft.qmd', 'editor'],
    ['project:quick.md', 'editor'],
  ]);
  expect(preview.groups[0]?.tabs.at(-1)).toMatchObject({ editorMode: 'source', transient: true });
});

test('legacy target and material tabs normalize to resource locators', () => {
  expect(
    normalizeLegacyTab({
      id: 'old-file',
      title: 'note.md',
      kind: 'editor',
      target: { projectId: 'project', path: 'note.md', fileId: 'f1' },
    }),
  ).toMatchObject({
    resource: { locator: { source: 'project', projectId: 'project', fileId: 'f1' } },
  });
  expect(
    normalizeLegacyTab({
      id: 'old-reader',
      title: 'paper.pdf',
      kind: 'reader',
      material: { id: 'a1', materialVersionId: 'v1', name: 'paper.pdf' },
    }),
  ).toMatchObject({
    resource: {
      locator: { source: 'library', attachmentId: 'a1', materialVersionId: 'v1' },
    },
  });
});

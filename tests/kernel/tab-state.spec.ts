import { expect, test } from '@playwright/test';
import {
  openFileTab,
  type WorkbenchTabState,
} from '../../apps/desktop/src/renderer/src/workbench/tab-state.js';

const file = (path: string, openMode: 'preview' | 'permanent' = 'preview') => ({
  projectId: 'project',
  path,
  openMode,
});

test('transient file tabs replace within the active group and dirty tabs become permanent', () => {
  const initial: WorkbenchTabState = { groups: [], activeGroupId: null };
  const first = openFileTab(initial, file('first.md'));
  const second = openFileTab(first, file('second.md'));
  expect(second.groups[0]?.tabs.map((tab) => tab.target?.path)).toEqual(['second.md']);
  const third = openFileTab(second, file('third.md'), (target) => target.path === 'second.md');
  expect(third.groups[0]?.tabs.map((tab) => [tab.target?.path, tab.transient])).toEqual([
    ['second.md', false],
    ['third.md', true],
  ]);
});

test('permanent opening rebinds an unresolved path tab and activates its group', () => {
  const state: WorkbenchTabState = {
    activeGroupId: 'b',
    groups: [
      { id: 'a', tabs: [], activeId: null },
      {
        id: 'b',
        activeId: 'old',
        tabs: [{ id: 'old', title: 'note.md', kind: 'editor', target: file('note.md') }],
      },
    ],
  };
  const opened = openFileTab(state, {
    projectId: 'project',
    path: 'note.md',
    fileId: 'stable-id',
    openMode: 'permanent',
  });
  expect(opened.activeGroupId).toBe('b');
  expect(opened.groups[1]?.activeId).toBe('project:stable-id');
  expect(opened.groups[1]?.tabs).toMatchObject([
    { id: 'project:stable-id', target: { path: 'note.md', fileId: 'stable-id' }, transient: false },
  ]);
});

test('file targets default to permanent tabs', () => {
  const opened = openFileTab(
    { groups: [], activeGroupId: null },
    { projectId: 'project', path: 'report.md' },
  );
  expect(opened.groups[0]?.tabs[0]?.transient).toBe(false);
});

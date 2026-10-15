import { expect, test } from '@playwright/test';
import {
  assetTarget,
  linkTarget,
} from '../../apps/desktop/src/renderer/src/workbench/markdown-paths.js';

test('Markdown URI paths decode before project boundary checks and separate file fragments', () => {
  for (const href of [
    '%E6%9D%90%E6%96%99%20%E7%AC%94%E8%AE%B0.md#%E7%BB%93%E8%AE%BA',
    '材料 笔记.md#结论',
  ])
    expect(linkTarget('', href)).toEqual({ kind: 'file', path: '材料 笔记.md' });
  expect(linkTarget('notes/current.md', '../input.md#result')).toEqual({
    kind: 'file',
    path: 'input.md',
  });
  expect(linkTarget('', '#%E7%BB%93%E8%AE%BA')).toEqual({ kind: 'anchor', id: '结论' });
  expect(linkTarget('', 'literal%23name.md')).toEqual({ kind: 'file', path: 'literal#name.md' });
  expect(assetTarget('notes/current.md', '../%E5%9B%BE%20%E7%89%87.png')).toEqual({
    kind: 'local',
    path: '图 片.png',
  });
  for (const href of [
    '%2e%2e/secret.md',
    '%2fsecret.md',
    '..%5csecret.md',
    'javascript%3Aalert(1)',
    'bad%name.md',
  ]) {
    expect(linkTarget('', href)).toBeUndefined();
    expect(assetTarget('', href)).toEqual({ kind: 'invalid' });
  }
});

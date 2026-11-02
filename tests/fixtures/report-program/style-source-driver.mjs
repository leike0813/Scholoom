import assert from 'node:assert/strict';
import { reportRenderLimits as limits } from '../../../packages/protocol/src/report-rendering.js';
import { createWorkerDOM, hydrate } from '../../../packages/editor/vendor/worker-dom/src/worker-thread/index.js';
import { runStyleCases } from './style-source-cases.mjs';

const source = createWorkerDOM(() => {}, () => {}, () => {});
hydrate(source.document, [], {}, ['background-color'], [], [800, 600], { storage: {}, errorMsg: null }, { storage: {}, errorMsg: null });
const result = { groups: runStyleCases(source.document), limits: [] };
const element = source.document.createElement('div');
const style = element.style;
style.cssText = 'color:red;';
const observer = new source.MutationObserver(() => {});
observer.observe(element, { attributes: true });
style.cssText = 'color:blue;width:12px;--Theme:Green;';
const records = observer.takeRecords();
assert.equal(records.length, 1, 'one attribute mutation for the full replacement');
assert.equal(records[0].attributeName, 'style');
const before = style.cssText;
for (const [name, css] of [
  ['bytes', '--Text:"' + 'a'.repeat(limits.cssBytes) + '"'],
  ['utf8 bytes', '--Text:"' + '汉'.repeat(Math.ceil(limits.cssBytes / 3)) + '"'],
  ['tokens', '--Tokens:' + 'a '.repeat(limits.cssTokens)],
  ['depth', '--Depth:' + 'f('.repeat(limits.cssDepth + 1) + 'a' + ')'.repeat(limits.cssDepth + 1)],
]) {
  assert.throws(() => { style.cssText = css; }, RangeError);
  assert.equal(style.cssText, before, 'capacity rejection preserves the prior table');
  result.limits.push(name);
}
assert.throws(() => style.setProperty('--Text', 'a'.repeat(limits.cssBytes)), RangeError);
assert.equal(style.cssText, before);
assert.equal(observer.takeRecords().length, 0, 'capacity rejection has no attribute mutation');
observer.disconnect();
result.singleReplacementMutation = true;
console.log(JSON.stringify(result));

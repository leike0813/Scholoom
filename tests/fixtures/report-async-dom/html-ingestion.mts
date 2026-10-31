import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { TransferrableKeys as K } from '../report-worker-dom/vendor/src/transfer/TransferrableKeys.js';
import type { Element } from '../report-worker-dom/vendor/src/worker-thread/dom/Element.js';
import type { Node } from '../report-worker-dom/vendor/src/worker-thread/dom/Node.js';
import { createWorkerDOM, hydrate } from '../report-worker-dom/vendor/src/worker-thread/index.js';

const [inputPath, output] = process.argv.slice(2);
assert(inputPath && output);
const html = await readFile(inputPath, 'utf8');
assert(Buffer.byteLength(html) <= 65536, 'inputHtmlBudget');
const packets: object[] = [];
const source = createWorkerDOM(
  (message: any) => {
    const packet = {
      phase: message[K.phase],
      nodes: Array.from(new Uint16Array(message[K.nodes])),
      strings: message[K.strings],
      mutations: Array.from(new Uint16Array(message[K.mutations])),
    };
    assert(
      packets.length < 4 && Buffer.byteLength(JSON.stringify(packet)) <= 65536,
      'sourcePacketBudget',
    );
    packets.push(packet);
  },
  () => {},
  () => {},
);
hydrate(
  source.document,
  [],
  {} as any,
  [],
  [],
  [800, 600],
  { storage: {}, errorMsg: null },
  { storage: {}, errorMsg: null },
);
source.document[K.observe]();
const expected = {
  htmlNamespace: 'http://www.w3.org/1999/xhtml',
  mathNamespace: 'http://www.w3.org/1998/Math/MathML',
  inputValue: 'seed',
};
const evidence: Record<string, any> = {
  inputPath,
  html,
  entry: 'source.document.body.innerHTML',
  parser: 'fixed vendor/src/third_party/html-parser/html-parser.ts parse()',
  expected,
  sourcePid: process.pid,
  nativeHostInputVerified: false,
  packets,
};
let failure: unknown;
try {
  source.document.body.innerHTML = html;
  await Promise.resolve();
  const math = source.document.getElementById('html-math');
  const input = source.document.getElementById('html-input');
  const describe = (node: any) =>
    node
      ? {
          localName: node.localName,
          namespace: node.namespaceURI,
          text: node.textContent,
          declaredXmlns: node.getAttribute?.('xmlns') ?? null,
        }
      : null;
  evidence.math = [
    math,
    math?.querySelector('mfrac'),
    math?.querySelector('mi'),
    math?.querySelector('mn'),
  ].map(describe);
  evidence.input = {
    node: describe(input),
    isUpstreamInput: input instanceof source.HTMLInputElement,
    value: input?.value,
    type: input?.type,
  };
  evidence.elementTree = (source.document.body.querySelectorAll('*') ?? []).map(describe);
  assert(input instanceof source.HTMLInputElement, 'htmlInputClass');
  assert.equal(input.namespaceURI, expected.htmlNamespace, 'htmlInputNamespace');
  assert.equal(input.value, expected.inputValue, 'htmlInputValue');
  for (const node of evidence.math)
    assert.equal(node?.namespace, expected.mathNamespace, 'mathmlNamespace');
  assert.equal(math?.querySelector('mi')?.textContent, 'n');
  assert.equal(math?.querySelector('mn')?.textContent, '2');
  let observed = '';
  input.addEventListener('input', () => {
    observed = input.value;
  });
  input.value = 'narrow-edit';
  input.dispatchEvent(new source.Event('input', { bubbles: true }));
  await Promise.resolve();
  assert.equal(observed, 'narrow-edit');
  evidence.sourceSyntheticInput = {
    observed,
    scope: 'source property/event only; no native host input',
  };
  evidence.fragments = [
    {
      name: 'math-text-and-html-siblings',
      namespace: expected.htmlNamespace,
      tag: 'section',
      html: '<math><mtext><span>text</span><mglyph></mglyph><malignmark></malignmark></mtext><mi>x</mi></math><input value="next">',
    },
    {
      name: 'annotation-html-and-svg',
      namespace: expected.htmlNamespace,
      tag: 'section',
      html: '<math><semantics><annotation-xml encoding="TEXT/HTML"><div><math><mn>1</mn></math></div></annotation-xml><annotation-xml><svg><circle></circle></svg></annotation-xml></semantics></math><p>after</p>',
    },
    {
      name: 'annotation-attribute-name-case',
      namespace: expected.htmlNamespace,
      tag: 'section',
      html: '<math><annotation-xml ENCODING="text/html"><input VALUE="seed"></annotation-xml></math>',
    },
    {
      name: 'svg-integration-and-return',
      namespace: expected.htmlNamespace,
      tag: 'section',
      html: '<svg><foreignObject><input value="svg"><math><mi>x</mi></math></foreignObject><desc><span>description</span></desc><circle></circle></svg><p>after</p>',
    },
    {
      name: 'math-fragment',
      namespace: expected.mathNamespace,
      tag: 'math',
      html: '<mfrac><mi>n</mi><mn>2</mn></mfrac>',
    },
    {
      name: 'math-text-fragment',
      namespace: expected.mathNamespace,
      tag: 'mtext',
      html: '<span>text</span><mglyph></mglyph><math><mn>3</mn></math>',
    },
    {
      name: 'annotation-fragment',
      namespace: expected.mathNamespace,
      tag: 'annotation-xml',
      encoding: 'application/xhtml+xml',
      html: '<input value="annotation"><math><mi>x</mi></math>',
    },
  ].map((fixture) => {
    const container = source.document.createElementNS(fixture.namespace, fixture.tag);
    if (fixture.encoding) container.setAttribute('encoding', fixture.encoding);
    container.innerHTML = fixture.html;
    const nodes: Element[] = [];
    const visit = (node: Node) => {
      if (node.nodeType === 1) nodes.push(node as Element);
      for (const child of node.childNodes) visit(child);
    };
    for (const child of container.childNodes) visit(child);
    return {
      ...fixture,
      nodes: nodes.map((node) => ({
        name: node.localName,
        namespace: node.namespaceURI,
        text: node.textContent,
        value: node instanceof source.HTMLInputElement ? node.value : null,
      })),
    };
  });
  await Promise.resolve();
} catch (error) {
  failure = error;
  evidence.failure = { name: (error as Error).name, message: (error as Error).message };
  process.exitCode = 1;
} finally {
  evidence.support = failure
    ? 'unsupported-for-this-static-html'
    : 'source-check-passed-host-validation-pending';
  await writeFile(join(output, 'source-evidence.json'), JSON.stringify(evidence, null, 2));
  if (failure)
    await writeFile(join(output, 'first-failure.json'), JSON.stringify(evidence, null, 2));
}
console.log(
  JSON.stringify({
    support: evidence.support,
    failure: evidence.failure,
    math: evidence.math,
    input: evidence.input,
  }),
);

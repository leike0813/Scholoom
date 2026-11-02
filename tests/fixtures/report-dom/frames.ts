import type { ReportRenderFrame } from '../../../packages/protocol/dist/report-contracts.js';

export const namespaces = {
  html: 'http://www.w3.org/1999/xhtml',
  math: 'http://www.w3.org/1998/Math/MathML',
  svg: 'http://www.w3.org/2000/svg',
};

// Independent 1×1 white JPEG: ImageMagick `convert -size 1x1 xc:white -strip -interlace none jpeg:-`.
export const frozenJPEG =
  '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAMCAgICAgMCAgIDAwMDBAYEBAQEBAgGBgUGCQgKCgkICQkKDA8MCgsOCwkJDRENDg8QEBEQCgwSExIQEw8QEBD/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AVN//2Q==';

export function frozenDecodeFrame() {
  const wire = new Wire(1);
  wire.frame.roots = { html: 30, head: 31 };
  wire.element(3, 'link');
  wire.attr(3, 'rel', 'stylesheet');
  wire.attr(3, 'href', '../assets/decode.css');
  wire.children(31, [3]);
  wire.element(4, 'img');
  wire.attr(4, 'src', '../assets/pixel.jpg');
  wire.attr(4, 'alt', 'Frozen JPEG');
  wire.element(5, 'p');
  wire.attr(5, 'class', 'frozen-font');
  wire.text(6, 'x');
  wire.children(5, [6]);
  wire.children(2, [4, 5]);
  return wire.frame;
}

/** Static WorkerDOM wire encoding; no report script, upstream node allocator or HTML parser. */
export class Wire {
  readonly frame: ReportRenderFrame;
  private readonly strings: string[];
  constructor(sequence: number, previous: string[] = []) {
    this.strings = [...previous];
    this.frame = { sequence, phase: sequence === 1 ? 1 : 2, nodes: [], strings: [], mutations: [] };
  }
  string(value: string) {
    const existing = this.strings.indexOf(value);
    if (existing >= 0) return existing;
    this.frame.strings.push(value);
    return this.strings.push(value) - 1;
  }
  element(id: number, name: string, namespace = namespaces.html) {
    this.frame.nodes.push(id, 1, this.string(name), 0, this.string(namespace));
  }
  text(id: number, text: string) {
    this.frame.nodes.push(id, 3, this.string('#text'), this.string(text), 0);
  }
  attr(id: number, name: string, value: string) {
    this.frame.mutations.push(0, id, this.string(name), this.string(''), this.string(value) + 1);
  }
  property(id: number, name: string, value: string) {
    this.frame.mutations.push(3, id, this.string(name), 0, this.string(value));
  }
  children(id: number, added: number[], removed: number[] = [], before = 0) {
    this.frame.mutations.push(2, id, before, 0, added.length, removed.length, ...added, ...removed);
  }
  content(id: number, value: string) {
    this.frame.mutations.push(1, id, this.string(value));
  }
  inputEvent(id: number) {
    this.frame.mutations.push(4, id, 0, 1, this.string('input'), 0, 0, 0, 0, 0);
  }
}

export const ids = { article: 3, paragraph: 4, text: 5, input: 6, table: 7, fraction: 14, svg: 19 };
export function baseline(flatSiblings = 0) {
  const w = new Wire(1);
  for (const [id, name] of [
    [3, 'article'],
    [4, 'p'],
    [6, 'input'],
    [7, 'table'],
    [8, 'caption'],
    [10, 'tbody'],
    [11, 'tr'],
    [12, 'td'],
  ] as const)
    w.element(id, name);
  w.text(5, 'Selectable report evidence');
  w.text(9, 'Measured results');
  w.text(13, '42');
  for (const [id, name] of [
    [14, 'math'],
    [15, 'mfrac'],
    [16, 'mi'],
    [17, 'mn'],
  ] as const)
    w.element(id, name, namespaces.math);
  w.text(18, 'x');
  w.element(19, 'svg', namespaces.svg);
  w.element(20, 'circle', namespaces.svg);
  w.text(21, '2');
  w.attr(4, 'id', 'evidence');
  w.attr(6, 'aria-label', 'Report note');
  w.attr(6, 'type', 'text');
  w.property(6, 'value', 'draft');
  w.attr(7, 'aria-label', 'Results');
  w.attr(14, 'display', 'block');
  w.attr(19, 'aria-label', 'Static measurement');
  w.attr(19, 'role', 'img');
  w.attr(19, 'viewBox', '0 0 40 40');
  w.attr(19, 'width', '40');
  w.attr(19, 'height', '40');
  for (const [name, value] of [
    ['cx', '20'],
    ['cy', '20'],
    ['r', '10'],
    ['fill', 'navy'],
  ])
    w.attr(20, name!, value!);
  w.children(4, [5]);
  w.children(8, [9]);
  w.children(12, [13]);
  w.children(11, [12]);
  w.children(10, [11]);
  w.children(7, [8, 10]);
  w.children(16, [18]);
  w.children(17, [21]);
  w.children(15, [16, 17]);
  w.children(14, [15]);
  w.children(19, [20]);
  w.children(3, [4, 6, 7, 14, 19]);
  w.children(2, [3]);
  w.inputEvent(6);
  if (flatSiblings) {
    const siblings = Array.from({ length: flatSiblings }, (_, index) => 100 + index);
    for (const id of siblings) w.element(id, 'span');
    w.children(2, siblings);
  }
  return w.frame;
}

export function largePage(previous: string[]) {
  const frames: ReportRenderFrame[] = [];
  const strings = [...previous];
  for (let batch = 0; batch < 10; batch++) {
    const w = new Wire(batch + 3, strings);
    const articles: number[] = [];
    for (let object = batch * 10; object < (batch + 1) * 10; object++) {
      const base = 100 + object * 10;
      const names = ['article', 'h2', '', 'p', '', 'table', 'tbody', 'tr', 'td', ''];
      for (let offset = 0; offset < names.length; offset++) {
        const name = names[offset]!;
        if (name) w.element(base + offset, name);
        else
          w.text(
            base + offset,
            offset === 2
              ? `Object ${object + 1}`
              : offset === 4
                ? `Evidence ${object + 1}`
                : `${object + 1}`,
          );
      }
      w.attr(base, 'data-object', `${object + 1}`);
      w.children(base + 1, [base + 2]);
      w.children(base + 3, [base + 4]);
      w.children(base + 8, [base + 9]);
      w.children(base + 7, [base + 8]);
      w.children(base + 6, [base + 7]);
      w.children(base + 5, [base + 6]);
      w.children(base, [base + 1, base + 3, base + 5]);
      articles.push(base);
    }
    w.children(2, articles);
    strings.push(...w.frame.strings);
    frames.push(w.frame);
  }
  return frames;
}

export const attacks = [
  'unknown-node',
  'duplicate-node',
  'cycle',
  'wrong-namespace',
  'script-element',
  'onerror',
  'srcdoc',
  'style',
  'resource-url',
  'navigation-url',
  'svg-url',
  'innerHTML-property',
  'onerror-property',
  'invalid-string-index',
  'invalid-node-index',
  'truncated-node',
  'truncated-mutation',
  'unknown-opcode',
  'focused-value',
  'focused-attribute',
  'removed-insertion-anchor',
  'fragment-self-insertion',
  'utf8-frame-budget',
  'fragment-url',
  'work-units',
] as const;
export type Attack = (typeof attacks)[number];

export function malicious(kind: Attack, previous: string[]) {
  const w = new Wire(2, previous);
  // Every candidate starts with a valid visible write, which must remain unapplied on rejection.
  w.content(ids.text, `UNCOMMITTED ${kind}`);
  switch (kind) {
    case 'unknown-node':
      w.children(3, [65000]);
      break;
    case 'duplicate-node':
      w.element(30, 'p');
      w.element(30, 'p');
      break;
    case 'cycle':
      w.children(4, [3]);
      break;
    case 'wrong-namespace':
      w.element(30, 'mfrac', namespaces.html);
      break;
    case 'script-element':
      w.element(30, 'script');
      break;
    case 'onerror':
      w.attr(4, 'onerror', 'window.__reportScriptRan = true');
      break;
    case 'srcdoc':
      w.attr(4, 'srcdoc', '<script>window.__reportScriptRan = true</script>');
      break;
    case 'style':
      w.attr(4, 'style', 'background:url(https://report-dom.invalid/leak)');
      break;
    case 'resource-url':
      w.attr(6, 'src', 'https://report-dom.invalid/leak');
      break;
    case 'navigation-url':
      w.attr(4, 'href', 'javascript:window.__reportScriptRan=true');
      break;
    case 'svg-url':
      w.attr(20, 'fill', 'url(https://report-dom.invalid/leak)');
      break;
    case 'innerHTML-property':
      w.property(
        3,
        'innerHTML',
        '<img src="https://report-dom.invalid/leak" onerror="window.__reportScriptRan=true">',
      );
      break;
    case 'onerror-property':
      w.property(4, 'onerror', 'window.__reportScriptRan=true');
      break;
    case 'invalid-string-index':
      w.frame.mutations.push(1, 5, 65535);
      break;
    case 'invalid-node-index':
      w.frame.mutations.push(1, 0, 0);
      break;
    case 'truncated-node':
      w.frame.nodes.push(30, 1, 0, 0);
      break;
    case 'truncated-mutation':
      w.frame.mutations.push(0, 4, w.string('title'));
      break;
    case 'unknown-opcode':
      w.frame.mutations.push(65535, 4);
      break;
    case 'focused-value':
      w.property(6, 'value', 'clobbered');
      break;
    case 'focused-attribute':
      w.attr(6, 'value', 'clobbered');
      break;
    case 'removed-insertion-anchor':
      w.children(3, [4], [4], 4);
      break;
    case 'fragment-self-insertion':
      w.frame.nodes.push(30, 11, w.string('#document-fragment'), 0, 0);
      w.children(30, [30]);
      break;
    case 'utf8-frame-budget':
      w.frame.strings.push('界'.repeat(22 * 1024));
      break;
    case 'fragment-url':
      w.element(30, 'a');
      w.attr(30, 'href', '#evidence');
      w.children(3, [30]);
      break;
    case 'work-units':
      for (let move = 0; move < 1024; move++) w.children(2, [100]);
      break;
  }
  return w.frame;
}

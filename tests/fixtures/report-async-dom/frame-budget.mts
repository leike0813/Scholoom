// Scholoom 2026-10-31: preflight frame copies; these limits do not account for the whole heap.
export const frameLimits = { bytes: 65536, frames: 4, strings: 1024, nodes: 512 } as const;

export interface Frame {
  sequence: number;
  phase: number;
  nodes: readonly number[] | Uint16Array;
  strings: readonly string[];
  mutations: readonly number[] | Uint16Array;
  bytes?: number;
}

function check(value: unknown, code: string): asserts value {
  if (!value) throw new Error(code);
}

/** JSON quotes/escapes and UTF8 replacement of lone surrogates have different sizes. */
export function stringBytes(value: string, json = false): number {
  let size = json ? 2 : 0;
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (
      json &&
      (code === 34 ||
        code === 92 ||
        code === 8 ||
        code === 9 ||
        code === 10 ||
        code === 12 ||
        code === 13)
    )
      size += 2;
    else if (json && code < 32) size += 6;
    else if (code < 0x80) size++;
    else if (code < 0x800) size += 2;
    else if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(i + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        size += 4;
        i++;
      } else size += json ? 6 : 3;
    } else if (code >= 0xdc00 && code <= 0xdfff) size += json ? 6 : 3;
    else size += 3;
    check(size <= frameLimits.bytes, 'mutationFrameBudget');
  }
  return size;
}

function numberBytes(value: number): number {
  check(Number.isSafeInteger(value) && value >= 0, 'invalidFrameNumber');
  let size = 1;
  while (value >= 10) {
    value = Math.floor(value / 10);
    size++;
  }
  return size;
}

function wordsBytes(values: Frame['nodes']): number {
  check(Array.isArray(values) || values instanceof Uint16Array, 'invalidWords');
  check(values.length * 2 <= frameLimits.bytes, 'mutationFrameBudget');
  let size = 2 + Math.max(0, values.length - 1);
  for (const value of values) {
    check(Number.isInteger(value) && value >= 0 && value <= 65535, 'invalidU16');
    size += numberBytes(value);
    check(size <= frameLimits.bytes, 'mutationFrameBudget');
  }
  return size;
}

/** Typed views are measured as the arrays that the source will put on the wire. */
export function measureFrame(frame: Frame, includeBytes = frame.bytes !== undefined) {
  for (const key in frame)
    check(
      key === 'sequence' ||
        key === 'phase' ||
        key === 'nodes' ||
        key === 'strings' ||
        key === 'mutations' ||
        key === 'bytes',
      'invalidFrameField',
    );
  check(frame.nodes.length % 5 === 0, 'nodeTuple');
  check(Array.isArray(frame.strings) && frame.strings.length <= frameLimits.strings, 'stringCount');
  const nodes = wordsBytes(frame.nodes);
  const mutations = wordsBytes(frame.mutations);
  let strings = 2 + Math.max(0, frame.strings.length - 1);
  let rawStrings = 0;
  for (const value of frame.strings) {
    check(typeof value === 'string', 'invalidStrings');
    strings += stringBytes(value, true);
    rawStrings += stringBytes(value);
    check(strings <= frameLimits.bytes && rawStrings <= frameLimits.bytes, 'mutationFrameBudget');
  }
  const compactBytes = frame.nodes.length * 2 + frame.mutations.length * 2 + strings;
  check(compactBytes <= frameLimits.bytes, 'mutationFrameBudget');
  // These are the existing frame's JSON keys, separators and scalar values, not an envelope cap.
  const wireBytes =
    '{"sequence":'.length +
    numberBytes(frame.sequence) +
    ',"phase":'.length +
    numberBytes(frame.phase) +
    ',"nodes":'.length +
    nodes +
    ',"strings":'.length +
    strings +
    ',"mutations":'.length +
    mutations +
    (includeBytes ? ',"bytes":'.length + numberBytes(frame.bytes ?? compactBytes) : 0) +
    1;
  check(wireBytes <= frameLimits.bytes, 'mutationFrameBudget');
  return { compactBytes, wireBytes, stringBytes: rawStrings };
}

/** The actual source adapter uses this so a rejected frame cannot reach bulk copying. */
export function copyFrame(frame: Omit<Frame, 'bytes'>) {
  const measured = measureFrame(frame, true);
  return {
    ...frame,
    nodes: Array.from(frame.nodes),
    mutations: Array.from(frame.mutations),
    bytes: measured.compactBytes,
  };
}

export interface FrameContext {
  received: number;
  staged: number;
  stagedBytes: number;
  stringCount: number;
  stringBytes: number;
  nodeIds: ReadonlySet<number>;
  stringAt(index: number): string;
}

/** Read-only check: the receiver commits counters/IDs only after this returns. */
export function preflightFrame(frame: Frame, context: FrameContext) {
  const measured = measureFrame(frame);
  check(frame.sequence === context.received + 1, 'mutationSequence');
  check(
    context.staged < frameLimits.frames &&
      context.stagedBytes + measured.wireBytes <= frameLimits.bytes * frameLimits.frames,
    'mutationBudget',
  );
  check(context.stringCount + frame.strings.length <= frameLimits.strings, 'stringCount');
  check(context.stringBytes + measured.stringBytes <= frameLimits.bytes, 'stringBytes');
  check(context.nodeIds.size + frame.nodes.length / 5 <= frameLimits.nodes, 'nodeBudget');
  const lookup = (index: number) =>
    index < context.stringCount
      ? context.stringAt(index)
      : frame.strings[index - context.stringCount];
  for (let i = 0; i < frame.nodes.length; i += 5) {
    const id = frame.nodes[i];
    check(id > 0 && id <= frameLimits.nodes, 'nodeBudget');
    check(!context.nodeIds.has(id), 'probeNodeBudgetOrDuplicate');
    for (let previous = 0; previous < i; previous += 5)
      check(frame.nodes[previous] !== id, 'probeNodeBudgetOrDuplicate');
    const type = frame.nodes[i + 1];
    const name = lookup(frame.nodes[i + 2]);
    check([1, 3, 8, 11].includes(type), 'unsupportedNode');
    if (type === 1)
      check(
        name && !/^(script|iframe|link|style|object|embed|img|a)$/i.test(name),
        'unsupportedElement',
      );
  }
  let operations = 0;
  for (let i = 0; i < frame.mutations.length; ) {
    check(++operations <= 128, 'operationBudget');
    const m = frame.mutations;
    const type = m[i];
    const length =
      type === 0 || type === 3
        ? 5
        : type === 1
          ? 3
          : type === 2
            ? 6 + m[i + 4] + m[i + 5]
            : type === 4
              ? 4 + m[i + 2] * 2 + m[i + 3] * 6
              : 0;
    check(length > 0 && i + length <= m.length, 'unsupportedMutation');
    if (type === 0 || type === 3) {
      const name = lookup(m[i + 2]);
      check(name && !/^on|^(src|href|srcdoc|style)$/i.test(name), 'unsupportedAttribute');
      if (type === 3) check(name === 'value', 'unsupportedProperty');
    }
    i += length;
  }
  return measured;
}

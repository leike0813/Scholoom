import type { FromSchema } from 'json-schema-to-ts';
import { compileContract } from './core.js';
import { array, object } from './schema.js';

/** Per-view rendering capacity; independent of model requests and report resource bytes. */
export const reportRenderLimits = {
  frameBytes: 65536,
  nodes: 16384,
  strings: 16384,
  stringBytes: 2097152,
  contentUnits: 2097152,
  attributes: 64,
  depth: 256,
  operations: 2048,
  workUnits: 262144,
  inFlight: 4,
  cssBytes: 65536,
  cssTokens: 8192,
  cssNodes: 16384,
  cssDepth: 64,
  cssImports: 8,
  cssSelectors: 256,
  imagePixels: 4194304,
  renderPixels: 16777216,
  fontBytes: 8388608,
} as const;

const word = { type: 'integer', minimum: 0, maximum: 65535 } as const;
export const reportRenderFrameSchema = object(
  {
    sequence: { type: 'integer', minimum: 1, maximum: Number.MAX_SAFE_INTEGER },
    phase: { enum: [1, 2] },
    roots: object({ html: word, head: word }, ['html', 'head']),
    nodes: { ...array(word), maxItems: 32768 },
    strings: {
      ...array({ type: 'string', maxLength: reportRenderLimits.frameBytes }),
      maxItems: reportRenderLimits.strings,
    },
    mutations: { ...array(word), maxItems: 32768 },
    bytes: { type: 'integer', minimum: 0, maximum: reportRenderLimits.frameBytes },
  },
  ['sequence', 'phase', 'nodes', 'strings', 'mutations'],
);

export type ReportRenderFrame = FromSchema<typeof reportRenderFrameSchema>;
const validate = compileContract({ params: reportRenderFrameSchema, result: true }).params;

export function isReportRenderFrame(value: unknown): value is ReportRenderFrame {
  if (!validate(value)) return false;
  const frame = value as ReportRenderFrame;
  // Bound stringify/encoding before allocating either representation.
  let units = frame.nodes.length + frame.mutations.length;
  for (const text of frame.strings) {
    units += text.length;
    if (units > reportRenderLimits.frameBytes) return false;
  }
  return (
    new TextEncoder().encode(JSON.stringify(frame)).byteLength <= reportRenderLimits.frameBytes
  );
}

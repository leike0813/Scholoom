import { expect, test } from '@playwright/test';
import {
  decodeReportHeader,
  encodeReportHeader,
  reportHeaderStart,
} from '../../packages/editor/dist/report-codec.js';
import { compileContract, OperationError } from '../../packages/protocol/dist/core.js';
import {
  isReportBridgeMessage,
  isReportManifest,
  reportBridgeMessageSchema,
  reportLimits,
  reportManifestSchema,
  reportSnapshotSchema,
} from '../../packages/protocol/dist/report-contracts.js';

type Manifest = Parameters<typeof encodeReportHeader>[0];
const limits = {
  resources: 32,
  sources: 100,
  objects: 100,
  semanticsUnits: 8192,
  requestUnits: 4096,
  manifestBytes: 128 * 1024,
  bridgeBytes: 64 * 1024,
};
const start = '<!--scholoom-report-v1\n';
const end = '\n-->\n';

// Handwritten independently of the encoder, including the escaped string data.
const fixedHeader = String.raw`<!--scholoom-report-v1
{
  "version": 1,
  "resources": [{"path":"plot.js","ref":{"source":"project","projectId":"p","fileId":"script"},"basis":"script1","mediaType":"text/javascript"}],
  "sources": [{"ref":{"source":"library","attachmentId":"paper","materialVersionId":"version1"},"basis":"paper1"}],
  "objects": [{"objectId":"plot","name":"Result","semantics":"Selected \u003cplot\u003e \u002d result","sourceIndexes":[0]}]
}
-->
`;

function manifest(): Manifest {
  return {
    version: 1,
    resources: [
      {
        path: 'plot.js',
        ref: { source: 'project', projectId: 'p', fileId: 'script' },
        basis: 'script1',
        mediaType: 'text/javascript',
      },
    ],
    sources: [
      {
        ref: { source: 'library', attachmentId: 'paper', materialVersionId: 'version1' },
        basis: 'paper1',
      },
    ],
    objects: [
      { objectId: 'plot', name: 'Result', semantics: 'Selected result', sourceIndexes: [0] },
    ],
  };
}

const header = (value: unknown) => start + JSON.stringify(value) + end;
const validateManifest = compileContract({ params: reportManifestSchema, result: true }).params;
const validateBridge = compileContract({ params: reportBridgeMessageSchema, result: true }).params;
const validateSnapshot = compileContract({ params: reportSnapshotSchema, result: true }).params;

function failsWith(action: () => unknown, code: 'invalidRequest' | 'tooLarge') {
  let failure: unknown;
  try {
    action();
  } catch (reason) {
    failure = reason;
  }
  expect(failure).toBeInstanceOf(OperationError);
  expect(failure).toMatchObject({ code });
}

function manifestOfBytes(size: number): Manifest {
  const value = manifest();
  value.objects = Array.from({ length: 16 }, (_, index) => ({
    objectId: `object${index}`,
    name: 'Result',
    semantics: '',
  }));
  let remaining = size - Buffer.byteLength(JSON.stringify(value));
  for (const object of value.objects) {
    const units = Math.min(remaining, limits.semanticsUnits);
    object.semantics = 'a'.repeat(units);
    remaining -= units;
  }
  expect(remaining).toBe(0);
  expect(Buffer.byteLength(JSON.stringify(value))).toBe(size);
  return value;
}

test('handwritten header decodes independently of HTML body and encoder output', () => {
  const expected = manifest();
  expected.objects = expected.objects.map((object) => ({
    ...object,
    semantics: 'Selected <plot> - result',
  }));
  expect(reportHeaderStart).toBe(start);
  expect(reportLimits).toMatchObject(limits);
  expect(decodeReportHeader(fixedHeader)).toEqual(expected);
  const body = '<script>not valid JavaScript</script><!--scholoom-report-v2\n{broken}\n-->\0<';
  expect(decodeReportHeader(fixedHeader + body)).toEqual(expected);
  expect(decodeReportHeader(fixedHeader + '<broken '.repeat(300000))).toEqual(expected);
});

test('encoder escapes comment delimiters as JSON Unicode without changing their values', () => {
  const value = manifest();
  value.objects = value.objects.map((object) => ({ ...object, semantics: '<plot> --> <!-- -' }));
  const encoded = encodeReportHeader(value);
  expect(encoded.startsWith(start)).toBe(true);
  const closing = encoded.indexOf('\n-->');
  expect(closing).toBeGreaterThan(start.length);
  expect(encoded.indexOf('-->')).toBe(closing + 1);
  const json = encoded.slice(start.length, closing);
  expect(json).not.toMatch(/[<>-]/);
  for (const escaped of [/\\u003[cC]/, /\\u003[eE]/, /\\u002[dD]/]) expect(json).toMatch(escaped);
  expect(JSON.parse(json)).toEqual(value);
});

test('header closing delimiter must end its line or the document', () => {
  expect(decodeReportHeader(fixedHeader.trimEnd())).toEqual(decodeReportHeader(fixedHeader));
  failsWith(() => decodeReportHeader(`${fixedHeader.trimEnd()}<html></html>`), 'invalidRequest');
});

for (const [name, html] of [
  ['missing start', JSON.stringify(manifest()) + end],
  ['unsupported header version', `<!--scholoom-report-v2\n${JSON.stringify(manifest())}${end}`],
  ['unsupported manifest version', header({ ...manifest(), version: 2 })],
  ['malformed JSON', `${start}{"version":${end}`],
  ['missing end', start + JSON.stringify(manifest())],
  ['end is not a separate line', `${start}${JSON.stringify(manifest())}-->`],
  ['end exceeds the bounded prefix', `${start}${' '.repeat(limits.manifestBytes + 1)}{}${end}`],
  ['extra manifest identity', header({ ...manifest(), reportId: 'invented' })],
] as const) {
  test(`decoder rejects ${name}`, () =>
    failsWith(() => decodeReportHeader(html), 'invalidRequest'));
}

for (const character of ['<', '>', '-']) {
  test(`decoder rejects an unescaped ${character} in JSON string data`, () => {
    const value = manifest();
    value.objects = value.objects.map((object) => ({
      ...object,
      semantics: `raw${character}data`,
    }));
    failsWith(() => decodeReportHeader(header(value)), 'invalidRequest');
  });
}

test('manifest and snapshot schemas retain the existing resource descriptor contract', () => {
  const value = manifest();
  expect(validateManifest(value)).toBe(true);
  expect(isReportManifest(value)).toBe(true);
  const resource = {
    ref: { source: 'project', projectId: 'p', fileId: 'report' },
    basis: 'report1',
    name: 'comparison.html',
    path: 'reports/comparison.html',
    format: 'html',
    capabilities: { read: true, write: true, readingRecords: false, render: false },
  };
  expect(validateSnapshot({ resource, manifest: value })).toBe(true);
  for (const invalid of [
    { resource, manifest: value, reportId: 'invented' },
    { resource: { ...resource, reportId: 'invented' }, manifest: value },
    { resource: { ...resource, capabilities: { read: true } }, manifest: value },
    { resource: { ...resource, basis: undefined }, manifest: value },
  ])
    expect(validateSnapshot(invalid)).toBe(false);
});

for (const mediaType of [
  'text/javascript',
  'text/css',
  'application/json',
  'image/png',
  'font/woff2',
]) {
  test(`manifest accepts declared ${mediaType} resources`, () => {
    const value = manifest();
    expect(isReportManifest({ ...value, resources: [{ ...value.resources[0], mediaType }] })).toBe(
      true,
    );
  });
}

for (const mediaType of ['text/html', 'image/svg+xml']) {
  test(`manifest rejects ${mediaType} resource documents`, () => {
    const value = manifest();
    expect(isReportManifest({ ...value, resources: [{ ...value.resources[0], mediaType }] })).toBe(
      false,
    );
  });
}

for (const field of ['resources', 'sources', 'objects'] as const) {
  test(`manifest accepts ${limits[field]} ${field} and rejects one more`, () => {
    const value = manifest();
    const items = Array.from({ length: limits[field] + 1 }, (_, index) =>
      field === 'objects'
        ? { objectId: `object${index}`, name: 'Result', semantics: 'Fixed result' }
        : field === 'sources'
          ? {
              ref: { source: 'project', projectId: 'p', fileId: `source${index}` },
              basis: 'source1',
            }
          : {
              path: `asset${index}.js`,
              ref: { source: 'project', projectId: 'p', fileId: `asset${index}` },
              basis: 'asset1',
              mediaType: 'text/javascript',
            },
    );
    const accepted = { ...value, [field]: items.slice(0, limits[field]) };
    expect(isReportManifest(accepted)).toBe(true);
    expect(decodeReportHeader(header(accepted))).toEqual(accepted);
    const rejected = { ...value, [field]: items };
    expect(isReportManifest(rejected)).toBe(false);
    failsWith(() => decodeReportHeader(header(rejected)), 'invalidRequest');
  });
}

test('object semantics count UTF16 units rather than Unicode code points', () => {
  const value = manifest();
  const semantics = '😀'.repeat(limits.semanticsUnits / 2);
  value.objects = value.objects.map((object) => ({ ...object, semantics }));
  expect(semantics.length).toBe(8192);
  expect(isReportManifest(value)).toBe(true);
  expect(decodeReportHeader(header(value))).toEqual(value);
  value.objects = value.objects.map((object) => ({ ...object, semantics: object.semantics + 'a' }));
  expect(isReportManifest(value)).toBe(false);
  failsWith(() => decodeReportHeader(header(value)), 'invalidRequest');
});

test('manifest JSON is bounded at 128 KiB including encoder Unicode expansion', () => {
  const boundary = manifestOfBytes(limits.manifestBytes);
  expect(isReportManifest(boundary)).toBe(true);
  const encoded = encodeReportHeader(boundary);
  expect(Buffer.byteLength(encoded.slice(start.length, encoded.indexOf('\n-->')))).toBe(
    limits.manifestBytes,
  );
  expect(decodeReportHeader(header(boundary))).toEqual(boundary);
  failsWith(() => encodeReportHeader(manifestOfBytes(limits.manifestBytes + 1)), 'tooLarge');
  const expanded = manifest();
  expanded.objects = Array.from({ length: 3 }, (_, index) => ({
    objectId: `object${index}`,
    name: 'Result',
    semantics: '<'.repeat(limits.semanticsUnits),
  }));
  expect(isReportManifest(expanded)).toBe(true);
  failsWith(() => encodeReportHeader(expanded), 'tooLarge');
});

test('manifest rejects duplicate object identities, invalid source indexes and extra nested fields', () => {
  const value = manifest();
  for (const invalid of [
    { ...value, objects: [value.objects[0], value.objects[0]] },
    ...[-1, 1, 0.5].map((index) => ({
      ...value,
      objects: [{ ...value.objects[0], sourceIndexes: [index] }],
    })),
    {
      ...value,
      resources: [
        {
          ...value.resources[0],
          ref: { source: 'library', attachmentId: 'paper', materialVersionId: 'version1' },
        },
      ],
    },
    { ...value, resources: [{ ...value.resources[0], extra: true }] },
    { ...value, sources: [{ ...value.sources[0], role: 'input' }] },
    { ...value, objects: [{ ...value.objects[0], receiver: 'forged' }] },
  ]) {
    expect(isReportManifest(invalid)).toBe(false);
    failsWith(() => decodeReportHeader(header(invalid)), 'invalidRequest');
  }
  expect(
    isReportManifest({
      ...value,
      objects: [{ objectId: 'plot', name: 'Result', semantics: 'No source link' }],
    }),
  ).toBe(true);
});

const bridge = { version: 1, viewId: 'view', generation: 0, basis: 'report1' } as const;
const select = { ...bridge, type: 'select', objectIds: ['plot'], request: 'Compare this result' };

test('bridge schemas accept only the declared message shapes and original ErrorInfo', () => {
  for (const message of [
    { ...bridge, type: 'ready' },
    select,
    ...['state', 'restore'].map((type) => ({
      ...bridge,
      type,
      browse: { order: ['plot'], page: 1 },
      draft: ['note', null, false],
      dirty: true,
    })),
    { ...bridge, type: 'queued' },
    { ...bridge, type: 'error', error: { code: 'permissionDenied', message: 'Access withdrawn' } },
  ]) {
    expect(validateBridge(message)).toBe(true);
    expect(isReportBridgeMessage(message)).toBe(true);
  }
  for (const message of [
    { ...bridge, type: 'ready', payload: {} },
    { ...bridge, type: 'queued', objectIds: ['plot'] },
    { ...bridge, type: 'state', browse: {}, draft: {}, dirty: 'yes' },
    { ...bridge, type: 'restore', browse: {}, dirty: false },
    { ...bridge, type: 'error', error: { code: 'customReportError', message: 'Invalid code' } },
    {
      ...bridge,
      type: 'error',
      error: { code: 'invalidRequest', message: 'Invalid metadata', receiver: 'forged' },
    },
  ])
    expect(isReportBridgeMessage(message)).toBe(false);
});

test('bridge rejects forged authority, wrong versions and invalid generations', () => {
  for (const message of [
    { ...select, ref: { source: 'project', projectId: 'other', fileId: 'other' } },
    { ...select, receiver: { projectId: 'other', sessionId: 'other' } },
    { ...select, version: 2 },
    { ...select, generation: -1 },
    { ...select, generation: 0.5 },
  ]) {
    expect(validateBridge(message)).toBe(false);
    expect(isReportBridgeMessage(message)).toBe(false);
  }
});

const nonJsonBrowse: Array<[string, () => unknown]> = [
  ['Map', () => new Map([['hidden', 'a'.repeat(limits.bridgeBytes + 1)]])],
  ['ArrayBuffer', () => new ArrayBuffer(limits.bridgeBytes + 1)],
  ['Date', () => new Date('2026-01-01T00:00:00Z')],
  ['undefined', () => undefined],
  ['NaN', () => Number.NaN],
  ['nested Map', () => ({ rows: [{ details: new Map() }] })],
  ['nested undefined', () => ({ rows: [undefined] })],
  ['nested nonfinite number', () => [{ value: Number.POSITIVE_INFINITY }]],
  [
    'cycle',
    () => {
      const value: { rows: unknown[] } = { rows: [] };
      value.rows.push(value);
      return value;
    },
  ],
];

for (const [name, browse] of nonJsonBrowse) {
  test(`bridge state rejects ${name} rather than silently converting it to JSON`, () => {
    expect(
      isReportBridgeMessage({
        ...bridge,
        type: 'state',
        browse: browse(),
        draft: {},
        dirty: false,
      }),
    ).toBe(false);
  });
}

for (const browse of [
  { rows: [{ id: 'plot', visible: true, value: null }] },
  ['plot', 1, false, null],
]) {
  test(`bridge state accepts ordinary JSON ${Array.isArray(browse) ? 'arrays' : 'objects'}`, () => {
    expect(
      isReportBridgeMessage({ ...bridge, type: 'state', browse, draft: {}, dirty: false }),
    ).toBe(true);
  });
}

test('bridge selection requires 1 to 100 unique IDs and a 4096 UTF16 request', () => {
  const ids = Array.from({ length: 101 }, (_, index) => `object${index}`);
  expect(
    isReportBridgeMessage({ ...select, objectIds: ids.slice(0, 100), request: '😀'.repeat(2048) }),
  ).toBe(true);
  for (const message of [
    { ...select, objectIds: [] },
    { ...select, objectIds: ids },
    { ...select, objectIds: ['plot', 'plot'] },
    { ...select, request: '😀'.repeat(2048) + 'a' },
  ])
    expect(isReportBridgeMessage(message)).toBe(false);
});

for (const type of ['state', 'restore']) {
  test(`whole ${type} bridge message has an inclusive 64 KiB JSON bound`, () => {
    const message = { ...bridge, type, browse: null, draft: '', dirty: false };
    message.draft = 'a'.repeat(limits.bridgeBytes - Buffer.byteLength(JSON.stringify(message)));
    expect(Buffer.byteLength(JSON.stringify(message))).toBe(65536);
    expect(isReportBridgeMessage(message)).toBe(true);
    expect(isReportBridgeMessage({ ...message, draft: message.draft + 'a' })).toBe(false);
  });
}

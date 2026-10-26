import { expect, test } from '@playwright/test';
import {
  type ReportResourcePorts,
  ReportResources,
} from '../../packages/editor/dist/report-resources.js';
import { compileContract, OperationError } from '../../packages/protocol/dist/core.js';
import type { ResourceDescriptor, ResourceInputs } from '../../packages/protocol/dist/resources.js';
import { resourceEvidenceSchema } from '../../packages/protocol/dist/resources.js';

const html =
  '<!--scholoom-report-v1\n{"version":1,"resources":[{"path":"assets/data.json","ref":{"source":"project","projectId":"p","fileId":"data"},"basis":"d1","mediaType":"application/json"}],"sources":[{"ref":{"source":"library","attachmentId":"paper","materialVersionId":"v1"},"basis":"v1"}],"objects":[{"objectId":"row1","name":"Paper A","semantics":"Compare dose 10 and 20","sourceIndexes":[0]}]}\n-->\n<html><body>Fixed comparison</body></html>';
const entry = {
  ref: { source: 'project' as const, projectId: 'p', fileId: 'report' },
  basis: 'r1',
};
const capabilities = { read: true, write: false, readingRecords: false, render: false };
const validEvidence = compileContract({ params: resourceEvidenceSchema, result: true }).params;

function fixture(content = html) {
  const values = new Map<string, { descriptor: ResourceDescriptor; bytes: Buffer; size?: number }>([
    [
      'report',
      {
        descriptor: {
          ...entry,
          name: 'index.html',
          path: 'reports/index.html',
          format: 'html',
          capabilities,
        },
        bytes: Buffer.from(content),
      },
    ],
    [
      'data',
      {
        descriptor: {
          ref: { source: 'project', projectId: 'p', fileId: 'data' },
          basis: 'd1',
          name: 'data.json',
          path: 'reports/assets/data.json',
          format: 'text',
          capabilities,
        },
        bytes: Buffer.from('{"dose":[10,20]}'),
      },
    ],
    [
      'paper',
      {
        descriptor: {
          ref: { source: 'library', attachmentId: 'paper', materialVersionId: 'v1' },
          basis: 'v1',
          name: 'paper.pdf',
          format: 'pdf',
          capabilities,
        },
        bytes: Buffer.from('fixed source bytes'),
      },
    ],
  ]);
  const authorizations: { access: string; refs: string[] }[] = [];
  let revoked = false;
  let onRead: ((input: ResourceInputs['resources.read']) => void) | undefined;
  const key = (ref: ResourceInputs['resources.read']['ref']) =>
    ref.source === 'project'
      ? ref.fileId
      : ref.source === 'library'
        ? ref.attachmentId
        : ref.outputId;
  const ports: ReportResourcePorts = {
    async describe(locator) {
      if (revoked) throw new OperationError('permissionDenied', 'fixture revoked');
      const value =
        locator.source === 'project' && !locator.fileId
          ? [...values.values()].find((v) => v.descriptor.path === locator.path)
          : values.get(key(locator as ResourceInputs['resources.read']['ref']));
      if (!value) throw new OperationError('notFound', 'fixture missing');
      return structuredClone(value.descriptor);
    },
    async read(input) {
      onRead?.(input);
      const value = values.get(key(input.ref));
      if (!value) throw new OperationError('notFound', 'fixture missing');
      const offset = input.offset ?? 0;
      const size = value.size ?? value.bytes.length;
      const end = Math.min(size, offset + (input.limit ?? 262144));
      const bytes =
        value.size === undefined ? value.bytes.subarray(offset, end) : Buffer.alloc(end - offset);
      return {
        ref: value.descriptor.ref,
        basis: value.descriptor.basis,
        data: bytes.toString('base64'),
        offset,
        size,
        unit: 'byte',
        truncated: false,
        ...(end < size ? { nextOffset: end } : {}),
      };
    },
    async authorize(evidence, access) {
      if (revoked) throw new OperationError('permissionDenied', 'fixture revoked');
      expect(evidence.every((item) => validEvidence(item))).toBe(true);
      authorizations.push({ access, refs: evidence.map((v) => key(v.ref)) });
    },
  };
  return {
    values,
    ports,
    authorizations,
    revoke: () => {
      revoked = true;
    },
    onRead: (handler: typeof onRead) => {
      onRead = handler;
    },
  };
}

test('fixed report snapshot checks real identity and declared read/send sources without adding storage', async () => {
  const f = fixture();
  const snapshot = await new ReportResources(f.ports).snapshot(entry, 'send');
  expect(snapshot.resource).toMatchObject(entry);
  expect(snapshot.manifest.objects).toEqual([
    { objectId: 'row1', name: 'Paper A', semantics: 'Compare dose 10 and 20', sourceIndexes: [0] },
  ]);
  expect(
    f.authorizations.some(
      (v) => v.access === 'send' && v.refs.includes('paper') && v.refs.includes('data'),
    ),
  ).toBe(true);
  expect(Object.keys(snapshot).sort()).toEqual(['manifest', 'resource']);
});

for (const scenario of [
  'path mismatch',
  'dependency change',
  'entry change',
  'source revoked',
  'send denied',
  'private path authority',
  'mixed version',
  'recursive report',
  'recursive report BOM',
] as const) {
  test(`report candidate rejects ${scenario} and publishes no partial snapshot`, async () => {
    let content = html;
    if (scenario === 'mixed version')
      content = html.replace(
        '"sources":[',
        '"sources":[{"ref":{"source":"project","projectId":"p","fileId":"data"},"basis":"old"},',
      );
    const f = fixture(content);
    const data = f.values.get('data');
    const report = f.values.get('report');
    const paper = f.values.get('paper');
    if (!data || !report || !paper) throw new Error('fixture setup');
    if (scenario === 'path mismatch') data.descriptor.path = 'reports/elsewhere.json';
    if (scenario === 'dependency change')
      f.onRead((input) => {
        if (input.ref.source === 'project' && input.ref.fileId === 'data')
          data.descriptor.basis = 'changed';
      });
    if (scenario === 'entry change')
      f.onRead((input) => {
        if (input.ref.source === 'project' && input.ref.fileId === 'data')
          report.descriptor.basis = 'changed';
      });
    if (scenario === 'source revoked')
      f.onRead((input) => {
        if (input.ref.source === 'project' && input.ref.fileId === 'data') f.revoke();
      });
    if (scenario === 'send denied')
      f.ports.authorize = async (evidence, access) => {
        if (access === 'send' && evidence.some((v) => v.ref.source === 'library'))
          throw new OperationError('permissionDenied', 'fixture external-send denied');
      };
    if (scenario === 'private path authority') {
      const describe = f.ports.describe;
      f.ports.describe = async (locator) => {
        if (locator.source === 'project' && locator.path)
          throw new OperationError('permissionDenied', 'fixture unsafe link/private target');
        return describe(locator);
      };
    }
    if (scenario.startsWith('recursive report')) {
      paper.descriptor.format = 'html';
      paper.bytes = Buffer.from((scenario === 'recursive report BOM' ? '\uFEFF' : '') + html);
    }
    await expect(new ReportResources(f.ports).snapshot(entry, 'send')).rejects.toMatchObject({
      code:
        scenario === 'path mismatch'
          ? 'notFound'
          : scenario === 'mixed version' || scenario.endsWith('change')
            ? 'contentChanged'
            : scenario.startsWith('recursive report')
              ? 'invalidRequest'
              : 'permissionDenied',
    });
  });
}

for (const path of [
  '../../outside.json',
  '/absolute.json',
  'https://example.invalid/a',
  'C:/outside',
  '//host/share',
  'assets/data.json?token=1',
  '\\\\host\\share',
  '\\absolute',
]) {
  test(`report dependency rejects escaping path ${path}`, async () => {
    const f = fixture(html.replace('assets/data.json', JSON.stringify(path).slice(1, -1)));
    await expect(new ReportResources(f.ports).snapshot(entry)).rejects.toMatchObject({
      code: 'permissionDenied',
    });
  });
}

test('read denial and absent sources fail through the injected authority', async () => {
  const f = fixture();
  const read = f.values.get('paper');
  if (!read) throw new Error('fixture setup');
  read.descriptor.capabilities = { ...read.descriptor.capabilities, read: false };
  await expect(new ReportResources(f.ports).snapshot(entry)).rejects.toMatchObject({
    code: 'permissionDenied',
  });
  f.values.delete('paper');
  await expect(new ReportResources(f.ports).snapshot(entry)).rejects.toMatchObject({
    code: 'notFound',
  });
});

test('short byte fragments still detect report sources and entry moves invalidate relative dependencies', async () => {
  const recursive = fixture();
  const paper = recursive.values.get('paper');
  if (!paper) throw new Error('fixture setup');
  paper.descriptor.format = 'html';
  paper.bytes = Buffer.from(html);
  const read = recursive.ports.read;
  recursive.ports.read = (input) => read({ ...input, limit: Math.min(input.limit ?? 262144, 8) });
  await expect(new ReportResources(recursive.ports).snapshot(entry)).rejects.toMatchObject({
    code: 'invalidRequest',
  });
  const moved = fixture();
  const report = moved.values.get('report');
  if (!report) throw new Error('fixture setup');
  moved.onRead((input) => {
    if (input.ref.source === 'project' && input.ref.fileId === 'data')
      report.descriptor.path = 'archive/reports/index.html';
  });
  await expect(new ReportResources(moved.ports).snapshot(entry)).rejects.toMatchObject({
    code: 'contentChanged',
  });
});

test('binary/active documents and non-UTF8 entries cannot masquerade as allowed dependencies', async () => {
  const f = fixture();
  const data = f.values.get('data');
  const report = f.values.get('report');
  if (!data || !report) throw new Error('fixture setup');
  data.descriptor.name = 'hidden.svg';
  await expect(new ReportResources(f.ports).snapshot(entry)).rejects.toMatchObject({
    code: 'permissionDenied',
  });
  report.bytes = Buffer.from([0xff, 0xff]);
  await expect(new ReportResources(f.ports).snapshot(entry)).rejects.toMatchObject({
    code: 'invalidRequest',
  });
});

test('dependency and aggregate byte capacities reject before publishing a snapshot', async () => {
  const f = fixture();
  const data = f.values.get('data');
  if (!data) throw new Error('fixture setup');
  data.size = 8388609;
  await expect(new ReportResources(f.ports).snapshot(entry)).rejects.toMatchObject({
    code: 'tooLarge',
  });
  data.size = 8388608;
  await expect(new ReportResources(f.ports).snapshot(entry)).resolves.toMatchObject({
    resource: entry,
  });
  const manifest = JSON.parse(html.split('\n')[1] ?? '');
  manifest.resources = Array.from({ length: 5 }, (_, i) => ({
    path: `assets/${i}.json`,
    ref: { source: 'project', projectId: 'p', fileId: `data${i}` },
    basis: 'd1',
    mediaType: 'application/json',
  }));
  const large = fixture(`<!--scholoom-report-v1\n${JSON.stringify(manifest)}\n-->\n<html></html>`);
  for (let i = 0; i < 5; i++)
    large.values.set(`data${i}`, {
      descriptor: {
        ref: { source: 'project', projectId: 'p', fileId: `data${i}` },
        basis: 'd1',
        name: `${i}.json`,
        path: `reports/assets/${i}.json`,
        format: 'text',
        capabilities,
      },
      bytes: Buffer.alloc(0),
      size: 8388608,
    });
  await expect(new ReportResources(large.ports).snapshot(entry)).rejects.toMatchObject({
    code: 'tooLarge',
  });
});

test('HTML entry byte limit is inclusive and does not count UTF16 units instead of bytes', async () => {
  const exact = html + ' '.repeat(262144 - Buffer.byteLength(html));
  await expect(new ReportResources(fixture(exact).ports).snapshot(entry)).resolves.toMatchObject({
    resource: entry,
  });
  await expect(
    new ReportResources(fixture(exact + 'a').ports).snapshot(entry),
  ).rejects.toMatchObject({ code: 'tooLarge' });
});

test('parallel dependency verification remains bounded and waits for accepted reads on failure', async () => {
  const manifest = JSON.parse(html.split('\n')[1] ?? '');
  manifest.resources = Array.from({ length: 8 }, (_, i) => ({
    path: `assets/${i}.json`,
    ref: { source: 'project', projectId: 'p', fileId: `d${i}` },
    basis: 'd1',
    mediaType: 'application/json',
  }));
  const f = fixture(`<!--scholoom-report-v1\n${JSON.stringify(manifest)}\n-->\n<html></html>`);
  for (let i = 0; i < 8; i++)
    f.values.set(`d${i}`, {
      descriptor: {
        ref: { source: 'project', projectId: 'p', fileId: `d${i}` },
        basis: 'd1',
        name: `${i}.json`,
        path: `reports/assets/${i}.json`,
        format: 'text',
        capabilities,
      },
      bytes: Buffer.from('[]'),
    });
  let active = 0;
  let maximum = 0;
  const read = f.ports.read;
  f.ports.read = async (input) => {
    active++;
    maximum = Math.max(maximum, active);
    try {
      await new Promise((resolve) => setTimeout(resolve, 1));
      if (input.ref.source === 'project' && input.ref.fileId === 'd0')
        throw new OperationError('contentChanged', 'fixture change');
      return await read(input);
    } finally {
      active--;
    }
  };
  await expect(new ReportResources(f.ports).snapshot(entry)).rejects.toMatchObject({
    code: 'contentChanged',
  });
  expect(maximum).toBeLessThanOrEqual(4);
  expect(active).toBe(0);
});

test('source revocation during every asynchronous entry verification prevents publishing', async () => {
  const baseline = fixture();
  let checks = 0;
  const describe = baseline.ports.describe;
  baseline.ports.describe = async (locator) => {
    if (locator.source === 'project' && locator.fileId === 'report') checks++;
    return describe(locator);
  };
  await new ReportResources(baseline.ports).snapshot(entry, 'send');
  expect(checks).toBeGreaterThan(0);
  for (let revokeAt = 1; revokeAt <= checks; revokeAt++) {
    const f = fixture();
    let current = 0;
    let allowed = true;
    const read = f.ports.describe;
    f.ports.describe = async (locator) => {
      const result = await read(locator);
      if (locator.source === 'project' && locator.fileId === 'report' && ++current === revokeAt)
        allowed = false;
      return result;
    };
    f.ports.authorize = async (evidence) => {
      if (!allowed && evidence.some((item) => item.ref.source === 'library'))
        throw new OperationError('permissionDenied', 'fixture source authorization revoked');
    };
    await expect(new ReportResources(f.ports).snapshot(entry, 'send')).rejects.toMatchObject({
      code: 'permissionDenied',
    });
  }
});

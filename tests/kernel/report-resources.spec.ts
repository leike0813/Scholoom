import { expect, test } from '@playwright/test';
import {
  type ReportResourcePorts,
  ReportResources,
} from '../../packages/editor/dist/report-resources.js';
import { compileContract, OperationError } from '../../packages/protocol/dist/core.js';
import type {
  ResourceDescriptor,
  ResourceEvidence,
  ResourceInputs,
} from '../../packages/protocol/dist/resources.js';
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

test('report detection accumulates short byte fragments including a split UTF8 BOM', async () => {
  for (const content of [html, `\ufeff${html}`, '<p>Ordinary HTML</p>']) {
    const f = fixture(content);
    const read = f.ports.read.bind(f.ports);
    f.ports.read = (input) => read({ ...input, limit: Math.min(input.limit ?? 2, 2) });
    expect(await new ReportResources(f.ports).isReport(entry)).toBe(
      content !== '<p>Ordinary HTML</p>',
    );
  }
  const revoked = fixture();
  revoked.onRead(() => revoked.revoke());
  await expect(new ReportResources(revoked.ports).isReport(entry)).rejects.toMatchObject({
    code: 'permissionDenied',
  });
});

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

test('freezing retains the checked local bytes and never copies declared source material', async () => {
  const f = fixture();
  const frozen = await new ReportResources(f.ports).freeze(entry, 'send');
  const files = new Map(frozen.files.map((file) => [file.path, file.bytes.toString('utf8')]));
  expect(files).toEqual(
    new Map([
      ['reports/index.html', html],
      ['reports/assets/data.json', '{"dose":[10,20]}'],
    ]),
  );
  expect(frozen.snapshot.resource).toMatchObject(entry);
  expect(frozen.snapshot.manifest.sources).toHaveLength(1);
  const data = f.values.get('data');
  if (!data) throw new Error('fixture setup');
  data.bytes.fill(0);
  expect(frozen.files.find((file) => file.path.endsWith('data.json'))?.bytes.toString('utf8')).toBe(
    '{"dose":[10,20]}',
  );
  expect(
    f.authorizations.some((value) => value.access === 'send' && value.refs.includes('paper')),
  ).toBe(true);
});

test('historical reports use the recorded entry bytes and basis while rechecking declared sources', async () => {
  const f = fixture();
  const value = f.values.get('report');
  if (!value) throw new Error('fixture setup');
  const recorded = structuredClone(value.descriptor);
  value.descriptor.basis = 'r2';
  value.bytes = Buffer.from('<p>New ordinary content</p>');
  const reports = new ReportResources(f.ports);
  const historical = await reports.historical(recorded, html, 'send');
  expect(historical.resource).toMatchObject({ ...entry, capabilities: { write: false } });
  expect(historical.manifest.sources).toEqual([
    {
      ref: { source: 'library', attachmentId: 'paper', materialVersionId: 'v1' },
      basis: 'v1',
    },
  ]);
  f.onRead((input) => {
    if (input.ref.source === 'project' && input.ref.fileId === 'data') f.revoke();
  });
  await expect(reports.historical(recorded, html, 'send')).rejects.toMatchObject({
    code: 'permissionDenied',
  });
});

test('historical review uses the complete original declaration after the current report drops a source', async () => {
  const f = fixture();
  const current = f.values.get('report');
  if (!current) throw new Error('fixture setup');
  const recorded = structuredClone(current.descriptor);
  current.descriptor.basis = 'r2';
  current.bytes = Buffer.from(
    '<!--scholoom-report-v1\n{"version":1,"resources":[],"sources":[],"objects":[]}\n-->\n<html></html>',
  );
  const reports = new ReportResources(f.ports);
  const result = await reports.reviewHistorical(recorded, html, 'send');
  expect(result.state).toBe('available');
  if (result.state !== 'available') throw new Error('Original report unavailable');
  expect(result.snapshot.resource).toMatchObject(entry);
  expect(result.evidence).toEqual([
    entry,
    { ref: { source: 'project', projectId: 'p', fileId: 'data' }, basis: 'd1' },
    {
      ref: { source: 'library', attachmentId: 'paper', materialVersionId: 'v1' },
      basis: 'v1',
    },
  ]);
  expect(
    f.authorizations.some((value) => value.access === 'send' && value.refs.includes('paper')),
  ).toBe(true);
  const authorize = f.ports.authorize;
  f.ports.authorize = async (evidence, access) => {
    await authorize(evidence, access);
    if (evidence.some((item) => item.ref.source === 'library'))
      throw new OperationError('permissionDenied', 'fixture old source denied');
  };
  expect((await reports.snapshot({ ...entry, basis: 'r2' })).manifest.sources).toEqual([]);
  await expect(reports.reviewHistorical(recorded, html, 'send')).rejects.toMatchObject({
    code: 'permissionDenied',
  });
});

test('historical review separates readable identity from unavailable original bytes', async () => {
  for (const reason of ['contentChanged', 'notFound', 'unavailable'] as const) {
    await test.step(reason, async () => {
      const f = fixture();
      const recorded = f.values.get('report')?.descriptor;
      const data = f.values.get('data');
      if (!recorded || !data) throw new Error('fixture setup');
      const reports = new ReportResources(f.ports);
      if (reason === 'contentChanged') data.descriptor.basis = 'd2';
      else {
        const read = f.ports.read;
        f.ports.read = async (input) => {
          if (input.ref.source === 'project' && input.ref.fileId === 'data')
            throw new OperationError(reason, 'fixture bytes unavailable');
          return read(input);
        };
      }
      await expect(reports.historical(recorded, html, 'read')).rejects.toMatchObject({
        code: reason,
      });
      const result = await reports.reviewHistorical(recorded, html, 'read');
      expect(result).toMatchObject({ state: 'unavailable', reason });
      expect(result).not.toHaveProperty('snapshot');
      expect(result.evidence).toContainEqual({
        ref: { source: 'project', projectId: 'p', fileId: 'data' },
        basis: 'd1',
      });
      expect(f.authorizations.at(-1)).toEqual({
        access: 'read',
        refs: ['report', 'data', 'paper'],
      });
    });
  }
});

test('trusted identity qualification classifies unavailable bytes while all direct reads stay strict', async () => {
  const f = fixture();
  const recorded = f.values.get('report')?.descriptor;
  if (!recorded) throw new Error('fixture setup');
  const unavailable = new OperationError('unavailable', 'fixture source bytes unavailable');
  const describe = f.ports.describe;
  f.ports.describe = async (locator) => {
    if (locator.source === 'library') throw unavailable;
    return describe(locator);
  };
  const checked: ResourceEvidence[] = [];
  f.ports.checkReadIdentity = async (evidence) => {
    expect(f.authorizations.at(-1)).toEqual({
      access: 'send',
      refs: ['report', 'data', 'paper'],
    });
    checked.push(evidence);
  };
  const reports = new ReportResources(f.ports);
  for (const read of [
    () => reports.snapshot(entry, 'send'),
    () => reports.freeze(entry, 'send'),
    () => reports.historical(recorded, html, 'send'),
  ]) {
    await expect(read()).rejects.toBe(unavailable);
  }
  expect(checked).toEqual([]);
  const result = await reports.reviewHistorical(recorded, html, 'send');
  expect(result).toMatchObject({ state: 'unavailable', reason: 'unavailable' });
  expect(result).not.toHaveProperty('snapshot');
  expect(result.evidence).toContainEqual({
    ref: { source: 'library', attachmentId: 'paper', materialVersionId: 'v1' },
    basis: 'v1',
  });
  expect(checked).toEqual(expect.arrayContaining(result.evidence));
  expect(f.authorizations.at(-1)).toEqual({
    access: 'send',
    refs: ['report', 'data', 'paper'],
  });
});

test('trusted identity failures propagate before and after a failed read without descriptor fallback', async () => {
  for (const phase of ['before read', 'after read'] as const) {
    for (const error of [
      new OperationError('permissionDenied', 'fixture read revoked'),
      new OperationError('notFound', 'fixture unknown identity'),
      new OperationError('unavailable', 'fixture identity cannot be confirmed'),
      new OperationError('contentChanged', 'fixture identity changed'),
      new Error('fixture provider failed'),
    ]) {
      await test.step(`${phase}: ${error.message}`, async () => {
        const f = fixture();
        const recorded = f.values.get('report')?.descriptor;
        if (!recorded) throw new Error('fixture setup');
        let failedRead = false;
        const read = f.ports.read;
        f.ports.read = async (input) => {
          if (input.ref.source === 'project' && input.ref.fileId === 'data') {
            failedRead = true;
            throw new OperationError('unavailable', 'fixture original bytes unavailable');
          }
          return read(input);
        };
        let describedSource = false;
        const describe = f.ports.describe;
        f.ports.describe = async (locator) => {
          if (locator.source === 'library') describedSource = true;
          return describe(locator);
        };
        f.ports.checkReadIdentity = async (evidence) => {
          if (evidence.ref.source === 'library' && (phase === 'before read' || failedRead))
            throw error;
        };
        await expect(
          new ReportResources(f.ports).reviewHistorical(recorded, html, 'send'),
        ).rejects.toBe(error);
        expect(failedRead).toBe(phase === 'after read');
        expect(describedSource).toBe(false);
      });
    }
  }
});

test('trusted identity qualification still requires complete send authorization before and after checks', async () => {
  for (const phase of ['before identity', 'after identity'] as const) {
    const f = fixture();
    const recorded = f.values.get('report')?.descriptor;
    if (!recorded) throw new Error('fixture setup');
    let checked = false;
    f.ports.checkReadIdentity = async () => {
      checked = true;
    };
    const authorize = f.ports.authorize;
    const denial = new OperationError('permissionDenied', 'fixture send revoked');
    f.ports.authorize = async (evidence, access) => {
      await authorize(evidence, access);
      if (access === 'send' && (phase === 'before identity' || checked)) throw denial;
    };
    await expect(
      new ReportResources(f.ports).reviewHistorical(recorded, html, 'send'),
    ).rejects.toBe(denial);
    expect(checked).toBe(phase === 'after identity');
    expect(f.authorizations.at(-1)).toEqual({
      access: 'send',
      refs: ['report', 'data', 'paper'],
    });
  }
});

test('historical review refuses copy qualification when access changes during a failed read', async () => {
  for (const invalidation of ['source read', 'send grant', 'final authorization'] as const) {
    await test.step(invalidation, async () => {
      const f = fixture();
      const recorded = f.values.get('report')?.descriptor;
      if (!recorded) throw new Error('fixture setup');
      let failed = false;
      let revoked = false;
      const read = f.ports.read;
      f.ports.read = async (input) => {
        if (input.ref.source === 'project' && input.ref.fileId === 'data') {
          failed = true;
          throw new OperationError('unavailable', 'fixture original bytes unavailable');
        }
        return read(input);
      };
      const describe = f.ports.describe;
      f.ports.describe = async (locator) => {
        const value = await describe(locator);
        if (failed && locator.source === 'library') {
          if (invalidation === 'source read')
            return { ...value, capabilities: { ...value.capabilities, read: false } };
          if (invalidation === 'final authorization') revoked = true;
        }
        return value;
      };
      const authorize = f.ports.authorize;
      f.ports.authorize = async (evidence, access) => {
        await authorize(evidence, access);
        if (
          (revoked || (failed && invalidation === 'send grant' && access === 'send')) &&
          evidence.some((item) => item.ref.source === 'library')
        )
          throw new OperationError('permissionDenied', 'fixture original source revoked');
      };
      await expect(
        new ReportResources(f.ports).reviewHistorical(recorded, html, 'send'),
      ).rejects.toMatchObject({ code: 'permissionDenied' });
      expect(failed).toBe(true);
    });
  }
});

test('historical review requires positive stable source metadata rather than treating lookup failure as lost bytes', async () => {
  for (const scenario of [
    'new material version',
    'missing metadata',
    'read denied',
    'contradictory basis',
    'notFound',
    'unavailable',
  ] as const) {
    await test.step(scenario, async () => {
      const f = fixture();
      const recorded = f.values.get('report')?.descriptor;
      if (!recorded) throw new Error('fixture setup');
      const describe = f.ports.describe;
      f.ports.describe = async (locator) => {
        const value = await describe(locator);
        if (locator.source !== 'library') return value;
        if (scenario === 'new material version')
          return { ...value, ref: { ...locator, materialVersionId: 'v2' }, basis: 'v2' };
        if (scenario === 'missing metadata') return { ...value, basis: '' };
        if (scenario === 'read denied')
          return { ...value, capabilities: { ...value.capabilities, read: false } };
        if (scenario === 'contradictory basis') return { ...value, basis: 'v2' };
        throw new OperationError(scenario, 'fixture identity cannot be confirmed');
      };
      await expect(
        new ReportResources(f.ports).reviewHistorical(recorded, html, 'read'),
      ).rejects.toMatchObject({
        code:
          scenario === 'new material version' || scenario === 'contradictory basis'
            ? 'contentChanged'
            : scenario === 'missing metadata'
              ? 'invalidRequest'
              : scenario === 'read denied'
                ? 'permissionDenied'
                : scenario,
      });
    });
  }
});

test('historical review rejects invalid original declarations before classifying a byte failure', async () => {
  const contradictory = html.replace(
    '"sources":[',
    '"sources":[{"ref":{"source":"project","projectId":"p","fileId":"data"},"basis":"old"},',
  );
  for (const [content, code] of [
    ['<html>Not a report</html>', 'invalidRequest'],
    [contradictory, 'contentChanged'],
    [html.replace('"basis":"v1"', '"basis":"other"'), 'contentChanged'],
    [html.replace('assets/data.json', '../../outside.json'), 'permissionDenied'],
    [
      html
        .replace('assets/data.json', 'index.html')
        .replace('"fileId":"data"', '"fileId":"report"')
        .replace('"basis":"d1"', '"basis":"r1"'),
      'permissionDenied',
    ],
  ] as const) {
    await test.step(code, async () => {
      const f = fixture();
      const current = f.values.get('report');
      if (!current) throw new Error('fixture setup');
      const recorded = structuredClone(current.descriptor);
      current.descriptor.basis = 'r2';
      f.ports.checkReadIdentity = async () => {
        throw new Error('Invalid declarations must fail before identity qualification');
      };
      f.ports.read = async () => {
        throw new OperationError('unavailable', 'fixture byte failure');
      };
      const reports = new ReportResources(f.ports);
      await expect(reports.reviewHistorical(recorded, content, 'read')).rejects.toMatchObject({
        code,
      });
    });
  }
});

test('historical review propagates unrelated failures without a copy qualification', async () => {
  for (const error of [
    new OperationError('invalidRequest', 'fixture invalid read'),
    new OperationError('permissionDenied', 'fixture denied'),
    new OperationError('tooLarge', 'fixture capacity'),
    Object.assign(new Error('fixture non-domain failure'), { code: 'unavailable' }),
  ]) {
    const f = fixture();
    const recorded = f.values.get('report')?.descriptor;
    if (!recorded) throw new Error('fixture setup');
    f.ports.read = async () => {
      throw error;
    };
    await expect(
      new ReportResources(f.ports).reviewHistorical(recorded, html, 'read'),
    ).rejects.toBe(error);
  }
});

for (const invalidation of ['source revoked', 'dependency changed'] as const) {
  test(`freezing refuses publication after ${invalidation} while copying bytes`, async () => {
    const f = fixture();
    f.onRead((input) => {
      if (input.ref.source !== 'project' || input.ref.fileId !== 'data') return;
      if (invalidation === 'source revoked') f.revoke();
      else {
        const data = f.values.get('data');
        if (!data) throw new Error('fixture setup');
        data.descriptor.basis = 'changed';
      }
    });
    await expect(new ReportResources(f.ports).freeze(entry)).rejects.toMatchObject({
      code: invalidation === 'source revoked' ? 'permissionDenied' : 'contentChanged',
    });
  });
}

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

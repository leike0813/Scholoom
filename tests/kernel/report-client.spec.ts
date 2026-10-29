import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { createReportClient } from '../../apps/desktop/src/renderer/src/workbench/reports/report-client.js';
import { reportClientDomain } from '../fixtures/report-client/domain.js';

test('throwing report observers cannot block healthy observers or shared client reconnection', async () => {
  const domain = await reportClientDomain(test.info().outputPath('domain'));
  const adapter = createReportClient({
    client: domain.reader,
    dataDirectory: domain.profile,
    entry: domain.entry,
  });
  const faults = new Set<string>();
  const unthrow = adapter.subscribe(() => {
    const stage =
      domain.reader.getSnapshot().phase === 'reconnecting'
        ? 'reconnecting'
        : adapter.read().canDisplay
          ? 'loaded'
          : undefined;
    if (stage && !faults.has(stage)) {
      faults.add(stage);
      throw new Error('synthetic report observer failure');
    }
  });
  let healthyLoads = 0;
  const unreport = adapter.subscribe(() => {
    if (adapter.read().canDisplay) healthyLoads++;
  });
  const phases: string[] = [];
  const unphase = domain.reader.subscribe(() => phases.push(domain.reader.getSnapshot().phase));
  try {
    await expect.poll(() => healthyLoads).toBeGreaterThan(0);
    expect(faults.has('loaded')).toBe(true);
    domain.proxy.dropConnections();
    await expect.poll(() => phases.includes('reconnecting')).toBe(true);
    expect(faults.has('reconnecting')).toBe(true);
    expect(adapter.read().canDisplay).toBe(false);
    await expect.poll(() => domain.reader.getSnapshot().phase).toBe('connected');
    expect(phases).toContain('connected');
    await domain.watch();
    await adapter.recheck();
    expect(adapter.read().canDisplay).toBe(true);
    await writeFile(
      test.info().outputPath('facts.json'),
      JSON.stringify(
        { faults: [...faults], phases, healthyLoads, metadata: adapter.read() },
        null,
        2,
      ),
    );
  } finally {
    unthrow();
    unreport();
    unphase();
    adapter.dispose();
    await domain.close();
  }
});

test('real report save notifications discover latest basis, retain dirty metadata and explicitly switch', async () => {
  const domain = await reportClientDomain(test.info().outputPath('domain'));
  const adapter = createReportClient({
    client: domain.reader,
    dataDirectory: domain.profile,
    entry: domain.entry,
  });
  let notifications = 0;
  const unsubscribe = adapter.subscribe(() => {
    notifications++;
  });
  try {
    await expect.poll(() => adapter.read().canDisplay).toBe(true);
    expect(adapter.read().current?.resource.basis).toBe(domain.entry.basis);
    const secondHtml = domain.html.replace('Compare dose 10 and 20', 'Compare dose 20 and 30');
    const second = await domain.writer.call('resources.save', {
      ref: domain.entry.ref,
      basis: domain.entry.basis,
      content: secondHtml,
    });
    await expect.poll(() => adapter.read().current?.resource.basis).toBe(second.basis);
    expect(adapter.read().current?.manifest.objects[0]?.semantics).toBe('Compare dose 20 and 30');
    adapter.protect({ pageDirty: true, explicitItems: false, composerDraft: false });
    const thirdHtml = secondHtml.replace('Compare dose 20 and 30', 'Compare dose 30 and 40');
    const third = await domain.writer.call('resources.save', {
      ref: second.ref,
      basis: second.basis,
      content: thirdHtml,
    });
    await expect.poll(() => adapter.read().pending?.resource.basis).toBe(third.basis);
    expect(adapter.read()).toMatchObject({
      current: { resource: { basis: second.basis } },
      canDisplay: true,
      canReplace: true,
    });
    expect(adapter.viewPending()).toBe(true);
    expect(adapter.read().current?.resource.basis).toBe(third.basis);
    expect(adapter.read().current?.manifest).toEqual(
      (await domain.writer.call('resources.report', { ref: third.ref, basis: third.basis }))
        .manifest,
    );
    expect(await readFile(join(domain.project.path, 'report.html'), 'utf8')).toBe(thirdHtml);
    expect(notifications).toBeGreaterThan(0);
    expect(domain.facts().peak).toBe(1);
    await writeFile(
      test.info().outputPath('facts.json'),
      JSON.stringify({ metadata: adapter.read(), rpc: domain.facts() }, null, 2),
    );
  } finally {
    unsubscribe();
    adapter.dispose();
    await domain.close();
  }
});

test('held real RPCs settle before later checks; configuration replacement and dispose seal late delivery', async () => {
  const domain = await reportClientDomain(test.info().outputPath('domain'));
  const adapter = createReportClient({
    client: domain.reader,
    dataDirectory: domain.profile,
    entry: domain.entry,
  });
  const observed: Array<string | undefined> = [];
  const unobserve = adapter.subscribe(() => observed.push(adapter.read().current?.resource.basis));
  let changes = 0;
  const unchange = domain.reader.subscribeChanges(() => {
    changes++;
  });
  try {
    await expect.poll(() => adapter.read().canDisplay).toBe(true);
    const held = domain.holdReport();
    const checking = adapter.recheck();
    await held.entered;
    const originalCalls = domain
      .facts()
      .requests.filter(
        (value) => value.connection === 1 && value.method.startsWith('resources.'),
      ).length;
    const before = changes;
    const second = await domain.writer.call('resources.save', {
      ref: domain.entry.ref,
      basis: domain.entry.basis,
      content: domain.html.replace('Compare dose 10 and 20', 'Intermediate candidate'),
    });
    await expect.poll(() => changes).toBeGreaterThan(before);
    const afterSecond = changes;
    const third = await domain.writer.call('resources.save', {
      ref: second.ref,
      basis: second.basis,
      content: domain.html.replace('Compare dose 10 and 20', 'Latest candidate'),
    });
    await expect.poll(() => changes).toBeGreaterThan(afterSecond);
    expect(
      domain
        .facts()
        .requests.filter(
          (value) => value.connection === 1 && value.method.startsWith('resources.'),
        ),
    ).toHaveLength(originalCalls);
    expect(adapter.read().current?.resource.basis).toBe(domain.entry.basis);
    held.release();
    await checking;
    await expect.poll(() => adapter.read().current?.resource.basis).toBe(third.basis);
    expect(observed).not.toContain(second.basis);
    expect(domain.facts().peak).toBe(1);
    const closing = domain.holdReport();
    const late = adapter.recheck();
    await closing.entered;
    adapter.setContext({
      client: domain.reader,
      dataDirectory: join(domain.profile, 'different-configuration'),
    });
    expect(adapter.read()).toMatchObject({
      closed: true,
      canDisplay: false,
      current: null,
      pending: null,
      loading: true,
    });
    let settled = false;
    void late.then(() => {
      settled = true;
    });
    await Promise.resolve();
    expect(settled).toBe(false);
    closing.release();
    await late;
    expect(adapter.read()).toMatchObject({
      closed: true,
      canDisplay: false,
      current: null,
      loading: false,
    });
    adapter.dispose();
    await writeFile(
      test.info().outputPath('facts.json'),
      JSON.stringify({ observed, rpc: domain.facts(), metadata: adapter.read() }, null, 2),
    );
  } finally {
    unchange();
    unobserve();
    adapter.dispose();
    await domain.close();
  }
});

test('a retained old library source is rechecked even when the new report drops it; reconnect requires explicit recovery', async () => {
  const domain = await reportClientDomain(test.info().outputPath('domain'));
  const adapter = createReportClient({
    client: domain.reader,
    dataDirectory: domain.profile,
    entry: domain.entry,
  });
  let changes = 0;
  const unchange = domain.reader.subscribeChanges(() => {
    changes++;
  });
  const phases: string[] = [];
  const unphase = domain.reader.subscribe(() => phases.push(domain.reader.getSnapshot().phase));
  try {
    await expect.poll(() => adapter.read().canDisplay).toBe(true);
    adapter.protect({ pageDirty: true, explicitItems: false, composerDraft: true });
    const nextManifest = {
      ...domain.manifest,
      sources: [],
      objects: domain.manifest.objects.map((object) => ({ ...object, sourceIndexes: [] })),
    };
    const nextHtml = `<!--scholoom-report-v1\n${JSON.stringify(nextManifest).replaceAll('-', '\\u002d')}\n-->\n<html><body>No library source in new version</body></html>`;
    const next = await domain.writer.call('resources.save', {
      ref: domain.entry.ref,
      basis: domain.entry.basis,
      content: nextHtml,
    });
    await expect.poll(() => adapter.read().pending?.resource.basis).toBe(next.basis);
    expect(adapter.read().canDisplay).toBe(true);
    await domain.writer.call('library.grant', {
      read: false,
      write: false,
      send: false,
      autoBackup: false,
    });
    await expect.poll(() => adapter.read().error?.code).toBe('permissionDenied');
    expect(adapter.read()).toMatchObject({ canDisplay: false, canReplace: false, pending: null });
    // The new report itself is readable; the failure must come from the retained old source.
    expect(
      (await domain.writer.call('resources.report', { ref: next.ref, basis: next.basis })).manifest
        .sources,
    ).toEqual([]);
    const before = changes;
    await domain.writer.call('library.grant', {
      read: true,
      write: true,
      send: false,
      autoBackup: false,
    });
    await expect.poll(() => changes).toBeGreaterThan(before);
    expect(adapter.read().canDisplay).toBe(false);
    await adapter.recheck();
    expect(adapter.read()).toMatchObject({
      canDisplay: false,
      canReplace: true,
      pending: { resource: { basis: next.basis } },
    });
    expect(adapter.viewPending()).toBe(true);
    expect(adapter.read().canDisplay).toBe(true);
    domain.proxy.dropConnections();
    await expect.poll(() => phases.includes('reconnecting')).toBe(true);
    expect(adapter.read().canDisplay).toBe(false);
    await expect.poll(() => domain.reader.getSnapshot().phase).toBe('connected');
    await domain.watch();
    expect(adapter.read().canDisplay).toBe(false);
    await adapter.recheck();
    // Protection still exists, so restored permissions produce pending metadata, not old display.
    expect(adapter.read().canReplace).toBe(true);
    expect(adapter.viewPending()).toBe(true);
    expect(adapter.read().current?.resource.basis).toBe(next.basis);
    const source = domain.source.ref;
    assert(source.source === 'library');
    await writeFile(
      test.info().outputPath('facts.json'),
      JSON.stringify({ source, phases, metadata: adapter.read(), rpc: domain.facts() }, null, 2),
    );
  } finally {
    unphase();
    unchange();
    adapter.dispose();
    await domain.close();
  }
});

test('a readable dependency revision may advance while the dirty old page retains its original basis', async () => {
  const domain = await reportClientDomain(test.info().outputPath('domain'));
  const adapter = createReportClient({
    client: domain.reader,
    dataDirectory: domain.profile,
    entry: domain.entry,
  });
  try {
    await expect.poll(() => adapter.read().canDisplay).toBe(true);
    adapter.protect({ pageDirty: true, explicitItems: true, composerDraft: false });
    const dependency = domain.manifest.resources[0];
    assert(dependency);
    const revised = await domain.writer.call('resources.save', {
      ref: dependency.ref,
      basis: dependency.basis,
      content: '[30,40]',
    });
    const manifest = { ...domain.manifest, resources: [{ ...dependency, basis: revised.basis }] };
    const html = `<!--scholoom-report-v1\n${JSON.stringify(manifest).replaceAll('-', '\\u002d')}\n-->\n<html><body>Externally published complete candidate</body></html>`;
    // External-editor publication in this isolated project; RPC discovery and authorization stay real.
    await writeFile(join(domain.project.path, 'report.html'), html);
    const entry = await domain.writer.call('resources.describe', { locator: domain.entry.ref });
    const verified = await domain.writer.call('resources.report', {
      ref: entry.ref,
      basis: entry.basis,
    });
    expect(verified.manifest.resources[0]?.basis).toBe(revised.basis);
    await adapter.recheck();
    await expect.poll(() => adapter.read().pending?.resource.basis).toBe(entry.basis);
    expect(adapter.read().current?.manifest.resources[0]?.basis).toBe(dependency.basis);
    expect(adapter.viewPending()).toBe(true);
    expect(adapter.read().current?.manifest).toEqual(verified.manifest);
    expect(await readFile(join(domain.project.path, 'assets/data.json'), 'utf8')).toBe('[30,40]');
    await writeFile(
      test.info().outputPath('facts.json'),
      JSON.stringify(
        { old: dependency, revised, metadata: adapter.read(), rpc: domain.facts() },
        null,
        2,
      ),
    );
  } finally {
    adapter.dispose();
    await domain.close();
  }
});

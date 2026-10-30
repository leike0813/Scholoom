import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { KernelApplication } from '../../apps/kernel/dist/application.js';
import type { SynthesisConfig } from '../../apps/kernel/dist/research-graphs/config.js';
import {
  HarnessRecords,
  InstructionSaver,
  openCheckpoint,
} from '../../packages/harness/dist/node.js';
import { OperationError } from '../../packages/protocol/dist/core.js';
import type { TaskMetadata } from '../../packages/protocol/dist/projects.js';
import type {
  ResourceEvidence,
  ResourceSaveResult,
} from '../../packages/protocol/dist/resources.js';
import { synthesisModelResponse } from '../fixtures/project-literature-synthesis-model.js';
import type { ModelServerOptions } from '../model-server.js';
import { createModelServer } from '../model-server.js';
import { PAGE_ONE_TEXT, syntheticPdf } from '../pdf-fixture.js';

const evidenceRoot =
  '/home/joshua/.cache/scholoom-closeout-execution-20261030/workers/research-graph-runtime/synthesis';
const Database = createRequire(new URL('../../packages/harness/package.json', import.meta.url))(
  'better-sqlite3',
);

async function fixture(respond: ModelServerOptions['respond']) {
  await mkdir(evidenceRoot, { recursive: true });
  const root = await mkdtemp(join(evidenceRoot, 'run-'));
  const model = await createModelServer({ ...(respond ? { respond } : {}) });
  const app = new KernelApplication(join(root, 'profile'), {
    environment: { MINIMAX_CN_API_KEY: 'synthetic' },
    modelEndpoint: model.url,
  });
  try {
    await app.initialize();
    const project = await app.call('project.create', {
      path: join(root, 'project'),
      trust: 'trusted',
    });
    const session = await app.call('session.create', { projectId: project.id });
    const scope = { projectId: project.id, sessionId: session.id };
    const input = {
      ...scope,
      invocationId: randomUUID(),
      instructionId: randomUUID(),
      graphId: 'scholoom.project-literature-synthesis',
      version: '1',
      config: {
        question: '比较合成样本42与17及其限制。',
        reportTarget: { kind: 'create', path: 'report.md' },
        processTarget: { kind: 'create', path: 'process.md' },
        requireIndependentReview: false,
      } as SynthesisConfig,
      materials: [] as ResourceEvidence[],
      text: '从指定合成材料开始，保存比较依据和下一步。',
    };
    const start = async () => {
      const product = app.connectProduct();
      try {
        return await product.call('research.requestGraph', input);
      } finally {
        product.close();
      }
    };
    const wait = async (state: string) => {
      await expect
        .poll(
          async () => {
            const run = (await app.snapshot(scope)).run;
            if (run?.state === 'failed' && state !== 'failed') throw new Error(JSON.stringify(run));
            return run?.state;
          },
          { timeout: 30000 },
        )
        .toBe(state);
    };
    return { root, model, app, project, scope, input, start, wait };
  } catch (error) {
    await app.close();
    await model.close();
    throw error;
  }
}

test('production synthesis consumes bounded text and saves process before synthesis, report and self-check', async () => {
  let material: ResourceEvidence;
  let app: KernelApplication;
  let projectPath = '';
  let observedProcessBeforeReport = false;
  const respond = synthesisModelResponse(() => [material], true);
  const f = await fixture(async (input) => {
    if (input.calls.includes('read_context_resource'))
      observedProcessBeforeReport ||= (
        await readFile(join(projectPath, 'process.md'), 'utf8')
      ).includes('形成比较维度');
    return respond(input);
  });
  app = f.app;
  projectPath = f.project.path;
  try {
    await app.call('files.save', {
      projectId: f.project.id,
      path: 'source.txt',
      content: '合成来源：样本A=42；样本B=17。两组各n=1。',
    });
    const descriptor = await app.call('resources.describe', {
      locator: { source: 'project', projectId: f.project.id, path: 'source.txt' },
    });
    material = { ref: descriptor.ref, basis: descriptor.basis };
    f.input.materials = [material];
    const graphs = await app.call('research.graphs', {});
    expect(graphs.descriptions.some((graph) => graph.definition.graphId === f.input.graphId)).toBe(
      true,
    );
    const product = app.connectProduct();
    try {
      for (const extra of [
        { code: 'arbitrary' },
        { tools: ['write_file'] },
        { model: 'arbitrary' },
      ])
        await expect(
          product.call('research.requestGraph', {
            ...f.input,
            config: { ...f.input.config, ...extra },
          }),
        ).rejects.toMatchObject({ code: 'invalidRequest' });
    } finally {
      product.close();
    }
    expect(f.model.requests).toHaveLength(0);
    await f.start();
    await f.wait('completed');
    expect(observedProcessBeforeReport).toBe(true);
    expect(await readFile(join(projectPath, 'report.md'), 'utf8')).toContain('相差25');
    const process = await readFile(join(projectPath, 'process.md'), 'utf8');
    expect(process).toContain('形成比较维度');
    expect(process).toContain('自查已核来源');
    const calls = await app.call('research.graphCalls', {
      ...f.scope,
      invocationId: f.input.invocationId,
    });
    const execution = calls.calls[0]?.executions[0];
    expect(execution?.check).toMatchObject({
      delivery: 'usable',
      researchAssessment: 'notAssessed',
    });
    const sourceLength = '合成来源：样本A=42；样本B=17。两组各n=1。'.length;
    expect(execution?.run.graphProgress?.evidence.contentReads).toContainEqual({
      resource: material,
      content: {
        kind: 'text',
        offset: 0,
        length: sourceLength,
        size: sourceLength,
        truncated: false,
      },
    });
    expect(
      execution?.run.graphProgress?.evidence.roleResults?.map((item) => item.role).sort(),
    ).toEqual(['process', 'report']);
    expect(JSON.stringify(f.model.requests[0]?.messages)).toContain(f.input.text);
    expect(f.model.requests).toHaveLength(4);
    expect(f.model.requests[0]?.tool_choice).toEqual({ type: 'auto' });
  } finally {
    await app.close();
    await f.model.close();
  }
});

test('a plain summary is corrected once with newly confirmed user instructions before any role is saved', async () => {
  let material: ResourceEvidence;
  let corrected = false;
  let checkedCorrection = false;
  let consumed = false;
  const supplementId = randomUUID();
  const marker = 'Additional independent condition 6328 must precede the correction request.';
  const respond = synthesisModelResponse(() => [material], true);
  const f = await fixture(async (input) => {
    if (!corrected && input.calls.includes('read_context_resource')) {
      corrected = true;
      await f.app.call('session.send', {
        ...f.scope,
        instructionId: supplementId,
        text: marker,
        materials: [],
      });
      return { text: '普通说明，尚未提交节点结果。' };
    }
    if (corrected && !checkedCorrection) {
      expect(input.user).toContain(marker);
      expect(consumed).toBe(true);
      checkedCorrection = true;
    }
    return respond(input);
  });
  const confirm = HarnessRecords.prototype.confirmConsumption;
  HarnessRecords.prototype.confirmConsumption = function (...args) {
    const result = confirm.apply(this, args);
    if (args[2].checkpointNamespace && args[2].instructionIds.includes(supplementId))
      consumed = true;
    return result;
  };
  try {
    await f.app.call('files.save', {
      projectId: f.project.id,
      path: 'source.txt',
      content: 'Synthetic A=42 B=17.',
    });
    const source = await f.app.call('resources.describe', {
      locator: { source: 'project', projectId: f.project.id, path: 'source.txt' },
    });
    material = { ref: source.ref, basis: source.basis };
    f.input.materials = [material];
    await f.start();
    await f.wait('completed');
    expect(checkedCorrection).toBe(true);
    expect(f.model.requests).toHaveLength(5);
    expect(await readFile(join(f.project.path, 'report.md'), 'utf8')).toContain('相差25');
    expect(await readFile(join(f.project.path, 'process.md'), 'utf8')).not.toContain(
      '普通说明，尚未提交节点结果',
    );
  } finally {
    HarnessRecords.prototype.confirmConsumption = confirm;
    await f.app.close();
    await f.model.close();
  }
});

test('a truncated structured submission cannot save a role even when its arguments are complete', async () => {
  let material: ResourceEvidence;
  const respond = synthesisModelResponse(() => [material], true);
  const f = await fixture(async (input) => {
    const answer = await respond(input);
    return answer && 'tool' in answer && answer.tool.name === 'submit_literature_synthesis'
      ? { ...answer, stopReason: 'max_tokens' }
      : answer;
  });
  try {
    await f.app.call('files.save', {
      projectId: f.project.id,
      path: 'source.txt',
      content: 'Synthetic A=42 B=17.',
    });
    const source = await f.app.call('resources.describe', {
      locator: { source: 'project', projectId: f.project.id, path: 'source.txt' },
    });
    material = { ref: source.ref, basis: source.basis };
    f.input.materials = [material];
    await f.start();
    await f.wait('failed');
    const run = (await f.app.snapshot(f.scope)).run;
    assert(run?.graphProgress?.kind === 'graph.failed');
    expect(run.graphProgress.error.code).toBe('modelFailed');
    expect(await readFile(join(f.project.path, 'process.md'), 'utf8')).not.toContain(
      '形成比较维度',
    );
    await expect(readFile(join(f.project.path, 'report.md'), 'utf8')).rejects.toMatchObject({
      code: 'ENOENT',
    });
    expect(f.model.requests).toHaveLength(2);
  } finally {
    await f.app.close();
    await f.model.close();
  }
});

test('synthesis accepts one fenced result and excludes output reads regardless of reference key order', async () => {
  let material: ResourceEvidence;
  const respond = synthesisModelResponse(() => [material]);
  const f = await fixture(async (input) => {
    if (input.calls.filter((name) => name === 'read_context_resource').length === 1) {
      const descriptor = await f.app.call('resources.describe', {
        locator: { source: 'project', projectId: f.project.id, path: 'process.md' },
      });
      return {
        tool: {
          name: 'read_context_resource',
          input: {
            ref: Object.fromEntries(Object.entries(descriptor.ref).reverse()),
            basis: descriptor.basis,
            encoding: 'utf8',
            offset: 0,
            limit: 4096,
          },
        },
      };
    }
    const answer = await respond(input);
    if (answer && 'text' in answer) {
      const output = JSON.parse(answer.text);
      output.report ??= null;
      return { text: `已完成本阶段核查。\n\n\`\`\`json\n${JSON.stringify(output)}\n\`\`\`` };
    }
    return answer;
  });
  try {
    await f.app.call('files.save', {
      projectId: f.project.id,
      path: 'source.txt',
      content: '合成来源：样本A=42；样本B=17。两组各n=1。',
    });
    const descriptor = await f.app.call('resources.describe', {
      locator: { source: 'project', projectId: f.project.id, path: 'source.txt' },
    });
    material = { ref: descriptor.ref, basis: descriptor.basis };
    f.input.materials = [material];
    await f.start();
    await f.wait('completed');
    const progress = (await f.app.snapshot(f.scope)).run?.graphProgress;
    expect(progress?.evidence.inputs).toEqual([material]);
    expect(progress?.evidence.contentReads?.map((read) => read.resource)).toEqual([material]);
    expect(await readFile(join(f.project.path, 'report.md'), 'utf8')).toContain('相差25');
    expect(f.model.requests).toHaveLength(5);
  } finally {
    await f.app.close();
    await f.model.close();
  }
});

for (const [kind, output] of [
  ['truncated', '{"process":"candidate","next":"deliver"'],
  [
    'ambiguous',
    '```json\n{"process":"one","next":"deliver"}\n```\n```json\n{"process":"two","next":"deliver"}\n```',
  ],
  [
    'indented second fence',
    '```json\n{"process":"one","next":"deliver"}\n```\n   ```json\n   {"process":"two","next":"deliver"}\n   ```',
  ],
  [
    'tilde second fence',
    '```json\n{"process":"one","next":"deliver"}\n```\n~~~json\n{"process":"two","next":"deliver"}\n~~~',
  ],
] as const) {
  test(`synthesis pauses on ${kind} node output without saving a candidate`, async () => {
    const f = await fixture(() => ({ text: output }));
    try {
      await f.app.call('files.save', {
        projectId: f.project.id,
        path: 'source.txt',
        content: '合成来源：仅用于节点输出拒绝场景。',
      });
      const source = await f.app.call('resources.describe', {
        locator: { source: 'project', projectId: f.project.id, path: 'source.txt' },
      });
      f.input.materials = [{ ref: source.ref, basis: source.basis }];
      await f.start();
      await f.wait('waiting');
      const progress = (await f.app.snapshot(f.scope)).run?.graphProgress;
      assert(progress?.kind === 'graph.waiting');
      expect(progress.wait.nodeKey).toBe('delivery-wait');
      expect(await readFile(join(f.project.path, 'process.md'), 'utf8')).not.toContain('candidate');
      await expect(readFile(join(f.project.path, 'report.md'), 'utf8')).rejects.toMatchObject({
        code: 'ENOENT',
      });
      expect(f.model.requests).toHaveLength(2);
    } finally {
      await f.app.close();
      await f.model.close();
    }
  });
}

test('ordinary continuation cleans an output misclassified as a source in an older checkpoint', async () => {
  let material: ResourceEvidence;
  let reject = true;
  const respond = synthesisModelResponse(() => [material]);
  const f = await fixture((input) => {
    if (reject) {
      reject = false;
      return { text: JSON.stringify({ process: '保留原过程，等待明确接续。', next: 'wait' }) };
    }
    return respond(input);
  });
  let app = f.app;
  try {
    await app.call('files.save', {
      projectId: f.project.id,
      path: 'source.txt',
      content: 'Synthetic A=42 B=17.',
    });
    const source = await app.call('resources.describe', {
      locator: { source: 'project', projectId: f.project.id, path: 'source.txt' },
    });
    material = { ref: source.ref, basis: source.basis };
    f.input.materials = [material];
    await f.start();
    await f.wait('waiting');
    const before = (await app.snapshot(f.scope)).run;
    assert(before);
    const internal = app.projects.get(f.project.id).internal;
    await app.close();
    const opened = await openCheckpoint(internal, before.id);
    try {
      const saver = new InstructionSaver(opened.database, async () => {});
      const tuple = await saver.getTuple({ configurable: { thread_id: before.id } });
      assert(tuple);
      assert(tuple.metadata);
      const values = tuple.checkpoint.channel_values;
      const roles = values.roleResults as { role: string; result: ResourceSaveResult }[];
      const process = roles.find((item) => item.role === 'process');
      assert(process);
      // Emulate the old field-order bug without replaying the original model request or save.
      await saver.put(
        tuple.config,
        {
          ...tuple.checkpoint,
          channel_values: { ...values, sources: [material, process.result.resource] },
        },
        tuple.metadata,
      );
    } finally {
      opened.database.close();
    }
    app = new KernelApplication(join(f.root, 'profile'), {
      environment: { MINIMAX_CN_API_KEY: 'synthetic' },
      modelEndpoint: f.model.url,
    });
    await app.initialize();
    await app.call('session.send', {
      ...f.scope,
      instructionId: randomUUID(),
      text: '继续核查：已修复输出身份比较，按原保存依据接续。',
      materials: [],
    });
    await expect
      .poll(async () => (await app.snapshot(f.scope)).run?.state, { timeout: 30000 })
      .toBe('completed');
    const after = (await app.snapshot(f.scope)).run;
    expect(after?.id).toBe(before.id);
    expect(after?.graphProgress?.evidence.inputs).toEqual([material]);
    expect(await readFile(join(f.project.path, 'report.md'), 'utf8')).toContain('相差25');
  } finally {
    await app.close();
    await f.model.close();
  }
});

for (const format of ['long-text', 'pdf-page', 'html-section'] as const) {
  test(`production synthesis records the actual ${format} range and updates an explicit existing report`, async () => {
    let material: ResourceEvidence;
    let sectionId = '';
    let answers = 0;
    const f = await fixture(({ calls }) => {
      const count = calls.filter(
        (name) => name === 'read_context_resource' || name === 'read_context_document',
      ).length;
      if (!count)
        return {
          tool: {
            name: format === 'long-text' ? 'read_context_resource' : 'read_context_document',
            input:
              format === 'long-text'
                ? { ...material, encoding: 'utf8', offset: 300000, limit: 17 }
                : {
                    ...material,
                    request:
                      format === 'pdf-page'
                        ? { method: 'readPdfPage', input: { pageIndex: 0, offset: 0, limit: 4096 } }
                        : {
                            method: 'readDocumentSection',
                            input: { sectionId, offset: 500, limit: 17, textOnly: true },
                          },
                  },
          },
        };
      answers++;
      return {
        text: JSON.stringify({
          process: `实际片段的采用理由，第${answers}次判断；材料未读范围仍保留，后续需扩大独立样本。`,
          ...(answers === 2
            ? {
                report:
                  '# 修订报告\n保留人工研究问题。新片段说明当前合成材料条件；不能推广。修改依据已写入过程。',
              }
            : {}),
          next: answers === 1 ? 'synthesize' : answers === 2 ? 'review' : 'deliver',
        }),
      };
    });
    try {
      const name =
        format === 'pdf-page'
          ? 'source.pdf'
          : format === 'html-section'
            ? 'source.html'
            : 'source.txt';
      const source =
        format === 'pdf-page'
          ? syntheticPdf()
          : format === 'html-section'
            ? `<html><body><p>${'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.repeat(300)}</p></body></html>`
            : `${'x'.repeat(300000)}Known tail value42`;
      await writeFile(join(f.project.path, name), source);
      const descriptor = await f.app.call('resources.describe', {
        locator: { source: 'project', projectId: f.project.id, path: name },
      });
      material = { ref: descriptor.ref, basis: descriptor.basis };
      f.input.materials = [material];
      if (format === 'html-section') {
        const info = await f.app.call('resources.document', {
          ...material,
          request: { method: 'documentInfo', input: {} },
        });
        assert('sections' in info && info.sections[0]);
        sectionId = info.sections[0].id;
      }
      await f.app.call('files.save', {
        projectId: f.project.id,
        path: 'report.md',
        content: '# 人工原报告\n保留人工研究问题。',
      });
      const old = await f.app.call('resources.describe', {
        locator: { source: 'project', projectId: f.project.id, path: 'report.md' },
      });
      f.input.config.reportTarget = {
        kind: 'update',
        resource: { ref: old.ref, basis: old.basis },
      };
      await f.start();
      await f.wait('completed');
      const view = await f.app.call('research.graphCalls', {
        ...f.scope,
        invocationId: f.input.invocationId,
      });
      const execution = view.calls[0]?.executions[0];
      expect(execution?.check.delivery).toBe('usable');
      const ranges = execution?.run.graphProgress?.evidence.contentReads ?? [];
      if (format === 'long-text')
        expect(ranges).toContainEqual({
          resource: material,
          content: {
            kind: 'text',
            offset: 300000,
            length: 17,
            size: 300018,
            truncated: false,
            nextOffset: 300017,
          },
        });
      else if (format === 'pdf-page') {
        expect(ranges).toContainEqual({
          resource: material,
          content: {
            kind: 'pdf-page',
            pageIndex: 0,
            offset: 0,
            length: PAGE_ONE_TEXT.length,
            hasText: true,
          },
        });
        expect(JSON.stringify(f.model.requests[1]?.messages)).toContain(PAGE_ONE_TEXT);
      } else {
        expect(ranges).toContainEqual({
          resource: material,
          content: {
            kind: 'document-section',
            sectionId,
            normalizationVersion: 1,
            offset: 500,
            length: 17,
            nextOffset: 517,
            size: expect.any(Number),
          },
        });
        const section = ranges.find((item) => item.content.kind === 'document-section');
        assert(section?.content.kind === 'document-section');
        expect(section.content.size).toBeGreaterThan(7000);
      }
      const report = execution?.run.graphProgress?.evidence.roleResults?.find(
        (item) => item.role === 'report',
      )?.result;
      expect(report?.resource.ref).toEqual(old.ref);
      expect(report?.resource.basis).not.toBe(old.basis);
      assert(report?.editId);
      expect(await readFile(join(f.project.path, 'report.md'), 'utf8')).toContain(
        '保留人工研究问题',
      );
    } finally {
      await f.app.close();
      await f.model.close();
    }
  });
}

test('a real graph wait ignores vague continuation and consumes an explicit ordinary decision', async () => {
  let material: ResourceEvidence;
  let answers = 0;
  const f = await fixture(({ calls }) => {
    if (!calls.includes('read_context_resource'))
      return {
        tool: {
          name: 'read_context_resource',
          input: { ...material, encoding: 'utf8', limit: 4096 },
        },
      };
    answers++;
    return {
      text: JSON.stringify({
        process: `判断${answers}：范围明确后继续，保留样本限制。`,
        ...(answers === 3 ? { report: '# 合成报告\n依据42，单样本不能推广。' } : {}),
        next:
          answers === 1
            ? 'wait'
            : answers === 2
              ? 'synthesize'
              : answers === 3
                ? 'review'
                : 'deliver',
        ...(answers === 1
          ? { prompt: '请明确是否只比较当前合成样本。发送“继续核查：只比较当前合成样本”。' }
          : {}),
      }),
    };
  });
  try {
    await f.app.call('files.save', {
      projectId: f.project.id,
      path: 'source.txt',
      content: 'Known synthetic 42.',
    });
    const d = await f.app.call('resources.describe', {
      locator: { source: 'project', projectId: f.project.id, path: 'source.txt' },
    });
    material = { ref: d.ref, basis: d.basis };
    f.input.materials = [material];
    const receipt = await f.start();
    await f.wait('waiting');
    const requests = f.model.requests.length;
    await f.app.call('session.send', {
      ...f.scope,
      instructionId: randomUUID(),
      text: '继续',
      materials: [],
    });
    await f.wait('waiting');
    expect(f.model.requests).toHaveLength(requests);
    const accepted = await f.app.call('session.send', {
      ...f.scope,
      instructionId: randomUUID(),
      text: '继续核查：只比较当前合成样本',
      materials: [],
    });
    expect(accepted.runId).toBe(receipt.runId);
    await f.wait('completed');
    const process = await readFile(join(f.project.path, 'process.md'), 'utf8');
    expect(process).toContain('只比较当前合成样本');
    expect(process).toContain('判断1');
    expect(JSON.stringify(f.model.requests.at(-1)?.messages)).toContain('只比较当前合成样本');
  } finally {
    await f.app.close();
    await f.model.close();
  }
});

test('missing reports and an explicit independent review remain incomplete with saved partial process', async () => {
  let material: ResourceEvidence;
  const f = await fixture(({ calls }) =>
    calls.includes('read_context_resource')
      ? {
          text: JSON.stringify({
            process: '已取得单样本，独立复核仍缺少，报告尚未完成。',
            next: 'deliver',
          }),
        }
      : {
          tool: {
            name: 'read_context_resource',
            input: { ...material, encoding: 'utf8', limit: 4096 },
          },
        },
  );
  try {
    await f.app.call('files.save', {
      projectId: f.project.id,
      path: 'source.txt',
      content: 'Synthetic source42.',
    });
    const d = await f.app.call('resources.describe', {
      locator: { source: 'project', projectId: f.project.id, path: 'source.txt' },
    });
    material = { ref: d.ref, basis: d.basis };
    f.input.materials = [material];
    f.input.config.requireIndependentReview = true;
    await f.start();
    await f.wait('waiting');
    const view = await f.app.call('research.graphCalls', {
      ...f.scope,
      invocationId: f.input.invocationId,
    });
    expect(view.calls[0]?.executions[0]?.check.delivery).toBe('incomplete');
    expect((await f.app.snapshot(f.scope)).run?.graphProgress).toMatchObject({
      kind: 'graph.waiting',
      wait: { nodeKey: 'review-wait' },
    });
    expect(await readFile(join(f.project.path, 'process.md'), 'utf8')).toContain('独立复核仍缺少');
  } finally {
    await f.app.close();
    await f.model.close();
  }
});

test('oversized actual tool text is rejected before consumption and a narrower range is retained', async () => {
  let material: ResourceEvidence;
  let answers = 0;
  const f = await fixture(({ calls }) => {
    const reads = calls.filter((name) => name === 'read_context_resource').length;
    if (reads < 2)
      return {
        tool: {
          name: 'read_context_resource',
          input: { ...material, encoding: 'utf8', limit: reads ? 17 : 5000 },
        },
      };
    answers++;
    return {
      text: JSON.stringify({
        process: '只采用实际交付的17字符，原超限请求不是正文消费。',
        ...(answers === 2 ? { report: '# 小片报告\n范围17字符，覆盖受限。' } : {}),
        next: answers === 1 ? 'synthesize' : answers === 2 ? 'review' : 'deliver',
      }),
    };
  });
  try {
    await f.app.call('files.save', {
      projectId: f.project.id,
      path: 'source.txt',
      content: 'X'.repeat(6000),
    });
    const d = await f.app.call('resources.describe', {
      locator: { source: 'project', projectId: f.project.id, path: 'source.txt' },
    });
    material = { ref: d.ref, basis: d.basis };
    f.input.materials = [material];
    await f.start();
    await f.wait('completed');
    const rawReply = JSON.stringify(f.model.requests[1]?.messages);
    expect(rawReply).toContain('tooLarge');
    expect(rawReply).not.toContain('X'.repeat(4097));
    const view = await f.app.call('research.graphCalls', {
      ...f.scope,
      invocationId: f.input.invocationId,
    });
    expect(view.calls[0]?.executions[0]?.run.graphProgress?.evidence.contentReads).toEqual([
      {
        resource: material,
        content: {
          kind: 'text',
          offset: 0,
          length: 17,
          size: 6000,
          truncated: false,
          nextOffset: 17,
        },
      },
    ]);
  } finally {
    await f.app.close();
    await f.model.close();
  }
});

test('a source tool error is persisted, waits for its explicit ordinary decision and keeps the original identity', async () => {
  let material: ResourceEvidence;
  let chosen = false;
  let answers = 0;
  const f = await fixture(({ calls }) => {
    const reads = calls.filter((name) => name === 'read_context_resource').length;
    if (!reads || (chosen && reads < 2))
      return {
        tool: {
          name: 'read_context_resource',
          input: {
            ref: material.ref,
            basis: reads ? material.basis : 'synthetic-wrong-basis',
            encoding: 'utf8',
            limit: 4096,
          },
        },
      };
    if (!chosen) return { text: JSON.stringify({ process: '来源失败，必须等待。', next: 'wait' }) };
    answers++;
    return {
      text: JSON.stringify({
        process: '按明确普通消息重新使用原身份核查并保留失败历史。',
        ...(answers === 2 ? { report: '# 核查后报告\n原来源42，保留样本局限。' } : {}),
        next: answers === 1 ? 'synthesize' : answers === 2 ? 'review' : 'deliver',
      }),
    };
  });
  try {
    await f.app.call('files.save', {
      projectId: f.project.id,
      path: 'source.txt',
      content: 'Original source42.',
    });
    const d = await f.app.call('resources.describe', {
      locator: { source: 'project', projectId: f.project.id, path: 'source.txt' },
    });
    material = { ref: d.ref, basis: d.basis };
    f.input.materials = [material];
    await f.start();
    await f.wait('waiting');
    expect((await f.app.snapshot(f.scope)).run?.graphProgress).toMatchObject({
      kind: 'graph.waiting',
      wait: { nodeKey: 'source-wait' },
    });
    expect(await readFile(join(f.project.path, 'process.md'), 'utf8')).toContain('contentChanged');
    const requests = f.model.requests.length;
    await f.app.call('session.send', {
      ...f.scope,
      instructionId: randomUUID(),
      text: '继续',
      materials: [],
    });
    await f.wait('waiting');
    expect(f.model.requests).toHaveLength(requests);
    chosen = true;
    assert(material.ref.source === 'project');
    await f.app.call('session.send', {
      ...f.scope,
      instructionId: randomUUID(),
      text: `重试来源 project:${material.ref.projectId}:${material.ref.fileId}：使用已确认的原始依据，保留失败记录`,
      materials: [],
    });
    await f.wait('completed');
    const process = await readFile(join(f.project.path, 'process.md'), 'utf8');
    expect(process).toContain('contentChanged');
    expect(process).toContain('使用已确认的原始依据');
  } finally {
    await f.app.close();
    await f.model.close();
  }
});

test('the actual shared model budget ends an unfinished graph while retaining saved process and consumed ranges', async () => {
  let material: ResourceEvidence;
  const f = await fixture(() => ({
    tool: { name: 'read_context_resource', input: { ...material, encoding: 'utf8', limit: 17 } },
  }));
  try {
    await f.app.call('files.save', {
      projectId: f.project.id,
      path: 'source.txt',
      content: 'Budget source42, further facts remain.',
    });
    const d = await f.app.call('resources.describe', {
      locator: { source: 'project', projectId: f.project.id, path: 'source.txt' },
    });
    material = { ref: d.ref, basis: d.basis };
    f.input.materials = [material];
    await f.start();
    await f.wait('failed');
    const view = await f.app.call('research.graphCalls', {
      ...f.scope,
      invocationId: f.input.invocationId,
    });
    const execution = view.calls[0]?.executions[0];
    expect(execution?.check.delivery).toBe('incomplete');
    expect(execution?.run.graphProgress).toMatchObject({ kind: 'graph.failed' });
    expect(execution?.run.graphProgress?.evidence.contentReads?.length).toBeGreaterThan(0);
    expect(f.model.requests).toHaveLength(32);
    expect(await readFile(join(f.project.path, 'process.md'), 'utf8')).toContain('本次文献综合');
  } finally {
    await f.app.close();
    await f.model.close();
  }
});

for (const catalogOnlyCandidate of [false, true]) {
  test(`the production task snapshot and real navigation survive a CAS conflict (${catalogOnlyCandidate ? 'v2 catalog' : 'v1'})`, async () => {
    test.setTimeout(90000);
    let material: ResourceEvidence;
    let answers = 0;
    const f = await fixture(({ calls }) => {
      if (!calls.includes('read_context_resource'))
        return {
          tool: {
            name: 'read_context_resource',
            input: { ...material, encoding: 'utf8', limit: 4096 },
          },
        };
      answers++;
      return {
        text: JSON.stringify({
          process:
            '采用实际合成文本42；题录候选没有附件，不据此制造全文发现。比较与条件留待独立样本。',
          ...(answers === 2
            ? { report: '# 实际任务报告\n真实已读样本42；只有题录的候选不提供全文证据。' }
            : {}),
          next: answers === 1 ? 'synthesize' : answers === 2 ? 'review' : 'deliver',
        }),
      };
    });
    try {
      await f.app.call('files.save', {
        projectId: f.project.id,
        path: 'source.txt',
        content: 'Task source42.',
      });
      const d = await f.app.call('resources.describe', {
        locator: { source: 'project', projectId: f.project.id, path: 'source.txt' },
      });
      material = { ref: d.ref, basis: d.basis };
      assert(d.ref.source === 'project');
      const metadata: TaskMetadata = {
        kind: 'research-task',
        formatVersion: 1,
        id: 'synthesis',
        title: '真实综合任务',
        status: 'active',
        links: [
          {
            id: 'text-source',
            role: 'source',
            target: { kind: 'project-file', fileId: d.ref.fileId },
            basis: d.basis,
          },
        ],
      };
      if (catalogOnlyCandidate) {
        await f.app.call('library.grant', {
          read: true,
          write: true,
          send: true,
          autoBackup: false,
        });
        const batch = await f.app.call('library.ingest', {
          batchId: randomUUID(),
          json: JSON.stringify([{ title: '合成题录候选，无全文' }]),
          version: 'preprint',
          origin: 'synthesis-test',
        });
        await expect
          .poll(async () => (await f.app.call('library.batch', { batchId: batch.id })).batch.state)
          .toBe('completed');
        const sourceId = (await f.app.call('library.batch', { batchId: batch.id })).entries[0]
          ?.sourceId;
        assert(sourceId);
        const source = await f.app.call('library.get', { sourceId });
        const libraryId = (await f.app.call('library.status', {})).id;
        metadata.links?.push({
          id: 'catalog-source',
          role: 'source',
          basis: source.version,
          target: { kind: 'library-source', libraryId, sourceId },
        });
      }
      const created = await f.app.call('tasks.create', {
        projectId: f.project.id,
        operationId: randomUUID(),
        path: 'tasks/synthesis.task.md',
        content: `---\n${JSON.stringify(metadata)}\n---\n\n研究目的：比较已读材料与候选条件，保留下一步。\n`,
      });
      assert(created.state === 'complete');
      const task = {
        projectId: f.project.id,
        taskId: 'synthesis',
        fileId: created.resource.ref.fileId,
      };
      const entry = await f.app.call('tasks.read', { task });
      const projectTasks = f.app.projectTasks.bind(f.app);
      let conflict = true;
      f.app.projectTasks = (context) => {
        const port = projectTasks(context);
        return {
          ...port,
          save: async (input) => {
            if (conflict) {
              conflict = false;
              const user = await f.app.call('tasks.read', { task });
              await f.app.call('tasks.save', {
                task,
                basis: user.entry.basis,
                content: `${user.content}\n人工并发注记：请保留。\n`,
              });
            }
            return port.save(input);
          },
        };
      };
      const started = await f.app.call('tasks.runGraph', {
        task,
        basis: entry.entry.basis,
        sessionId: f.scope.sessionId,
        invocationId: f.input.invocationId,
        instructionId: f.input.instructionId,
        processOperationId: randomUUID(),
        graphId: f.input.graphId,
        version: f.input.version,
        config: f.input.config,
        sourceLinkIds: metadata.links?.map((item) => item.id) ?? [],
      });
      assert(started.inputSnapshot?.state === 'complete');
      const snapshot = JSON.parse(
        await readFile(join(f.project.path, started.inputSnapshot.resource.path ?? ''), 'utf8'),
      );
      expect(snapshot.formatVersion).toBe(catalogOnlyCandidate ? 2 : 1);
      await f.wait('waiting');
      const beforeReport = await readFile(join(f.project.path, 'report.md'), 'utf8');
      const modelRequests = f.model.requests.length;
      const reportIdentity = await f.app.call('resources.describe', {
        locator: { source: 'project', projectId: f.project.id, path: 'report.md' },
      });
      expect((await f.app.call('tasks.read', { task })).content).toContain('人工并发注记');
      await f.app.call('session.send', {
        ...f.scope,
        instructionId: randomUUID(),
        text: '继续补链：保留人工注记，只补已保存成果的任务导航',
        materials: [],
      });
      await f.wait('completed');
      expect(f.model.requests).toHaveLength(modelRequests);
      expect(await readFile(join(f.project.path, 'report.md'), 'utf8')).toBe(beforeReport);
      expect(await f.app.call('resources.describe', { locator: reportIdentity.ref })).toEqual(
        reportIdentity,
      );
      const current = await f.app.call('tasks.read', { task });
      expect(current.metadata.status).toBe('active');
      expect(current.metadata.links).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            role: 'result',
            target: {
              kind: 'project-file',
              fileId: reportIdentity.ref.source === 'project' ? reportIdentity.ref.fileId : '',
            },
            basis: reportIdentity.basis,
          }),
        ]),
      );
      expect(
        current.metadata.links?.filter(
          (link) => link.role === 'process' && link.target.kind === 'project-file',
        ).length,
      ).toBeGreaterThanOrEqual(2);
      const view = await f.app.call('research.graphCalls', {
        ...f.scope,
        invocationId: f.input.invocationId,
      });
      expect(view.calls[0]?.executions[0]?.check.delivery).toBe('usable');
      if (catalogOnlyCandidate) {
        expect(snapshot.sources).toContainEqual(
          expect.objectContaining({
            catalog: expect.objectContaining({ revision: expect.any(Number) }),
          }),
        );
        expect(view.calls[0]?.executions[0]?.run.graphProgress?.evidence.inputs).toHaveLength(1);
        expect(await readFile(join(f.project.path, 'process.md'), 'utf8')).toContain(
          '"attachments":[]',
        );
      }
    } finally {
      await f.app.close();
      await f.model.close();
    }
  });
}

test('a self-check returns to real acquisition, adopts a new library source and revises the saved report', async () => {
  let first: ResourceEvidence;
  let added: ResourceEvidence;
  let answers = 0;
  const f = await fixture(({ calls }) => {
    const reads = calls.filter((name) => name === 'read_context_resource').length;
    if (!reads || (answers >= 3 && reads < 2))
      return {
        tool: {
          name: 'read_context_resource',
          input: {
            ...(reads ? added : first),
            encoding: 'utf8',
            limit: 4096,
          },
        },
      };
    answers++;
    return {
      text: JSON.stringify({
        process:
          answers < 4
            ? '原来源42，比较还缺少条件B。自查要求补读。'
            : '实际新增库来源17改变了条件比较：保留原样本限制，解释修改依据。',
        ...(answers === 2
          ? { report: '# 初稿\n来源A=42，条件B尚缺。' }
          : answers === 5
            ? {
                report:
                  '# 修订\n来源A=42；实际新增库来源B=17。差值25，条件不同不能推广；保留原局限，下一步独立复验。',
              }
            : {}),
        next:
          answers === 1 || answers === 4
            ? 'synthesize'
            : answers === 2 || answers === 5
              ? 'review'
              : answers === 3
                ? 'acquire'
                : 'deliver',
      }),
    };
  });
  try {
    await f.app.call('files.save', {
      projectId: f.project.id,
      path: 'source.txt',
      content: 'Original A=42; n=1.',
    });
    const d = await f.app.call('resources.describe', {
      locator: { source: 'project', projectId: f.project.id, path: 'source.txt' },
    });
    first = { ref: d.ref, basis: d.basis };
    f.input.materials = [first];
    await f.app.call('library.grant', { read: true, write: true, send: true, autoBackup: false });
    const path = join(f.root, 'additional.txt');
    await writeFile(path, 'Independent synthetic library B=17; different condition.');
    const batch = await f.app.call('library.importFiles', {
      batchId: randomUUID(),
      paths: [path],
      storage: 'managed',
      purpose: '正文',
      version: 'published',
      origin: 'synthesis-test',
    });
    await expect
      .poll(async () => (await f.app.call('library.batch', { batchId: batch.id })).batch.state)
      .toBe('completed');
    const attachmentId = (await f.app.call('library.batch', { batchId: batch.id })).entries[0]
      ?.attachmentId;
    assert(attachmentId);
    const attachment = await f.app.call('library.attachment', { attachmentId });
    const extra = await f.app.call('resources.describe', {
      locator: { source: 'library', attachmentId, materialVersionId: attachment.materialVersionId },
    });
    added = { ref: extra.ref, basis: extra.basis };
    await f.start();
    await f.wait('completed');
    const original = await f.app.call('research.graphCalls', {
      ...f.scope,
      invocationId: f.input.invocationId,
    });
    const execution = original.calls[0]?.executions[0];
    expect(execution?.check.delivery).toBe('usable');
    expect(execution?.run.graphProgress?.evidence.inputs).toEqual([first, added]);
    expect(execution?.run.graphProgress?.evidence.reads).toEqual([first, added]);
    expect(await readFile(join(f.project.path, 'report.md'), 'utf8')).toContain('差值25');
    expect(await readFile(join(f.project.path, 'process.md'), 'utf8')).toContain(
      '实际新增库来源17改变',
    );
    expect(f.app.projects.get(f.project.id).history('report.md')).toHaveLength(2);
    await f.app.call('library.grant', { read: false, write: true, send: true, autoBackup: false });
    const denied = await f.app.call('research.graphCalls', {
      ...f.scope,
      invocationId: f.input.invocationId,
    });
    expect(denied.calls[0]?.executions[0]?.check.delivery).toBe('incomplete');
    expect(f.model.requests).toHaveLength(8);
  } finally {
    await f.app.close();
    await f.model.close();
  }
});

test('an unknown creation is checked by its original operation before any research starts', async () => {
  let material: ResourceEvidence;
  let answers = 0;
  const f = await fixture(({ calls }) => {
    if (!calls.includes('read_context_resource'))
      return {
        tool: {
          name: 'read_context_resource',
          input: { ...material, encoding: 'utf8', limit: 4096 },
        },
      };
    answers++;
    return {
      text: JSON.stringify({
        process: '原创建已核查后取得材料42，研究判断与创建核查分开。',
        ...(answers === 2 ? { report: '# 报告\n来源42；保留单样本局限。' } : {}),
        next: answers === 1 ? 'synthesize' : answers === 2 ? 'review' : 'deliver',
      }),
    };
  });
  try {
    await f.app.call('files.save', {
      projectId: f.project.id,
      path: 'source.txt',
      content: 'Synthetic original source42.',
    });
    const d = await f.app.call('resources.describe', {
      locator: { source: 'project', projectId: f.project.id, path: 'source.txt' },
    });
    material = { ref: d.ref, basis: d.basis };
    f.input.materials = [material];
    const store = f.app.projects.get(f.project.id);
    store.database.exec(
      "CREATE TRIGGER lose_synthesis_registration BEFORE INSERT ON file_references BEGIN SELECT RAISE(ABORT, 'synthetic registration failure'); END",
    );
    await f.start();
    await f.wait('waiting');
    const original = await readFile(join(f.project.path, 'process.md'), 'utf8');
    expect(f.model.requests).toHaveLength(0);
    store.database.exec('DROP TRIGGER lose_synthesis_registration');
    await f.app.call('session.send', {
      ...f.scope,
      instructionId: randomUUID(),
      text: '继续核查：只查询原创建操作，保留已经写出的过程文件',
      materials: [],
    });
    await f.wait('completed');
    expect(await readFile(join(f.project.path, 'process.md'), 'utf8')).toContain(original);
    expect(f.model.requests).toHaveLength(4);
    const view = await f.app.call('research.graphCalls', {
      ...f.scope,
      invocationId: f.input.invocationId,
    });
    expect(view.calls[0]?.executions[0]?.check.delivery).toBe('usable');
    expect(
      view.calls[0]?.executions[0]?.run.graphProgress?.evidence.creations?.filter(
        (item) => item.state === 'complete',
      ),
    ).toHaveLength(2);
  } finally {
    await f.app.close();
    await f.model.close();
  }
});

test('a preparation source race accepts explicit exclusion and rechecks targets without losing prior process', async () => {
  let first: ResourceEvidence;
  const f = await fixture(synthesisModelResponse(() => [first]));
  try {
    for (const [path, content] of [
      ['first.txt', 'Healthy A=42 and comparison17.'],
      ['second.txt', 'Original B=17.'],
      ['prior-process.md', 'Prior research must survive.'],
    ] as const)
      await f.app.call('files.save', { projectId: f.project.id, path, content });
    const describe = (path: string) =>
      f.app.call('resources.describe', {
        locator: { source: 'project', projectId: f.project.id, path },
      });
    const a = await describe('first.txt');
    const b = await describe('second.txt');
    assert(b.ref.source === 'project');
    const failedFileId = b.ref.fileId;
    const prior = await describe('prior-process.md');
    first = { ref: a.ref, basis: a.basis };
    f.input.materials = [first, { ref: b.ref, basis: b.basis }];
    f.input.config.processTarget = {
      kind: 'update',
      resource: { ref: prior.ref, basis: prior.basis },
    };
    const resources = f.app.executionResources.bind(f.app);
    let changed = false;
    f.app.executionResources = (context) => {
      const port = resources(context);
      return {
        ...port,
        describe: async (locator) => {
          if (!changed && locator.source === 'project' && locator.fileId === failedFileId) {
            changed = true;
            await f.app.call('resources.save', {
              ref: b.ref,
              basis: b.basis,
              content: 'Human changed B after admission.',
            });
          }
          return port.describe(locator);
        },
      };
    };
    await f.start();
    await f.wait('waiting');
    const run = (await f.app.snapshot(f.scope)).run;
    expect(run?.graphProgress).toMatchObject({
      kind: 'graph.waiting',
      wait: { nodeKey: 'source-wait' },
    });
    expect(f.model.requests).toHaveLength(0);
    expect(await readFile(join(f.project.path, 'prior-process.md'), 'utf8')).toContain(
      'Prior research must survive.',
    );
    assert(b.ref.source === 'project');
    await f.app.call('session.send', {
      ...f.scope,
      instructionId: randomUUID(),
      text: `忽略来源 project:${f.project.id}:${b.ref.fileId}：B已变基且未读，仅采用A并保留覆盖局限`,
      materials: [],
    });
    await f.wait('completed');
    const after = (await f.app.snapshot(f.scope)).run;
    expect(after?.id).toBe(run?.id);
    expect(after?.graphProgress?.evidence.inputs).toEqual([first]);
    const process = await readFile(join(f.project.path, 'prior-process.md'), 'utf8');
    expect(process).toContain('Prior research must survive.');
    expect(process).toContain('B已变基且未读');
  } finally {
    await f.app.close();
    await f.model.close();
  }
});

test('a committed child-consumption receipt loss preserves its task and complete context across restart', async () => {
  let material: ResourceEvidence;
  let sendSupplement: (() => Promise<unknown>) | undefined;
  const marker = 'Additional independent condition 7329 must survive recovery.';
  const supplementId = randomUUID();
  const respond = synthesisModelResponse(() => [material]);
  const f = await fixture(async (input) => {
    const send = sendSupplement;
    sendSupplement = undefined;
    await send?.();
    return respond(input);
  });
  let app = f.app;
  const confirm = HarnessRecords.prototype.confirmConsumption;
  let injected = false;
  HarnessRecords.prototype.confirmConsumption = function (...args) {
    const result = confirm.apply(this, args);
    if (!injected && args[2].checkpointNamespace && args[2].instructionIds.includes(supplementId)) {
      injected = true;
      throw new Error('Synthetic lost receipt after real consumption transaction');
    }
    return result;
  };
  try {
    await app.call('files.save', {
      projectId: f.project.id,
      path: 'source.txt',
      content: 'Synthetic A=42 and B=17.',
    });
    const d = await app.call('resources.describe', {
      locator: { source: 'project', projectId: f.project.id, path: 'source.txt' },
    });
    material = { ref: d.ref, basis: d.basis };
    f.input.materials = [material];
    sendSupplement = () =>
      app.call('session.send', {
        ...f.scope,
        instructionId: supplementId,
        text: marker,
        materials: [],
      });
    await f.start();
    await expect
      .poll(async () => (await app.snapshot(f.scope)).run?.state, { timeout: 30000 })
      .toBe('failed');
    const before = (await app.snapshot(f.scope)).run;
    expect(injected).toBe(true);
    const requests = f.model.requests.length;
    await app.close();
    app = new KernelApplication(join(f.root, 'profile'), {
      environment: { MINIMAX_CN_API_KEY: 'synthetic' },
      modelEndpoint: f.model.url,
    });
    await app.initialize();
    await app.call('session.send', {
      ...f.scope,
      instructionId: randomUUID(),
      text: '继续核查：恢复原执行及完整补充条件。',
      materials: [],
    });
    await expect
      .poll(async () => (await app.snapshot(f.scope)).run?.state, { timeout: 30000 })
      .toBe('completed');
    expect((await app.snapshot(f.scope)).run?.id).toBe(before?.id);
    expect(f.model.requests.length).toBeGreaterThan(requests);
    expect(JSON.stringify(f.model.requests.at(-1))).toContain(marker);
  } finally {
    HarnessRecords.prototype.confirmConsumption = confirm;
    await app.close();
    await f.model.close();
  }
});

for (const changed of [false, true]) {
  test(`a rejected save retains its original candidate and ${changed ? 'protects a later edit' : 'retries only that update'}`, async () => {
    let material: ResourceEvidence;
    const f = await fixture(synthesisModelResponse(() => [material]));
    let rejected: { before: ResourceEvidence; content: string } | undefined;
    const saved: { before: ResourceEvidence; content: string }[] = [];
    try {
      await f.app.call('files.save', {
        projectId: f.project.id,
        path: 'source.txt',
        content: 'Synthetic A=42 B=17.',
      });
      const d = await f.app.call('resources.describe', {
        locator: { source: 'project', projectId: f.project.id, path: 'source.txt' },
      });
      material = { ref: d.ref, basis: d.basis };
      f.input.materials = [material];
      const resources = f.app.executionResources.bind(f.app);
      f.app.executionResources = (context) => {
        const port = resources(context);
        return {
          ...port,
          save: async (input) => {
            const attempt = {
              before: { ref: input.ref, basis: input.basis },
              content: input.content,
            };
            if (!rejected) {
              rejected = attempt;
              throw new OperationError('permissionDenied', 'Synthetic rejection before any write');
            }
            const result = await port.save(input);
            saved.push(attempt);
            return result;
          },
        };
      };
      await f.start();
      await f.wait('waiting');
      const run = (await f.app.snapshot(f.scope)).run;
      assert(run && rejected);
      const original = rejected;
      expect(original.content).toContain('形成比较维度');
      expect(saved).toHaveLength(0);
      const requests = f.model.requests.length;
      if (changed)
        await f.app.call('resources.save', {
          ...original.before,
          content: 'Later human edit must survive.',
        });
      await f.app.call('session.send', {
        ...f.scope,
        instructionId: randomUUID(),
        text: '继续核查：拒绝已解除，核原候选和原保存依据。',
        materials: [],
      });
      await f.wait(changed ? 'waiting' : 'completed');
      expect((await f.app.snapshot(f.scope)).run?.id).toBe(run.id);
      if (changed) {
        expect(saved).toHaveLength(0);
        expect(f.model.requests).toHaveLength(requests);
        expect(await readFile(join(f.project.path, 'process.md'), 'utf8')).toBe(
          'Later human edit must survive.',
        );
        const opened = await openCheckpoint(f.app.projects.get(f.project.id).internal, run.id);
        try {
          const tuple = await new InstructionSaver(opened.database, async () => {}).getTuple({
            configurable: { thread_id: run.id },
          });
          expect(tuple?.checkpoint.channel_values).toMatchObject({
            unknownSave: true,
            pendingSave: { kind: 'update', before: original.before, content: original.content },
          });
        } finally {
          opened.database.close();
        }
      } else {
        expect(saved[0]).toEqual(original);
        expect(await readFile(join(f.project.path, 'process.md'), 'utf8')).toContain(
          original.content,
        );
      }
    } finally {
      await f.app.close();
      await f.model.close();
    }
  });
}

for (const loseReceipt of [false, true]) {
  test(`a saved role survives a root persistence cut with ${loseReceipt ? 'unknown' : 'cached exact'} receipt`, async () => {
    test.setTimeout(90000);
    let material: ResourceEvidence;
    const f = await fixture(synthesisModelResponse(() => [material], true));
    let app = f.app;
    let checkpointPath = '';
    let armed = true;
    const saves: { before: ResourceEvidence; result: ResourceSaveResult }[] = [];
    const instrument = () => {
      const resources = app.executionResources.bind(app);
      app.executionResources = (context) => {
        const port = resources(context);
        return {
          ...port,
          save: async (input) => {
            const result = await port.save(input);
            saves.push({ before: { ref: input.ref, basis: input.basis }, result });
            if (armed) {
              armed = false;
              const row = app.projects
                .get(f.project.id)
                .database.prepare('SELECT value FROM run_instances WHERE run_id = ?')
                .get(context.runId) as { value: string };
              checkpointPath = JSON.parse(row.value).checkpointPath;
              const db = new Database(checkpointPath, { fileMustExist: true });
              try {
                if (loseReceipt)
                  db.exec(
                    "CREATE TRIGGER cut_role_writes BEFORE INSERT ON writes WHEN NEW.checkpoint_ns = '' BEGIN SELECT RAISE(ABORT, 'synthetic lost effect receipt'); END",
                  );
                db.exec(
                  "CREATE TRIGGER cut_role_root BEFORE INSERT ON checkpoints WHEN NEW.checkpoint_ns = '' BEGIN SELECT RAISE(ABORT, 'synthetic root cut'); END",
                );
              } finally {
                db.close();
              }
            }
            return result;
          },
        };
      };
    };
    try {
      await app.call('files.save', {
        projectId: f.project.id,
        path: 'source.txt',
        content: 'Synthetic A=42 B=17.',
      });
      const d = await app.call('resources.describe', {
        locator: { source: 'project', projectId: f.project.id, path: 'source.txt' },
      });
      material = { ref: d.ref, basis: d.basis };
      f.input.materials = [material];
      instrument();
      await f.start();
      await f.wait('failed');
      const before = (await app.snapshot(f.scope)).run;
      assert(before);
      expect(saves).toHaveLength(1);
      const first = saves[0];
      assert(first);
      const opened = await openCheckpoint(app.projects.get(f.project.id).internal, before.id);
      try {
        const tuple = await new InstructionSaver(opened.database, async () => {}).getTuple({
          configurable: { thread_id: before.id },
        });
        const intent = tuple?.checkpoint.channel_values.pendingSave as {
          role: string;
          kind: string;
          before: ResourceEvidence;
          content: string;
        };
        expect(intent).toMatchObject({ role: 'process', kind: 'update', before: first.before });
        expect(intent.content).toBe(await readFile(join(f.project.path, 'process.md'), 'utf8'));
      } finally {
        opened.database.close();
      }
      const requests = f.model.requests.length;
      const actualBefore = await readFile(join(f.project.path, 'process.md'), 'utf8');
      await app.close();
      const db = new Database(checkpointPath, { fileMustExist: true });
      try {
        if (loseReceipt) db.exec('DROP TRIGGER cut_role_writes');
        db.exec('DROP TRIGGER cut_role_root');
      } finally {
        db.close();
      }
      app = new KernelApplication(join(f.root, 'profile'), {
        environment: { MINIMAX_CN_API_KEY: 'synthetic' },
        modelEndpoint: f.model.url,
      });
      await app.initialize();
      instrument();
      await app.call('session.send', {
        ...f.scope,
        instructionId: randomUUID(),
        text: '继续核查：核原保存，不覆盖后续成果。',
        materials: [],
      });
      await expect
        .poll(async () => (await app.snapshot(f.scope)).run?.state, { timeout: 30000 })
        .toBe(loseReceipt ? 'waiting' : 'completed');
      const after = (await app.snapshot(f.scope)).run;
      expect(after?.id).toBe(before.id);
      expect(saves.filter((item) => item.before.basis === first.before.basis)).toHaveLength(1);
      if (loseReceipt) {
        expect(saves).toHaveLength(1);
        expect(f.model.requests).toHaveLength(requests);
        expect(after?.graphProgress).toMatchObject({ kind: 'graph.waiting' });
        expect(
          after?.graphProgress?.evidence.roleResults?.some((item) => item.role === 'process'),
        ).toBe(false);
        expect(await readFile(join(f.project.path, 'process.md'), 'utf8')).toBe(actualBefore);
        await app.call('session.send', {
          ...f.scope,
          instructionId: randomUUID(),
          text: '继续核查：保留未知候选，不重放写入。',
          materials: [],
        });
        await expect
          .poll(async () => (await app.snapshot(f.scope)).run?.state, { timeout: 30000 })
          .toBe('waiting');
        expect(saves).toHaveLength(1);
        expect(f.model.requests).toHaveLength(requests);
      } else {
        expect(saves[1]?.before).toEqual({
          ref: first.result.resource.ref,
          basis: first.result.resource.basis,
        });
        expect(await readFile(join(f.project.path, 'process.md'), 'utf8')).toContain(actualBefore);
      }
    } finally {
      await app.close();
      await f.model.close();
    }
  });
}

test('an ordinary explicit exclusion removes an unread failed source from the trusted next-node scope', async () => {
  let first: ResourceEvidence;
  let second: ResourceEvidence;
  let app: KernelApplication;
  let projectId = '';
  let changed = false;
  let answers = 0;
  const f = await fixture(async ({ calls }) => {
    const reads = calls.filter((name) => name === 'read_context_resource').length;
    if (reads < 2) {
      if (reads === 1 && !changed) {
        await app.call('resources.save', {
          ref: second.ref,
          basis: second.basis,
          content: 'Human changed original B; old basis no longer current.',
        });
        changed = true;
      }
      return {
        tool: {
          name: 'read_context_resource',
          input: { ...(reads ? second : first), encoding: 'utf8', limit: 4096 },
        },
      };
    }
    answers++;
    return {
      text: JSON.stringify({
        process: '按真实普通消息排除未读取的变基来源B，仅使用A；比较覆盖不足仍需补证，不能推广。',
        ...(answers === 2
          ? {
              report:
                '# 缩小范围后的报告\n仅来源A=42，B已明确排除，没有取得其正文；比较未充分，需后续材料。',
            }
          : {}),
        next: answers === 1 ? 'synthesize' : answers === 2 ? 'review' : 'deliver',
      }),
    };
  });
  app = f.app;
  projectId = f.project.id;
  try {
    for (const [path, content] of [
      ['first.txt', 'Original A=42.'],
      ['second.txt', 'Original B=17.'],
    ])
      await app.call('files.save', { projectId, path: path ?? '', content: content ?? '' });
    const a = await app.call('resources.describe', {
      locator: { source: 'project', projectId, path: 'first.txt' },
    });
    const b = await app.call('resources.describe', {
      locator: { source: 'project', projectId, path: 'second.txt' },
    });
    first = { ref: a.ref, basis: a.basis };
    second = { ref: b.ref, basis: b.basis };
    f.input.materials = [first, second];
    await f.start();
    await f.wait('waiting');
    expect((await app.snapshot(f.scope)).run?.graphProgress).toMatchObject({
      kind: 'graph.waiting',
      wait: { nodeKey: 'source-wait' },
    });
    assert(b.ref.source === 'project');
    await app.call('session.send', {
      ...f.scope,
      instructionId: randomUUID(),
      text: `忽略来源 project:${projectId}:${b.ref.fileId}：B已变基且没有取得正文，本次只采用A并保留比较覆盖局限`,
      materials: [],
    });
    await f.wait('completed');
    const view = await app.call('research.graphCalls', {
      ...f.scope,
      invocationId: f.input.invocationId,
    });
    const call = view.calls[0];
    expect(call?.call.materials).toEqual([first, second]);
    expect(call?.executions[0]?.run.graphProgress?.evidence.inputs).toEqual([first]);
    expect(call?.executions[0]?.run.graphProgress?.evidence.reads).toEqual([first]);
    expect(call?.executions[0]?.check.delivery).toBe('usable');
    const process = await readFile(join(f.project.path, 'process.md'), 'utf8');
    expect(process).toContain('B已变基且没有取得正文');
    expect(process).toContain('研究影响');
  } finally {
    await app.close();
    await f.model.close();
  }
});

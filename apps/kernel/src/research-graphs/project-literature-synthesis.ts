import { posix } from 'node:path';
import { HumanMessage, isAIMessage } from '@langchain/core/messages';
import {
  Annotation,
  Command,
  END,
  interrupt,
  MessagesAnnotation,
  START,
  StateGraph,
  task,
} from '@langchain/langgraph';
import type { AgentState, GraphFactory } from '@scholoom/harness/node';
import { callExecutionControl } from '@scholoom/harness/worker';
import { failure } from '@scholoom/platform/node';
import { compileContract, type ErrorInfo, OperationError } from '@scholoom/protocol/core';
import type {
  GraphContentRead,
  GraphProgress,
  GraphResumeInput,
  GraphRoleResult,
  GraphWait,
} from '@scholoom/protocol/execution';
import {
  type TaskGraphInputSnapshot,
  taskGraphInputSnapshotSchema,
} from '@scholoom/protocol/projects';
import type { ResearchGraph } from '@scholoom/protocol/research';
import type {
  ResourceCreationOutputs,
  ResourceEvidence,
  ResourceSaveResult,
} from '@scholoom/protocol/resources';
import { completeTextRead, graphArtifactOperation } from '@scholoom/research/node';
import { z } from 'zod';
import { synthesisConfig, synthesisConfigSchema } from './config.js';
import {
  collectContentReads,
  prepareSynthesisToolResult,
  type SourceFailure,
  sameEvidence,
  sourceKey,
} from './content-reads.js';
import { nodeGuidance, synthesisTools } from './node-guidance.js';
import { linkTaskResearchArtifacts } from './task-navigation.js';

export const projectLiteratureSynthesis: ResearchGraph = {
  definition: {
    graphId: 'scholoom.project-literature-synthesis',
    version: '1',
    stateFormatVersion: '1',
    requiresModel: true,
    configSchema: synthesisConfigSchema,
    waitSchemas: {
      decision: {
        type: 'object',
        properties: {
          action: { enum: ['retry', 'exclude', 'continue'] },
          source: { type: 'string' },
          reason: { type: 'string' },
        },
        required: ['action', 'reason'],
        additionalProperties: false,
      },
    },
  },
  name: '项目定向文献综合',
  description: '按研究问题实际取材、比较和修订，持续保存项目过程与报告，核查交付并等待必要选择。',
  source: 'Scholoom',
  purpose: 'research',
  resources: Object.keys(nodeGuidance).map((nodeKey) => ({
    nodeKey,
    resourceId: 'node-guidance',
    source: 'apps/kernel/src/research-graphs/node-guidance.ts',
  })),
  delivery: { roles: ['report', 'process'], inputReadMode: 'content-ranges' },
};

const nodeOutput = z
  .object({
    process: z.string().trim().min(1).max(196608),
    report: z.string().trim().min(1).max(196608).optional(),
    next: z.enum(['acquire', 'synthesize', 'review', 'deliver', 'wait']),
    prompt: z.string().max(4096).optional(),
  })
  .strict();
type Phase = keyof typeof nodeGuidance;
type PendingSave = {
  role: 'report' | 'process';
  content: string;
  previousResult?: ResourceSaveResult;
} & (
  | { kind: 'create'; operationId: string; path: string }
  | { kind: 'update'; before: ResourceEvidence }
);
const snapshotContract = compileContract({ params: taskGraphInputSnapshotSchema, result: true });
const bodyRead = (read: GraphContentRead) =>
  (read.content.kind === 'text' ||
    read.content.kind === 'document-section' ||
    (read.content.kind === 'pdf-page' && read.content.hasText)) &&
  read.content.length > 0;

export const projectLiteratureSynthesisFactory: GraphFactory = {
  definition: projectLiteratureSynthesis.definition,
  resume(wait, messages) {
    for (const message of messages) {
      const exclusion = /^忽略来源\s+(\S+)\s*[:：]\s*(\S[\s\S]*)$/.exec(message.text.trim());
      const retry = /^重试来源\s+(\S+)\s*[:：]\s*(\S[\s\S]*)$/.exec(message.text.trim());
      const link = /^(?:继续补链|继续核查)\s*[:：]\s*(\S[\s\S]*)$/.exec(message.text.trim());
      const value = exclusion
        ? { action: 'exclude', source: exclusion[1], reason: exclusion[2] }
        : retry
          ? { action: 'retry', source: retry[1], reason: retry[2] }
          : link
            ? { action: 'continue', reason: link[1] }
            : undefined;
      if (
        value &&
        (wait.nodeKey === 'source-wait' ? value.action !== 'continue' : value.action === 'continue')
      )
        return { value, instructionIds: [message.id] };
    }
    return undefined;
  },
  create(input, { peer, signal, checkpointer, agent }) {
    if (!checkpointer || !input.originInstructionId || input.graph.workDomain.kind !== 'project')
      throw new OperationError('invalidRequest', '综合图需要项目、原指令及持久checkpoint。');
    const settings = synthesisConfig.parse(input.graph.config);
    const projectId = input.graph.workDomain.projectId;
    const sessionId = input.graph.workDomain.sessionId;
    const origin = input.originInstructionId;
    for (const target of [settings.reportTarget, settings.processTarget]) {
      if (
        target.kind === 'create' &&
        (target.path.includes('\\') ||
          posix.isAbsolute(target.path) ||
          posix.normalize(target.path).split('/').includes('..') ||
          target.path.startsWith('.scholoom/'))
      )
        throw new OperationError('invalidRequest', '成果路径必须属于当前项目。');
      if (
        target.kind === 'update' &&
        (target.resource.ref.source !== 'project' || target.resource.ref.projectId !== projectId)
      )
        throw new OperationError('permissionDenied', '只能更新当前项目的明确文件。');
    }
    if (
      settings.reportTarget.kind === 'create' &&
      settings.processTarget.kind === 'create' &&
      posix.normalize(settings.reportTarget.path) === posix.normalize(settings.processTarget.path)
    )
      throw new OperationError('invalidRequest', '报告和过程需要独立文件。');
    if (
      settings.reportTarget.kind === 'update' &&
      settings.processTarget.kind === 'update' &&
      sourceKey(settings.reportTarget.resource) === sourceKey(settings.processTarget.resource)
    )
      throw new OperationError('invalidRequest', '报告和过程需要独立文件。');

    const state = Annotation.Root({
      ...MessagesAnnotation.spec,
      instructionIds: Annotation<string[]>(),
      instructionRunId: Annotation<string>(),
      instructions: Annotation<AgentState['instructions']>(),
      graphResume: Annotation<GraphResumeInput>(),
      graphWait: Annotation<GraphWait>(),
      snapshot: Annotation<TaskGraphInputSnapshot | undefined>(),
      sources: Annotation<ResourceEvidence[]>(),
      contentReads: Annotation<GraphContentRead[]>(),
      roleResults: Annotation<GraphRoleResult[]>(),
      creations: Annotation<ResourceCreationOutputs['resources.create'][]>(),
      processText: Annotation<string>(),
      reportText: Annotation<string>(),
      catalog: Annotation<unknown[]>(),
      failures: Annotation<SourceFailure[]>(),
      excluded: Annotation<string[]>(),
      decisions: Annotation<string[]>(),
      handledFailures: Annotation<string[]>(),
      phase: Annotation<Phase>(),
      route: Annotation<string>(),
      turns: Annotation<number>(),
      reviewed: Annotation<boolean>(),
      error: Annotation<ErrorInfo | undefined>(),
      prompt: Annotation<string>(),
      waitKind: Annotation<string>(),
      sourceResume: Annotation<'prepare' | 'acquire'>(),
      navigationOnly: Annotation<boolean>(),
      unknownSave: Annotation<boolean>(),
      pendingSave: Annotation<PendingSave | undefined>(),
      saveQueue: Annotation<PendingSave[]>(),
      afterSave: Annotation<string>(),
      saveWait: Annotation<{ waitKind: string; prompt: string; error?: ErrorInfo } | undefined>(),
    });
    type Value = typeof state.State;
    const read = (resource: ResourceEvidence) =>
      callExecutionControl(peer, 'resources.read', {
        ref: resource.ref,
        basis: resource.basis,
        encoding: 'utf8',
        limit: 262144,
      });
    const custom = async (name: string, args: Record<string, unknown>) => {
      const raw = await callExecutionControl(peer, 'execution.custom', { name, args });
      const value = JSON.parse(raw);
      if (value?.error) throw new OperationError(value.error.code, value.error.message);
      return value;
    };
    const readCatalog = async (snapshot: TaskGraphInputSnapshot | undefined) => {
      const catalog = [];
      for (const source of snapshot?.sources ?? [])
        if ('catalog' in source) {
          const current = await custom('library_get', { sourceId: source.catalog.sourceId });
          if (
            current.id !== source.catalog.sourceId ||
            current.version !== source.catalog.version ||
            current.revision !== source.catalog.revision
          )
            throw new OperationError(
              'contentChanged',
              `题录来源 ${source.catalog.sourceId} 的原身份或版本已变化，请核查后建立新的输入调用。`,
            );
          const attachments = await custom('library_attachments', {
            sourceId: current.id,
            limit: 100,
          });
          catalog.push({ catalog: source.catalog, current, attachments });
        }
      return catalog;
    };
    const observed: Partial<Value> = {};
    const evidence = (value: Value): GraphProgress['evidence'] => {
      const current = { ...value, ...observed };
      const contentReads = (current.contentReads ?? []).filter(
        (item) => !(current.excluded ?? []).includes(sourceKey(item.resource)),
      );
      const reads: ResourceEvidence[] = [];
      for (const item of contentReads.filter(bodyRead))
        if (!reads.some((prior) => sameEvidence(prior, item.resource))) reads.push(item.resource);
      return {
        inputs: current.sources ?? [],
        reads,
        contentReads,
        results: (current.roleResults ?? []).map((item) => item.result),
        roleResults: current.roleResults ?? [],
        creations: current.creations ?? [],
      };
    };
    const saveEffect = task(
      { name: 'save-synthesis-role', retry: { maxAttempts: 1 } },
      async (pending: PendingSave) => {
        let creation: ResourceCreationOutputs['resources.create'] | undefined;
        try {
          const { content } = pending;
          let result: ResourceSaveResult;
          if (pending.kind === 'update') {
            let before: Awaited<ReturnType<typeof read>>;
            try {
              before = await read(pending.before);
            } catch (error) {
              if (failure(error).code === 'contentChanged')
                throw new OperationError(
                  'outcomeUnknown',
                  '原保存依据已变化，需核查本次候选及原写入，不能重放。',
                );
              throw error;
            }
            if (!completeTextRead(before))
              throw new OperationError('tooLarge', '更新目标未完整读回。');
            if (before.data === content && pending.previousResult)
              return { result: pending.previousResult };
            result = await callExecutionControl(peer, 'resources.save', {
              ref: pending.before.ref,
              basis: pending.before.basis,
              content,
            });
          } else {
            const { operationId } = pending;
            try {
              creation = await callExecutionControl(peer, 'resources.creation', {
                projectId,
                operationId,
              });
            } catch (error) {
              if (failure(error).code !== 'notFound') throw error;
              creation = await callExecutionControl(peer, 'resources.create', {
                projectId,
                operationId,
                path: pending.path,
                content,
              });
            }
            if (creation.state !== 'complete')
              throw new OperationError('outcomeUnknown', '原创建操作需要核查，不能重放。');
            result = {
              resource: creation.resource,
              ...(creation.editId ? { editId: creation.editId } : {}),
              ...(creation.association ? { association: creation.association } : {}),
            };
            const saved = await read(result.resource);
            if (!completeTextRead(saved) || saved.data !== content)
              throw new OperationError(
                'outcomeUnknown',
                '原创建已存在，内容与本次候选不同，需核查。',
              );
          }
          return { result, ...(creation ? { creation } : {}) };
        } catch (error) {
          signal.throwIfAborted();
          return { error: failure(error), ...(creation ? { creation } : {}) };
        }
      },
    );
    const acceptSave = (
      value: Value,
      result: ResourceSaveResult,
      creation?: ResourceCreationOutputs['resources.create'],
    ): Partial<Value> => {
      const pending = value.pendingSave;
      if (!pending) throw new OperationError('invalidRequest', '缺少持久保存意图。');
      const { role, content } = pending;
      const roleResults = [
        ...value.roleResults.filter((item) => item.role !== role),
        { role, result },
      ];
      const creations = creation
        ? [...value.creations.filter((item) => item.operationId !== creation.operationId), creation]
        : value.creations;
      observed.roleResults = roleResults;
      observed.creations = creations;
      return {
        roleResults,
        creations,
        pendingSave: value.saveQueue[0],
        saveQueue: value.saveQueue.slice(1),
        unknownSave: false,
        route: value.saveQueue.length ? 'save' : value.afterSave,
        ...(value.saveQueue.length
          ? {}
          : {
              ...(value.afterSave === 'wait' ? value.saveWait : { error: undefined }),
              saveWait: undefined,
            }),
        ...(role === 'process' ? { processText: content } : { reportText: content }),
      };
    };
    const queueSaves = (
      value: Value,
      outputs: { role: 'report' | 'process'; content: string }[],
      afterSave: string,
    ): Partial<Value> => {
      const pending = outputs.map(({ role, content }): PendingSave => {
        const previousResult = value.roleResults.find((item) => item.role === role)?.result;
        const target = role === 'report' ? settings.reportTarget : settings.processTarget;
        const before =
          previousResult?.resource ?? (target.kind === 'update' ? target.resource : undefined);
        return {
          role,
          content,
          ...(previousResult ? { previousResult } : {}),
          ...(before
            ? { kind: 'update', before }
            : {
                kind: 'create',
                operationId: graphArtifactOperation(origin, role),
                path: target.kind === 'create' ? target.path : '',
              }),
        };
      });
      const roleResults = value.roleResults.filter(
        (item) => !outputs.some(({ role }) => role === item.role),
      );
      observed.roleResults = roleResults;
      return {
        pendingSave: pending[0],
        saveQueue: pending.slice(1),
        roleResults,
        afterSave,
        saveWait: undefined,
        route: 'save',
      };
    };
    const processContent = (value: Value, addition: string) => {
      const content = [value.processText, addition].filter(Boolean).join('\n\n');
      if (content.length > 262144)
        throw new OperationError('tooLarge', '过程文件已到容量，请保留当前成果并新建后续调用。');
      return content;
    };
    const pauseSource = async (
      value: Value,
      sourceResume: 'prepare' | 'acquire' = 'acquire',
    ): Promise<Partial<Value>> => {
      const failed = value.failures[0];
      if (!failed) throw new OperationError('invalidRequest', '缺少实际来源错误。');
      const content = processContent(
        value,
        `## 来源读取受阻\n\n${JSON.stringify(value.failures)}\n暂停依赖来源的工作，等待用户明确处理；已读范围：${JSON.stringify(value.contentReads)}。`,
      );
      return {
        ...value,
        ...queueSaves(value, [{ role: 'process', content }], 'wait'),
        waitKind: 'source-wait',
        sourceResume,
        error: failed.error,
        prompt: `来源 ${sourceKey(failed.resource)} 读取失败：${failed.error.message}。依赖该来源的工作已暂停。请发送“重试来源 ${sourceKey(failed.resource)}：处理理由”或“忽略来源 ${sourceKey(failed.resource)}：排除理由”；含糊继续不会改变范围。`,
      };
    };
    const pause = (error: unknown, extra: Partial<Value> = {}): Partial<Value> => {
      signal.throwIfAborted();
      const info = failure(error);
      return {
        ...observed,
        ...extra,
        error: info,
        route: 'wait',
        waitKind: 'delivery-wait',
        unknownSave: info.code === 'outcomeUnknown' && !extra.navigationOnly,
        prompt: `当前工作未完成：${info.message}。保留已保存文件；请核查原操作后发送“继续核查：具体处理说明”。`,
      };
    };
    const excludedOutput = (value: Value, resource: ResourceEvidence) => {
      if (resource.role === 'task-input') return true;
      const targets = [settings.reportTarget, settings.processTarget];
      return (
        input.graph.materials.some(
          (item) => item.role === 'task-input' && sameEvidence(item, resource),
        ) ||
        value.roleResults.some(
          (item) => JSON.stringify(item.result.resource.ref) === JSON.stringify(resource.ref),
        ) ||
        targets.some(
          (target) =>
            target.kind === 'update' &&
            JSON.stringify(target.resource.ref) === JSON.stringify(resource.ref),
        )
      );
    };

    const graph = new StateGraph(state)
      .addNode('prepare', async (value): Promise<Partial<Value>> => {
        try {
          const snapshots = input.graph.materials.filter((item) => item.role === 'task-input');
          if (snapshots.length > 1)
            throw new OperationError('invalidRequest', '任务输入快照必须唯一。');
          let snapshot: TaskGraphInputSnapshot | undefined;
          if (snapshots[0]) {
            const actual = await read(snapshots[0]);
            if (!completeTextRead(actual))
              throw new OperationError('tooLarge', '任务输入快照没有完整读取。');
            const decoded: unknown = JSON.parse(actual.data);
            if (!snapshotContract.params(decoded))
              throw new OperationError('invalidRequest', '任务输入快照不符合v1/v2 schema。');
            snapshot = decoded as TaskGraphInputSnapshot;
            if (
              snapshot.task.projectId !== projectId ||
              snapshot.sessionId !== sessionId ||
              snapshot.instructionId !== origin ||
              snapshot.entry.ref.source !== 'project' ||
              snapshot.entry.ref.projectId !== projectId
            )
              throw new OperationError('permissionDenied', '快照与当前项目、会话或原指令不符。');
            for (const source of snapshot.sources)
              if (
                'evidence' in source &&
                !input.graph.materials.some((item) => sameEvidence(item, source.evidence))
              )
                throw new OperationError('permissionDenied', '快照材料不属于原受理范围。');
            await custom('read_research_task', { task: snapshot.task });
          }
          let processText = value.processText;
          for (const target of [settings.processTarget, settings.reportTarget])
            if (target.kind === 'update') {
              const role = target === settings.processTarget ? 'process' : 'report';
              const before = await read(
                value.roleResults.find((item) => item.role === role)?.result.resource ??
                  target.resource,
              );
              if (!completeTextRead(before))
                throw new OperationError('tooLarge', '更新目标需要完整读取。');
              if (target === settings.processTarget) processText = before.data;
            }
          const catalog = await readCatalog(snapshot);
          for (const source of value.sources) {
            try {
              const descriptor = await callExecutionControl(peer, 'resources.describe', {
                locator: source.ref,
              });
              if (!sameEvidence(descriptor, source))
                throw new OperationError('contentChanged', '原材料已变化。');
            } catch (error) {
              return await pauseSource(
                {
                  ...value,
                  processText,
                  ...(snapshot ? { snapshot } : {}),
                  catalog,
                  failures: [{ resource: source, error: failure(error) }],
                },
                'prepare',
              );
            }
          }
          for (const prior of settings.prior ?? []) {
            if (prior.ref.source !== 'project' || prior.ref.projectId !== projectId)
              throw new OperationError('permissionDenied', '既有成果必须属于当前项目。');
            const descriptor = await callExecutionControl(peer, 'resources.describe', {
              locator: prior.ref,
            });
            if (!sameEvidence(descriptor, prior))
              throw new OperationError('contentChanged', '指定既有成果已变化。');
          }
          const prepared = { ...value, processText, ...(snapshot ? { snapshot } : {}), catalog };
          const content = processContent(
            prepared,
            `# 本次文献综合\n\n研究问题：${settings.question}\n约束：${settings.constraints ?? '无附加约束'}\n原指令：${origin}\n来源范围：${JSON.stringify(value.sources)}\n题录条件：${JSON.stringify(catalog)}\n下一步：按原身份实际取材、比较，独立复核要求：${settings.requireIndependentReview}。`,
          );
          return {
            ...queueSaves(prepared, [{ role: 'process', content }], 'acquire'),
            ...(snapshot ? { snapshot } : {}),
            catalog,
            error: undefined,
          };
        } catch (error) {
          return pause(error);
        }
      })
      .addNode('acquire', (value, config) => runAgent(value, config, 'acquire'))
      .addNode('synthesize', (value, config) => runAgent(value, config, 'synthesize'))
      .addNode('review', (value, config) => runAgent(value, config, 'review'))
      .addNode('save', async (value): Promise<Partial<Value>> => {
        try {
          if (!value.pendingSave) throw new OperationError('invalidRequest', '缺少持久保存意图。');
          const saved = await saveEffect(value.pendingSave);
          if ('error' in saved) {
            const creation = saved.creation;
            if (creation)
              observed.creations = [
                ...value.creations.filter((item) => item.operationId !== creation.operationId),
                creation,
              ];
            throw new OperationError(saved.error.code, saved.error.message);
          }
          return acceptSave(value, saved.result, saved.creation);
        } catch (error) {
          return {
            ...pause(error),
            ...(value.afterSave === 'wait'
              ? {
                  saveWait: value.saveWait ?? {
                    waitKind: value.waitKind,
                    prompt: value.prompt,
                    ...(value.error ? { error: value.error } : {}),
                  },
                }
              : {}),
          };
        }
      })
      .addNode('deliver', async (value): Promise<Partial<Value>> => {
        try {
          await readCatalog(value.snapshot);
          if (settings.requireIndependentReview)
            return {
              route: 'wait',
              waitKind: 'review-wait',
              prompt:
                '本次明确要求独立复核，尚未实际完成。保留已保存的阶段成果；同一执行自查不能替代，请完成独立复核后另行核查。',
            };
          const facts = evidence(value);
          const missing = value.sources.filter(
            (source) =>
              !facts.contentReads?.some(
                (item) => sameEvidence(item.resource, source) && bodyRead(item),
              ),
          );
          if (!value.sources.length || missing.length) {
            if (value.turns < 12) return { route: 'acquire', phase: 'acquire' };
            throw new OperationError('resourceLimit', '必要正文未取得，已到图迭代上限。');
          }
          if (!value.reviewed) return { route: 'review' };
          for (const source of facts.reads)
            await callExecutionControl(peer, 'resources.read', {
              ref: source.ref,
              basis: source.basis,
              encoding: 'base64',
              limit: 1,
            });
          for (const role of ['process', 'report']) {
            const result = value.roleResults.find((item) => item.role === role)?.result;
            if (!result) return { route: role === 'report' ? 'synthesize' : 'acquire' };
            const actual = await read(result.resource);
            if (
              !result.editId ||
              result.association?.state !== 'confirmed' ||
              !completeTextRead(actual) ||
              !actual.data.trim()
            )
              throw new OperationError('unavailable', '成果保存、关联或当前完整读回未确认。');
          }
          if (value.snapshot) {
            const linked = await linkTaskResearchArtifacts(
              peer,
              value.snapshot,
              value.roleResults.filter(
                (item): item is GraphRoleResult & { role: 'report' | 'process' } =>
                  item.role === 'report' || item.role === 'process',
              ),
            );
            if (linked.state !== 'confirmed')
              return pause(new OperationError(linked.error.code, linked.error.message), {
                navigationOnly: true,
              });
          }
          return { route: 'done', error: undefined };
        } catch (error) {
          return pause(error);
        }
      })
      .addNode('wait', async (value): Promise<Partial<Value>> => {
        const choice = interrupt({ prompt: value.prompt, kind: value.waitKind }) as {
          action: string;
          source?: string;
          reason: string;
        };
        if (value.waitKind === 'review-wait') return { route: 'wait' };
        if (value.unknownSave) {
          if (value.pendingSave?.kind !== 'create')
            return {
              route: 'wait',
              prompt:
                '原更新保存回执未知，不能重放或用当前同文认定成功。请核查原文件编辑及保存归属，保留候选后另行明确接续。',
            };
          try {
            const pending = value.pendingSave;
            const operationId = pending.operationId;
            const creation = await callExecutionControl(peer, 'resources.creation', {
              projectId,
              operationId,
            });
            const creations = [
              ...value.creations.filter((item) => item.operationId !== operationId),
              creation,
            ];
            observed.creations = creations;
            if (
              creation.state !== 'complete' ||
              !creation.editId ||
              creation.association?.state !== 'confirmed'
            )
              return { creations, route: 'wait' };
            const actual = await read(creation.resource);
            if (!completeTextRead(actual) || actual.data !== pending.content)
              return { creations, route: 'wait' };
            const result: ResourceSaveResult = {
              resource: creation.resource,
              editId: creation.editId,
              association: creation.association,
            };
            return acceptSave(value, result, creation);
          } catch (error) {
            return pause(error);
          }
        }
        if (value.pendingSave)
          return {
            route:
              choice.action === 'continue' &&
              value.error &&
              [
                'permissionDenied',
                'invalidRequest',
                'notFound',
                'tooLarge',
                'contentChanged',
              ].includes(value.error.code)
                ? 'save'
                : 'wait',
          };
        const pending = value.failures.find((item) => sourceKey(item.resource) === choice.source);
        if (
          value.waitKind === 'source-wait' &&
          (!pending || !['exclude', 'retry'].includes(choice.action))
        )
          return { route: 'wait' };
        const decision = `用户普通消息决定：${JSON.stringify(choice)}\n适用原错误：${JSON.stringify(pending ?? value.error)}\n研究影响：${choice.action === 'exclude' ? '明确缩小本次依据范围，该来源不再支撑当前结论，需重新核查比较和覆盖局限。' : '核查原身份后继续，不替换来源或盲重放保存。'}`;
        try {
          const excluded =
            choice.action === 'exclude' && choice.source
              ? [...value.excluded, choice.source]
              : value.excluded;
          const sources =
            choice.action === 'exclude'
              ? value.sources.filter((source) => sourceKey(source) !== choice.source)
              : value.sources;
          const contentReads = value.contentReads.filter(
            (item) => !excluded.includes(sourceKey(item.resource)),
          );
          return {
            ...queueSaves(
              value,
              [{ role: 'process', content: processContent(value, decision) }],
              value.navigationOnly
                ? 'deliver'
                : value.waitKind === 'source-wait'
                  ? value.sourceResume
                  : 'prepare',
            ),
            excluded,
            sources,
            contentReads,
            failures: [],
            decisions: [...value.decisions, decision],
            handledFailures: [
              ...value.handledFailures,
              ...value.failures
                .filter((item) => sourceKey(item.resource) === choice.source)
                .flatMap((item) => (item.toolCallId ? [item.toolCallId] : [])),
            ],
            error: undefined,
            reviewed: value.navigationOnly ? value.reviewed : false,
          };
        } catch (error) {
          return pause(error);
        }
      })
      .addEdge(START, 'prepare');

    const allowed = [
      'prepare',
      'acquire',
      'synthesize',
      'review',
      'save',
      'deliver',
      'wait',
      'done',
    ] as const;
    for (const node of [
      'prepare',
      'acquire',
      'synthesize',
      'review',
      'save',
      'deliver',
      'wait',
    ] as const)
      graph.addConditionalEdges(
        node,
        (value) =>
          value.route === 'done' ? END : (value.route as Exclude<(typeof allowed)[number], 'done'>),
        ['prepare', 'acquire', 'synthesize', 'review', 'save', 'deliver', 'wait', END],
      );
    const compiled = graph.compile({ checkpointer });
    const config = {
      configurable: { thread_id: input.attemptId },
      durability: 'sync' as const,
      signal,
      callbacks: [],
      recursionLimit: 100,
    };

    async function runAgent(
      value: Value,
      nodeConfig: Parameters<typeof agent.invoke>[1],
      phase: Phase,
    ): Promise<Partial<Value>> {
      if (value.turns >= 12)
        return {
          route: 'done',
          error: { code: 'resourceLimit', message: '已到12次业务节点迭代上限，保留部分成果。' },
        };
      let current = value;
      let consumerPending = false;
      try {
        const catalog = await readCatalog(value.snapshot);
        let calls = collectContentReads(value.messages).toolCalls;
        consumerPending = true;
        const actual = await agent.invoke(value, nodeConfig, {
          tools: synthesisTools,
          materials: [
            ...value.sources,
            ...input.graph.materials.filter((item) => item.role === 'task-input'),
          ],
          systemPrompt: `${nodeGuidance[phase]}\n本次目标及明确旧成果：${JSON.stringify(settings)}\n当前有效来源：${JSON.stringify(value.sources)}\n题录及附件条件：${JSON.stringify(catalog)}\n已保存角色：${JSON.stringify(value.roleResults)}\n明确用户决定：${JSON.stringify(value.decisions)}\n当前职责：${phase}`,
          prepareToolResult(name, args, result) {
            if (++calls > 96)
              throw new OperationError(
                'resourceLimit',
                '已到96次工具调用上限，保存部分成果后停止。',
              );
            return prepareSynthesisToolResult(name, args, result);
          },
        });
        consumerPending = false;
        const collected = collectContentReads(actual.messages);
        const contentReads = collected.contentReads.filter(
          (item) =>
            !excludedOutput(value, item.resource) &&
            !value.excluded.includes(sourceKey(item.resource)),
        );
        const sources = [...value.sources];
        for (const item of contentReads)
          if (bodyRead(item) && !sources.some((source) => sameEvidence(source, item.resource)))
            sources.push(item.resource);
        current = {
          ...value,
          ...actual,
          sources,
          contentReads,
          turns: value.turns + 1,
          phase,
          reviewed: phase === 'review',
          failures: collected.failures.filter(
            (item) =>
              !value.excluded.includes(sourceKey(item.resource)) &&
              (!item.toolCallId || !value.handledFailures.includes(item.toolCallId)),
          ),
        };
        Object.assign(observed, { contentReads, sources });
        if (current.failures.length) {
          return await pauseSource(current);
        }
        const last = [...actual.messages].reverse().find(isAIMessage);
        const text =
          typeof last?.content === 'string'
            ? last.content
            : (last?.content
                .filter((block) => block.type === 'text')
                .map((block) => block.text)
                .join('') ?? '');
        const parsed = nodeOutput.safeParse(
          JSON.parse(text.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '')),
        );
        if (!parsed.success)
          throw new OperationError('invalidRequest', '节点没有返回可保存的研究过程和明确下一步。');
        const content = processContent(
          current,
          `## ${phase}\n\n${parsed.data.process}\n\n实际读取范围：${JSON.stringify(contentReads)}${current.failures.length ? `\n来源错误：${JSON.stringify(current.failures)}` : ''}`,
        );
        let route: string = parsed.data.next;
        if (phase === 'acquire' && ['review', 'deliver'].includes(route)) route = 'synthesize';
        if (phase === 'synthesize' && route === 'deliver') route = 'review';
        return {
          ...current,
          ...queueSaves(
            current,
            [
              { role: 'process', content },
              ...(parsed.data.report
                ? [{ role: 'report' as const, content: parsed.data.report }]
                : []),
            ],
            route,
          ),
          ...(route === 'wait'
            ? {
                waitKind: 'decision-wait',
                prompt:
                  parsed.data.prompt ?? '请明确本次研究目标或材料范围后发送“继续核查：具体决定”。',
              }
            : {}),
          error: undefined,
        };
      } catch (error) {
        if (
          ['resourceLimit', 'contentChanged', 'permissionDenied', 'unavailable'].includes(
            failure(error).code,
          )
        ) {
          const child = await checkpointer?.getTuple(nodeConfig);
          const messages = child?.checkpoint.channel_values.messages as
            | AgentState['messages']
            | undefined;
          if (messages) {
            const collected = collectContentReads(messages);
            const contentReads = collected.contentReads.filter(
              (item) =>
                !excludedOutput(value, item.resource) &&
                !value.excluded.includes(sourceKey(item.resource)),
            );
            observed.contentReads = contentReads;
            const sources = [...current.sources];
            for (const item of contentReads)
              if (bodyRead(item) && !sources.some((source) => sameEvidence(source, item.resource)))
                sources.push(item.resource);
            observed.sources = sources;
            current = {
              ...current,
              contentReads,
              sources,
              failures: collected.failures.filter(
                (item) =>
                  !value.excluded.includes(sourceKey(item.resource)) &&
                  (!item.toolCallId || !value.handledFailures.includes(item.toolCallId)),
              ),
            };
            if (current.failures.length) {
              if (consumerPending) {
                const channels = child?.checkpoint.channel_values;
                if (
                  channels?.instructionRunId !== input.attemptId ||
                  !Array.isArray(channels.instructionIds) ||
                  !Array.isArray(channels.instructions)
                )
                  throw error;
                await checkpointer?.confirmLatest(nodeConfig);
                current = {
                  ...current,
                  messages,
                  instructionRunId: channels.instructionRunId,
                  instructionIds: channels.instructionIds as string[],
                  instructions: channels.instructions as AgentState['instructions'],
                };
              }
              return pauseSource(current);
            }
          }
          if (!consumerPending && failure(error).code === 'resourceLimit')
            return { ...current, ...observed, route: 'done', error: failure(error) };
        }
        // Preserve the original task/root until the shared consumer returns complete channels.
        if (consumerPending) throw error;
        return { ...current, ...pause(error) };
      }
    }

    let finished: { done: true; graph: GraphProgress } | undefined;
    return {
      'execution.next': async () => {
        if (finished) return finished;
        let error: ErrorInfo | undefined;
        try {
          const before = await compiled.getState(config);
          if (input.input) {
            const instructions = new Map<string, AgentState['instructions'][number]>(
              [...(before.values.instructions ?? []), ...(input.instructions ?? [])].map((item) => [
                item.instructionId,
                item,
              ]),
            );
            await checkpointer.bindGraph(config, {
              instructionIds: [...instructions.keys()],
              graphResume: input.input,
            });
            const waiting = before.tasks.flatMap((task) => task.interrupts ?? []);
            await compiled.invoke(
              waiting.some((item) => item.id === input.input?.waitId)
                ? new Command({
                    resume: { [input.input.waitId]: input.input.value },
                    update: {
                      instructions: [...instructions.values()],
                      messages: (input.instructions ?? []).map(
                        (item) =>
                          new HumanMessage({ id: item.instructionId, content: item.text ?? '' }),
                      ),
                    },
                  })
                : null,
              config,
            );
          } else
            await compiled.invoke(
              before.createdAt
                ? null
                : {
                    messages: (input.instructions ?? []).map(
                      (item) =>
                        new HumanMessage({ id: item.instructionId, content: item.text ?? '' }),
                    ),
                    instructionIds: input.instructionIds ?? [],
                    instructionRunId: input.attemptId,
                    instructions: input.instructions ?? [],
                    sources: input.graph.materials.filter((item) => item.role !== 'task-input'),
                    contentReads: [],
                    roleResults: [],
                    creations: [],
                    processText: '',
                    reportText: '',
                    catalog: [],
                    failures: [],
                    excluded: [],
                    decisions: [],
                    handledFailures: [],
                    turns: 0,
                    reviewed: false,
                    phase: 'acquire',
                    route: 'prepare',
                    navigationOnly: false,
                    unknownSave: false,
                    saveQueue: [],
                  },
              config,
            );
        } catch (caught) {
          signal.throwIfAborted();
          error = failure(caught);
        }
        const current = await compiled.getState(config);
        const value = current.values as Value;
        const actualEvidence = evidence(value);
        const pending = current.tasks.flatMap((task) => task.interrupts ?? [])[0];
        let progress: GraphProgress;
        if (error)
          progress = {
            kind: 'graph.failed',
            attemptId: input.attemptId,
            error,
            evidence: actualEvidence,
          };
        else if (pending?.id) {
          const wait: GraphWait = {
            attemptId: input.attemptId,
            waitId: pending.id,
            nodeKey: value.waitKind,
            inputSchemaRef: 'decision',
            prompt: value.prompt,
            checkpointRef: input.checkpointRef ?? input.attemptId,
          };
          await checkpointer.bindGraph(config, { graphWait: wait });
          progress = { kind: 'graph.waiting', wait, evidence: actualEvidence };
        } else if (value.error || value.route !== 'done')
          progress = {
            kind: 'graph.failed',
            attemptId: input.attemptId,
            error: value.error ?? { code: 'unavailable', message: '综合图尚未完成。' },
            evidence: actualEvidence,
          };
        else
          progress = {
            kind: 'graph.completed',
            attemptId: input.attemptId,
            evidence: actualEvidence,
          };
        finished = { done: true, graph: progress };
        return finished;
      },
    };
  },
};

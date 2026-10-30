import { isDeepStrictEqual } from 'node:util';
import { type BaseMessage, isAIMessage, isToolMessage } from '@langchain/core/messages';
import { compileContract, type ErrorInfo, isErrorInfo } from '@scholoom/protocol/core';
import type { GraphContentRead } from '@scholoom/protocol/execution';
import {
  type ResourceDocumentOutputs,
  type ResourceEvidence,
  type ResourceOutputs,
  resourceDocumentContracts,
  resourceEvidenceSchema,
  resourceOperations,
} from '@scholoom/protocol/resources';

export const sameEvidence = (a: ResourceEvidence, b: ResourceEvidence) =>
  a.basis === b.basis && isDeepStrictEqual(a.ref, b.ref);
export const sourceKey = ({ ref }: ResourceEvidence): string =>
  ref.source === 'library'
    ? `library:${ref.attachmentId}:${ref.materialVersionId}`
    : ref.source === 'project'
      ? `project:${ref.projectId}:${ref.fileId}`
      : `render:${ref.projectId}:${ref.outputId}`;

const evidenceContract = compileContract({ params: resourceEvidenceSchema, result: true });
const textContract = compileContract(resourceOperations['resources.read']);
const pageContract = compileContract(resourceDocumentContracts.readPdfPage);
const sectionContract = compileContract(resourceDocumentContracts.readDocumentSection);

/** Preserve small replies byte for byte, before the SDK can replace them with a path. */
export function prepareSynthesisToolResult(
  _name: string,
  _args: Record<string, unknown>,
  result: string,
): string {
  const tooLarge = () =>
    JSON.stringify({
      error: {
        code: 'tooLarge',
        message: '正文最多4096 UTF16字符，完整返回最多32KiB；请缩小读取范围。',
      },
    });
  if (Buffer.byteLength(result, 'utf8') > 32768) return tooLarge();
  let value: unknown;
  try {
    value = JSON.parse(result);
  } catch {
    return result;
  }
  if (
    value &&
    typeof value === 'object' &&
    (('data' in value && typeof value.data === 'string' && value.data.length > 4096) ||
      ('text' in value && typeof value.text === 'string' && value.text.length > 4096))
  )
    return tooLarge();
  return result;
}

export type SourceFailure = { resource: ResourceEvidence; error: ErrorInfo; toolCallId: string };

/** Rebuild consumption from durable ToolMessages, including results restored inside a child task. */
export function collectContentReads(messages: readonly BaseMessage[]): {
  contentReads: GraphContentRead[];
  failures: SourceFailure[];
  toolCalls: number;
} {
  const calls = new Map<string, { name: string; args: Record<string, unknown> }>();
  const contentReads: GraphContentRead[] = [];
  const failures: SourceFailure[] = [];
  let toolCalls = 0;
  for (const message of messages) {
    if (isAIMessage(message)) {
      for (const call of message.tool_calls ?? []) {
        toolCalls++;
        if (call.id) calls.set(call.id, call);
      }
    }
    if (!isToolMessage(message)) continue;
    const call = calls.get(message.tool_call_id);
    if (!call || !['read_context_resource', 'read_context_document'].includes(call.name)) continue;
    const resource = { ref: call.args.ref, basis: call.args.basis };
    if (!evidenceContract.params(resource)) continue;
    const evidence = resource as ResourceEvidence;
    let value: unknown;
    const raw =
      typeof message.content === 'string'
        ? message.content
        : message.content.map((block) => (block.type === 'text' ? block.text : '')).join('');
    try {
      value = JSON.parse(raw as string);
    } catch {
      continue;
    }
    if (value && typeof value === 'object' && 'error' in value && isErrorInfo(value.error)) {
      // Capacity errors request a narrower read; they are not broken source identities.
      if (value.error.code !== 'tooLarge')
        failures.push({ resource: evidence, error: value.error, toolCallId: message.tool_call_id });
      continue;
    }
    if (prepareSynthesisToolResult(call.name, call.args, raw as string) !== raw) continue;
    let content: GraphContentRead['content'] | undefined;
    if (call.name === 'read_context_resource' && textContract.result(value)) {
      const read = value as ResourceOutputs['resources.read'];
      if (!sameEvidence(evidence, read)) continue;
      content = {
        kind: read.unit === 'utf16' ? 'text' : 'bytes',
        offset: read.offset,
        length: read.unit === 'utf16' ? read.data.length : Buffer.from(read.data, 'base64').length,
        size: read.size,
        truncated: read.truncated,
        ...(read.nextOffset !== undefined ? { nextOffset: read.nextOffset } : {}),
      };
    } else if (call.name === 'read_context_document') {
      const method = (call.args.request as { method?: string } | undefined)?.method;
      if (method === 'readPdfPage' && pageContract.result(value)) {
        const read = value as ResourceDocumentOutputs['readPdfPage'];
        content = {
          kind: 'pdf-page',
          offset: read.offset,
          length: read.text.length,
          pageIndex: read.pageIndex,
          hasText: read.hasText,
          ...(read.nextOffset !== undefined ? { nextOffset: read.nextOffset } : {}),
        };
      } else if (method === 'readDocumentSection' && sectionContract.result(value)) {
        const read = value as ResourceDocumentOutputs['readDocumentSection'];
        content = {
          kind: 'document-section',
          offset: read.offset,
          length: read.text.length,
          size: read.length,
          sectionId: read.sectionId,
          normalizationVersion: read.normalizationVersion,
          ...(read.nextOffset !== undefined ? { nextOffset: read.nextOffset } : {}),
        };
      } else if (method === 'pdfInfo' || method === 'documentInfo') content = { kind: 'directory' };
      else if (method === 'searchDocument') content = { kind: 'search' };
    }
    if (content) contentReads.push({ resource: evidence, content });
  }
  return { contentReads, failures, toolCalls };
}

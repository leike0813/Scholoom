import { isAIMessage, isToolMessage } from '@langchain/core/messages';
import { OperationError } from '@scholoom/protocol/core';
import type { AgentState } from './graph-registry.js';

const invalid = () =>
  new OperationError('invalidRequest', '节点未提交唯一完整且符合约定的JSON结果。');

/** Read a transient SDK result or its exact terminal receipt, including older text checkpoints. */
export function readStructuredResult(
  value: Pick<AgentState, 'messages' | 'structuredResponse'>,
  name: string,
): unknown {
  if (value.structuredResponse !== undefined) return value.structuredResponse;
  const [request, receipt, ending] = value.messages.slice(-3);
  const calls = request && isAIMessage(request) ? request.tool_calls : undefined;
  const call = calls?.[0];
  if (
    calls?.length === 1 &&
    call?.name === name &&
    receipt &&
    isToolMessage(receipt) &&
    receipt.name === name &&
    receipt.tool_call_id === call.id &&
    receipt.status !== 'error' &&
    typeof receipt.content === 'string' &&
    ending &&
    isAIMessage(ending) &&
    !ending.tool_calls?.length
  ) {
    try {
      return JSON.parse(receipt.content);
    } catch {
      throw invalid();
    }
  }
  const last = value.messages.at(-1);
  if (!last || !isAIMessage(last) || last.tool_calls?.length) throw invalid();
  const text =
    typeof last.content === 'string'
      ? last.content
      : last.content
          .filter((block) => block.type === 'text')
          .map((block) => block.text)
          .join('');
  const fences = [...text.matchAll(/^```(?:json)?[^\S\r\n]*\r?\n([\s\S]*?)^```[^\S\r\n]*$/gm)];
  const fenced =
    fences.length === 1 && [...text.matchAll(/^ {0,3}(?:`{3,}|~{3,}).*$/gm)].length === 2;
  try {
    return JSON.parse(
      text.trimStart().startsWith('{') ? text : fenced ? (fences[0]?.[1] ?? text) : text,
    );
  } catch {
    throw invalid();
  }
}

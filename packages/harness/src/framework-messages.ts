import { type BaseMessage, mapStoredMessageToChatMessage } from '@langchain/core/messages';
import { compileContract, OperationError } from '@scholoom/protocol/core';
import { type FrameworkMessage, frameworkMessageSchema } from '@scholoom/protocol/execution';

const validate = compileContract({ params: frameworkMessageSchema, result: true }).params;
export function encodeFrameworkMessage(message: BaseMessage): FrameworkMessage {
  const value: unknown = message.toDict();
  if (!isFrameworkMessage(value))
    throw new OperationError('outcomeUnknown', '框架消息不符合契约。');
  return value;
}
function isFrameworkMessage(value: unknown): value is FrameworkMessage {
  return validate(value) === true;
}
export function decodeFrameworkMessage(value: FrameworkMessage): BaseMessage {
  // The SDK types predate block content and omit fields that its own serializer leaves optional.
  return mapStoredMessageToChatMessage(
    value as unknown as Parameters<typeof mapStoredMessageToChatMessage>[0],
  );
}

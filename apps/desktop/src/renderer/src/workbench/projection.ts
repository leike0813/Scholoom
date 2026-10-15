import type { ThreadMessageLike } from '@assistant-ui/react';
import type { Message } from '@scholoom/protocol';

export function toThreadMessage(message: Message): ThreadMessageLike {
  const common = { id: message.id, createdAt: new Date(message.createdAt) };
  if (message.role === 'user') {
    const state = message.state === 'accepted' ? '已受理' : '已消费';
    return {
      ...common,
      role: 'user',
      content:
        message.text +
        '\n（' +
        state +
        '）' +
        (message.materials.length ? `\n附加材料：${message.materials.join('、')}` : ''),
    };
  }
  const status =
    message.state === 'streaming'
      ? { type: 'running' as const }
      : message.state === 'error'
        ? { type: 'incomplete' as const, reason: 'error' as const }
        : { type: 'complete' as const, reason: 'stop' as const };
  if (message.role === 'tool') {
    return {
      ...common,
      role: 'assistant',
      status,
      content: [
        {
          type: 'tool-call',
          toolCallId: message.id,
          toolName: '项目工具',
          args: { operation: message.text },
          isError: message.state === 'error',
          ...(message.state === 'complete' ? { result: message.text } : {}),
        },
        { type: 'text', text: message.text },
      ],
    };
  }
  return {
    ...common,
    role: 'assistant',
    status,
    content:
      message.text +
      (message.materials.length ? `\n实际使用材料：${message.materials.join('、')}` : ''),
  };
}

import { failure } from '@scholoom/platform/node';
import { type ErrorInfo, OperationError } from '@scholoom/protocol/core';
import {
  fileChangeOperations,
  type HarnessProjectPort,
  type ProjectsInputs,
} from '@scholoom/protocol/projects';

export function createFileChangeTools({
  port,
  projectId,
  check,
  onError,
}: {
  port: Pick<HarnessProjectPort, 'files.changes' | 'files.edit'>;
  projectId: string;
  check: () => void;
  onError: (error: ErrorInfo) => void;
}) {
  function tool<Input extends { projectId: string }>(
    name: string,
    description: string,
    schema: object,
    call: (input: Input) => Promise<unknown>,
  ) {
    return {
      name,
      description,
      schema,
      func: async (input: Input) => {
        try {
          check();
          if (projectId === 'application' || input.projectId !== projectId)
            throw new OperationError('permissionDenied', '修改历史工具只读取当前项目。');
          const result = await call(input);
          check();
          return JSON.stringify(result);
        } catch (error) {
          const info = failure(error);
          onError(info);
          return JSON.stringify({ error: info });
        }
      },
    };
  }
  return [
    tool(
      'get_file_changes',
      '按稳定fileId读取有界修改摘要。检查coverage与未知来源；旧锚点缺失不能解释为没有变化。来源只证明系统动作，不能当科研原因或已消费。',
      fileChangeOperations['files.changes'].params,
      (input: ProjectsInputs['files.changes']) => port['files.changes'](input),
    ),
    tool(
      'read_file_edit',
      '读取指定文件的一条实际FileEdit及已记录来源、依据和撤销关联。旧历史无来源即未知，不从正文或会话猜作者。',
      fileChangeOperations['files.edit'].params,
      (input: ProjectsInputs['files.edit']) => port['files.edit'](input),
    ),
  ];
}

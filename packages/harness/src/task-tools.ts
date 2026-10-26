import { failure } from '@scholoom/platform/node';
import { type ErrorInfo, OperationError } from '@scholoom/protocol/core';
import { type ProjectTaskInputs, type TaskPort, taskOperations } from '@scholoom/protocol/projects';
import {
  type ExecutionResourcePort,
  type ResourceCreationInputs,
  resourceCreationOperations,
} from '@scholoom/protocol/resources';

type TaskToolInput =
  | ProjectTaskInputs[keyof ProjectTaskInputs]
  | ResourceCreationInputs['resources.creation'];

export function createTaskTools({
  port,
  resources,
  projectId,
  check,
  onError,
}: {
  port: TaskPort;
  resources: Pick<ExecutionResourcePort, 'creation'>;
  projectId: string;
  check: () => void;
  onError?: (error: ErrorInfo) => void;
}) {
  function tool<const Name extends string, Input extends TaskToolInput>(
    name: Name,
    description: string,
    schema: object,
    call: (input: Input) => Promise<unknown>,
  ) {
    return {
      name,
      description,
      schema,
      func: async (input: Input): Promise<string> => {
        try {
          check();
          const requested = 'task' in input ? input.task.projectId : input.projectId;
          if (projectId === 'application' || requested !== projectId)
            throw new OperationError('permissionDenied', '任务工具仅允许当前项目工作域。');
          const result = await call(input);
          check();
          return JSON.stringify(result);
        } catch (error) {
          const info = failure(error);
          onError?.(info);
          return JSON.stringify({ error: info });
        }
      },
    };
  }

  return [
    tool(
      'list_research_tasks',
      '分页发现当前项目任务摘要；默认分页参数由原任务端口处理。摘要不是正文，继续工作前先 read_research_task 读取入口及依据；歧义时询问用户，不按名称猜测。',
      taskOperations['tasks.list'].params,
      (input: ProjectTaskInputs['tasks.list']) => port.list({ ...input, projectId }),
    ),
    tool(
      'read_research_task',
      '按当前项目任务及入口文件身份读取正文和依据，再按需读取引用来源。来源错误按材料引用行为矩阵暂停依赖工作，询问并等待用户选择；不自动重试、忽略或替代来源，删除事实不可查时明确报告。',
      taskOperations['tasks.read'].params,
      (input: ProjectTaskInputs['tasks.read']) =>
        port.read({ ...input, task: { ...input.task, projectId } }),
    ),
    tool(
      'create_research_task',
      '仅在用户明确要求或确认建议后创建当前项目任务，不因能力调用自动创建。先检查已有任务，使用稳定 operationId；结果未知时用 read_task_creation 查询原操作，不重试创建或另建替身。',
      taskOperations['tasks.create'].params,
      (input: ProjectTaskInputs['tasks.create']) => port.create({ ...input, projectId }),
    ),
    tool(
      'save_research_task',
      '先 read_research_task 取得当前入口及 basis，再保存完整候选。过程和成果先保存为实际文件，再更新入口关联；关联失败保留文件，重读后补缺失关系，不重新生成。执行结束不自动完成任务，完成须保存明确判断与依据；冲突或结果未知时核查，不自动重试。来源错误按材料引用行为矩阵暂停询问并等待选择，不替代来源。',
      taskOperations['tasks.save'].params,
      (input: ProjectTaskInputs['tasks.save']) =>
        port.save({ ...input, task: { ...input.task, projectId } }),
    ),
    tool(
      'read_task_creation',
      '创建回执未知时以原 operationId 查询当前项目 resources.creation，保留原状态及错误；查询不重复创建，不换身份或替代入口。',
      resourceCreationOperations['resources.creation'].params,
      (input: ResourceCreationInputs['resources.creation']) =>
        resources.creation({ ...input, projectId }),
    ),
  ];
}

import type { ProgramToolsPort } from '@scholoom/protocol/programs';
import { programsOperations } from '@scholoom/protocol/programs';
import { z } from 'zod';

/** Tools use the same project operations as the manual workbench. */
export function programTools(port: ProgramToolsPort) {
  return [
    {
      name: 'list_program_environments',
      description: '分页读取当前项目已经登记的程序环境；查询不安装依赖。',
      schema: programsOperations['programs.environments'].params,
      func: port['programs.environments'],
    },
    {
      name: 'start_project_program',
      description:
        '在当前可信项目运行明确的JS/MJS或Python文件。先取得实际资源依据，声明输入和输出；默认随本执行收尾。后台移交仅由用户在运行面板明确操作。',
      schema: programsOperations['programs.start'].params,
      func: port['programs.start'],
    },
    {
      name: 'read_program_run',
      description: '按持久运行身份或原操作身份读取真实状态、退出、停止及输出事实。',
      schema: programsOperations['programs.run'].params,
      func: port['programs.run'],
    },
    {
      name: 'list_program_runs',
      description: '分页发现当前项目的实际程序运行记录。',
      schema: programsOperations['programs.runs'].params,
      func: port['programs.runs'],
    },
    {
      name: 'read_program_logs',
      description:
        '按顺序游标读取有界日志，注意truncatedBefore；等待结束和没有日志都不表示程序失败。',
      schema: programsOperations['programs.logs'].params,
      func: port['programs.logs'],
    },
    {
      name: 'cancel_project_program',
      description: '请求停止程序及后代，继续查询直到完整停止确认；保留实际输出。',
      schema: programsOperations['programs.cancel'].params,
      func: port['programs.cancel'],
    },
    {
      name: 'reconcile_program_outputs',
      description: '仅核查原运行及明确输出，不重跑或重新写入结果。',
      schema: programsOperations['programs.reconcile'].params,
      func: port['programs.reconcile'],
    },
    {
      name: 'plan_program_environment',
      description: '为已登记环境提出锁定准备计划。不会自行授权或安装。',
      schema: programsOperations['programs.environmentPlan'].params,
      func: port['programs.environmentPlan'],
    },
    {
      name: 'read_program_environment_plan',
      description: '读取环境准备计划、来源及所需授权。',
      schema: programsOperations['programs.environmentPlanStatus'].params,
      func: port['programs.environmentPlanStatus'],
    },
    {
      name: 'prepare_program_environment',
      description: '仅消费人类已经明确批准的计划准备受管环境，失败时核查，不能自批安装。',
      schema: programsOperations['programs.environmentPrepare'].params,
      func: port['programs.environmentPrepare'],
    },
  ].map((definition) => ({
    ...definition,
    schema: z.fromJSONSchema(JSON.parse(JSON.stringify(definition.schema))),
    func: async (input: unknown) => JSON.stringify(await definition.func(input as never)),
  }));
}

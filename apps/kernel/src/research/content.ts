import { readFile } from 'node:fs/promises';
import { isResearchMethod, type ResearchMethod } from '@scholoom/protocol';
import { OperationError } from '../errors.js';

const directory = new URL('./builtin/material-analysis/', import.meta.url);

export class ResearchContent {
  async discover(): Promise<ResearchMethod[]> {
    const value: unknown = JSON.parse(
      await readFile(new URL('capability.yaml', directory), 'utf8'),
    );
    if (!isResearchMethod(value)) throw new OperationError('unavailable', '内置科研能力声明无效。');
    return [value];
  }

  async resolve(
    methodId: string,
    version: string,
  ): Promise<{ method: ResearchMethod; content: string }> {
    const method = (await this.discover()).find(
      (item) => item.id === methodId && item.version === version,
    );
    if (!method) throw new OperationError('notFound', '科研方法或指定版本不存在。');
    const content = await readFile(new URL('SKILL.md', directory), 'utf8');
    return { method, content };
  }
}

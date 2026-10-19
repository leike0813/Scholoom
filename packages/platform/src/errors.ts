import { type ErrorInfo, OperationError } from '@scholoom/protocol/core';

export function failure(error: unknown): ErrorInfo {
  if (error instanceof OperationError) return { code: error.code, message: error.message };
  const code = (error as NodeJS.ErrnoException)?.code;
  if (code === 'ENOENT') return { code: 'notFound', message: '目标不存在，请重新读取。' };
  if (code === 'EACCES' || code === 'EPERM')
    return { code: 'permissionDenied', message: '没有访问目标的权限。' };
  if (code === 'EEXIST') return { code: 'contentChanged', message: '目标已经存在，不能覆盖。' };
  return { code: 'unavailable', message: '操作暂不可用；请查询当前状态后重试。' };
}

import { OperationError } from '@scholoom/protocol/core';
import { validateLibrary } from '@scholoom/protocol/library';
import { executeDocument } from './document-parser.js';
import { serveMaterial } from './material-execution.js';

serveMaterial(async (request, bytes) => {
  if (request.kind !== 'document' || !validateLibrary(request.method, 'params', request.input))
    throw new OperationError('invalidRequest', '文档读取请求无效。');
  return executeDocument(Buffer.from(bytes), request);
});

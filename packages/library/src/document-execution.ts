import { compileContract, OperationError } from '@scholoom/protocol/core';
import { resourceDocumentContracts } from '@scholoom/protocol/resources';
import { executeDocument } from './document-parser.js';
import { serveMaterial } from './material-execution.js';

const validators = new Map(
  Object.entries(resourceDocumentContracts).map(([method, contract]) => [
    `library.${method}`,
    compileContract(contract),
  ]),
);
serveMaterial(async (request, bytes) => {
  if (request.kind !== 'document' || !validators.get(request.method)?.params(request.input))
    throw new OperationError('invalidRequest', '文档读取请求无效。');
  return executeDocument(Buffer.from(bytes), request);
});

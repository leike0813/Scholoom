import { RpcPeer } from '@scholoom/broker/rpc';
import { openReportChannel, type SystemReportRequest } from '@scholoom/platform/node';
import { compileContract, OperationError } from '@scholoom/protocol/core';
import { reportManagerOperations } from '@scholoom/protocol/isolation';

const contracts = Object.fromEntries(
  Object.entries(reportManagerOperations).map(([method, operation]) => [
    method,
    compileContract(operation),
  ]),
);

/** A single authenticated C→M connection; loss never reconnects or replays a gate command. */
export async function connectReportManager(
  endpoint: {
    path: string;
    ownerUid: number;
    serverUid: number;
  },
  configId: string,
): Promise<{ request: SystemReportRequest; close(): Promise<void> }> {
  if (endpoint.ownerUid !== 0 || endpoint.serverUid !== 0)
    throw new OperationError('authenticationFailed', '系统报告管理端必须由固定系统身份提供。');
  let peer: RpcPeer | undefined,
    closed = false;
  const channel = await openReportChannel({
    ...endpoint,
    onFrame: (frame) => peer?.receive(frame),
    onClose: () => {
      closed = true;
      peer?.close();
    },
  });
  peer = new RpcPeer(channel, { control: () => true });
  const connection = peer;
  if (closed) {
    peer.close();
    await channel.close();
    throw new OperationError('unavailable', '系统管理连接已关闭。');
  }
  return {
    async request(method, input) {
      const contract = contracts[method];
      if (!contract?.params(input) || (input as { configId: string }).configId !== configId)
        throw new OperationError('invalidRequest', '系统请求与配置绑定不一致。');
      if (closed) throw new OperationError('unavailable', '系统管理连接已关闭。');
      const semantics = reportManagerOperations[method].semantics;
      const result = await connection.request(method, input, {
        waitMs: semantics.waitMs,
        control: true,
        lossCode: semantics.effect === 'write' ? 'outcomeUnknown' : 'unavailable',
      });
      if (!contract.result(result))
        throw new OperationError('protocolIncompatible', '系统回执与同源契约不一致。');
      return result;
    },
    async close() {
      closed = true;
      connection.close();
      await channel.close();
    },
  };
}

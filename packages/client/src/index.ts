/**
 * Connection coordinates supplied by the kernel discovery mechanism.
 * The WebSocket transport and discovery implementation are added with the app-server.
 */
export interface KernelEndpoint {
  url: URL;
  token: string;
}

export type { JsonRpcRequest, KernelRuntimeInfo } from '@scholoom/protocol';

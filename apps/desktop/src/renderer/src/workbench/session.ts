import type { ExternalStoreAdapter, ThreadMessageLike } from '@assistant-ui/react';
import type { ErrorInfo } from '@scholoom/protocol';

/** 真实来源在界面上可区分的连接阶段；样例状态只由显式样例场景提供。 */
export type KernelPhase =
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'disconnected'
  | 'error'
  | 'stopping'
  | 'stopped'
  | 'unknown';

/** 用户可见的生命周期操作与诊断信息，仅真实来源提供。 */
export interface WorkbenchConnection {
  message: string;
  instanceId?: string | undefined;
  error?: ErrorInfo | undefined;
  /** 用户重试：请宿主发现或启动内核后重新连接。 */
  retry?: (() => void) | undefined;
  /** 查询实际状态；只探测，不启动内核。 */
  inspect?: (() => void) | undefined;
  /** 明确停止内核；确认原实例退出后才报告已停止。 */
  stop?: (() => void) | undefined;
}

export interface WorkbenchSession {
  status: KernelPhase | 'sample';
  connection?: WorkbenchConnection;
  materials: readonly string[];
  selectedMaterials: readonly string[];
  toggleMaterial: (name: string) => void;
  adapter: ExternalStoreAdapter<ThreadMessageLike>;
  reset?: () => void;
}

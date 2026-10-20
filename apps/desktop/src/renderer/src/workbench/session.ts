import type { ExternalStoreAdapter, ThreadMessageLike } from '@assistant-ui/react';
import type { Effort, ErrorInfo, FileLocation, ModelOption } from '@scholoom/protocol';
import type { ReactNode } from 'react';

export interface FileTarget {
  projectId: string;
  path: string;
  fileId?: string;
  create?: boolean;
  openMode?: 'preview' | 'permanent';
}

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
}

export type SessionStatus = 'running' | 'awaiting' | 'failed' | 'idle';

export interface SessionSummary {
  id: string;
  title: string;
  status: SessionStatus;
  unread?: boolean;
  /** ISO 时间戳；界面经 relativeTime 格式化为中文相对时间。 */
  updatedAt: string;
}

export interface FileNode {
  name: string;
  kind: 'dir' | 'file';
  children?: readonly FileNode[];
  /** 当前在中间区 tab 中打开。 */
  open?: boolean;
}

export type TaskStatus = 'running' | 'awaiting' | 'done' | 'idle';

export interface TaskSummary {
  id: string;
  title: string;
  status: TaskStatus;
  updatedAt: string;
}

export interface WorkbenchNotice {
  id: string;
  severity: 'info' | 'warning' | 'error';
  summary: string;
  content: ReactNode;
}

export interface WorkbenchSession {
  status: KernelPhase | 'sample';
  connection?: WorkbenchConnection;
  materials: readonly string[];
  selectedMaterials: readonly string[];
  toggleMaterial: (name: string) => void;
  adapter: ExternalStoreAdapter<ThreadMessageLike>;
  reset?: () => void;
  draftKey?: string;
  controls?: ReactNode;
  notices?: readonly WorkbenchNotice[];
  executionStatus?: string;
  projectTrust?: {
    state: 'pending' | 'restricted';
    request: () => void;
  };
  sessionNavigation?: ReactNode;
  openSessionSearch?: () => void;
  sessionSearchDialog?: ReactNode;
  openProjectOnboarding?: () => void;
  projectOnboardingDialog?: ReactNode;
  projectTrustDialog?: ReactNode;
  activeSessionTitle?: string;
  openMessageFile?: (path: string, fileId?: string) => Promise<void>;
  projectId?: string;
  fileRevision?: number;
  resolveFiles?: ((fileIds: string[]) => Promise<FileLocation[]>) | undefined;
  initialTabs?: readonly {
    id: string;
    title: string;
    kind: 'library' | 'reader' | 'editor' | 'preview';
  }[];
  fileNavigator?: ReactNode | ((activeFile?: FileTarget) => ReactNode);
  fileTarget?: FileTarget;
  renderFile?: (
    target: FileTarget,
    mode?: import('./tab-state.js').FileViewMode,
    onDirty?: () => void,
    viewId?: string,
  ) => ReactNode;
  isFileDirty?: (target: FileTarget) => boolean;
  flushFile?: (target: FileTarget) => Promise<void>;
  /** 共同文献库 tab 内容；缺省时该 tab 呈现占位。 */
  library?: ReactNode;
  readerTarget?: import('@scholoom/protocol').LibraryAttachment | undefined;
  renderReader?: (material: import('@scholoom/protocol').LibraryAttachment) => ReactNode;
  createSession?: () => void;
  cancel?: (() => void) | undefined;
  loadEarlier?: (() => void) | undefined;
  /**
   * composer 执行上下文：项目、权限只读段与模型/推理强度选择。
   * 提供 modelOptions 与 onModelChange 时启用真实选择；null 选择表示“跟随默认”（清除会话覆盖）。
   */
  executionContext?: {
    project: string;
    model: string;
    permissions: string;
    effort?: string | undefined;
    supportsEffort?: boolean | undefined;
    defaultModel?: string | undefined;
    defaultEffort?: string | undefined;
    modelOverridden?: boolean;
    effortOverridden?: boolean;
    modelOptions?: readonly ModelOption[] | undefined;
    effortOptions?: readonly Effort[] | undefined;
    /** 归档、未连接或无会话时禁用选择。 */
    configureDisabled?: boolean;
    configureError?: string | undefined;
    retryConfigure?: (() => void) | undefined;
    onModelChange?: ((model: string | null) => void) | undefined;
    onEffortChange?: ((effort: Effort | null) => void) | undefined;
  };
  /** 会话列表；缺省时左区呈现空态。 */
  sessions?: readonly SessionSummary[];
  activeSessionId?: string;
  selectSession?: (id: string) => void;
  /** 文件树；缺省时右区呈现空态。 */
  fileTree?: readonly FileNode[];
  /** 研究任务列表；缺省时右区呈现空态。 */
  tasks?: readonly TaskSummary[];
}

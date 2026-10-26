import type { ExternalStoreAdapter, ThreadMessageLike } from '@assistant-ui/react';
import type {
  ContextItem,
  DelegationRecord,
  Effort,
  ErrorInfo,
  FileLocation,
  ModelOption,
  ResourceDescriptor,
  TaskGraphInputs,
  TaskGraphOutputs,
  TaskLink,
  TaskPort,
  TaskRead,
  TaskSummary,
  WorkbenchContextSnapshot,
} from '@scholoom/protocol';
import type { ReactNode } from 'react';
import type { ResourceTarget } from './resource-controller.js';

export type { FileTarget } from './resource-controller.js';

import type { FileTarget } from './resource-controller.js';

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

export type { TaskStatus, TaskSummary } from '@scholoom/protocol';

export interface WorkbenchNotice {
  id: string;
  severity: 'info' | 'warning' | 'error';
  summary: string;
  content: ReactNode;
}

export interface WorkbenchSession {
  delegations?: {
    revision: number;
    get: (id: string) => Promise<DelegationRecord>;
    cancel: (id: string) => Promise<DelegationRecord>;
    open: (resource: ResourceDescriptor) => void;
  };
  status: KernelPhase | 'sample';
  connection?: WorkbenchConnection;
  /** 用户显式附加、随下一条指令发送的上下文；与实时选择快照分别表达。 */
  contextItems?: readonly ContextItem[] | undefined;
  appendContextItem?: ((item: ContextItem) => void) | undefined;
  removeContextItem?: ((itemId: string) => void) | undefined;
  updateContextComment?: ((itemId: string, comment: string) => void) | undefined;
  contextError?: string | undefined;
  /** 发布当前活动视图的有界选择快照；null 清空。 */
  publishContext?: ((snapshot: WorkbenchContextSnapshot | null) => void) | undefined;
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
  taskPort?: TaskPort;
  taskGraphs?: {
    list: (input: TaskGraphInputs['tasks.graphs']) => Promise<TaskGraphOutputs['tasks.graphs']>;
    run: (input: TaskGraphInputs['tasks.runGraph']) => Promise<TaskGraphOutputs['tasks.runGraph']>;
  };
  taskRevision?: number;
  taskWatchError?: string;
  taskDraftKey?: string;
  taskCreation?: (
    operationId: string,
  ) => Promise<import('@scholoom/protocol').ResourceCreationOutputs['resources.creation']>;
  associateTask?: (
    entry: TaskRead,
    path: string,
    role: TaskLink['role'],
    note: string,
  ) => Promise<TaskRead>;
  resolveFiles?: ((fileIds: string[]) => Promise<FileLocation[]>) | undefined;
  initialTabs?: readonly {
    id: string;
    title: string;
    kind: 'library' | 'reader' | 'editor' | 'preview';
  }[];
  fileNavigator?: ReactNode | ((activeFile?: FileTarget) => ReactNode);
  resourceTarget?: ResourceTarget;
  resolveResource?: (target: ResourceTarget) => Promise<ResourceTarget>;
  renderResource?: (
    target: ResourceTarget,
    mode?: import('./tab-state.js').FileViewMode,
    onDirty?: () => void,
    viewId?: string,
  ) => ReactNode;
  isResourceDirty?: (target: ResourceTarget) => boolean;
  flushResource?: (target: ResourceTarget) => Promise<void>;
  /** 共同文献库 tab 内容；缺省时该 tab 呈现占位。 */
  library?: ReactNode;
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

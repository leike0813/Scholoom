import type { ReportUpdateState } from '../../../apps/desktop/src/renderer/src/workbench/reports/report-updates.js';
import type {
  ContextItem,
  KernelEndpoint,
  ResourceDescriptor,
} from '../../../packages/protocol/dist/index.js';

export interface ConnectedConfiguration {
  endpoint: KernelEndpoint;
  projectId: string;
  sessionId: string;
  entry: ResourceDescriptor;
}
export interface ConnectedObservation {
  projectId: string;
  sessionId: string;
  body: string;
  items: ContextItem[];
  serialized: string;
  metadata: ReportUpdateState | null;
  stored: string | null;
  clientPhase: string;
  consumers: number;
  subscriptions: number;
  reply: string;
  settled: number;
  changes: { projectId?: string; filePaths?: string[]; libraryChanged?: boolean }[];
  events: { kind: string; basis?: string }[];
}

import type { restoreReportDraft } from '../../../apps/desktop/src/renderer/src/workbench/reports/report-draft-client.js';
import type { ReportUpdateState } from '../../../apps/desktop/src/renderer/src/workbench/reports/report-updates.js';
import type {
  ContextItem,
  KernelEndpoint,
  ResourceDescriptor,
} from '../../../packages/protocol/dist/index.js';
import type { ReportBridgeMessage } from '../../../packages/protocol/dist/report-contracts.js';

export interface ExactObservation {
  result: Awaited<ReturnType<typeof restoreReportDraft>> | null;
  error: string | null;
  envelope: ReportBridgeMessage | null;
}

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
  exact: ExactObservation | null;
  pageSave: { key: string; localStorageWritten: boolean } | null;
  clientPhase: string;
  consumers: number;
  subscriptions: number;
  reply: string;
  settled: number;
  changes: { projectId?: string; filePaths?: string[]; libraryChanged?: boolean }[];
  events: { kind: string; basis?: string }[];
}

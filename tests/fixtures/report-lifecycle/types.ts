import type { ReportUpdateState } from '../../../apps/desktop/src/renderer/src/workbench/reports/report-updates.js';
import type { ContextItem } from '../../../packages/protocol/dist/index.js';

export interface LifecycleObservation {
  key: string;
  body: string;
  items: ContextItem[];
  serialized: string;
  calls: string[];
  view: null | {
    updates: ReportUpdateState;
    recovery: string;
    wire: {
      message: unknown;
      bytes: number;
      valid: boolean;
      viewId: string;
      generation: number;
    } | null;
    stored: string | null;
    protection: { pageDirty: boolean; explicitItems: boolean; composerDraft: boolean };
  };
  reply: string;
  subscriptions: number;
  consumers: number;
  events: {
    kind: string;
    basis?: string;
    bytes?: number;
    valid?: boolean;
    generation?: number;
    localStorageWritten?: boolean;
  }[];
}

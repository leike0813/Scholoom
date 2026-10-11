import type { ExternalStoreAdapter, ThreadMessageLike } from '@assistant-ui/react';

export interface WorkbenchSession {
  status: 'disconnected' | 'sample';
  materials: readonly string[];
  selectedMaterials: readonly string[];
  toggleMaterial: (name: string) => void;
  adapter: ExternalStoreAdapter<ThreadMessageLike>;
  reset?: () => void;
}

export const disconnectedSession: WorkbenchSession = {
  status: 'disconnected',
  materials: [],
  selectedMaterials: [],
  toggleMaterial: () => {},
  adapter: {
    messages: [],
    isSendDisabled: true,
    onNew: async () => {
      throw new Error('Kernel is not connected.');
    },
    convertMessage: (message) => message,
  },
};

import { useRef } from 'react';
import { createRoot } from 'react-dom/client';
import type { WorkbenchSession } from '../../../apps/desktop/src/renderer/src/workbench/session';
import { Workbench } from '../../../apps/desktop/src/renderer/src/workbench/Workbench';
import { startReceiver } from './receiver.js';
import '../../../apps/desktop/src/renderer/src/styles.css';

function View() {
  const ref = useRef<HTMLIFrameElement>(null);
  return (
    <iframe
      ref={ref}
      title="WorkerDOM native view"
      sandbox="allow-same-origin"
      srcDoc={'<!doctype html><html><meta charset="utf-8"><body></body></html>'}
      onLoad={() => {
        const receiver = startReceiver(ref.current!.contentDocument!);
        Reflect.set(window, 'workerDomProbe', receiver);
      }}
    />
  );
}
const session: WorkbenchSession = {
  status: 'sample',
  projectId: 'worker-dom-synthetic',
  materials: [],
  selectedMaterials: [],
  toggleMaterial: () => {},
  adapter: { messages: [], onNew: async () => {}, convertMessage: (m) => m },
  resourceTarget: {
    locator: {
      source: 'project',
      projectId: 'worker-dom-synthetic',
      fileId: 'probe',
      path: 'probe.html',
    },
    name: 'WorkerDOM probe.html',
    openMode: 'permanent',
  },
  renderResource: () => <View />,
};
createRoot(document.getElementById('fixture')!).render(<Workbench session={session} />);

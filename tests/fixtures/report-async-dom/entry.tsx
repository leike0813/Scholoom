import { useRef } from 'react';
import { createRoot } from 'react-dom/client';
import type { WorkbenchSession } from '../../../apps/desktop/src/renderer/src/workbench/session';
import { Workbench } from '../../../apps/desktop/src/renderer/src/workbench/Workbench';
import { startReceiver } from './receiver.mjs';
import '../../../apps/desktop/src/renderer/src/styles.css';

function View() {
  const ref = useRef<HTMLIFrameElement>(null);
  return (
    <iframe
      ref={ref}
      title="Async native view"
      sandbox="allow-same-origin"
      srcDoc={'<!doctype html><html><meta charset="utf-8"><body></body></html>'}
      onLoad={() =>
        Reflect.set(
          window,
          'asyncDomProbe',
          startReceiver(ref.current!.contentDocument!, {
            reverse: new URLSearchParams(location.search).has('reverse'),
            cancel: new URLSearchParams(location.search).has('cancel'),
            cancelClick: new URLSearchParams(location.search).has('cancelClick'),
          }),
        )
      }
    />
  );
}
const session: WorkbenchSession = {
  status: 'sample',
  projectId: 'async-dom-synthetic',
  materials: [],
  selectedMaterials: [],
  toggleMaterial: () => {},
  adapter: { messages: [], onNew: async () => {}, convertMessage: (m) => m },
  resourceTarget: {
    locator: {
      source: 'project',
      projectId: 'async-dom-synthetic',
      fileId: 'probe',
      path: 'probe.html',
    },
    name: 'Async DOM probe.html',
    openMode: 'permanent',
  },
  renderResource: () => <View />,
};
createRoot(document.getElementById('fixture')!).render(<Workbench session={session} />);

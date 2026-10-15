import { lazy, StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { KernelWorkbench } from './workbench/kernel-session';
import './styles.css';

const root = document.getElementById('root');
if (!root) throw new Error('Application root is missing.');
const Scenario =
  import.meta.env.DEV &&
  new URLSearchParams(window.location.search).get('scenario') === 'ui-foundation'
    ? lazy(() => import('./scenarios/ui-foundation'))
    : null;

createRoot(root).render(
  <StrictMode>
    <Suspense fallback={<p role="status">加载工作台…</p>}>
      {Scenario ? <Scenario /> : <KernelWorkbench />}
    </Suspense>
  </StrictMode>,
);

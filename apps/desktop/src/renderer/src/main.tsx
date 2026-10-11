import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { OrcaUiPrototype } from './OrcaUiPrototype';
import './styles.css';

const root = document.getElementById('root');
if (!root) throw new Error('Application root is missing.');
const showPrototype =
  import.meta.env.DEV && new URLSearchParams(window.location.search).get('prototype') === 'orca-ui';

createRoot(root).render(
  <StrictMode>
    {showPrototype ? (
      <OrcaUiPrototype />
    ) : (
      <main>
        <h1>Scholoom</h1>
        <p>开始你的研究。</p>
      </main>
    )}
  </StrictMode>,
);

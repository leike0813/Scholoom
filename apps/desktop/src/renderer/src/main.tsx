import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

const root = document.getElementById('root');
if (!root) throw new Error('Application root is missing.');

createRoot(root).render(
  <StrictMode>
    <main>
      <h1>Scholoom</h1>
      <p>开始你的研究。</p>
    </main>
  </StrictMode>,
);

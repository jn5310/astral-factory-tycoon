import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { initLanguage } from './core/Game';
import './index.css';

// iOS Safari ignores user-scalable=no; cancel its native pinch/double-tap zoom so the game owns touch input.
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('dblclick', (e) => e.preventDefault());

// Pick the language (saved choice, else the browser's) before the first render.
initLanguage();

const root = document.getElementById('root');
if (!root) throw new Error('#root element not found');
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

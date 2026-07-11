import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.js';
import { initPerfHud } from './perf.js';
import './style.css';

initPerfHud();

// Account economy sync starts after first paint — it statically imports the
// Supabase layer, and its own save debounce (1.5 s) already tolerates far
// more delay than an idle callback adds. Dialogue overrides load lazily on
// first read (see dialogue.ts) — no boot-time table fetch (perf P1, 0139).
const idle: (fn: () => void) => void =
  'requestIdleCallback' in window ? (fn) => requestIdleCallback(fn) : (fn) => setTimeout(fn, 1);
idle(() => {
  void import('./economy-sync.js').then((m) => m.initEconomySync());
});

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('#root element missing');
createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

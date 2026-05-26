import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.js';
import { initDialogue } from './dialogue.js';
import { initEconomySync } from './economy-sync.js';
import './style.css';

initEconomySync();
void initDialogue();

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('#root element missing');
createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

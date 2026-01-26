/**
 * Side Panel Entry Point
 *
 * React mount point for the extension side panel.
 * Manages authentication state and token communication with the embedded web app.
 */

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { SidePanelApp } from './SidePanelApp';

// Mount the React app
const container = document.getElementById('root');

if (!container) {
  throw new Error('Root element not found');
}

const root = createRoot(container);

root.render(
  <StrictMode>
    <SidePanelApp />
  </StrictMode>
);

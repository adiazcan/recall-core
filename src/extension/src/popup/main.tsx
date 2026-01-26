/**
 * Popup Entry Point
 *
 * React mount point for the extension popup.
 */

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Popup } from './Popup';

// Mount the React app
const container = document.getElementById('root');

if (!container) {
  throw new Error('Root element not found');
}

const root = createRoot(container);

root.render(
  <StrictMode>
    <Popup />
  </StrictMode>
);

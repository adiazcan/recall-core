/**
 * Side Panel Entry Point
 *
 * React mount point for the extension side panel.
 * Full implementation will be added in Phase 4 (User Story 2).
 */

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

// Placeholder component for Phase 4 implementation
function SidePanelPlaceholder(): JSX.Element {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        padding: '24px',
        textAlign: 'center',
        color: '#6b7280',
      }}
    >
      <div style={{ fontSize: '48px', marginBottom: '16px' }}>📑</div>
      <h2 style={{ fontSize: '18px', fontWeight: 500, marginBottom: '8px', color: '#1f2937' }}>
        Recall Side Panel
      </h2>
      <p style={{ fontSize: '14px' }}>
        Coming soon: Browse your saved items here without leaving the current
        tab.
      </p>
    </div>
  );
}

// Mount the React app
const container = document.getElementById('root');

if (!container) {
  throw new Error('Root element not found');
}

const root = createRoot(container);

root.render(
  <StrictMode>
    <SidePanelPlaceholder />
  </StrictMode>
);

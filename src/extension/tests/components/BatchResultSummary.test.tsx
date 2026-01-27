import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BatchResultSummary } from '../../src/popup/components/SaveSelectedTabs';
import type { BatchSaveResult } from '../../src/types';

describe('BatchResultSummary', () => {
  it('renders full success summary', () => {
    const result: BatchSaveResult = {
      total: 3,
      created: 2,
      deduplicated: 1,
      failed: 0,
      results: [
        { success: true, isNew: true, index: 0, url: 'https://a.com' },
        { success: true, isNew: true, index: 1, url: 'https://b.com' },
        { success: true, isNew: false, index: 2, url: 'https://c.com' },
      ],
    };

    render(<BatchResultSummary result={result} />);

    expect(screen.getByText('All 3 tabs processed')).toBeTruthy();
    expect(screen.getByText('Saved')).toBeTruthy();
    expect(screen.getByText('Already saved')).toBeTruthy();
  });

  it('renders partial success summary with failures', () => {
    const result: BatchSaveResult = {
      total: 2,
      created: 1,
      deduplicated: 0,
      failed: 1,
      results: [
        { success: true, isNew: true, index: 0, url: 'https://a.com' },
        {
          success: false,
          isNew: false,
          index: 1,
          url: 'https://b.com',
          error: 'Network error',
        },
      ],
    };

    render(<BatchResultSummary result={result} />);

    expect(screen.getByText('Saved 1 of 2 tabs')).toBeTruthy();
    expect(screen.getByText('Failed')).toBeTruthy();
    expect(screen.getByText(/Network error/)).toBeTruthy();
  });
});

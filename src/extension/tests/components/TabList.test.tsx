import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TabList } from '../../src/popup/components/TabList';
import { mocks } from '../setup';
import type { SaveableTab } from '../../src/types';

describe('TabList', () => {
  it('renders tabs and notifies selection change', async () => {
    mocks.tabs.query.mockResolvedValueOnce([
      { id: 1, url: 'https://example.com', title: 'Example' },
      { id: 2, url: 'chrome://extensions', title: 'Extensions' },
    ] as chrome.tabs.Tab[]);

    const onSelectionChange = vi.fn();
    const onTabsLoaded = vi.fn();

    render(
      <TabList
        selectedIds={new Set()}
        onSelectionChange={onSelectionChange}
        onTabsLoaded={onTabsLoaded}
      />
    );

    expect(await screen.findByText('Example')).toBeTruthy();
    expect(screen.getByText('Chrome internal pages cannot be saved')).toBeTruthy();

    const checkbox = screen.getByLabelText('Select Example') as HTMLInputElement;
    fireEvent.click(checkbox);

    expect(onSelectionChange).toHaveBeenCalledTimes(1);
    const nextSelection = onSelectionChange.mock.calls[0][0] as Set<number>;
    expect(nextSelection.has(1)).toBe(true);

    const loadedTabs = onTabsLoaded.mock.calls[0][0] as SaveableTab[];
    expect(loadedTabs).toHaveLength(2);
  });
});

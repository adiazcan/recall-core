/**
 * TabList Component
 *
 * Displays a list of open tabs with checkbox selection for batch save operations.
 * Filters and marks restricted URLs (chrome://, edge://, about:) as non-selectable.
 */

import type { JSX } from 'react';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { isRestrictedUrl, getRestrictedReason } from '../../services/api';
import type { SaveableTab } from '../../types';

export interface TabListProps {
  /** Selected tab IDs */
  selectedIds: Set<number>;
  /** Callback when selection changes */
  onSelectionChange: (selectedIds: Set<number>) => void;
  /** Callback when tabs are loaded */
  onTabsLoaded?: (tabs: SaveableTab[]) => void;
}

/**
 * Converts a chrome.tabs.Tab to a SaveableTab with restriction check
 */
function toSaveableTab(tab: chrome.tabs.Tab): SaveableTab | null {
  if (!tab.id || !tab.url) return null;

  const canSave = !isRestrictedUrl(tab.url);
  const restrictedReason = canSave ? undefined : getRestrictedReason(tab.url);

  return {
    id: tab.id,
    url: tab.url,
    title: tab.title ?? tab.url,
    favIconUrl: tab.favIconUrl,
    canSave,
    restrictedReason,
  };
}

export function TabList({
  selectedIds,
  onSelectionChange,
  onTabsLoaded,
}: TabListProps): JSX.Element {
  const [tabs, setTabs] = useState<SaveableTab[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | undefined>();

  // Load all open tabs
  useEffect(() => {
    const abortController = new AbortController();

    async function loadTabs() {
      try {
        // Query all tabs in the current window
        const chromeTabs = await chrome.tabs.query({ currentWindow: true });

        if (abortController.signal.aborted) return;

        // Convert to SaveableTab and filter out null results
        const saveableTabs = chromeTabs
          .map(toSaveableTab)
          .filter((tab): tab is SaveableTab => tab !== null);

        if (abortController.signal.aborted) return;
        setTabs(saveableTabs);
        onTabsLoaded?.(saveableTabs);
      } catch (err) {
        if (abortController.signal.aborted) return;
        console.error('[TabList] Failed to load tabs:', err);
        setError('Failed to load tabs');
      } finally {
        if (!abortController.signal.aborted) {
          setIsLoading(false);
        }
      }
    }

    loadTabs();

    return () => {
      abortController.abort();
    };
  }, [onTabsLoaded]);

  // Calculate saveable tabs
  const saveableTabs = useMemo(
    () => tabs.filter((tab) => tab.canSave),
    [tabs]
  );

  // Check if all saveable tabs are selected
  const allSelected = useMemo(
    () =>
      saveableTabs.length > 0 &&
      saveableTabs.every((tab) => selectedIds.has(tab.id)),
    [saveableTabs, selectedIds]
  );

  // Check if some (but not all) saveable tabs are selected
  const someSelected = useMemo(
    () =>
      saveableTabs.some((tab) => selectedIds.has(tab.id)) && !allSelected,
    [saveableTabs, selectedIds, allSelected]
  );

  // Handle individual tab toggle
  const handleTabToggle = useCallback(
    (tabId: number) => {
      const newSelection = new Set(selectedIds);
      if (newSelection.has(tabId)) {
        newSelection.delete(tabId);
      } else {
        newSelection.add(tabId);
      }
      onSelectionChange(newSelection);
    },
    [selectedIds, onSelectionChange]
  );

  // Handle select all / deselect all
  const handleSelectAll = useCallback(() => {
    if (allSelected) {
      // Deselect all
      onSelectionChange(new Set());
    } else {
      // Select all saveable tabs
      onSelectionChange(new Set(saveableTabs.map((tab) => tab.id)));
    }
  }, [allSelected, saveableTabs, onSelectionChange]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
          <span
            className="w-4 h-4 border-2 border-gray-200 border-t-blue-500 rounded-full animate-spin dark:border-gray-600 dark:border-t-blue-400"
            aria-hidden="true"
          />
          <span>Loading tabs...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-center">
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      </div>
    );
  }

  if (tabs.length === 0) {
    return (
      <div className="p-4 text-center">
        <p className="text-sm text-gray-500 dark:text-gray-400">No tabs found</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {/* Select all header */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800">
        <input
          type="checkbox"
          id="select-all"
          checked={allSelected}
          ref={(el) => {
            if (el) el.indeterminate = someSelected;
          }}
          onChange={handleSelectAll}
          className="w-4 h-4 text-blue-500 border-gray-300 rounded focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
          aria-label="Select all tabs"
        />
        <label
          htmlFor="select-all"
          className="flex-1 text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer"
        >
          {allSelected
            ? 'Deselect all'
            : `Select all (${saveableTabs.length} saveable)`}
        </label>
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {selectedIds.size} selected
        </span>
      </div>

      {/* Tab list */}
      <ul className="flex-1 overflow-y-auto max-h-[300px] divide-y divide-gray-100 dark:divide-gray-800">
        {tabs.map((tab) => (
          <TabListItem
            key={tab.id}
            tab={tab}
            isSelected={selectedIds.has(tab.id)}
            onToggle={handleTabToggle}
          />
        ))}
      </ul>
    </div>
  );
}

// =============================================================================
// TabListItem Component
// =============================================================================

interface TabListItemProps {
  tab: SaveableTab;
  isSelected: boolean;
  onToggle: (tabId: number) => void;
}

function TabListItem({
  tab,
  isSelected,
  onToggle,
}: TabListItemProps): JSX.Element {
  const handleChange = useCallback(() => {
    if (tab.canSave) {
      onToggle(tab.id);
    }
  }, [tab.id, tab.canSave, onToggle]);

  const itemClasses = tab.canSave
    ? 'hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer'
    : 'opacity-60 cursor-not-allowed bg-gray-50 dark:bg-gray-900';

  return (
    <li className={`flex items-center gap-3 px-4 py-2.5 ${itemClasses}`}>
      <input
        type="checkbox"
        checked={isSelected}
        disabled={!tab.canSave}
        onChange={handleChange}
        className="w-4 h-4 text-blue-500 border-gray-300 rounded focus:ring-blue-500 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-700"
        aria-label={`Select ${tab.title}`}
      />

      {/* Favicon */}
      <div className="w-5 h-5 shrink-0 flex items-center justify-center">
        {tab.favIconUrl ? (
          <img
            src={tab.favIconUrl}
            alt=""
            className="w-4 h-4 rounded"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        ) : (
          <span className="w-4 h-4 flex items-center justify-center text-xs text-gray-400 bg-gray-200 rounded dark:bg-gray-700 dark:text-gray-500">
            🌐
          </span>
        )}
      </div>

      {/* Tab info */}
      <div
        className="flex-1 min-w-0 cursor-pointer"
        onClick={handleChange}
        role="button"
        tabIndex={tab.canSave ? 0 : -1}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleChange();
          }
        }}
      >
        <p className="text-sm text-gray-800 truncate dark:text-gray-200">
          {tab.title}
        </p>
        {tab.canSave ? (
          <p className="text-xs text-gray-500 truncate dark:text-gray-400">
            {tab.url}
          </p>
        ) : (
          <p className="text-xs text-amber-600 dark:text-amber-400">
            {tab.restrictedReason ?? 'Cannot save this page'}
          </p>
        )}
      </div>
    </li>
  );
}

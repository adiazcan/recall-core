/**
 * SaveSelectedTabs Component
 *
 * Orchestrates batch tab selection and save operations.
 * Shows progress during save and result summary after completion.
 */

import type { JSX } from 'react';
import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { TabList } from './TabList';
import { SaveProgress } from './SaveProgress';
import { saveUrl } from '../../services/messaging';
import type { SaveableTab, BatchSaveResult, SaveResult, ExtensionErrorCode } from '../../types';

export type BatchSaveStatus = 'selecting' | 'saving' | 'complete';

export interface SaveSelectedTabsProps {
  /** Callback when user cancels batch selection */
  onCancel: () => void;
  /** Callback when batch save completes */
  onComplete?: (result: BatchSaveResult) => void;
}

export function SaveSelectedTabs({
  onCancel,
  onComplete,
}: SaveSelectedTabsProps): JSX.Element {
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [tabs, setTabs] = useState<SaveableTab[]>([]);
  const [status, setStatus] = useState<BatchSaveStatus>('selecting');
  const [saveResult, setSaveResult] = useState<BatchSaveResult | null>(null);
  const [error, setError] = useState<string | undefined>();
  const [currentProgress, setCurrentProgress] = useState(0);
  const isMountedRef = useRef(true);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Get selected tabs
  const selectedTabs = useMemo(
    () => tabs.filter((tab) => selectedIds.has(tab.id)),
    [tabs, selectedIds]
  );

  // Handle tabs loaded callback
  const handleTabsLoaded = useCallback((loadedTabs: SaveableTab[]) => {
    setTabs(loadedTabs);
  }, []);

  // Handle save button click
  const handleSave = useCallback(async () => {
    if (status !== 'selecting' || selectedTabs.length === 0) return;

    setStatus('saving');
    setError(undefined);
    setCurrentProgress(0);
    setSaveResult(null);

    try {
      const items = selectedTabs.map((tab) => ({
        url: tab.url,
        title: tab.title,
      }));

      const results: Array<SaveResult & { index: number; url: string }> = new Array(
        items.length,
      );
      let currentIndex = 0;
      let completed = 0;

      const updateProgress = () => {
        completed += 1;
        if (isMountedRef.current) {
          setCurrentProgress(completed);
        }
      };

      async function processNext(): Promise<void> {
        while (currentIndex < items.length) {
          const index = currentIndex++;
          const item = items[index];

          try {
            const result = await saveUrl(item.url, item.title);
            results[index] = { ...result, index, url: item.url };
          } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to save';
            const errorCode = (err as { code?: ExtensionErrorCode })?.code ?? 'UNKNOWN';
            results[index] = {
              success: false,
              isNew: false,
              error: errorMessage,
              errorCode,
              index,
              url: item.url,
            };
          } finally {
            updateProgress();
          }
        }
      }

      const concurrency = Math.min(3, items.length);
      await Promise.all(
        Array.from({ length: concurrency }, () => processNext()),
      );

      const summary = results.reduce<BatchSaveResult>(
        (acc, result) => {
          if (result.success) {
            if (result.isNew) {
              acc.created += 1;
            } else {
              acc.deduplicated += 1;
            }
          } else {
            acc.failed += 1;
          }
          acc.results.push(result);
          return acc;
        },
        {
          total: items.length,
          created: 0,
          deduplicated: 0,
          failed: 0,
          results: [],
        },
      );

      if (!isMountedRef.current) {
        return;
      }

      setSaveResult(summary);
      setStatus('complete');
      onComplete?.(summary);
    } catch (err) {
      console.error('[SaveSelectedTabs] Batch save failed:', err);
      if (isMountedRef.current) {
        setError(err instanceof Error ? err.message : 'Failed to save tabs');
        setStatus('selecting');
      }
    }
  }, [selectedTabs, onComplete, status]);

  // Handle done (return to main view)
  const handleDone = useCallback(() => {
    onCancel();
  }, [onCancel]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100">
          {status === 'selecting' && 'Select tabs to save'}
          {status === 'saving' && 'Saving tabs...'}
          {status === 'complete' && 'Save complete'}
        </h2>
        {status === 'selecting' && (
          <button
            type="button"
            onClick={onCancel}
            className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            Cancel
          </button>
        )}
      </div>

      {/* Selection view */}
      {status === 'selecting' && (
        <>
          <div className="flex-1 overflow-hidden">
            <TabList
              selectedIds={selectedIds}
              onSelectionChange={setSelectedIds}
              onTabsLoaded={handleTabsLoaded}
            />
          </div>

          {/* Error message */}
          {error && (
            <div className="px-4 py-2 bg-red-50 border-t border-red-200 dark:bg-red-950 dark:border-red-800">
              <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
            </div>
          )}

          {/* Save button */}
          <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={handleSave}
              disabled={selectedIds.size === 0 || status !== 'selecting'}
              className="w-full py-2.5 px-4 text-sm font-medium text-white bg-blue-500 rounded-lg hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors dark:bg-blue-600 dark:hover:bg-blue-700 dark:disabled:bg-gray-600"
            >
              Save {selectedIds.size} tab{selectedIds.size !== 1 ? 's' : ''}
            </button>
          </div>
        </>
      )}

      {/* Saving view */}
      {status === 'saving' && (
        <div className="flex-1 flex flex-col items-center justify-center p-8">
          <div className="w-full max-w-xs">
            <SaveProgress
              status="saving"
              batchCurrent={currentProgress}
              batchTotal={selectedTabs.length}
            />
          </div>
        </div>
      )}

      {/* Complete view with result summary */}
      {status === 'complete' && saveResult && (
        <div className="flex-1 flex flex-col">
          <div className="flex-1 p-6">
            <BatchResultSummary result={saveResult} />
          </div>

          {/* Done button */}
          <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={handleDone}
              className="w-full py-2.5 px-4 text-sm font-medium text-white bg-blue-500 rounded-lg hover:bg-blue-600 transition-colors dark:bg-blue-600 dark:hover:bg-blue-700"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// BatchResultSummary Component
// =============================================================================

interface BatchResultSummaryProps {
  result: BatchSaveResult;
}

export function BatchResultSummary({ result }: BatchResultSummaryProps): JSX.Element {
  const { total, created, deduplicated, failed } = result;
  const hasErrors = failed > 0;

  return (
    <div className="space-y-4">
      {/* Success icon or partial success icon */}
      <div className="flex justify-center">
        {hasErrors ? (
          <span className="w-12 h-12 flex items-center justify-center rounded-full bg-amber-100 text-amber-600 text-2xl dark:bg-amber-900/50 dark:text-amber-400">
            ⚠️
          </span>
        ) : (
          <span className="w-12 h-12 flex items-center justify-center rounded-full bg-green-100 text-green-600 text-2xl dark:bg-green-900/50 dark:text-green-400">
            ✓
          </span>
        )}
      </div>

      {/* Summary text */}
      <p className="text-center text-base font-medium text-gray-800 dark:text-gray-100">
        {hasErrors
          ? `Saved ${created + deduplicated} of ${total} tabs`
          : `All ${total} tabs processed`}
      </p>

      {/* Detailed breakdown */}
      <div className="space-y-2">
        {created > 0 && (
          <ResultRow
            icon="✓"
            iconColor="text-green-500"
            bgColor="bg-green-100 dark:bg-green-900/30"
            label="Saved"
            count={created}
          />
        )}

        {deduplicated > 0 && (
          <ResultRow
            icon="↩"
            iconColor="text-yellow-500"
            bgColor="bg-yellow-100 dark:bg-yellow-900/30"
            label="Already saved"
            count={deduplicated}
          />
        )}

        {failed > 0 && (
          <ResultRow
            icon="✗"
            iconColor="text-red-500"
            bgColor="bg-red-100 dark:bg-red-900/30"
            label="Failed"
            count={failed}
          />
        )}
      </div>

      {/* Failed items details */}
      {failed > 0 && (
        <div className="mt-4">
          <p className="text-xs font-medium text-gray-600 mb-2 dark:text-gray-400">
            Failed items:
          </p>
          <ul className="space-y-1 max-h-[100px] overflow-y-auto">
            {result.results
              .filter((r) => !r.success)
              .map((r) => (
                <li
                  key={r.index}
                  className="text-xs text-gray-500 truncate dark:text-gray-400"
                  title={`${r.url}: ${r.error}`}
                >
                  • {truncateUrl(r.url)}
                  {r.error && <span className="text-red-500"> - {r.error}</span>}
                </li>
              ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// ResultRow Component
// =============================================================================

interface ResultRowProps {
  icon: string;
  iconColor: string;
  bgColor: string;
  label: string;
  count: number;
}

function ResultRow({
  icon,
  iconColor,
  bgColor,
  label,
  count,
}: ResultRowProps): JSX.Element {
  return (
    <div
      className={`flex items-center justify-between px-3 py-2 rounded-lg ${bgColor}`}
    >
      <div className="flex items-center gap-2">
        <span className={`text-sm ${iconColor}`}>{icon}</span>
        <span className="text-sm text-gray-700 dark:text-gray-200">{label}</span>
      </div>
      <span className="text-sm font-medium text-gray-800 dark:text-gray-100">
        {count}
      </span>
    </div>
  );
}

// =============================================================================
// Helpers
// =============================================================================

function truncateUrl(url: string, maxLength = 40): string {
  try {
    const parsed = new URL(url);
    const display = parsed.host + parsed.pathname;
    if (display.length <= maxLength) return display;
    return display.substring(0, maxLength - 3) + '...';
  } catch {
    if (url.length <= maxLength) return url;
    return url.substring(0, maxLength - 3) + '...';
  }
}

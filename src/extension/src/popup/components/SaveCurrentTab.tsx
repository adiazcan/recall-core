/**
 * SaveCurrentTab Component
 *
 * Displays the current tab info and provides a button to save it to Recall.
 * Handles API response codes with user-friendly messages.
 */

import type { JSX } from 'react';
import { useState, useEffect, useCallback } from 'react';
import { SaveProgress, type SaveStatus } from './SaveProgress';
import { saveUrl } from '../../services/messaging';
import { isRestrictedUrl, getRestrictedReason } from '../../services/api';
import type { TabInfo, ExtensionErrorCode } from '../../types';

export interface SaveCurrentTabProps {
  /** Whether the user is authenticated */
  isAuthenticated: boolean;
  /** Callback when save succeeds */
  onSaveSuccess?: () => void;
}

export function SaveCurrentTab({
  isAuthenticated,
  onSaveSuccess,
}: SaveCurrentTabProps): JSX.Element {
  const [currentTab, setCurrentTab] = useState<TabInfo | null>(null);
  const [isLoadingTab, setIsLoadingTab] = useState(true);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const [errorCode, setErrorCode] = useState<ExtensionErrorCode | undefined>();
  const [savedTitle, setSavedTitle] = useState<string | undefined>();
  const [isRestricted, setIsRestricted] = useState(false);
  const [restrictedReason, setRestrictedReason] = useState<string | undefined>();

  // Load current tab on mount
  useEffect(() => {
    let isMounted = true;

    async function loadCurrentTab() {
      try {
        const [tab] = await chrome.tabs.query({
          active: true,
          currentWindow: true,
        });

        if (!isMounted) return;

        if (tab && tab.id && tab.url) {
          setCurrentTab({
            id: tab.id,
            url: tab.url,
            title: tab.title ?? tab.url,
            favIconUrl: tab.favIconUrl,
          });

          // Check if URL is restricted
          if (isRestrictedUrl(tab.url)) {
            setIsRestricted(true);
            setRestrictedReason(getRestrictedReason(tab.url));
          }
        }
      } catch (error) {
        if (!isMounted) return;
        console.error('[SaveCurrentTab] Failed to get current tab:', error);
      } finally {
        if (isMounted) {
          setIsLoadingTab(false);
        }
      }
    }

    loadCurrentTab();

    return () => {
      isMounted = false;
    };
  }, []);

  // Handle save
  const handleSave = useCallback(async () => {
    if (!currentTab || isRestricted || !isAuthenticated) return;

    setSaveStatus('saving');
    setErrorMessage(undefined);
    setErrorCode(undefined);

    try {
      const result = await saveUrl(currentTab.url, currentTab.title);

      if (result.success) {
        setSavedTitle(result.item?.title ?? currentTab.title);
        setSaveStatus(result.isNew ? 'success' : 'dedupe');
        onSaveSuccess?.();
      } else {
        setErrorMessage(result.error);
        setErrorCode(result.errorCode);
        setSaveStatus('error');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save';
      setErrorMessage(message);
      setErrorCode('UNKNOWN');
      setSaveStatus('error');
    }
  }, [currentTab, isRestricted, isAuthenticated, onSaveSuccess]);

  // Handle retry
  const handleRetry = useCallback(() => {
    setSaveStatus('idle');
    handleSave();
  }, [handleSave]);

  // Handle dismiss
  const handleDismiss = useCallback(() => {
    setSaveStatus('idle');
    setErrorMessage(undefined);
    setErrorCode(undefined);
  }, []);

  // Reset state when tab changes
  useEffect(() => {
    setSaveStatus('idle');
    setErrorMessage(undefined);
    setErrorCode(undefined);
  }, [currentTab?.url]);

  if (isLoadingTab) {
    return (
      <div className="flex items-center justify-center min-h-[120px] p-4">
        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
          <span
            className="w-4 h-4 border-2 border-gray-200 border-t-blue-500 rounded-full animate-spin dark:border-gray-600 dark:border-t-blue-400"
            aria-hidden="true"
          />
          <span>Loading tab info...</span>
        </div>
      </div>
    );
  }

  if (!currentTab) {
    return (
      <div className="flex items-center justify-center min-h-[120px] p-4">
        <p className="text-sm text-gray-500 text-center dark:text-gray-400">
          Unable to access current tab
        </p>
      </div>
    );
  }

  const isSaveDisabled =
    !isAuthenticated ||
    isRestricted ||
    saveStatus === 'saving' ||
    saveStatus === 'success' ||
    saveStatus === 'dedupe';

  return (
    <div className="p-4">
      {/* Tab preview */}
      <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg mb-4 dark:bg-gray-800">
        {currentTab.favIconUrl && (
          <img
            src={currentTab.favIconUrl}
            alt=""
            className="w-6 h-6 shrink-0 rounded mt-0.5"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        )}
        <div className="flex flex-col gap-1 min-w-0 flex-1">
          <span className="text-sm font-medium text-gray-800 line-clamp-2 dark:text-gray-100">
            {currentTab.title}
          </span>
          <span className="text-xs text-gray-500 truncate dark:text-gray-400">
            {currentTab.url}
          </span>
        </div>
      </div>

      {/* Restricted URL warning */}
      {isRestricted && (
        <div className="flex items-center gap-2 p-3 bg-amber-100 rounded-md text-[13px] text-amber-800 dark:bg-amber-900/50 dark:text-amber-200">
          <span className="text-base" aria-hidden="true">
            ⚠️
          </span>
          <span>{restrictedReason ?? 'This page cannot be saved'}</span>
        </div>
      )}

      {/* Save button */}
      {!isRestricted && (
        <button
          type="button"
          className="w-full py-3 px-4 text-sm font-medium text-white bg-blue-500 rounded-lg hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors dark:bg-blue-600 dark:hover:bg-blue-700 dark:disabled:bg-gray-600"
          onClick={handleSave}
          disabled={isSaveDisabled}
        >
          {saveStatus === 'saving'
            ? 'Saving...'
            : saveStatus === 'success' || saveStatus === 'dedupe'
              ? 'Saved'
              : 'Save current tab'}
        </button>
      )}

      {/* Progress/feedback */}
      <SaveProgress
        status={saveStatus}
        errorMessage={errorMessage}
        errorCode={errorCode}
        savedTitle={savedTitle}
        onRetry={handleRetry}
        onDismiss={handleDismiss}
      />
    </div>
  );
}

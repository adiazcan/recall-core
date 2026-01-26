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
      <div className="save-current-tab save-current-tab--loading">
        <div className="save-current-tab__loading">
          <span className="save-current-tab__spinner" aria-hidden="true" />
          <span>Loading tab info...</span>
        </div>
        <style>{saveCurrentTabStyles}</style>
      </div>
    );
  }

  if (!currentTab) {
    return (
      <div className="save-current-tab save-current-tab--error">
        <p className="save-current-tab__message">
          Unable to access current tab
        </p>
        <style>{saveCurrentTabStyles}</style>
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
    <div className="save-current-tab">
      {/* Tab preview */}
      <div className="save-current-tab__preview">
        {currentTab.favIconUrl && (
          <img
            src={currentTab.favIconUrl}
            alt=""
            className="save-current-tab__favicon"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        )}
        <div className="save-current-tab__info">
          <span className="save-current-tab__title">{currentTab.title}</span>
          <span className="save-current-tab__url">{currentTab.url}</span>
        </div>
      </div>

      {/* Restricted URL warning */}
      {isRestricted && (
        <div className="save-current-tab__restricted">
          <span className="save-current-tab__restricted-icon" aria-hidden="true">
            ⚠️
          </span>
          <span>{restrictedReason ?? 'This page cannot be saved'}</span>
        </div>
      )}

      {/* Save button */}
      {!isRestricted && (
        <button
          type="button"
          className="save-current-tab__button"
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

      <style>{saveCurrentTabStyles}</style>
    </div>
  );
}

const saveCurrentTabStyles = `
  .save-current-tab {
    padding: 16px;
  }

  .save-current-tab--loading,
  .save-current-tab--error {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 120px;
  }

  .save-current-tab__loading {
    display: flex;
    align-items: center;
    gap: 8px;
    color: #6b7280;
    font-size: 14px;
  }

  .save-current-tab__spinner {
    width: 16px;
    height: 16px;
    border: 2px solid #e0e0e0;
    border-top-color: #3b82f6;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .save-current-tab__message {
    color: #6b7280;
    font-size: 14px;
    text-align: center;
  }

  .save-current-tab__preview {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 12px;
    background-color: #f9fafb;
    border-radius: 8px;
    margin-bottom: 16px;
  }

  .save-current-tab__favicon {
    width: 24px;
    height: 24px;
    flex-shrink: 0;
    border-radius: 4px;
    margin-top: 2px;
  }

  .save-current-tab__info {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
    flex: 1;
  }

  .save-current-tab__title {
    font-size: 14px;
    font-weight: 500;
    color: #1f2937;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .save-current-tab__url {
    font-size: 12px;
    color: #6b7280;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .save-current-tab__restricted {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px;
    background-color: #fef3c7;
    border-radius: 6px;
    font-size: 13px;
    color: #92400e;
  }

  .save-current-tab__restricted-icon {
    font-size: 16px;
  }

  .save-current-tab__button {
    width: 100%;
    padding: 12px 16px;
    font-size: 14px;
    font-weight: 500;
    color: white;
    background-color: #3b82f6;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .save-current-tab__button:hover:not(:disabled) {
    background-color: #2563eb;
  }

  .save-current-tab__button:disabled {
    background-color: #9ca3af;
    cursor: not-allowed;
  }

  @media (prefers-color-scheme: dark) {
    .save-current-tab__loading {
      color: #9ca3af;
    }

    .save-current-tab__spinner {
      border-color: #444;
      border-top-color: #60a5fa;
    }

    .save-current-tab__message {
      color: #9ca3af;
    }

    .save-current-tab__preview {
      background-color: #1f2937;
    }

    .save-current-tab__title {
      color: #f0f0f0;
    }

    .save-current-tab__url {
      color: #9ca3af;
    }

    .save-current-tab__restricted {
      background-color: #422006;
      color: #fbbf24;
    }

    .save-current-tab__button {
      background-color: #2563eb;
    }

    .save-current-tab__button:hover:not(:disabled) {
      background-color: #1d4ed8;
    }

    .save-current-tab__button:disabled {
      background-color: #4b5563;
    }
  }
`;

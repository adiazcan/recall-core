/**
 * SaveProgress Component
 *
 * Displays loading, success, and error states for save operations.
 * Reusable for both single and batch save operations.
 */

import type { JSX } from 'react';
import type { ExtensionErrorCode } from '../../types';

export type SaveStatus = 'idle' | 'saving' | 'success' | 'dedupe' | 'error';

export interface SaveProgressProps {
  status: SaveStatus;
  /** Error message when status is 'error' */
  errorMessage?: string;
  /** Error code for retry logic */
  errorCode?: ExtensionErrorCode;
  /** Item title for success message */
  savedTitle?: string;
  /** Callback when user clicks retry */
  onRetry?: () => void;
  /** Callback when user clicks dismiss */
  onDismiss?: () => void;
  /** Callback when user needs to sign in due to auth error */
  onSignIn?: () => void;
  /** Batch mode: current number being processed */
  batchCurrent?: number;
  /** Batch mode: total items in batch */
  batchTotal?: number;
}

/**
 * Maps error codes to user-friendly messages
 */
function getErrorDisplayMessage(code: ExtensionErrorCode | undefined, fallback: string): string {
  switch (code) {
    case 'AUTH_REQUIRED':
      return 'Please sign in to save items';
    case 'AUTH_FAILED':
      return 'Authentication failed. Please sign in again.';
    case 'AUTH_CANCELLED':
      return 'Sign-in was cancelled';
    case 'TOKEN_EXPIRED':
    case 'TOKEN_REFRESH_FAILED':
      return 'Session expired. Please sign in again.';
    case 'NETWORK_ERROR':
      return 'Network error. Check your connection and try again.';
    case 'API_ERROR':
      return 'Server error. Please try again later.';
    case 'RESTRICTED_URL':
      return 'This page cannot be saved';
    case 'INVALID_URL':
      return 'Invalid URL';
    default:
      return fallback;
  }
}

/**
 * Determines if the error is auth-related and requires re-authentication
 */
function isAuthError(code: ExtensionErrorCode | undefined): boolean {
  return (
    code === 'AUTH_REQUIRED' ||
    code === 'AUTH_FAILED' ||
    code === 'TOKEN_EXPIRED' ||
    code === 'TOKEN_REFRESH_FAILED'
  );
}

/**
 * Determines if retry should be offered based on error code
 */
function isRetryable(code: ExtensionErrorCode | undefined): boolean {
  return code === 'NETWORK_ERROR' || code === 'API_ERROR' || code === 'UNKNOWN';
}

/** Status-specific container styles */
const statusContainerStyles: Record<SaveStatus, string> = {
  idle: '',
  saving: 'bg-blue-50 border-blue-200 dark:bg-blue-950 dark:border-blue-800',
  success: 'bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800',
  dedupe: 'bg-yellow-50 border-yellow-200 dark:bg-yellow-950 dark:border-yellow-800',
  error: 'bg-red-50 border-red-200 dark:bg-red-950 dark:border-red-800',
};

export function SaveProgress({
  status,
  errorMessage,
  errorCode,
  savedTitle,
  onRetry,
  onDismiss,
  onSignIn,
  batchCurrent,
  batchTotal,
}: SaveProgressProps): JSX.Element | null {
  if (status === 'idle') {
    return null;
  }

  const showSignIn = isAuthError(errorCode) && onSignIn;
  const isBatchMode = batchTotal !== undefined && batchTotal > 1;

  return (
    <div className={`p-3 rounded-md border mt-3 ${statusContainerStyles[status]}`}>
      {status === 'saving' && (
        <div className="flex items-center gap-2">
          <span
            className="w-4 h-4 border-2 border-gray-200 border-t-blue-500 rounded-full animate-spin dark:border-gray-600 dark:border-t-blue-400"
            aria-hidden="true"
          />
          <span className="text-[13px] text-gray-700 dark:text-gray-200">
            {isBatchMode
              ? `Saving ${batchCurrent ?? 0} of ${batchTotal}...`
              : 'Saving...'}
          </span>
        </div>
      )}

      {status === 'success' && (
        <div className="flex items-center gap-2">
          <span
            className="w-5 h-5 flex items-center justify-center rounded-full bg-green-500 text-white text-xs font-bold"
            aria-hidden="true"
          >
            ✓
          </span>
          <span className="flex-1 text-[13px] text-gray-700 dark:text-gray-200 overflow-hidden text-ellipsis whitespace-nowrap">
            Saved{savedTitle ? `: ${truncateTitle(savedTitle)}` : '!'}
          </span>
          {onDismiss && (
            <button
              type="button"
              className="px-1.5 py-0.5 text-base leading-none text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              onClick={onDismiss}
              aria-label="Dismiss"
            >
              ×
            </button>
          )}
        </div>
      )}

      {status === 'dedupe' && (
        <div className="flex items-center gap-2">
          <span
            className="w-5 h-5 flex items-center justify-center rounded-full bg-yellow-500 text-white text-xs font-bold"
            aria-hidden="true"
          >
            ✓
          </span>
          <span className="flex-1 text-[13px] text-gray-700 dark:text-gray-200">Already saved</span>
          {onDismiss && (
            <button
              type="button"
              className="px-1.5 py-0.5 text-base leading-none text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              onClick={onDismiss}
              aria-label="Dismiss"
            >
              ×
            </button>
          )}
        </div>
      )}

      {status === 'error' && (
        <div className="flex items-center gap-2">
          <span
            className="w-5 h-5 flex items-center justify-center rounded-full bg-red-500 text-white text-xs font-bold"
            aria-hidden="true"
          >
            !
          </span>
          <span className="flex-1 text-[13px] text-gray-700 dark:text-gray-200 overflow-hidden text-ellipsis whitespace-nowrap">
            {getErrorDisplayMessage(errorCode, errorMessage ?? 'Failed to save')}
          </span>
          <div className="flex items-center gap-1">
            {showSignIn && (
              <button
                type="button"
                className="px-2 py-1 text-xs font-medium text-white bg-blue-500 rounded hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700"
                onClick={onSignIn}
              >
                Sign in
              </button>
            )}
            {!showSignIn && isRetryable(errorCode) && onRetry && (
              <button
                type="button"
                className="px-2 py-1 text-xs text-blue-500 border border-blue-500 rounded hover:bg-blue-50 dark:text-blue-400 dark:border-blue-400 dark:hover:bg-blue-950"
                onClick={onRetry}
              >
                Retry
              </button>
            )}
            {onDismiss && (
              <button
                type="button"
                className="px-1.5 py-0.5 text-base leading-none text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                onClick={onDismiss}
                aria-label="Dismiss"
              >
                ×
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Truncates title for display
 */
function truncateTitle(title: string, maxLength: number = 40): string {
  if (title.length <= maxLength) {
    return title;
  }
  return title.substring(0, maxLength - 3) + '...';
}

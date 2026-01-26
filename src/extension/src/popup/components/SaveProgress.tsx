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
 * Determines if retry should be offered based on error code
 */
function isRetryable(code: ExtensionErrorCode | undefined): boolean {
  return code === 'NETWORK_ERROR' || code === 'API_ERROR' || code === 'UNKNOWN';
}

export function SaveProgress({
  status,
  errorMessage,
  errorCode,
  savedTitle,
  onRetry,
  onDismiss,
}: SaveProgressProps): JSX.Element | null {
  if (status === 'idle') {
    return null;
  }

  return (
    <div className={`save-progress save-progress--${status}`}>
      {status === 'saving' && (
        <div className="save-progress__content">
          <span className="save-progress__spinner" aria-hidden="true" />
          <span className="save-progress__text">Saving...</span>
        </div>
      )}

      {status === 'success' && (
        <div className="save-progress__content save-progress__content--success">
          <span className="save-progress__icon" aria-hidden="true">
            ✓
          </span>
          <span className="save-progress__text">
            Saved{savedTitle ? `: ${truncateTitle(savedTitle)}` : '!'}
          </span>
          {onDismiss && (
            <button
              type="button"
              className="save-progress__dismiss"
              onClick={onDismiss}
              aria-label="Dismiss"
            >
              ×
            </button>
          )}
        </div>
      )}

      {status === 'dedupe' && (
        <div className="save-progress__content save-progress__content--dedupe">
          <span className="save-progress__icon" aria-hidden="true">
            ✓
          </span>
          <span className="save-progress__text">Already saved</span>
          {onDismiss && (
            <button
              type="button"
              className="save-progress__dismiss"
              onClick={onDismiss}
              aria-label="Dismiss"
            >
              ×
            </button>
          )}
        </div>
      )}

      {status === 'error' && (
        <div className="save-progress__content save-progress__content--error">
          <span className="save-progress__icon" aria-hidden="true">
            !
          </span>
          <span className="save-progress__text">
            {getErrorDisplayMessage(errorCode, errorMessage ?? 'Failed to save')}
          </span>
          <div className="save-progress__actions">
            {isRetryable(errorCode) && onRetry && (
              <button
                type="button"
                className="save-progress__action"
                onClick={onRetry}
              >
                Retry
              </button>
            )}
            {onDismiss && (
              <button
                type="button"
                className="save-progress__dismiss"
                onClick={onDismiss}
                aria-label="Dismiss"
              >
                ×
              </button>
            )}
          </div>
        </div>
      )}

      <style>{`
        .save-progress {
          padding: 12px;
          border-radius: 6px;
          margin-top: 12px;
        }

        .save-progress--saving {
          background-color: #f0f9ff;
          border: 1px solid #bae6fd;
        }

        .save-progress--success {
          background-color: #f0fdf4;
          border: 1px solid #bbf7d0;
        }

        .save-progress--dedupe {
          background-color: #fefce8;
          border: 1px solid #fef08a;
        }

        .save-progress--error {
          background-color: #fef2f2;
          border: 1px solid #fecaca;
        }

        .save-progress__content {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .save-progress__spinner {
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

        .save-progress__icon {
          width: 20px;
          height: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          font-size: 12px;
          font-weight: bold;
        }

        .save-progress__content--success .save-progress__icon {
          background-color: #22c55e;
          color: white;
        }

        .save-progress__content--dedupe .save-progress__icon {
          background-color: #eab308;
          color: white;
        }

        .save-progress__content--error .save-progress__icon {
          background-color: #ef4444;
          color: white;
        }

        .save-progress__text {
          flex: 1;
          font-size: 13px;
          color: #374151;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .save-progress__actions {
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .save-progress__action {
          padding: 4px 8px;
          font-size: 12px;
          color: #3b82f6;
          background: none;
          border: 1px solid #3b82f6;
          border-radius: 4px;
          cursor: pointer;
        }

        .save-progress__action:hover {
          background-color: #eff6ff;
        }

        .save-progress__dismiss {
          padding: 2px 6px;
          font-size: 16px;
          line-height: 1;
          color: #9ca3af;
          background: none;
          border: none;
          cursor: pointer;
        }

        .save-progress__dismiss:hover {
          color: #6b7280;
        }

        @media (prefers-color-scheme: dark) {
          .save-progress--saving {
            background-color: #1e3a5f;
            border-color: #1d4ed8;
          }

          .save-progress--success {
            background-color: #14532d;
            border-color: #166534;
          }

          .save-progress--dedupe {
            background-color: #422006;
            border-color: #a16207;
          }

          .save-progress--error {
            background-color: #450a0a;
            border-color: #991b1b;
          }

          .save-progress__text {
            color: #f0f0f0;
          }

          .save-progress__spinner {
            border-color: #444;
            border-top-color: #60a5fa;
          }

          .save-progress__action {
            color: #60a5fa;
            border-color: #60a5fa;
          }

          .save-progress__action:hover {
            background-color: #1e3a5f;
          }

          .save-progress__dismiss {
            color: #6b7280;
          }

          .save-progress__dismiss:hover {
            color: #9ca3af;
          }
        }
      `}</style>
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

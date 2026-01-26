/**
 * Extension Service Worker
 *
 * MV3 background service worker that handles:
 * - Message routing from popup and side panel
 * - Authentication flow coordination
 * - API calls to Recall backend
 * - Keyboard command handling
 */

import {
  createMessageListener,
  successResponse,
  errorResponse,
  type MessageHandlers,
} from '../services/messaging';
import {
  signIn,
  signOut,
  refreshAccessToken,
  getAuthState,
  AuthError,
} from '../services/auth';
import { saveItem, validateUrl, ApiError } from '../services/api';
import type {
  GetAuthStateMessage,
  SignInMessage,
  SignOutMessage,
  RefreshTokenMessage,
  OpenSidePanelMessage,
  SaveUrlMessage,
  SaveUrlsMessage,
  MessageResponse,
  AuthStateResponse,
  SaveResult,
  BatchSaveResult,
} from '../types';

const isDev = import.meta.env.MODE !== 'production';
const debugLog = (...args: unknown[]): void => {
  if (isDev) {
    console.log(...args);
  }
};

debugLog('[ServiceWorker] Initializing...');

// =============================================================================
// Message Handlers
// =============================================================================

/**
 * Handles GET_AUTH_STATE message
 */
async function handleGetAuthState(
  _message: GetAuthStateMessage
): Promise<MessageResponse<AuthStateResponse>> {
  try {
    const state = await getAuthState();
    return successResponse(state);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to get auth state';
    return errorResponse(message, 'AUTH_FAILED');
  }
}

/**
 * Handles SIGN_IN message
 */
async function handleSignIn(
  _message: SignInMessage
): Promise<MessageResponse<AuthStateResponse>> {
  try {
    const auth = await signIn();
    const state: AuthStateResponse = {
      isAuthenticated: true,
      user: auth.user,
      expiresAt: auth.expiresAt,
    };
    return successResponse(state);
  } catch (error) {
    if (error instanceof AuthError) {
      return errorResponse(error.message, error.code);
    }
    const message = error instanceof Error ? error.message : 'Sign in failed';
    return errorResponse(message, 'AUTH_FAILED');
  }
}

/**
 * Handles SIGN_OUT message
 */
async function handleSignOut(
  _message: SignOutMessage
): Promise<MessageResponse<void>> {
  try {
    await signOut();
    return successResponse(undefined);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Sign out failed';
    return errorResponse(message, 'UNKNOWN');
  }
}

/**
 * Handles REFRESH_TOKEN message
 */
async function handleRefreshToken(
  _message: RefreshTokenMessage
): Promise<MessageResponse<AuthStateResponse>> {
  try {
    const auth = await refreshAccessToken();
    const state: AuthStateResponse = {
      isAuthenticated: true,
      user: auth.user,
      expiresAt: auth.expiresAt,
    };
    return successResponse(state);
  } catch (error) {
    if (error instanceof AuthError) {
      return errorResponse(error.message, error.code);
    }
    const message = error instanceof Error ? error.message : 'Token refresh failed';
    return errorResponse(message, 'TOKEN_REFRESH_FAILED');
  }
}

/**
 * Handles OPEN_SIDE_PANEL message
 */
async function handleOpenSidePanel(
  message: OpenSidePanelMessage
): Promise<MessageResponse<void>> {
  try {
    await chrome.sidePanel.open({ windowId: message.payload.windowId });
    return successResponse(undefined);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to open side panel';
    return errorResponse(errorMessage, 'UNKNOWN');
  }
}

/**
 * Handles SAVE_URL message
 */
async function handleSaveUrl(
  message: SaveUrlMessage
): Promise<MessageResponse<SaveResult>> {
  const { url, title, tags } = message.payload;

  // Validate URL first
  const validation = validateUrl(url);
  if (!validation.valid) {
    return successResponse({
      success: false,
      isNew: false,
      error: validation.error,
      errorCode: validation.code,
    });
  }

  try {
    const result = await saveItem(url, title, tags);
    return successResponse(result);
  } catch (error) {
    if (error instanceof ApiError) {
      return successResponse({
        success: false,
        isNew: false,
        error: error.message,
        errorCode: error.code,
      });
    }
    if (error instanceof AuthError) {
      return successResponse({
        success: false,
        isNew: false,
        error: error.message,
        errorCode: error.code,
      });
    }
    const errorMessage = error instanceof Error ? error.message : 'Failed to save URL';
    return successResponse({
      success: false,
      isNew: false,
      error: errorMessage,
      errorCode: 'UNKNOWN',
    });
  }
}

// =============================================================================
// Batch Save Implementation
// =============================================================================

/** Maximum concurrent requests for batch operations */
const BATCH_CONCURRENCY_LIMIT = 3;

/**
 * Processes items in batches with limited concurrency
 *
 * @param items - Array of items to process
 * @param processor - Function to process each item
 * @param concurrencyLimit - Maximum concurrent operations
 */
async function processWithConcurrency<T, R>(
  items: T[],
  processor: (item: T, index: number) => Promise<R>,
  concurrencyLimit: number
): Promise<R[]> {
  const results: R[] = new Array(items.length);

  // Process in chunks to maintain concurrency limit
  for (let i = 0; i < items.length; i += concurrencyLimit) {
    const chunk = items.slice(i, i + concurrencyLimit);
    const chunkPromises = chunk.map((item, chunkIndex) => {
      const actualIndex = i + chunkIndex;
      return processor(item, actualIndex)
        .then((result) => {
          results[actualIndex] = result;
        })
        .catch((error) => {
          // Should not happen as processor catches errors, but handle just in case
          console.error(`[processWithConcurrency] Unexpected error at index ${actualIndex}:`, error);
          results[actualIndex] = {
            success: false,
            isNew: false,
            error: error instanceof Error ? error.message : 'Processing failed',
            errorCode: 'UNKNOWN',
            index: actualIndex,
            url: '',
          } as R;
        });
    });

    await Promise.all(chunkPromises);
  }

  return results;
}

/**
 * Handles SAVE_URLS message for batch save operations
 */
async function handleSaveUrls(
  message: SaveUrlsMessage
): Promise<MessageResponse<BatchSaveResult>> {
  const { items } = message.payload;

  if (!items || items.length === 0) {
    return successResponse({
      total: 0,
      created: 0,
      deduplicated: 0,
      failed: 0,
      results: [],
    });
  }

  debugLog('[ServiceWorker] Starting batch save of', items.length, 'items');

  // Process items with concurrency limit
  const results = await processWithConcurrency(
    items,
    async (item, index) => {
      const { url, title } = item;

      try {
        // Validate URL first
        const validation = validateUrl(url);
        if (!validation.valid) {
          return {
            success: false,
            isNew: false,
            error: validation.error,
            errorCode: validation.code,
            index,
            url,
          };
        }

        const saveResult = await saveItem(url, title);
        debugLog(
          `[ServiceWorker] Batch item ${index + 1}/${items.length}:`,
          saveResult.success ? (saveResult.isNew ? 'created' : 'dedupe') : 'failed'
        );
        return { ...saveResult, index, url };
      } catch (error) {
        let errorMessage: string;
        let errorCode: SaveResult['errorCode'];

        if (error instanceof ApiError) {
          errorMessage = error.message;
          errorCode = error.code;
        } else if (error instanceof AuthError) {
          errorMessage = error.message;
          errorCode = error.code;
        } else {
          errorMessage = error instanceof Error ? error.message : 'Failed to save';
          errorCode = 'UNKNOWN';
        }

        return {
          success: false,
          isNew: false,
          error: errorMessage,
          errorCode,
          index,
          url,
        };
      }
    },
    BATCH_CONCURRENCY_LIMIT
  );

  // Calculate summary
  let created = 0;
  let deduplicated = 0;
  let failed = 0;

  for (const result of results) {
    if (result.success) {
      if (result.isNew) {
        created++;
      } else {
        deduplicated++;
      }
    } else {
      failed++;
    }
  }

  debugLog(
    `[ServiceWorker] Batch save complete: ${created} created, ${deduplicated} deduplicated, ${failed} failed`
  );

  return successResponse({
    total: items.length,
    created,
    deduplicated,
    failed,
    results,
  });
}

// =============================================================================
// Message Handler Registry
// =============================================================================

const messageHandlers: MessageHandlers = {
  GET_AUTH_STATE: handleGetAuthState,
  SIGN_IN: handleSignIn,
  SIGN_OUT: handleSignOut,
  REFRESH_TOKEN: handleRefreshToken,
  OPEN_SIDE_PANEL: handleOpenSidePanel,
  SAVE_URL: handleSaveUrl,
  SAVE_URLS: handleSaveUrls,
};

// Register message listener
chrome.runtime.onMessage.addListener(createMessageListener(messageHandlers));

// =============================================================================
// Lifecycle Events
// =============================================================================

/**
 * Handle installation
 */
chrome.runtime.onInstalled.addListener((details): void => {
  debugLog('[ServiceWorker] Extension installed:', details.reason);

  // Set up side panel behavior - open on action click option
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false }).catch((error) => {
    console.error('[ServiceWorker] Failed to set panel behavior:', error);
  });
});

/**
 * Handle startup
 */
chrome.runtime.onStartup.addListener(async (): Promise<void> => {
  debugLog('[ServiceWorker] Browser started');
});

// =============================================================================
// Command Handlers
// =============================================================================

/**
 * Handle keyboard commands
 */
chrome.commands.onCommand.addListener((command): void => {
  debugLog('[ServiceWorker] Command received:', command);

  if (command === 'save-current-tab') {
    // Will be implemented in Phase 3 (T020)
    handleSaveCurrentTabCommand();
  }
});

/**
 * Handles the save-current-tab keyboard shortcut
 * Gets the active tab and saves its URL to Recall
 */
async function handleSaveCurrentTabCommand(): Promise<void> {
  debugLog('[ServiceWorker] save-current-tab command triggered');

  try {
    // Get the active tab in the current window
    const [activeTab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });

    if (!activeTab || !activeTab.url) {
      console.warn('[ServiceWorker] No active tab or URL found');
      // Could show a notification here in the future
      return;
    }

    // Validate URL
    const validation = validateUrl(activeTab.url);
    if (!validation.valid) {
      console.warn('[ServiceWorker] Cannot save URL:', validation.error);
      // Could show a notification here in the future
      return;
    }

    // Save the URL
    const result = await saveItem(activeTab.url, activeTab.title);

    if (result.success) {
      debugLog('[ServiceWorker] URL saved successfully:', result.item?.id);
      // Could show a success badge/notification here in the future
    } else {
      console.error('[ServiceWorker] Failed to save URL:', result.error);
      // Could show an error notification here in the future
    }
  } catch (error) {
    console.error('[ServiceWorker] Error saving current tab:', error);
  }
}

debugLog('[ServiceWorker] Initialization complete');

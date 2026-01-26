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
  MessageResponse,
  AuthStateResponse,
  SaveResult,
} from '../types';

console.log('[ServiceWorker] Initializing...');

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
// Message Handler Registry
// =============================================================================

const messageHandlers: MessageHandlers = {
  GET_AUTH_STATE: handleGetAuthState,
  SIGN_IN: handleSignIn,
  SIGN_OUT: handleSignOut,
  REFRESH_TOKEN: handleRefreshToken,
  OPEN_SIDE_PANEL: handleOpenSidePanel,
  SAVE_URL: handleSaveUrl,
  // SAVE_URLS will be added in Phase 5
};

// Register message listener
chrome.runtime.onMessage.addListener(createMessageListener(messageHandlers));

// =============================================================================
// Lifecycle Events
// =============================================================================

/**
 * Handle installation
 */
chrome.runtime.onInstalled.addListener((details) => {
  console.log('[ServiceWorker] Extension installed:', details.reason);

  // Set up side panel behavior - open on action click option
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false }).catch((error) => {
    console.error('[ServiceWorker] Failed to set panel behavior:', error);
  });
});

/**
 * Handle startup
 */
chrome.runtime.onStartup.addListener(async (): Promise<void> => {
  console.log('[ServiceWorker] Browser started');
});

// =============================================================================
// Command Handlers
// =============================================================================

/**
 * Handle keyboard commands
 */
chrome.commands.onCommand.addListener((command) => {
  console.log('[ServiceWorker] Command received:', command);

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
  console.log('[ServiceWorker] save-current-tab command triggered');

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
      console.log('[ServiceWorker] URL saved successfully:', result.item?.id);
      // Could show a success badge/notification here in the future
    } else {
      console.error('[ServiceWorker] Failed to save URL:', result.error);
      // Could show an error notification here in the future
    }
  } catch (error) {
    console.error('[ServiceWorker] Error saving current tab:', error);
  }
}

console.log('[ServiceWorker] Initialization complete');

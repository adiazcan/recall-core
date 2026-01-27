/**
 * Chrome Runtime Message Helpers
 *
 * Provides typed message sending and receiving utilities for communication
 * between extension components (popup, side panel, service worker).
 */

import type {
  ExtensionMessage,
  MessageResponse,
  AuthStateResponse,
  SaveResult,
  BatchSaveResult,
  ExtensionErrorCode,
} from '../types';

/** Default timeout for message responses (10 seconds) */
const MESSAGE_TIMEOUT_MS = 10000;

/**
 * Sends a message to the service worker and awaits a typed response
 *
 * @param message - The message to send
 * @param timeoutMs - Optional timeout in milliseconds (default: 10000)
 * @returns Promise resolving to the response
 * @throws Error if the message fails, times out, or response indicates an error
 */
export async function sendMessage<T>(
  message: ExtensionMessage,
  timeoutMs: number = MESSAGE_TIMEOUT_MS
): Promise<MessageResponse<T>> {
  console.log('[Messaging] sendMessage called:', message.type);
  
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      console.log('[Messaging] TIMEOUT for:', message.type);
      reject(new Error(`Message timeout: ${message.type} did not receive a response within ${timeoutMs}ms`));
    }, timeoutMs);

    try {
      console.log('[Messaging] Calling chrome.runtime.sendMessage...');
      chrome.runtime.sendMessage(message, (response: MessageResponse<T>) => {
        clearTimeout(timeoutId);
        console.log('[Messaging] Got response for', message.type, ':', response, 'lastError:', chrome.runtime.lastError);
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        if (response === undefined) {
          reject(new Error(`No response received for message: ${message.type}`));
          return;
        }
        resolve(response);
      });
    } catch (error) {
      clearTimeout(timeoutId);
      console.log('[Messaging] Exception:', error);
      reject(error instanceof Error ? error : new Error(String(error)));
    }
  });
}

/**
 * Sends a message and unwraps the response, throwing on error
 *
 * @param message - The message to send
 * @returns Promise resolving to the unwrapped data
 * @throws MessageError if the response indicates an error
 */
export async function sendMessageAndUnwrap<T>(
  message: ExtensionMessage
): Promise<T> {
  const response = await sendMessage<T>(message);

  if (!response.success) {
    throw new MessageError(response.error, response.errorCode);
  }

  return response.data;
}

// =============================================================================
// Typed Message Senders
// =============================================================================

/**
 * Requests the current authentication state
 */
export async function getAuthState(): Promise<AuthStateResponse> {
  return sendMessageAndUnwrap<AuthStateResponse>({
    type: 'GET_AUTH_STATE',
  });
}

/**
 * Initiates OAuth sign-in flow
 */
export async function signIn(): Promise<AuthStateResponse> {
  return sendMessageAndUnwrap<AuthStateResponse>({
    type: 'SIGN_IN',
  });
}

/**
 * Signs out and clears stored tokens
 */
export async function signOut(): Promise<void> {
  await sendMessageAndUnwrap<void>({
    type: 'SIGN_OUT',
  });
}

/**
 * Forces a token refresh
 */
export async function refreshToken(): Promise<AuthStateResponse> {
  return sendMessageAndUnwrap<AuthStateResponse>({
    type: 'REFRESH_TOKEN',
  });
}

/**
 * Saves a single URL to Recall
 */
export async function saveUrl(
  url: string,
  title?: string,
  tags?: string[]
): Promise<SaveResult> {
  return sendMessageAndUnwrap<SaveResult>({
    type: 'SAVE_URL',
    payload: { url, title, tags },
  });
}

/**
 * Saves multiple URLs in batch
 */
export async function saveUrls(
  items: Array<{ url: string; title?: string }>
): Promise<BatchSaveResult> {
  return sendMessageAndUnwrap<BatchSaveResult>({
    type: 'SAVE_URLS',
    payload: { items },
  });
}

/**
 * Opens the side panel
 */
export async function openSidePanel(windowId: number): Promise<void> {
  await sendMessageAndUnwrap<void>({
    type: 'OPEN_SIDE_PANEL',
    payload: { windowId },
  });
}

// =============================================================================
// Response Builders (for service worker use)
// =============================================================================

/**
 * Creates a success response
 */
export function successResponse<T>(data: T): MessageResponse<T> {
  return { success: true, data };
}

/**
 * Creates an error response
 */
export function errorResponse<T>(
  error: string,
  errorCode: ExtensionErrorCode = 'UNKNOWN'
): MessageResponse<T> {
  return { success: false, error, errorCode };
}

// =============================================================================
// Error Types
// =============================================================================

/**
 * Error class for message-related errors
 */
export class MessageError extends Error {
  public readonly code: ExtensionErrorCode;

  constructor(message: string, code: ExtensionErrorCode = 'UNKNOWN') {
    super(message);
    this.name = 'MessageError';
    this.code = code;
  }
}

// =============================================================================
// Message Listener Registration Helper (for service worker)
// =============================================================================

/**
 * Type for message handler functions
 */
export type MessageHandler<T extends ExtensionMessage = ExtensionMessage> = (
  message: T,
  sender: chrome.runtime.MessageSender
) => Promise<MessageResponse<unknown>>;

/**
 * Message handler registry type
 */
export type MessageHandlers = {
  [K in ExtensionMessage['type']]?: MessageHandler<
    Extract<ExtensionMessage, { type: K }>
  >;
};

/**
 * Creates a message listener that routes messages to handlers
 *
 * @param handlers - Map of message types to handler functions
 * @returns Function to be passed to chrome.runtime.onMessage.addListener
 */
export function createMessageListener(
  handlers: MessageHandlers
): (
  message: ExtensionMessage,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response: MessageResponse<unknown>) => void
) => boolean {
  return (message, sender, sendResponse) => {
    console.log('[MessageListener] Received message:', message?.type, 'from:', sender?.id);
    
    if (!message || typeof message !== 'object' || !('type' in message)) {
      console.log('[MessageListener] Invalid message format:', message);
      return false;
    }
    
    const handler = handlers[message.type];

    if (!handler) {
      console.warn('[MessageListener] Unknown message type:', message.type);
      sendResponse(errorResponse('Unknown message type'));
      return false;
    }

    console.log('[MessageListener] Found handler for:', message.type);

    // Helper to safely call sendResponse (may fail if channel is closed)
    const safeSendResponse = (response: MessageResponse<unknown>): void => {
      try {
        console.log('[MessageListener] Sending response for:', message.type);
        sendResponse(response);
      } catch (err) {
        console.warn('[MessageListener] Failed to send response (channel may be closed):', err);
      }
    };

    // Execute handler asynchronously
    handler(message as never, sender)
      .then((response) => {
        safeSendResponse(response);
      })
      .catch((error) => {
        console.error('[MessageListener] Handler error:', error);
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        const errorCode: ExtensionErrorCode =
          error instanceof MessageError ? error.code : 'UNKNOWN';
        safeSendResponse(errorResponse(errorMessage, errorCode));
      });

    // Return true to indicate async response
    return true;
  };
}

/**
 * Messaging service object for dependency injection
 */
export const messaging = {
  sendMessage,
  sendMessageAndUnwrap,
  getAuthState,
  signIn,
  signOut,
  refreshToken,
  saveUrl,
  saveUrls,
  openSidePanel,
  successResponse,
  errorResponse,
  createMessageListener,
};

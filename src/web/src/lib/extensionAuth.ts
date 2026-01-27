/**
 * Extension Authentication Module
 *
 * Handles SSO authentication when the web app is embedded in the
 * browser extension's side panel.
 *
 * Flow:
 * 1. Extension sends RECALL_EXT_AUTH message with access token
 * 2. Web app stores the token and uses it for API calls
 * 3. Web app can request fresh token via RECALL_REQUEST_TOKEN
 */

/** Message type from extension providing auth token */
interface ExtAuthTokenMessage {
  type: 'RECALL_EXT_AUTH';
  accessToken: string;
  expiresAt: number;
}

/** Message type to request token refresh from extension */
interface RequestTokenMessage {
  type: 'RECALL_REQUEST_TOKEN';
}

/** Message type when extension signs out */
interface ExtSignOutMessage {
  type: 'RECALL_EXT_SIGN_OUT';
}

type ExtensionMessage = ExtAuthTokenMessage | RequestTokenMessage | ExtSignOutMessage;

/** Token refresh buffer - request new token 5 minutes before expiry */
const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000;

/** Retry interval for token requests */
const TOKEN_REQUEST_RETRY_MS = 1000;

/** Maximum retries for token request */
const MAX_TOKEN_RETRIES = 10;

/** Stored extension token */
let extensionToken: { accessToken: string; expiresAt: number } | null = null;

/** Listeners for token changes */
const tokenChangeListeners = new Set<(hasToken: boolean) => void>();

/** Token request retry state */
let tokenRequestRetries = 0;
let tokenRequestTimeoutId: ReturnType<typeof setTimeout> | null = null;

/**
 * Checks if the web app is running inside an iframe (extension side panel)
 */
export function isInExtensionFrame(): boolean {
  try {
    return window.self !== window.top;
  } catch {
    // Cross-origin restriction means we're in a frame
    return true;
  }
}

/**
 * Checks if we have a valid extension token
 */
export function hasValidExtensionToken(): boolean {
  if (!extensionToken) {
    return false;
  }
  return extensionToken.expiresAt > Date.now() + TOKEN_REFRESH_BUFFER_MS;
}

/**
 * Gets the extension-provided access token
 * Returns null if no token or token is expired/expiring soon
 */
export function getExtensionToken(): string | null {
  if (!hasValidExtensionToken()) {
    return null;
  }
  return extensionToken!.accessToken;
}

/**
 * Sets the extension token (called when receiving RECALL_EXT_AUTH)
 */
function setExtensionToken(accessToken: string, expiresAt: number): void {
  // Clear any pending retry
  if (tokenRequestTimeoutId) {
    clearTimeout(tokenRequestTimeoutId);
    tokenRequestTimeoutId = null;
  }
  tokenRequestRetries = 0;
  
  extensionToken = { accessToken, expiresAt };
  console.log('[ExtensionAuth] Token received, expires at:', new Date(expiresAt).toISOString());
  notifyTokenChangeListeners(true);
}

/**
 * Clears the extension token (called when receiving RECALL_EXT_SIGN_OUT)
 */
function clearExtensionToken(): void {
  extensionToken = null;
  console.log('[ExtensionAuth] Token cleared (sign out)');
  notifyTokenChangeListeners(false);
}

/**
 * Notifies all listeners of token change
 */
function notifyTokenChangeListeners(hasToken: boolean): void {
  tokenChangeListeners.forEach((listener) => {
    try {
      listener(hasToken);
    } catch (error) {
      console.error('[ExtensionAuth] Listener error:', error);
    }
  });
}

/**
 * Registers a listener for token changes
 * @returns Unsubscribe function
 */
export function onExtensionTokenChange(listener: (hasToken: boolean) => void): () => void {
  tokenChangeListeners.add(listener);
  return () => {
    tokenChangeListeners.delete(listener);
  };
}

/**
 * Requests a fresh token from the extension
 * Call this when the current token is expired or about to expire
 * Will retry automatically if no response received
 */
export function requestTokenFromExtension(): void {
  if (!isInExtensionFrame()) {
    return;
  }

  // Don't request if we already have a valid token
  if (hasValidExtensionToken()) {
    return;
  }

  const message: RequestTokenMessage = {
    type: 'RECALL_REQUEST_TOKEN',
  };

  try {
    console.log('[ExtensionAuth] Requesting token from extension (attempt', tokenRequestRetries + 1, ')');
    window.parent.postMessage(message, '*');
    
    // Schedule retry if we don't receive token
    if (tokenRequestRetries < MAX_TOKEN_RETRIES) {
      tokenRequestTimeoutId = setTimeout(() => {
        if (!hasValidExtensionToken()) {
          tokenRequestRetries++;
          requestTokenFromExtension();
        }
      }, TOKEN_REQUEST_RETRY_MS);
    } else {
      console.warn('[ExtensionAuth] Max retries reached, no token received');
    }
  } catch (error) {
    console.error('[ExtensionAuth] Failed to request token:', error);
  }
}

/**
 * Handles incoming messages from the extension
 */
function handleExtensionMessage(event: MessageEvent): void {
  // Accept messages from any origin when in iframe (extension context)
  // The extension validates origin on its side
  const data = event.data as ExtensionMessage | undefined;
  
  if (!data || typeof data !== 'object' || !('type' in data)) {
    return;
  }

  console.log('[ExtensionAuth] Received message:', data.type);

  switch (data.type) {
    case 'RECALL_EXT_AUTH': {
      const { accessToken, expiresAt } = data as ExtAuthTokenMessage;
      if (accessToken && typeof expiresAt === 'number') {
        setExtensionToken(accessToken, expiresAt);
      } else {
        console.warn('[ExtensionAuth] Invalid token message:', { hasToken: !!accessToken, expiresAt });
      }
      break;
    }
    case 'RECALL_EXT_SIGN_OUT': {
      clearExtensionToken();
      break;
    }
  }
}

/** Flag to track if listener is registered */
let isListenerRegistered = false;

/**
 * Initializes extension auth message listener
 * Safe to call multiple times - only registers once
 */
export function initExtensionAuth(): void {
  if (isListenerRegistered) {
    return;
  }

  if (!isInExtensionFrame()) {
    console.log('[ExtensionAuth] Not in extension frame, skipping init');
    return;
  }

  console.log('[ExtensionAuth] Initializing in extension frame');
  window.addEventListener('message', handleExtensionMessage);
  isListenerRegistered = true;
  
  // Request initial token from extension
  requestTokenFromExtension();
}

/**
 * Extension auth module
 */
export const extensionAuth = {
  isInExtensionFrame,
  hasValidExtensionToken,
  getExtensionToken,
  requestTokenFromExtension,
  onExtensionTokenChange,
  initExtensionAuth,
};

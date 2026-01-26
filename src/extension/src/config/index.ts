/**
 * Environment-Aware Configuration Module
 *
 * Provides typed access to environment variables and centralized configuration.
 * Uses Vite's import.meta.env for environment variable access.
 */

/// <reference types="vite/client" />

/**
 * Configuration interface for the extension
 */
export interface ExtensionConfig {
  /** Base URL for the Recall API */
  apiBaseUrl: string;
  /** URL of the Recall web app (for side panel embedding) */
  webAppUrl: string;
  /** Entra External ID authority URL */
  entraAuthority: string;
  /** Entra client ID for the extension */
  entraClientId: string;
  /** OAuth redirect URL (chromiumapp.org) */
  entraRedirectUrl: string;
  /** API scope for access token */
  apiScope: string;
  /** Whether running in development mode */
  isDevelopment: boolean;
}

/**
 * Gets environment variable with fallback
 */
function getEnvVar(
  key: string,
  fallback: string
): string {
  const value = import.meta.env[key] as string | undefined;
  return value ?? fallback;
}

/**
 * Extension configuration singleton
 *
 * Loads configuration from environment variables with sensible defaults
 * for development environments.
 */
export const config: ExtensionConfig = {
  apiBaseUrl: getEnvVar('VITE_API_BASE_URL', 'http://localhost:5080'),
  webAppUrl: getEnvVar('VITE_WEB_APP_URL', 'http://localhost:5169'),
  entraAuthority: getEnvVar('VITE_ENTRA_AUTHORITY', ''),
  entraClientId: getEnvVar('VITE_ENTRA_CLIENT_ID', ''),
  entraRedirectUrl: getEnvVar('VITE_ENTRA_REDIRECT_URL', ''),
  apiScope: getEnvVar('VITE_API_SCOPE', ''),
  isDevelopment: import.meta.env.DEV ?? true,
};

/**
 * Validates that required configuration is present
 *
 * @returns Array of missing configuration keys or empty array if valid
 */
export function validateConfig(): string[] {
  const missing: string[] = [];
  const required: (keyof ExtensionConfig)[] = [
    'apiBaseUrl',
    'webAppUrl',
    'entraAuthority',
    'entraClientId',
    'entraRedirectUrl',
    'apiScope',
  ];

  for (const key of required) {
    if (!config[key]) {
      missing.push(key);
    }
  }

  return missing;
}

/**
 * Checks if authentication is properly configured
 */
export function isAuthConfigured(): boolean {
  return Boolean(
    config.entraAuthority &&
    config.entraClientId &&
    config.entraRedirectUrl &&
    config.apiScope
  );
}

/**
 * Builds the OAuth authorize URL for Entra External ID
 *
 * @param codeChallenge - PKCE code challenge
 * @param state - OAuth state parameter
 * @returns Full authorization URL
 */
export function buildAuthorizationUrl(
  codeChallenge: string,
  state: string
): string {
  const params = new URLSearchParams({
    client_id: config.entraClientId,
    response_type: 'code',
    redirect_uri: config.entraRedirectUrl,
    scope: `openid profile email offline_access ${config.apiScope}`,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    state,
    response_mode: 'query',
  });

  return `${config.entraAuthority}/oauth2/v2.0/authorize?${params.toString()}`;
}

/**
 * Gets the token endpoint URL for Entra External ID
 */
export function getTokenEndpoint(): string {
  return `${config.entraAuthority}/oauth2/v2.0/token`;
}

/**
 * Gets the allowed origins for postMessage communication with web app
 */
export function getAllowedWebAppOrigin(): string {
  try {
    const url = new URL(config.webAppUrl);
    return url.origin;
  } catch {
    return config.webAppUrl;
  }
}

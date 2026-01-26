/**
 * API Client Service
 *
 * Handles API calls to the Recall backend with automatic Bearer token
 * attachment and error handling.
 */

import { config } from '../config';
import { getValidAccessToken, AuthError } from './auth';
import type {
  CreateItemRequest,
  ItemDto,
  ApiErrorResponse,
  SaveResult,
  ExtensionErrorCode,
} from '../types';

/**
 * List of URL schemes that cannot be saved (browser-restricted)
 */
const RESTRICTED_URL_SCHEMES = [
  'chrome:',
  'chrome-extension:',
  'edge:',
  'about:',
  'data:',
  'file:',
  'javascript:',
  'blob:',
  'view-source:',
  'devtools:',
  'chrome-devtools:',
];

/**
 * List of URL patterns that cannot be saved
 */
const RESTRICTED_URL_PATTERNS = [
  /^chrome\.google\.com\/webstore/,
  /^microsoftedge\.microsoft\.com\/addons/,
  /^addons\.mozilla\.org/,
];

// =============================================================================
// URL Validation
// =============================================================================

/**
 * Checks if a URL is valid for saving
 */
export function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Checks if a URL is restricted (browser internal pages)
 */
export function isRestrictedUrl(url: string): boolean {
  // Check schemes
  const lowerUrl = url.toLowerCase();
  for (const scheme of RESTRICTED_URL_SCHEMES) {
    if (lowerUrl.startsWith(scheme)) {
      return true;
    }
  }

  // Check patterns
  try {
    const parsed = new URL(url);
    const hostPath = `${parsed.host}${parsed.pathname}`;
    for (const pattern of RESTRICTED_URL_PATTERNS) {
      if (pattern.test(hostPath)) {
        return true;
      }
    }
  } catch {
    // Invalid URL - will be caught by isValidUrl
  }

  return false;
}

/**
 * Gets the reason why a URL is restricted
 */
export function getRestrictedReason(url: string): string | undefined {
  const lowerUrl = url.toLowerCase();

  if (lowerUrl.startsWith('chrome:') || lowerUrl.startsWith('chrome-extension:')) {
    return 'Chrome internal pages cannot be saved';
  }
  if (lowerUrl.startsWith('edge:')) {
    return 'Edge internal pages cannot be saved';
  }
  if (lowerUrl.startsWith('about:')) {
    return 'Browser about pages cannot be saved';
  }
  if (lowerUrl.startsWith('file:')) {
    return 'Local files cannot be saved';
  }
  if (lowerUrl.startsWith('data:') || lowerUrl.startsWith('blob:')) {
    return 'Data URLs cannot be saved';
  }
  if (lowerUrl.startsWith('javascript:')) {
    return 'JavaScript URLs cannot be saved';
  }

  try {
    const parsed = new URL(url);
    const hostPath = `${parsed.host}${parsed.pathname}`;
    if (/chrome\.google\.com\/webstore/.test(hostPath)) {
      return 'Chrome Web Store pages cannot be saved';
    }
    if (/microsoftedge\.microsoft\.com\/addons/.test(hostPath)) {
      return 'Edge Add-ons pages cannot be saved';
    }
    if (/addons\.mozilla\.org/.test(hostPath)) {
      return 'Firefox Add-ons pages cannot be saved';
    }
  } catch {
    // Invalid URL
  }

  return undefined;
}

/**
 * Validates a URL and returns an error if invalid
 */
export function validateUrl(
  url: string
): { valid: true } | { valid: false; error: string; code: ExtensionErrorCode } {
  if (!url || typeof url !== 'string') {
    return { valid: false, error: 'URL is required', code: 'INVALID_URL' };
  }

  if (!isValidUrl(url)) {
    return { valid: false, error: 'Invalid URL format', code: 'INVALID_URL' };
  }

  if (isRestrictedUrl(url)) {
    return {
      valid: false,
      error: getRestrictedReason(url) ?? 'This URL cannot be saved',
      code: 'RESTRICTED_URL',
    };
  }

  return { valid: true };
}

// =============================================================================
// API Client
// =============================================================================

/**
 * Makes an authenticated API request
 */
function buildApiBaseUrl(): string {
  const trimmed = config.apiBaseUrl.replace(/\/+$/, '');
  return /\/api\/v1$/.test(trimmed) ? trimmed : `${trimmed}/api/v1`;
}

function buildApiUrl(endpoint: string): string {
  const base = buildApiBaseUrl();
  const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${base}${normalizedEndpoint}`;
}

async function apiRequest<T>(
  method: string,
  endpoint: string,
  body?: unknown
): Promise<T> {
  const accessToken = await getValidAccessToken();
  const url = buildApiUrl(endpoint);

  const headers: HeadersInit = {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  };

  const response = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    throw await handleApiError(response);
  }

  // Handle empty response body for 204 No Content
  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

/**
 * Handles API error responses
 */
async function handleApiError(response: Response): Promise<ApiError> {
  let errorMessage = `API error: ${response.status}`;
  let errorCode: ExtensionErrorCode = 'API_ERROR';

  try {
    const errorData = (await response.json()) as ApiErrorResponse;
    if (errorData.error?.message) {
      errorMessage = errorData.error.message;
    }
  } catch {
    // Use default error message
  }

  // Map HTTP status to error codes
  switch (response.status) {
    case 401:
      errorCode = 'AUTH_REQUIRED';
      errorMessage = 'Please sign in to continue';
      break;
    case 403:
      errorCode = 'AUTH_FAILED';
      errorMessage = 'Access denied';
      break;
    case 404:
      errorMessage = 'Resource not found';
      break;
    case 429:
      errorMessage = 'Too many requests. Please try again later.';
      break;
    case 500:
    case 502:
    case 503:
      errorMessage = 'Server error. Please try again later.';
      break;
  }

  return new ApiError(errorCode, errorMessage, response.status);
}

// =============================================================================
// API Methods
// =============================================================================

/**
 * Creates a new item in Recall
 *
 * @param request - The item to create
 * @returns The created item or existing item if deduplicated
 */
export async function createItem(
  request: CreateItemRequest
): Promise<{ item: ItemDto; isNew: boolean }> {
  // Validate URL before making request
  const validation = validateUrl(request.url);
  if (!validation.valid) {
    throw new ApiError(validation.code, validation.error);
  }

  try {
    // Make the API call directly to capture response status
    // API returns 201 for new items, 200 for deduplicated items
    const accessToken = await getValidAccessToken();
    const url = buildApiUrl('/items');

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw await handleApiError(response);
    }

    const item = (await response.json()) as ItemDto;
    // 201 = newly created, 200 = deduplicated (already existed)
    const isNew = response.status === 201;

    return { item, isNew };
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    if (error instanceof AuthError) {
      throw new ApiError(error.code, error.message);
    }
    const message = error instanceof Error ? error.message : 'Failed to save item';
    throw new ApiError('NETWORK_ERROR', message);
  }
}

/**
 * Creates a new item and returns a SaveResult
 */
export async function saveItem(
  url: string,
  title?: string,
  tags?: string[]
): Promise<SaveResult> {
  // Validate URL first
  const validation = validateUrl(url);
  if (!validation.valid) {
    return {
      success: false,
      isNew: false,
      error: validation.error,
      errorCode: validation.code,
    };
  }

  try {
    const { item, isNew } = await createItem({ url, title, tags });
    return {
      success: true,
      isNew,
      item: {
        id: item.id,
        url: item.url,
        title: item.title,
      },
    };
  } catch (error) {
    const apiError =
      error instanceof ApiError
        ? error
        : new ApiError(
            'UNKNOWN',
            error instanceof Error ? error.message : 'Failed to save'
          );

    return {
      success: false,
      isNew: false,
      error: apiError.message,
      errorCode: apiError.code,
    };
  }
}

/**
 * Gets items from the API with optional filtering
 * Note: This is a placeholder for future implementation
 */
export async function getItems(
  params: { limit?: number; cursor?: string } = {}
): Promise<{ items: ItemDto[]; nextCursor?: string }> {
  const queryParams = new URLSearchParams();
  if (params.limit) queryParams.set('limit', params.limit.toString());
  if (params.cursor) queryParams.set('cursor', params.cursor);

  const query = queryParams.toString();
  const endpoint = query ? `/items?${query}` : '/items';

  return apiRequest('GET', endpoint);
}

// =============================================================================
// Error Types
// =============================================================================

/**
 * API error class
 */
export class ApiError extends Error {
  public readonly code: ExtensionErrorCode;
  public readonly statusCode?: number;

  constructor(code: ExtensionErrorCode, message: string, statusCode?: number) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

/**
 * API service object for dependency injection
 */
export const api = {
  // URL validation
  isValidUrl,
  isRestrictedUrl,
  getRestrictedReason,
  validateUrl,
  // API methods
  createItem,
  saveItem,
  getItems,
};

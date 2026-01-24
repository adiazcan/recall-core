import { API_BASE_URL } from '../constants';
import { acquireAccessToken } from '../msalInstance';

type ApiRequestOptions = RequestInit & {
  timeoutMs?: number;
};

export type AuthErrorStatus = 401 | 403;

type AuthErrorHandler = (status: AuthErrorStatus) => void;

let authErrorHandler: AuthErrorHandler | null = null;

export function setAuthErrorHandler(handler: AuthErrorHandler | null) {
  authErrorHandler = handler;
}

export class ApiError extends Error {
  readonly status: number;
  readonly details?: unknown;

  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

export function buildQueryString(
  params: Record<string, string | number | boolean | null | undefined>,
): string {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') {
      return;
    }

    searchParams.set(key, String(value));
  });

  const queryString = searchParams.toString();
  return queryString ? `?${queryString}` : '';
}

function mapApiError(status: number, body: unknown): string {
  if (body && typeof body === 'object' && 'message' in body) {
    const message = (body as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim().length > 0) {
      return message;
    }
  }

  if (status === 404) return 'Resource not found.';
  if (status === 409) return 'This request conflicts with existing data.';
  if (status === 400) return 'Invalid request. Please check your input.';
  if (status >= 500) return 'Server error. Please try again later.';

  return 'An unexpected error occurred.';
}

async function parseResponseBody(response: Response): Promise<unknown> {
  const contentType = response.headers.get('content-type') ?? '';

  if (contentType.includes('application/json')) {
    try {
      return await response.json();
    } catch {
      return null;
    }
  }

  if (response.status === 204) {
    return null;
  }

  try {
    return await response.text();
  } catch {
    return null;
  }
}

export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const { timeoutMs = 30_000, ...fetchOptions } = options;
  const controller = new AbortController();
  const headers = new Headers(fetchOptions.headers);

  if (!headers.has('Accept')) {
    headers.set('Accept', 'application/json');
  }

  if (fetchOptions.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const isProtectedApiRequest =
    !path.startsWith('http') && (path === '/api/v1' || path.startsWith('/api/v1/'));
  if (isProtectedApiRequest && !headers.has('Authorization')) {
    const token = await acquireAccessToken();
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
  }

  const signal = fetchOptions.signal ?? controller.signal;
  const timeoutId = fetchOptions.signal
    ? null
    : setTimeout(() => {
        controller.abort();
      }, timeoutMs);

  const normalizedBaseUrl = API_BASE_URL.replace(/\/$/, '');
  const url = path.startsWith('http') ? path : `${normalizedBaseUrl}${path}`;

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      headers,
      signal,
    });

    const body = await parseResponseBody(response);

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        authErrorHandler?.(response.status as AuthErrorStatus);
      }
      throw new ApiError(response.status, mapApiError(response.status, body), body ?? undefined);
    }

    return body as T;
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

export async function apiRequestWithResponse<T>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<{ data: T; status: number }> {
  const { timeoutMs = 30_000, ...fetchOptions } = options;
  const controller = new AbortController();
  const headers = new Headers(fetchOptions.headers);

  if (!headers.has('Accept')) {
    headers.set('Accept', 'application/json');
  }

  if (fetchOptions.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const isProtectedApiRequest =
    !path.startsWith('http') && (path === '/api/v1' || path.startsWith('/api/v1/'));
  if (isProtectedApiRequest && !headers.has('Authorization')) {
    const token = await acquireAccessToken();
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
  }

  const signal = fetchOptions.signal ?? controller.signal;
  const timeoutId = fetchOptions.signal
    ? null
    : setTimeout(() => {
        controller.abort();
      }, timeoutMs);

  const normalizedBaseUrl = API_BASE_URL.replace(/\/$/, '');
  const url = path.startsWith('http') ? path : `${normalizedBaseUrl}${path}`;

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      headers,
      signal,
    });

    const body = await parseResponseBody(response);

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        authErrorHandler?.(response.status as AuthErrorStatus);
      }
      throw new ApiError(response.status, mapApiError(response.status, body), body ?? undefined);
    }

    return { data: body as T, status: response.status };
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

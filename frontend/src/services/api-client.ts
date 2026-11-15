import axios, { AxiosError } from 'axios';

/** A normalised API failure: stable `code`, a human `message`, and per-field messages for forms. */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly fieldErrors: Record<string, string> = {},
    public readonly retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

let csrfToken: string | null = null;
let onUnauthorized: (() => void) | null = null;

export const setCsrfToken = (token: string | null) => {
  csrfToken = token;
};
export const setUnauthorizedHandler = (fn: (() => void) | null) => {
  onUnauthorized = fn;
};

/** Requests that legitimately return 401/403 without meaning "your session ended". */
const AUTH_PATHS = ['/auth/teacher/login', '/auth/student/login', '/auth/me'];

export const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
  timeout: 20_000,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const method = (config.method ?? 'get').toLowerCase();
  if (csrfToken && !['get', 'head', 'options'].includes(method)) config.headers.set('X-CSRF-Token', csrfToken);
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (error: AxiosError<{ error?: { code?: string; message?: string; details?: Array<{ field: string; message: string }> } }>) => {
    if (axios.isCancel(error)) return Promise.reject(error);
    if (!error.response) {
      const offline = error.code === 'ECONNABORTED' ? 'The server took too long to answer.' : 'Cannot reach the server. Check your connection and try again.';
      return Promise.reject(new ApiError(0, 'NETWORK', offline));
    }
    const { status, data, headers, config } = error.response;
    const e = data?.error;
    const fieldErrors: Record<string, string> = {};
    for (const d of e?.details ?? []) if (!fieldErrors[d.field]) fieldErrors[d.field] = d.message;
    const url = config?.url ?? '';
    if (status === 401 && !AUTH_PATHS.some((p) => url.startsWith(p))) onUnauthorized?.();
    const retry = Number(headers?.['retry-after']);
    return Promise.reject(
      new ApiError(status, e?.code ?? 'ERROR', e?.message ?? 'Something went wrong. Please try again.', fieldErrors, Number.isFinite(retry) ? retry : undefined),
    );
  },
);

export const errorMessage = (err: unknown): string => (err instanceof Error ? err.message : 'Something went wrong. Please try again.');

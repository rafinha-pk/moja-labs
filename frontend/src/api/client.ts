import type { TokenPair } from './types';

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';
const REFRESH_KEY = 'moja.refresh';

export interface FieldIssue {
  field: string;
  code: string;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fields: FieldIssue[];

  constructor(status: number, code: string, fields: FieldIssue[] = []) {
    super(code);
    this.status = status;
    this.code = code;
    this.fields = fields;
  }

  fieldCode(field: string): string | undefined {
    return this.fields.find((issue) => issue.field === field)?.code;
  }
}

let accessToken: string | null = null;
let onSessionLost: () => void = () => {};
let refreshing: Promise<boolean> | null = null;

function readRefreshToken(): string | null {
  try {
    return localStorage.getItem(REFRESH_KEY);
  } catch {
    return null;
  }
}

function writeRefreshToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(REFRESH_KEY, token);
    else localStorage.removeItem(REFRESH_KEY);
  } catch {}
}

export function hasStoredSession(): boolean {
  return readRefreshToken() !== null;
}

export function setSessionLostHandler(handler: () => void): void {
  onSessionLost = handler;
}

export function storeTokens(tokens: TokenPair): void {
  accessToken = tokens.access_token;
  writeRefreshToken(tokens.refresh_token);
}

export function clearTokens(): void {
  accessToken = null;
  writeRefreshToken(null);
}

export function currentRefreshToken(): string | null {
  return readRefreshToken();
}

async function send(
  method: string,
  path: string,
  body: unknown,
  withAuth: boolean,
): Promise<Response> {
  const headers: Record<string, string> = {};
  const raw = body instanceof Blob;
  if (raw) headers['Content-Type'] = body.type || 'application/octet-stream';
  else if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (withAuth && accessToken) headers.Authorization = `Bearer ${accessToken}`;
  try {
    return await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : raw ? body : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, 'network');
  }
}

async function toError(response: Response): Promise<ApiError> {
  try {
    const data = await response.json();
    const { code, fields } = data.error;
    return new ApiError(response.status, code, fields);
  } catch {
    return new ApiError(response.status, 'unknown');
  }
}

async function refreshSession(): Promise<boolean> {
  const token = readRefreshToken();
  if (!token) return false;
  const response = await send(
    'POST',
    '/auth/refresh',
    { refresh_token: token },
    false,
  ).catch(() => null);
  if (!response) return false;
  if (!response.ok) {
    clearTokens();
    return false;
  }
  storeTokens(await response.json());
  return true;
}

function refreshOnce(): Promise<boolean> {
  refreshing ??= refreshSession().finally(() => {
    refreshing = null;
  });
  return refreshing;
}

export async function restoreSession(): Promise<boolean> {
  return refreshOnce();
}

async function authorized(
  method: string,
  path: string,
  body: unknown,
  withAuth: boolean,
): Promise<Response> {
  let response = await send(method, path, body, withAuth);
  if (response.status === 401 && withAuth && hasStoredSession()) {
    if (await refreshOnce()) {
      response = await send(method, path, body, withAuth);
    } else {
      onSessionLost();
    }
  }
  if (!response.ok) throw await toError(response);
  return response;
}

export async function upload<T>(path: string, file: Blob): Promise<T> {
  return (await (await authorized('PUT', path, file, true)).json()) as T;
}

export async function download(path: string): Promise<Blob> {
  return (await authorized('GET', path, undefined, true)).blob();
}

export async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  withAuth = true,
): Promise<T> {
  const response = await authorized(method, path, body, withAuth);
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

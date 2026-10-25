import type { ApiError } from '../api/client';
import { errorText, fieldErrorText } from '../i18n/pt';
import { Alert } from './Alert';

export function ErrorAlert({ error }: { error: ApiError | null }) {
  if (!error) return null;
  return <Alert tone="error">{errorText(error.code)}</Alert>;
}

export function fieldError(
  error: ApiError | null,
  field: string,
): string | undefined {
  const code = error?.fieldCode(field);
  return code ? fieldErrorText(code) : undefined;
}

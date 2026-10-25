import { useCallback, useState } from 'react';
import type { ApiError } from './client';
import { toApiError } from './useRequest';

export function useAction() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const run = useCallback(async function run<T>(
    action: () => Promise<T>,
  ): Promise<{ value: T } | null> {
    setPending(true);
    setError(null);
    try {
      return { value: await action() };
    } catch (err) {
      setError(toApiError(err));
      return null;
    } finally {
      setPending(false);
    }
  }, []);

  const clear = useCallback(() => setError(null), []);
  return { run, pending, error, clear };
}

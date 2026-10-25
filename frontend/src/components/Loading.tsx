import { pt } from '../i18n/pt';

export function Loading() {
  return (
    <p role="status" className="py-10 text-center text-sm text-muted">
      {pt.common.loading}
    </p>
  );
}

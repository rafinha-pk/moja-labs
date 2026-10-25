import { pt } from '../i18n/pt';

export function Progress({ done, total }: { done: number; total: number }) {
  const percent = total === 0 ? 0 : Math.round((done / total) * 100);
  return (
    <div
      role="progressbar"
      aria-label={pt.tasks.progressLabel}
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={done}
      className="h-2 w-full overflow-hidden rounded-full bg-line-muted"
    >
      <div
        className="h-full bg-success-emphasis"
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}

import { useCallback, useEffect, useState } from 'react';
import { usageApi } from '../api';
import type { UsageWindow } from '../api/types';
import { useAction } from '../api/useAction';
import { useRequest } from '../api/useRequest';
import { pt } from '../i18n/pt';
import { formatRemaining, usageTone } from '../lib/usage';

const POLL_MS = 60_000;
const TICK_MS = 30_000;

const FILL = {
  ok: 'bg-success-emphasis',
  warning: 'bg-warning',
  danger: 'bg-danger-emphasis',
} as const;

function Bar({
  label,
  window,
  now,
}: {
  label: string;
  window: UsageWindow | null;
  now: number;
}) {
  const text = pt.usage;
  if (!window) {
    return (
      <div className="flex flex-col gap-0.5 text-xs text-muted">
        <span>{label}</span>
        <span>{text.unknown}</span>
      </div>
    );
  }
  const remaining = new Date(`${window.resets_at}Z`).getTime() - now;
  const expired = remaining <= 0;
  const percent = Math.min(100, Math.max(0, window.percent));
  const detail = expired
    ? text.expired
    : text.resets(formatRemaining(remaining));
  return (
    <div
      className={`flex flex-col gap-0.5 ${expired ? 'opacity-60' : ''}`}
      title={`${label}: ${percent}% ${text.used}. ${detail}`}
    >
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span className="font-semibold">{label}</span>
        <span className="text-muted">{percent}%</span>
      </div>
      <div
        role="progressbar"
        aria-label={`${label}: ${percent}% ${text.used}`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        className="h-1.5 w-24 overflow-hidden rounded-full bg-line-muted"
      >
        <div
          className={`h-full ${FILL[usageTone(percent)]}`}
          style={{ width: `${percent}%` }}
        />
      </div>
      <span className="text-[0.65rem] leading-none text-muted">{detail}</span>
    </div>
  );
}

export function UsageBars() {
  const text = pt.usage;
  const load = useCallback(() => usageApi.get(), []);
  const { data, reload, setData } = useRequest(load);
  const action = useAction();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(reload, POLL_MS);
    return () => clearInterval(timer);
  }, [reload]);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(timer);
  }, []);

  const refresh = async () => {
    const result = await action.run(() => usageApi.refresh());
    if (result) {
      setData(result.value);
      setNow(Date.now());
    }
  };

  return (
    <div className="hidden items-center gap-3 md:flex">
      <Bar label={text.session} window={data?.five_hour ?? null} now={now} />
      <Bar label={text.week} window={data?.seven_day ?? null} now={now} />
      <button
        type="button"
        onClick={refresh}
        disabled={action.pending}
        aria-label={text.refresh}
        title={action.error ? text.failed : text.refreshHint}
        className="rounded-md border border-control-line px-1.5 py-0.5 text-sm text-muted hover:bg-control-hover hover:text-fg disabled:opacity-60"
      >
        {action.pending ? '…' : '↻'}
      </button>
    </div>
  );
}

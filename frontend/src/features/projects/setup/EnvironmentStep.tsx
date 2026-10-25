import { useCallback, useEffect, useRef } from 'react';
import { setupApi } from '../../../api';
import { useAction } from '../../../api/useAction';
import { useRequest } from '../../../api/useRequest';
import { Alert } from '../../../components/Alert';
import { Badge } from '../../../components/Badge';
import { Button } from '../../../components/Button';
import { Card } from '../../../components/Card';
import { ErrorAlert } from '../../../components/ErrorAlert';
import { Loading } from '../../../components/Loading';
import { pt } from '../../../i18n/pt';

const POLL_MS = 2000;

type ErrorKey = keyof typeof pt.setup.wizard.environment.errors;

export function EnvironmentStep({
  projectId,
  canManage,
  ready,
  onChanged,
}: {
  projectId: number;
  canManage: boolean;
  ready: boolean;
  onChanged: () => void;
}) {
  const text = pt.setup.wizard.environment;
  const load = useCallback(() => setupApi.environment(projectId), [projectId]);
  const { data, error, reload } = useRequest(load);
  const build = useAction();
  const logEnd = useRef<HTMLPreElement>(null);
  const previous = useRef<string | null>(null);
  const status = data?.status;

  useEffect(() => {
    if (status !== 'building') return;
    const timer = setInterval(reload, POLL_MS);
    return () => clearInterval(timer);
  }, [status, reload]);

  useEffect(() => {
    if (previous.current === 'building' && status && status !== 'building') {
      onChanged();
    }
    previous.current = status ?? null;
  }, [status, onChanged]);

  useEffect(() => {
    logEnd.current?.scrollTo({ top: logEnd.current.scrollHeight });
  }, [data?.log]);

  if (error) return <ErrorAlert error={error} />;
  if (!data) return <Loading />;

  const start = async () => {
    await build.run(() => setupApi.buildEnvironment(projectId));
    reload();
    onChanged();
  };

  const label =
    data.status === 'failed'
      ? text.retry
      : data.status === 'ready'
        ? text.rebuild
        : text.create;

  return (
    <Card title={text.title}>
      <div className="flex flex-col gap-4 p-4">
        <p className="text-sm text-muted">{text.text}</p>
        <ErrorAlert error={build.error} />

        <div className="flex flex-wrap items-center gap-3">
          <Badge>{text.statuses[data.status]}</Badge>
          {data.container && (
            <span className="text-xs text-muted">
              {text.container}: <code>{data.container}</code>
            </span>
          )}
        </div>

        {data.status === 'failed' && (
          <Alert tone="error">
            {text.errors[data.error_code as ErrorKey] ?? text.errors.unknown}
          </Alert>
        )}
        {!data.claude_available && <Alert tone="info">{text.noClaude}</Alert>}
        {data.workspace && (
          <p className="text-xs text-muted">
            {text.workspace}: <code>{data.workspace}</code>
          </p>
        )}

        {data.port && (
          <p className="text-xs text-muted">
            {text.address}: <code>http://localhost:{data.port}</code>.{' '}
            {text.addressHint}
          </p>
        )}

        {canManage && ready && (
          <div>
            <Button
              variant="primary"
              disabled={build.pending || data.status === 'building'}
              onClick={start}
            >
              {label}
            </Button>
          </div>
        )}

        {data.log && (
          <div>
            <p className="mb-1 text-xs font-semibold text-muted">{text.log}</p>
            <pre
              ref={logEnd}
              className="max-h-64 overflow-auto rounded-md border border-line bg-inset p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap"
            >
              {data.log}
            </pre>
          </div>
        )}
      </div>
    </Card>
  );
}

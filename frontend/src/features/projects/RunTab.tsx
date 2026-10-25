import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { projectsApi, runApi } from '../../api';
import { useAction } from '../../api/useAction';
import { useRequest } from '../../api/useRequest';
import { Alert } from '../../components/Alert';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { ErrorAlert } from '../../components/ErrorAlert';
import { TextArea } from '../../components/Field';
import { Loading } from '../../components/Loading';
import { pt } from '../../i18n/pt';
import { useProject } from './ProjectLayout';

const POLL_MS = 2000;

export function RunTab() {
  const { project, setProject } = useProject();
  const text = pt.run;
  const canRun = project.role === 'owner' || project.role === 'dev';
  const load = useCallback(() => runApi.get(project.id), [project.id]);
  const { data, error, reload } = useRequest(load);
  const action = useAction();
  const [draft, setDraft] = useState<string | null>(null);
  const logEnd = useRef<HTMLPreElement>(null);
  const running = data?.running ?? false;

  useEffect(() => {
    if (!running) return;
    const timer = setInterval(reload, POLL_MS);
    return () => clearInterval(timer);
  }, [running, reload]);

  useEffect(() => {
    logEnd.current?.scrollTo({ top: logEnd.current.scrollHeight });
  }, [data?.log]);

  if (error) return <ErrorAlert error={error} />;
  if (!data) return <Loading />;

  const command = draft ?? data.command ?? '';
  const changed = command.trim() !== (data.command ?? '');

  const refreshProject = async () =>
    setProject(await projectsApi.get(project.id));

  const save = async () => {
    const result = await action.run(() =>
      runApi.setCommand(project.id, command),
    );
    if (result) setDraft(null);
    reload();
  };

  const play = async () => {
    const result = await action.run(async () => {
      if (changed) await runApi.setCommand(project.id, command);
      await runApi.start(project.id);
    });
    if (result) setDraft(null);
    reload();
    await refreshProject();
  };

  const stop = async () => {
    await action.run(() => runApi.stop(project.id));
    reload();
  };

  return (
    <div className="flex flex-col gap-6">
      <Card title={text.title}>
        <div className="flex flex-col gap-4 p-4">
          <div className="flex flex-wrap items-center gap-3">
            <Badge>{running ? text.running : text.stopped}</Badge>
            {running && data.url && (
              <a href={data.url} target="_blank" rel="noreferrer">
                {text.open} ({data.url})
              </a>
            )}
          </div>

          {!data.ready && (
            <Alert tone="info">
              {text.needsEnvironment}{' '}
              <Link to="../setup">{text.goToSetup}</Link>
            </Alert>
          )}
          <ErrorAlert error={action.error} />

          {canRun ? (
            <>
              <TextArea
                id="run-command"
                label={text.command}
                hint={text.commandHint}
                rows={3}
                maxLength={2000}
                value={command}
                onChange={(event) => setDraft(event.target.value)}
              />
              <div className="flex flex-wrap gap-2">
                {text.suggestions.map((item) => (
                  <Button
                    key={item.label}
                    small
                    onClick={() => setDraft(item.command)}
                  >
                    {item.label}
                  </Button>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                {running ? (
                  <Button
                    variant="danger"
                    disabled={action.pending}
                    onClick={stop}
                  >
                    {text.stop}
                  </Button>
                ) : (
                  <Button
                    variant="primary"
                    disabled={
                      action.pending || !data.ready || command.trim() === ''
                    }
                    onClick={play}
                  >
                    {text.play}
                  </Button>
                )}
                <Button
                  disabled={action.pending || !changed || command.trim() === ''}
                  onClick={save}
                >
                  {text.save}
                </Button>
              </div>
            </>
          ) : (
            <p className="text-sm text-muted">
              {data.command ? <code>{data.command}</code> : text.noCommand}
            </p>
          )}

          {data.log && (
            <div>
              <p className="mb-1 text-xs font-semibold text-muted">
                {text.log}
              </p>
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
    </div>
  );
}

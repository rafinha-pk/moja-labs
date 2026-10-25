import { useCallback, useEffect, useState } from 'react';
import { agentApi, changesApi, githubApi } from '../../api';
import { useAction } from '../../api/useAction';
import { useRequest } from '../../api/useRequest';
import { Alert } from '../../components/Alert';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { Card, ListRow } from '../../components/Card';
import { ErrorAlert } from '../../components/ErrorAlert';
import { Loading } from '../../components/Loading';
import { pt } from '../../i18n/pt';
import { useProject } from './ProjectLayout';

const POLL_MS = 2000;

function statusLabel(status: string): string {
  return pt.git.status[status] ?? status;
}

export function GitTab() {
  const { project } = useProject();
  const text = pt.git;
  const canCommit = project.role === 'owner' || project.role === 'dev';
  const load = useCallback(() => changesApi.get(project.id), [project.id]);
  const loadGithub = useCallback(
    () => githubApi.project(project.id),
    [project.id],
  );
  const { data, error, setData, reload } = useRequest(load);
  const github = useRequest(loadGithub);
  const action = useAction();
  const [message, setMessage] = useState('');
  const [suggesting, setSuggesting] = useState<number | null>(null);
  const [suggestFailed, setSuggestFailed] = useState(false);

  useEffect(() => {
    if (suggesting === null) return;
    const timer = setInterval(async () => {
      try {
        const run = await agentApi.run(project.id, suggesting);
        if (run.status === 'running') return;
        setSuggesting(null);
        if (run.status === 'done' && run.summary) setMessage(run.summary);
        else setSuggestFailed(true);
        void agentApi.clear(project.id, 'commit');
      } catch {
        setSuggesting(null);
        setSuggestFailed(true);
      }
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [suggesting, project.id]);

  if (error) return <ErrorAlert error={error} />;
  if (!data) return <Loading />;

  const finish = async (run: () => ReturnType<typeof changesApi.get>) => {
    const result = await action.run(run);
    if (!result) return false;
    setData(result.value);
    return true;
  };

  const commit = async () => {
    if (await finish(() => changesApi.commit(project.id, message))) {
      setMessage('');
    }
  };

  const suggest = async () => {
    setSuggestFailed(false);
    const result = await action.run(() => changesApi.suggest(project.id));
    if (result) setSuggesting(result.value.id);
  };

  const pending = data.files.length > 0;
  const repository = github.data?.repository;

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]">
      <div className="flex min-w-0 flex-col gap-6">
        <Card
          title={text.changes}
          action={
            <div className="flex items-center gap-2">
              <Badge>{`${text.branch}: ${data.branch}`}</Badge>
              <Button small disabled={action.pending} onClick={reload}>
                {text.refresh}
              </Button>
            </div>
          }
        >
          <div className="flex flex-col gap-4 p-4">
            <ErrorAlert error={action.error} />
            {!pending && <p className="text-sm text-muted">{text.clean}</p>}
            {pending && (
              <>
                <div className="flex flex-col gap-2">
                  <p className="text-xs font-semibold text-muted">
                    {text.files}
                  </p>
                  <ul className="rounded-md border border-line">
                    {data.files.map((file) => (
                      <ListRow key={file.path}>
                        <code className="text-sm">{file.path}</code>
                        <Badge>{statusLabel(file.status)}</Badge>
                      </ListRow>
                    ))}
                  </ul>
                  {data.diff && (
                    <details>
                      <summary className="cursor-pointer text-sm">
                        {text.diff}
                      </summary>
                      <pre className="mt-2 max-h-96 overflow-auto rounded-md border border-line bg-inset p-3 font-mono text-xs whitespace-pre-wrap">
                        {data.diff}
                      </pre>
                    </details>
                  )}
                </div>
                {canCommit ? (
                  <div className="flex flex-col gap-2">
                    <label
                      htmlFor="commit-message"
                      className="text-sm font-semibold"
                    >
                      {text.message}
                    </label>
                    <textarea
                      id="commit-message"
                      rows={5}
                      maxLength={2000}
                      value={message}
                      disabled={suggesting !== null}
                      onChange={(event) => setMessage(event.target.value)}
                      className="w-full rounded-md border border-line bg-inset px-3 py-1.5 font-mono text-sm text-fg placeholder:text-muted focus:border-accent-emphasis disabled:opacity-60"
                    />
                    <p className="text-xs text-muted">{text.messageHint}</p>
                    {suggesting !== null && (
                      <p className="text-sm text-muted">{text.suggesting}</p>
                    )}
                    {suggestFailed && (
                      <p className="text-sm text-danger">
                        {text.suggestFailed}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-2">
                      <Button
                        disabled={action.pending || suggesting !== null}
                        onClick={suggest}
                      >
                        {text.suggest}
                      </Button>
                      <Button
                        variant="primary"
                        disabled={
                          action.pending ||
                          suggesting !== null ||
                          message.trim() === ''
                        }
                        onClick={commit}
                      >
                        {text.commit}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Alert tone="info">{text.ownerOnly}</Alert>
                )}
              </>
            )}
          </div>
        </Card>

        {data.unpushed.length > 0 && (
          <Card title={text.unpushed}>
            <ul>
              {data.unpushed.map((item) => (
                <ListRow key={item.hash}>
                  <span className="text-sm">{item.subject}</span>
                  <code className="text-xs text-muted">{item.hash}</code>
                </ListRow>
              ))}
            </ul>
            {canCommit && (
              <div className="border-t border-line-muted p-4">
                <Button
                  variant="primary"
                  disabled={action.pending}
                  onClick={() => finish(() => changesApi.push(project.id))}
                >
                  {text.push}
                </Button>
              </div>
            )}
          </Card>
        )}
      </div>

      <Card
        title={text.history}
        action={
          repository ? (
            <a href={repository.html_url} target="_blank" rel="noreferrer">
              {repository.full_name}
            </a>
          ) : undefined
        }
      >
        {data.commits.length === 0 ? (
          <p className="p-4 text-sm text-muted">{text.noCommits}</p>
        ) : (
          <ul>
            {data.commits.map((entry) => (
              <ListRow key={entry.hash} className="flex-col items-stretch">
                <p className="text-sm font-semibold">{entry.subject}</p>
                <p className="flex flex-wrap items-center gap-2 text-xs text-muted">
                  <code>{entry.hash}</code>
                  <span>
                    {entry.author} · {entry.when}
                  </span>
                  {!entry.pushed && <Badge>{text.notSent}</Badge>}
                </p>
              </ListRow>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

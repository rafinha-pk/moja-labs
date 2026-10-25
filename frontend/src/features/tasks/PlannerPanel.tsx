import { useCallback, useEffect, useRef, useState } from 'react';
import { agentApi, tasksApi } from '../../api';
import type { AgentRunSummary, Task } from '../../api/types';
import { useAction } from '../../api/useAction';
import { useRequest } from '../../api/useRequest';
import { Bubble } from '../../components/Bubble';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { ErrorAlert } from '../../components/ErrorAlert';
import { Loading } from '../../components/Loading';
import { MicButton } from '../../components/MicButton';
import { pt } from '../../i18n/pt';
import { conversationOf, latestDraft } from '../../lib/chat';

const POLL_MS = 2000;

interface PlannerPanelProps {
  projectId: number;
  onApplied: (created: Task[]) => void;
}

function Answer({
  run,
  showTasks,
}: {
  run: AgentRunSummary;
  showTasks: boolean;
}) {
  const text = pt.tasks.plan;
  if (run.status === 'running') {
    return <p className="text-muted">{text.working}</p>;
  }
  if (run.status === 'stopped') {
    return <p className="text-muted">{text.stopped}</p>;
  }
  if (run.status === 'failed') {
    return (
      <p className="text-danger">
        {text.errors[run.error_code ?? ''] ?? pt.errors.unknown}
      </p>
    );
  }
  const tasks = run.output?.tasks ?? [];
  return (
    <div className="flex flex-col gap-2">
      {run.output?.message && <p>{run.output.message}</p>}
      {showTasks &&
        (tasks.length === 0 ? (
          <p className="text-muted">{text.empty}</p>
        ) : (
          <>
            <p className="text-xs font-semibold text-muted">{text.proposed}</p>
            <ol className="flex list-decimal flex-col gap-1 pl-5">
              {tasks.map((task, index) => (
                <li key={index}>
                  <details>
                    <summary className="cursor-pointer">{task.title}</summary>
                    <p className="mt-1 whitespace-pre-line text-muted">
                      {task.description}
                    </p>
                  </details>
                </li>
              ))}
            </ol>
          </>
        ))}
    </div>
  );
}

export function PlannerPanel({ projectId, onApplied }: PlannerPanelProps) {
  const text = pt.tasks.plan;
  const loadRuns = useCallback(
    () => agentApi.runs(projectId, 'tasks'),
    [projectId],
  );
  const loadPlan = useCallback(() => tasksApi.plan(projectId), [projectId]);
  const runs = useRequest(loadRuns);
  const plan = useRequest(loadPlan);
  const action = useAction();
  const [prompt, setPrompt] = useState('');
  const messages = useRef<HTMLDivElement>(null);
  const previous = useRef<string | null>(null);

  const conversation = conversationOf(runs.data ?? []);
  const last = conversation[conversation.length - 1];
  const running = last?.status === 'running';
  const draft = latestDraft(conversation);

  useEffect(() => {
    if (!running) return;
    const timer = setInterval(runs.reload, POLL_MS);
    return () => clearInterval(timer);
  }, [running, runs.reload]);

  useEffect(() => {
    if (previous.current === 'running' && last?.status !== 'running') {
      plan.reload();
    }
    previous.current = last?.status ?? null;
  }, [last?.status]);

  useEffect(() => {
    messages.current?.scrollTo({ top: messages.current.scrollHeight });
  }, [conversation.length, last?.status]);

  if (runs.error) return <ErrorAlert error={runs.error} />;
  if (!runs.data) return <Loading />;

  const state = plan.data;
  const search = async () => {
    const result = await action.run(() => tasksApi.search(projectId));
    if (result) runs.reload();
  };

  const send = async (override?: string) => {
    const message = (override ?? prompt).trim();
    if (!message) return;
    const result = await action.run(() =>
      agentApi.start(projectId, message, false, 'tasks'),
    );
    if (!result) return;
    setPrompt('');
    runs.reload();
  };

  const stop = async () => {
    if (!last) return;
    await action.run(() => agentApi.stop(projectId, last.id));
    runs.reload();
  };

  const discard = async () => {
    const result = await action.run(() => agentApi.clear(projectId, 'tasks'));
    if (result) runs.reload();
  };

  const apply = async () => {
    if (!draft) return;
    const result = await action.run(() => tasksApi.apply(projectId, draft.id));
    if (!result) return;
    onApplied(result.value);
    runs.reload();
    plan.reload();
  };

  const proposed = draft?.output?.tasks.length ?? 0;

  return (
    <div className="flex h-[max(32rem,calc(100dvh-15rem))] flex-col gap-4">
      <Card title={text.searchTitle}>
        <div className="flex flex-col gap-3 p-4 text-sm">
          {state && (
            <p className="text-muted">
              {state.first
                ? text.first
                : text.changed(state.changed_files.length)}
            </p>
          )}
          {state && !state.first && state.changed_files.length > 0 && (
            <ul className="flex flex-col gap-1 text-xs">
              {state.changed_files.map((file) => (
                <li key={file.path} className="flex items-center gap-2">
                  <code>{file.path}</code>
                  <span className="text-muted">
                    {text.fileStatus[file.status]}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {state && state.reason && (
            <p className="text-warning">
              {text.reasons[state.reason] ?? pt.errors.unknown}
            </p>
          )}
          <div>
            <Button
              variant="primary"
              disabled={
                action.pending || running || !state || !state.can_search
              }
              onClick={search}
            >
              {text.search}
            </Button>
          </div>
        </div>
      </Card>

      <Card
        title={text.chatTitle}
        className="flex min-h-0 flex-1 flex-col"
        action={
          conversation.length > 0 ? (
            <Button
              small
              disabled={running || action.pending}
              onClick={discard}
            >
              {text.discard}
            </Button>
          ) : undefined
        }
      >
        <div className="flex min-h-0 flex-1 flex-col">
          <div
            ref={messages}
            className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4"
          >
            {conversation.length === 0 ? (
              <p className="text-sm text-muted">{text.chatEmpty}</p>
            ) : (
              conversation.map((run) => (
                <div key={run.id} className="flex flex-col gap-2">
                  <Bubble mine>
                    <p className="whitespace-pre-wrap">
                      {run.from_docs && run.resumed_from === null
                        ? text.searchLabel
                        : userText(run.prompt)}
                    </p>
                  </Bubble>
                  <Bubble mine={false}>
                    <Answer run={run} showTasks={run.id === draft?.id} />
                  </Bubble>
                </div>
              ))
            )}
          </div>
          <div className="flex flex-col gap-2 border-t border-line p-3">
            <ErrorAlert error={action.error} />
            <textarea
              aria-label={text.refine}
              rows={3}
              maxLength={8000}
              placeholder={text.refine}
              value={prompt}
              disabled={running}
              onChange={(event) => setPrompt(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
                  event.preventDefault();
                  void send();
                }
              }}
              className="w-full resize-none rounded-md border border-line bg-inset px-3 py-1.5 text-sm text-fg placeholder:text-muted focus:border-accent-emphasis disabled:opacity-60"
            />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex min-w-0 flex-col gap-1">
                <MicButton
                  value={prompt}
                  disabled={running}
                  onChange={setPrompt}
                  onSend={(spoken) => void send(spoken)}
                />
                <p className="text-xs text-muted">{text.refineHint}</p>
              </div>
              <div className="flex gap-2">
                {running ? (
                  <Button variant="danger" onClick={stop}>
                    {text.stop}
                  </Button>
                ) : (
                  <>
                    <Button
                      disabled={action.pending || prompt.trim() === ''}
                      onClick={() => void send()}
                    >
                      {text.send}
                    </Button>
                    {proposed > 0 && (
                      <Button
                        variant="primary"
                        disabled={action.pending}
                        onClick={apply}
                      >
                        {text.apply(proposed)}
                      </Button>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}

function userText(prompt: string): string {
  const marker = '\n\nRequest:\n';
  const index = prompt.indexOf(marker);
  return index === -1 ? prompt : prompt.slice(index + marker.length);
}

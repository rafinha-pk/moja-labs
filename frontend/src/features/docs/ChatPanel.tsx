import { useCallback, useEffect, useRef, useState } from 'react';
import { agentApi } from '../../api';
import type { AgentRunSummary, AgentStatus } from '../../api/types';
import { useAction } from '../../api/useAction';
import { useRequest } from '../../api/useRequest';
import { AttachmentPicker } from '../../components/AttachmentPicker';
import { Button } from '../../components/Button';
import { Bubble } from '../../components/Bubble';
import { Card } from '../../components/Card';
import { ErrorAlert } from '../../components/ErrorAlert';
import { Loading } from '../../components/Loading';
import { MicButton } from '../../components/MicButton';
import { UserMessage } from '../../components/UserMessage';
import { Markdown } from '../../components/Markdown';
import { pt } from '../../i18n/pt';
import { conversationOf } from '../../lib/chat';

const POLL_MS = 2000;
const PROMPT_MAX = 8000;

interface ChatPanelProps {
  projectId: number;
  onFinished: () => void;
}

function Answer({ run, liveLog }: { run: AgentRunSummary; liveLog: string }) {
  const text = pt.docs.chat;
  if (run.status === 'running') {
    const lines = liveLog.trim().split('\n').slice(-3).join('\n');
    return (
      <>
        <p className="text-muted">{text.working}</p>
        {lines && (
          <pre className="mt-1 font-mono text-xs whitespace-pre-wrap text-muted">
            {lines}
          </pre>
        )}
      </>
    );
  }
  if (run.status === 'stopped') {
    return <p className="text-muted">{text.stopped}</p>;
  }
  if (run.status === 'failed') {
    const known = run.error_code as keyof typeof text.errors;
    return (
      <p className="text-danger">{text.errors[known] ?? pt.errors.unknown}</p>
    );
  }
  return <>{run.summary && <Markdown source={run.summary} />}</>;
}

export function ChatPanel({ projectId, onFinished }: ChatPanelProps) {
  const text = pt.docs.chat;
  const loadRuns = useCallback(() => agentApi.runs(projectId), [projectId]);
  const runs = useRequest(loadRuns);
  const action = useAction();
  const [prompt, setPrompt] = useState('');
  const [attached, setAttached] = useState<string[]>([]);
  const messages = useRef<HTMLDivElement>(null);
  const previous = useRef<AgentStatus | null>(null);

  const conversation = conversationOf(runs.data ?? []);
  const last = conversation[conversation.length - 1];
  const running = last?.status === 'running';

  const loadLive = useCallback(
    () =>
      last && running
        ? agentApi.run(projectId, last.id)
        : Promise.resolve(null),
    [projectId, last?.id, running],
  );
  const live = useRequest(loadLive);

  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => {
      runs.reload();
      live.reload();
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [running, runs.reload, live.reload]);

  useEffect(() => {
    if (previous.current === 'running' && last?.status !== 'running') {
      onFinished();
    }
    previous.current = last?.status ?? null;
  }, [last?.status]);

  useEffect(() => {
    messages.current?.scrollTo({ top: messages.current.scrollHeight });
  }, [conversation.length, last?.status, live.data?.log]);

  if (runs.error) return <ErrorAlert error={runs.error} />;
  if (!runs.data) return <Loading />;

  const send = async (override?: string) => {
    const files = attached;
    const message = (override ?? prompt).trim();
    if (!message) return;
    const result = await action.run(() =>
      agentApi.start(
        projectId,
        message,
        conversation.length === 0,
        'docs',
        files,
      ),
    );
    if (!result) return;
    setPrompt('');
    setAttached([]);
    runs.reload();
  };

  const stop = async () => {
    if (!last) return;
    await action.run(() => agentApi.stop(projectId, last.id));
    runs.reload();
  };

  const newConversation = async () => {
    const result = await action.run(() => agentApi.clear(projectId));
    if (result) runs.reload();
  };

  return (
    <Card
      title={text.title}
      className="flex h-[max(24rem,calc(100dvh-15rem))] flex-col"
      action={
        <Button
          small
          disabled={running || action.pending || conversation.length === 0}
          onClick={newConversation}
        >
          {text.newConversation}
        </Button>
      }
    >
      <div className="flex min-h-0 flex-1 flex-col">
        <div
          ref={messages}
          className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4"
        >
          {conversation.length === 0 ? (
            <div className="flex flex-col gap-2">
              <p className="text-sm text-muted">{text.empty}</p>
              {text.suggestions.map((item) => (
                <Button
                  key={item.label}
                  small
                  className="justify-start whitespace-normal text-left"
                  onClick={() => setPrompt(item.prompt)}
                >
                  {item.label}
                </Button>
              ))}
            </div>
          ) : (
            conversation.map((run) => (
              <div key={run.id} className="flex flex-col gap-2">
                <Bubble mine>
                  <UserMessage text={run.prompt} />
                </Bubble>
                <Bubble mine={false}>
                  <Answer
                    run={run}
                    liveLog={live.data?.id === run.id ? live.data.log : ''}
                  />
                </Bubble>
              </div>
            ))
          )}
        </div>
        <div className="flex flex-col gap-2 border-t border-line p-3">
          <ErrorAlert error={action.error} />
          <textarea
            aria-label={text.title}
            rows={3}
            maxLength={PROMPT_MAX}
            placeholder={text.placeholder}
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
          <AttachmentPicker
            projectId={projectId}
            files={attached}
            disabled={running}
            onChange={setAttached}
          />
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 flex-col gap-1">
              <MicButton
                value={prompt}
                disabled={running}
                onChange={setPrompt}
                onSend={(spoken) => void send(spoken)}
              />
              <p className="text-xs text-muted">{text.hint}</p>
            </div>
            {running ? (
              <Button variant="danger" onClick={stop}>
                {text.stop}
              </Button>
            ) : (
              <Button
                variant="primary"
                disabled={action.pending || prompt.trim() === ''}
                onClick={() => void send()}
              >
                {text.send}
              </Button>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}

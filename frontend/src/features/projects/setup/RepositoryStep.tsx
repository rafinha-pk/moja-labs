import { useState, type FormEvent } from 'react';
import { githubApi, setupApi } from '../../../api';
import type { ProjectGithub } from '../../../api/types';
import { useAction } from '../../../api/useAction';
import { Alert } from '../../../components/Alert';
import { Badge } from '../../../components/Badge';
import { Button } from '../../../components/Button';
import { Card } from '../../../components/Card';
import { ErrorAlert, fieldError } from '../../../components/ErrorAlert';
import { SelectField, TextArea, TextField } from '../../../components/Field';
import { ConfirmDialog } from '../../../components/Modal';
import { pt } from '../../../i18n/pt';
import {
  defaultDraft,
  draftPayload,
  type RepositoryDraft,
} from '../../../lib/repository';

type Mode = 'create' | 'link';

function CreateForm({
  projectId,
  projectName,
  onDone,
}: {
  projectId: number;
  projectName: string;
  onDone: () => void;
}) {
  const text = pt.setup.wizard.repository;
  const create = useAction();
  const createAndSend = useAction();
  const [draft, setDraft] = useState<RepositoryDraft>(() =>
    defaultDraft(projectName),
  );
  const busy = create.pending || createAndSend.pending;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const result = await create.run(() =>
      githubApi.createRepository(projectId, draftPayload(draft)),
    );
    if (result) onDone();
  };

  const sendAll = async () => {
    await createAndSend.run(() => setupApi.run(projectId, draftPayload(draft)));
    onDone();
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <p className="text-sm text-muted">{pt.github.createHint}</p>
      <ErrorAlert error={create.error ?? createAndSend.error} />
      <TextField
        id="repo-name"
        label={pt.github.repoName}
        required
        maxLength={100}
        value={draft.name}
        onChange={(event) => setDraft({ ...draft, name: event.target.value })}
        error={fieldError(create.error ?? createAndSend.error, 'name')}
      />
      <TextArea
        id="repo-description"
        label={`${pt.github.repoDescription} ${pt.common.optional}`}
        rows={2}
        maxLength={350}
        value={draft.description}
        onChange={(event) =>
          setDraft({ ...draft, description: event.target.value })
        }
      />
      <SelectField
        id="repo-visibility"
        label={pt.github.visibility}
        value={draft.visibility}
        onChange={(event) =>
          setDraft({
            ...draft,
            visibility: event.target.value as RepositoryDraft['visibility'],
          })
        }
      >
        <option value="private">{pt.github.private}</option>
        <option value="public">{pt.github.public}</option>
      </SelectField>
      {draft.visibility === 'public' && (
        <Alert tone="info">{pt.github.publicWarning}</Alert>
      )}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={busy}>
          {pt.github.createButton}
        </Button>
        <Button variant="primary" disabled={busy} onClick={sendAll}>
          {text.createAndSend}
        </Button>
      </div>
    </form>
  );
}

function LinkForm({
  projectId,
  onDone,
}: {
  projectId: number;
  onDone: () => void;
}) {
  const { run, pending, error } = useAction();
  const [fullName, setFullName] = useState('');

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const result = await run(() =>
      githubApi.linkRepository(projectId, fullName),
    );
    if (result) onDone();
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <ErrorAlert error={error} />
      <TextField
        id="repo-full-name"
        label={pt.github.fullName}
        required
        value={fullName}
        onChange={(event) => setFullName(event.target.value)}
        error={fieldError(error, 'full_name')}
      />
      <div>
        <Button type="submit" variant="primary" disabled={pending}>
          {pt.github.linkButton}
        </Button>
      </div>
    </form>
  );
}

export function RepositoryStep({
  projectId,
  projectName,
  github,
  canManage,
  onDone,
}: {
  projectId: number;
  projectName: string;
  github: ProjectGithub;
  canManage: boolean;
  onDone: () => void;
}) {
  const text = pt.setup.wizard.repository;
  const [mode, setMode] = useState<Mode>('create');
  const [confirmUnlink, setConfirmUnlink] = useState(false);
  const unlink = useAction();
  const { repository } = github;

  const removeLink = async () => {
    const result = await unlink.run(() =>
      githubApi.unlinkRepository(projectId),
    );
    if (result) {
      setConfirmUnlink(false);
      onDone();
    }
  };

  return (
    <Card title={text.title}>
      <div className="flex flex-col gap-4 p-4">
        {repository ? (
          <>
            <ErrorAlert error={unlink.error} />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <a
                  href={repository.html_url}
                  target="_blank"
                  rel="noreferrer"
                  className="font-semibold"
                >
                  {repository.full_name}
                </a>
                <Badge>
                  {repository.is_private ? pt.github.private : pt.github.public}
                </Badge>
              </div>
              {canManage && (
                <Button
                  small
                  variant="danger"
                  onClick={() => setConfirmUnlink(true)}
                >
                  {pt.github.unlink}
                </Button>
              )}
            </div>
          </>
        ) : canManage ? (
          <>
            <p className="text-sm text-muted">{text.text}</p>
            <div
              role="group"
              aria-label={text.title}
              className="flex w-fit gap-1 rounded-md border border-line p-0.5"
            >
              {(['create', 'link'] as const).map((item) => (
                <Button
                  key={item}
                  small
                  variant={mode === item ? 'default' : 'invisible'}
                  aria-pressed={mode === item}
                  onClick={() => setMode(item)}
                >
                  {text.modes[item]}
                </Button>
              ))}
            </div>
            {mode === 'create' ? (
              <CreateForm
                projectId={projectId}
                projectName={projectName}
                onDone={onDone}
              />
            ) : (
              <LinkForm projectId={projectId} onDone={onDone} />
            )}
          </>
        ) : (
          <p className="text-sm text-muted">{pt.github.notLinked}</p>
        )}
      </div>

      <ConfirmDialog
        open={confirmUnlink}
        title={pt.github.unlinkTitle}
        text={pt.github.unlinkText}
        confirmLabel={pt.github.unlink}
        busy={unlink.pending}
        onConfirm={removeLink}
        onClose={() => setConfirmUnlink(false)}
      />
    </Card>
  );
}

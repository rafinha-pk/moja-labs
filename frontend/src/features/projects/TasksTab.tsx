import { useCallback, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { setupApi, tasksApi } from '../../api';
import type { Task, TaskSettings, TaskStatus } from '../../api/types';
import { useAction } from '../../api/useAction';
import { useRequest } from '../../api/useRequest';
import { Alert } from '../../components/Alert';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { Card, ListRow } from '../../components/Card';
import { ErrorAlert, fieldError } from '../../components/ErrorAlert';
import { TextArea, TextField } from '../../components/Field';
import { Loading } from '../../components/Loading';
import { ConfirmDialog, Modal } from '../../components/Modal';
import { Progress } from '../../components/Progress';
import { pt } from '../../i18n/pt';
import { ModelSelects } from '../tasks/ModelSelects';
import { PlannerPanel } from '../tasks/PlannerPanel';
import { useProject } from './ProjectLayout';

const STATUSES: TaskStatus[] = ['todo', 'doing', 'done', 'failed'];

function TaskDialog({
  projectId,
  task,
  onClose,
  onSaved,
}: {
  projectId: number;
  task: Task;
  onClose: () => void;
  onSaved: (task: Task) => void;
}) {
  const { run, pending, error } = useAction();
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description ?? '');

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const result = await run(() =>
      tasksApi.update(projectId, task.id, { title, description }),
    );
    if (result) onSaved(result.value);
  };

  return (
    <Modal
      open
      title={pt.tasks.editTitle}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>{pt.common.cancel}</Button>
          <Button
            type="submit"
            form="edit-task"
            variant="primary"
            disabled={pending}
          >
            {pt.common.save}
          </Button>
        </>
      }
    >
      <form id="edit-task" onSubmit={submit} className="flex flex-col gap-4">
        <ErrorAlert error={error} />
        <TextField
          id="task-title"
          label={pt.tasks.titleLabel}
          required
          maxLength={150}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          error={fieldError(error, 'title')}
        />
        <TextArea
          id="task-description"
          label={pt.tasks.descriptionLabel}
          rows={6}
          maxLength={5000}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          error={fieldError(error, 'description')}
        />
      </form>
    </Modal>
  );
}

function SettingsCard({
  projectId,
  settings,
  onSaved,
}: {
  projectId: number;
  settings: TaskSettings;
  onSaved: (settings: TaskSettings) => void;
}) {
  const text = pt.tasks.options;
  const { run, pending, error } = useAction();
  const [draft, setDraft] = useState({
    model: settings.model,
    effort: settings.effort,
    thinking: settings.thinking,
  });
  const [saved, setSaved] = useState(false);

  const save = async () => {
    const result = await run(() => tasksApi.saveSettings(projectId, draft));
    if (!result) return;
    onSaved(result.value);
    setSaved(true);
  };

  return (
    <Card title={text.title}>
      <div className="flex flex-col gap-3 p-4">
        <p className="text-sm text-muted">{text.hint}</p>
        <ErrorAlert error={error} />
        <ModelSelects
          id="project-options"
          models={settings.models}
          efforts={settings.efforts}
          model={draft.model}
          effort={draft.effort}
          thinking={draft.thinking}
          inherit={false}
          onChange={(patch) => {
            setSaved(false);
            setDraft((current) => ({
              model: patch.model ?? current.model,
              effort: patch.effort ?? current.effort,
              thinking:
                patch.thinking === undefined
                  ? current.thinking
                  : (patch.thinking ?? current.thinking),
            }));
          }}
        />
        <div className="flex items-center gap-3">
          <Button disabled={pending} onClick={save}>
            {text.save}
          </Button>
          {saved && <span className="text-sm text-success">{text.saved}</span>}
        </div>
      </div>
    </Card>
  );
}

function TaskRow({
  task,
  settings,
  busy,
  onChange,
  onEdit,
  onRemove,
}: {
  task: Task;
  settings: TaskSettings;
  busy: boolean;
  onChange: (patch: Parameters<typeof tasksApi.update>[2]) => void;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const custom = task.model || task.effort || task.thinking !== null;
  return (
    <ListRow className="flex-col items-stretch">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2 text-sm font-semibold">
            {task.title}
            {task.source === 'ai' && <Badge>{pt.tasks.fromAi}</Badge>}
          </p>
          {task.description && (
            <p className="mt-1 text-sm whitespace-pre-line text-muted">
              {task.description}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label={pt.tasks.statusLabel}
            value={task.status}
            disabled={busy}
            onChange={(event) =>
              onChange({ status: event.target.value as TaskStatus })
            }
            className="rounded-md border border-line bg-inset px-2 py-1 text-sm text-fg"
          >
            {STATUSES.map((status) => (
              <option key={status} value={status}>
                {pt.tasks.statuses[status]}
              </option>
            ))}
          </select>
          <Button small variant="invisible" onClick={onEdit}>
            {pt.tasks.edit}
          </Button>
          <Button small variant="danger" onClick={onRemove}>
            {pt.common.delete}
          </Button>
        </div>
      </div>
      <details open={Boolean(custom)} className="mt-2">
        <summary className="cursor-pointer text-xs text-muted">
          {pt.tasks.options.customize}
        </summary>
        <div className="mt-2">
          <ModelSelects
            id={`task-${task.id}`}
            models={settings.models}
            efforts={settings.efforts}
            model={task.model}
            effort={task.effort}
            thinking={task.thinking}
            inherit
            disabled={busy}
            onChange={onChange}
          />
        </div>
      </details>
    </ListRow>
  );
}

export function TasksTab() {
  const { project } = useProject();
  const loadSetup = useCallback(() => setupApi.get(project.id), [project.id]);
  const loadTasks = useCallback(() => tasksApi.list(project.id), [project.id]);
  const loadSettings = useCallback(
    () => tasksApi.settings(project.id),
    [project.id],
  );
  const setup = useRequest(loadSetup);
  const tasks = useRequest(loadTasks);
  const settings = useRequest(loadSettings);
  const action = useAction();
  const add = useAction();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [editing, setEditing] = useState<Task | null>(null);
  const [removing, setRemoving] = useState<Task | null>(null);
  const [adding, setAdding] = useState(false);

  if (setup.error || tasks.error || settings.error) {
    return <ErrorAlert error={setup.error ?? tasks.error ?? settings.error} />;
  }
  if (!setup.data || !tasks.data || !settings.data) return <Loading />;

  const list = tasks.data;
  const replace = (task: Task) =>
    tasks.setData(list.map((item) => (item.id === task.id ? task : item)));

  const change = async (
    task: Task,
    patch: Parameters<typeof tasksApi.update>[2],
  ) => {
    const result = await action.run(() =>
      tasksApi.update(project.id, task.id, patch),
    );
    if (result) replace(result.value);
  };

  const create = async (event: FormEvent) => {
    event.preventDefault();
    const result = await add.run(() =>
      tasksApi.create(project.id, { title, description }),
    );
    if (result) {
      tasks.setData([...list, result.value]);
      setTitle('');
      setDescription('');
      setAdding(false);
    }
  };

  const remove = async () => {
    if (!removing) return;
    const result = await action.run(() =>
      tasksApi.remove(project.id, removing.id),
    );
    if (result) {
      tasks.setData(list.filter((task) => task.id !== removing.id));
      setRemoving(null);
    }
  };

  const done = list.filter((task) => task.status === 'done').length;

  if (!setup.data.complete) {
    return (
      <Alert tone="info">
        {pt.tasks.setupRequired} <Link to="../setup">{pt.tasks.goToSetup}</Link>
      </Alert>
    );
  }

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_26rem]">
      <div className="flex min-w-0 flex-col gap-4">
        <SettingsCard
          projectId={project.id}
          settings={settings.data}
          onSaved={settings.setData}
        />

        <Card
          title={pt.tasks.title}
          action={
            <Button small onClick={() => setAdding((value) => !value)}>
              {pt.tasks.newButton}
            </Button>
          }
        >
          <div className="flex flex-col gap-2 border-b border-line-muted px-4 py-3">
            <p className="text-sm text-muted">
              {pt.tasks.progress(done, list.length)}
            </p>
            <Progress done={done} total={list.length} />
          </div>
          <ErrorAlert error={action.error} />
          {list.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted">
              {pt.tasks.empty}
            </p>
          ) : (
            <ul>
              {list.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  settings={settings.data!}
                  busy={action.pending}
                  onChange={(patch) => change(task, patch)}
                  onEdit={() => setEditing(task)}
                  onRemove={() => setRemoving(task)}
                />
              ))}
            </ul>
          )}
        </Card>

        {adding && (
          <Card title={pt.tasks.new}>
            <form onSubmit={create} className="flex flex-col gap-4 p-4">
              <ErrorAlert error={add.error} />
              <TextField
                id="new-task-title"
                label={pt.tasks.titleLabel}
                required
                maxLength={150}
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                error={fieldError(add.error, 'title')}
              />
              <TextArea
                id="new-task-description"
                label={`${pt.tasks.descriptionLabel} ${pt.common.optional}`}
                rows={2}
                maxLength={5000}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
              <div>
                <Button type="submit" variant="primary" disabled={add.pending}>
                  {pt.tasks.add}
                </Button>
              </div>
            </form>
          </Card>
        )}
      </div>

      <div className="lg:sticky lg:top-4">
        <PlannerPanel
          projectId={project.id}
          onApplied={(created) => tasks.setData([...list, ...created])}
        />
      </div>

      {editing && (
        <TaskDialog
          projectId={project.id}
          task={editing}
          onClose={() => setEditing(null)}
          onSaved={(task) => {
            replace(task);
            setEditing(null);
          }}
        />
      )}
      <ConfirmDialog
        open={removing !== null}
        title={pt.tasks.removeTitle}
        text={pt.tasks.removeText}
        confirmLabel={pt.common.delete}
        busy={action.pending}
        onConfirm={remove}
        onClose={() => setRemoving(null)}
      />
    </div>
  );
}

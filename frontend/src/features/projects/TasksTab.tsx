import { useCallback, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { setupApi, tasksApi } from '../../api';
import type { StageKey, StageStatus, Task } from '../../api/types';
import { useAction } from '../../api/useAction';
import { useRequest } from '../../api/useRequest';
import { Alert } from '../../components/Alert';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { ErrorAlert, fieldError } from '../../components/ErrorAlert';
import { TextArea, TextField } from '../../components/Field';
import { Loading } from '../../components/Loading';
import { ConfirmDialog, Modal } from '../../components/Modal';
import { Progress } from '../../components/Progress';
import { pt } from '../../i18n/pt';
import { useProject } from './ProjectLayout';

const DOT: Record<StageStatus, string> = {
  todo: 'bg-line',
  doing: 'bg-warning',
  done: 'bg-success-emphasis',
  skipped: 'bg-line-muted',
};

interface StageAction {
  label: string;
  next: StageStatus;
  primary?: boolean;
}

const ACTIONS: Record<StageStatus, StageAction[]> = {
  todo: [
    { label: pt.tasks.actions.execute, next: 'doing', primary: true },
    { label: pt.tasks.actions.skip, next: 'skipped' },
  ],
  doing: [
    { label: pt.tasks.actions.finish, next: 'done', primary: true },
    { label: pt.tasks.actions.stop, next: 'todo' },
  ],
  done: [{ label: pt.tasks.actions.reopen, next: 'todo' }],
  skipped: [{ label: pt.tasks.actions.reopen, next: 'todo' }],
};

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
          maxLength={5000}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          error={fieldError(error, 'description')}
        />
      </form>
    </Modal>
  );
}

function TaskCard({
  task,
  busy,
  onStage,
  onEdit,
  onRemove,
}: {
  task: Task;
  busy: boolean;
  onStage: (key: StageKey, status: StageStatus) => void;
  onEdit: () => void;
  onRemove: () => void;
}) {
  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line-muted px-4 py-3">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 text-sm font-semibold">
            {task.title}
            <Badge>{pt.tasks.statuses[task.status]}</Badge>
          </p>
          {task.description && (
            <p className="mt-1 whitespace-pre-line text-sm text-muted">
              {task.description}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <Button small variant="invisible" onClick={onEdit}>
            {pt.tasks.edit}
          </Button>
          <Button small variant="danger" onClick={onRemove}>
            {pt.common.delete}
          </Button>
        </div>
      </div>
      <ul>
        {task.stages.map((stage) => (
          <li
            key={stage.key}
            className="flex flex-wrap items-center justify-between gap-3 border-b border-line-muted px-4 py-2 last:border-b-0"
          >
            <div className="flex items-center gap-3">
              <span
                aria-hidden="true"
                className={`h-2.5 w-2.5 shrink-0 rounded-full ${DOT[stage.status]}`}
              />
              <span className="text-sm">{pt.tasks.stageNames[stage.key]}</span>
              <span className="text-xs text-muted">
                {pt.tasks.statuses[stage.status]}
              </span>
            </div>
            <div className="flex gap-2">
              {ACTIONS[stage.status].map((action) => (
                <Button
                  key={action.next}
                  small
                  variant={action.primary ? 'primary' : 'default'}
                  disabled={busy}
                  onClick={() => onStage(stage.key, action.next)}
                >
                  {action.label}
                </Button>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export function TasksTab() {
  const { project } = useProject();
  const loadSetup = useCallback(() => setupApi.get(project.id), [project.id]);
  const loadTasks = useCallback(() => tasksApi.list(project.id), [project.id]);
  const setup = useRequest(loadSetup);
  const tasks = useRequest(loadTasks);
  const action = useAction();
  const add = useAction();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [editing, setEditing] = useState<Task | null>(null);
  const [removing, setRemoving] = useState<Task | null>(null);

  if (setup.error || tasks.error) {
    return <ErrorAlert error={setup.error ?? tasks.error} />;
  }
  if (!setup.data || !tasks.data) return <Loading />;

  const list = tasks.data;
  const replace = (task: Task) =>
    tasks.setData(list.map((item) => (item.id === task.id ? task : item)));

  const changeStage = async (
    task: Task,
    key: StageKey,
    status: StageStatus,
  ) => {
    const result = await action.run(() =>
      tasksApi.setStage(project.id, task.id, key, status),
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

  return (
    <div className="flex flex-col gap-4">
      {!setup.data.complete && (
        <Alert tone="info">
          {pt.tasks.setupRequired}{' '}
          <Link to="../setup">{pt.tasks.goToSetup}</Link>
        </Alert>
      )}

      <Card title={pt.tasks.title}>
        <div className="flex flex-col gap-2 px-4 py-3">
          <p className="text-sm text-muted">
            {pt.tasks.progress(done, list.length)}
          </p>
          <Progress done={done} total={list.length} />
        </div>
      </Card>

      <ErrorAlert error={action.error} />
      {list.length === 0 && setup.data.complete && (
        <p className="text-center text-sm text-muted">{pt.tasks.empty}</p>
      )}
      {list.map((task) => (
        <TaskCard
          key={task.id}
          task={task}
          busy={action.pending}
          onStage={(key, status) => changeStage(task, key, status)}
          onEdit={() => setEditing(task)}
          onRemove={() => setRemoving(task)}
        />
      ))}

      {setup.data.complete && (
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

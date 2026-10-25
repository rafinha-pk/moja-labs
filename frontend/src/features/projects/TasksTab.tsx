import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { setupApi, tasksApi } from '../../api';
import type {
  Specialty,
  Task,
  TaskSettings,
  TaskStatus,
} from '../../api/types';
import { useAction } from '../../api/useAction';
import { useRequest } from '../../api/useRequest';
import { Alert } from '../../components/Alert';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { Card, ListRow } from '../../components/Card';
import { ErrorAlert, fieldError } from '../../components/ErrorAlert';
import { SelectField, TextArea, TextField } from '../../components/Field';
import { Loading } from '../../components/Loading';
import { Markdown } from '../../components/Markdown';
import { ConfirmDialog, Modal } from '../../components/Modal';
import { Progress } from '../../components/Progress';
import { pt } from '../../i18n/pt';
import { allowedAreas } from '../../lib/areas';
import { ModelSelects } from '../tasks/ModelSelects';
import { PlannerPanel } from '../tasks/PlannerPanel';
import { useProject } from './ProjectLayout';

const STATUSES: TaskStatus[] = ['todo', 'queued', 'doing', 'done', 'failed'];
const POLL_MS = 3000;

function isBusy(task: Task): boolean {
  return task.status === 'queued' || task.status === 'doing';
}

function TaskDialog({
  projectId,
  task,
  areas,
  onClose,
  onSaved,
}: {
  projectId: number;
  task: Task;
  areas: Specialty[];
  onClose: () => void;
  onSaved: (task: Task) => void;
}) {
  const { run, pending, error } = useAction();
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description ?? '');
  const [area, setArea] = useState<Specialty>(task.area);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const result = await run(() =>
      tasksApi.update(projectId, task.id, { title, description, area }),
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
        <SelectField
          id="task-area"
          label={pt.tasks.area.label}
          hint={pt.tasks.area.hint}
          value={area}
          onChange={(event) => setArea(event.target.value as Specialty)}
        >
          {areas.map((item) => (
            <option key={item} value={item}>
              {pt.tasks.area[item]}
            </option>
          ))}
        </SelectField>
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

function TaskResult({ projectId, task }: { projectId: number; task: Task }) {
  const text = pt.tasks.run;
  const load = useCallback(
    () => tasksApi.run(projectId, task.id),
    [projectId, task.id, task.status, task.run_id],
  );
  const { data, error, reload } = useRequest(load);
  const working = task.status === 'doing';

  useEffect(() => {
    if (!working) return;
    const timer = setInterval(reload, POLL_MS);
    return () => clearInterval(timer);
  }, [working, reload]);
  if (error) return <ErrorAlert error={error} />;
  if (!data) return <Loading />;
  return (
    <div className="mt-2 flex flex-col gap-3">
      {data.error_code && (
        <p className="text-sm text-danger">
          {text.errors[data.error_code] ?? pt.errors.unknown}
        </p>
      )}
      {data.summary && (
        <div>
          <p className="mb-1 text-xs font-semibold text-muted">
            {text.summary}
          </p>
          <div className="rounded-md border border-line p-3">
            <Markdown source={data.summary} />
          </div>
        </div>
      )}
      {data.log && (
        <div>
          <p className="mb-1 text-xs font-semibold text-muted">{text.log}</p>
          <pre className="max-h-64 overflow-auto rounded-md border border-line bg-inset p-3 font-mono text-xs whitespace-pre-wrap">
            {data.log}
          </pre>
        </div>
      )}
    </div>
  );
}

function TaskRow({
  task,
  settings,
  projectId,
  busy,
  running,
  canRun,
  areas,
  onChange,
  onEdit,
  onRemove,
  onExecute,
}: {
  task: Task;
  settings: TaskSettings;
  projectId: number;
  busy: boolean;
  running: boolean;
  canRun: boolean;
  areas: Specialty[];
  onChange: (patch: Parameters<typeof tasksApi.update>[2]) => void;
  onEdit: () => void;
  onRemove: () => void;
  onExecute: () => void;
}) {
  const custom = task.model || task.effort || task.thinking !== null;
  const [showResult, setShowResult] = useState(false);
  const working = isBusy(task);
  const mine = areas.includes(task.area);

  useEffect(() => {
    if (task.status === 'doing') setShowResult(true);
  }, [task.status]);
  return (
    <ListRow className="flex-col items-stretch">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2 text-sm font-semibold">
            {task.title}
            <Badge>{pt.tasks.area[task.area]}</Badge>
            {task.source === 'ai' && <Badge>{pt.tasks.fromAi}</Badge>}
          </p>
          {!mine && (
            <p className="mt-1 text-xs text-muted">{pt.tasks.area.other}</p>
          )}
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
            disabled={busy || working || !mine}
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
          {canRun && mine && (
            <Button
              small
              variant="primary"
              disabled={busy || running}
              onClick={onExecute}
            >
              {task.status === 'todo'
                ? pt.tasks.run.execute
                : pt.tasks.run.again}
            </Button>
          )}
          <Button
            small
            variant="invisible"
            disabled={working || !mine}
            onClick={onEdit}
          >
            {pt.tasks.edit}
          </Button>
          <Button
            small
            variant="danger"
            disabled={working || !mine}
            onClick={onRemove}
          >
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
            disabled={busy || !mine}
            onChange={onChange}
          />
        </div>
      </details>
      {task.run_id !== null && (
        <details
          className="mt-2"
          open={showResult}
          onToggle={(event) => setShowResult(event.currentTarget.open)}
        >
          <summary className="cursor-pointer text-xs text-muted">
            {working ? pt.tasks.run.running : pt.tasks.run.result}
          </summary>
          {showResult && <TaskResult projectId={projectId} task={task} />}
        </details>
      )}
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
  const canRun = project.role === 'owner' || project.role === 'dev';
  const areas = allowedAreas(project.specialty);
  const [area, setArea] = useState<Specialty>(
    areas.includes('fullstack') ? 'fullstack' : areas[0]!,
  );
  const reloadTasks = tasks.reload;
  const loadArchived = useCallback(
    () => tasksApi.list(project.id, true),
    [project.id, tasks.data?.length ?? -1],
  );
  const archived = useRequest(loadArchived);
  const anyBusy = tasks.data?.some(isBusy) ?? false;

  useEffect(() => {
    if (!anyBusy) return;
    const timer = setInterval(reloadTasks, POLL_MS);
    return () => clearInterval(timer);
  }, [anyBusy, reloadTasks]);

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
      tasksApi.create(project.id, { title, description, area }),
    );
    if (result) {
      tasks.setData([...list, result.value]);
      setTitle('');
      setDescription('');
      setAdding(false);
    }
  };

  const runAll = async () => {
    const result = await action.run(() => tasksApi.executeAll(project.id));
    if (result) tasks.setData(result.value);
  };

  const stopAll = async () => {
    const result = await action.run(() => tasksApi.stopExecution(project.id));
    if (result) tasks.setData(result.value);
  };

  const executeOne = async (task: Task) => {
    const result = await action.run(() =>
      tasksApi.execute(project.id, task.id),
    );
    if (result) replace(result.value);
    tasks.reload();
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
            <div className="flex flex-wrap gap-2">
              {canRun &&
                (anyBusy ? (
                  <Button small variant="danger" onClick={stopAll}>
                    {pt.tasks.run.stop}
                  </Button>
                ) : (
                  <Button
                    small
                    variant="primary"
                    disabled={
                      action.pending ||
                      !list.some((task) => task.status === 'todo')
                    }
                    onClick={runAll}
                  >
                    {pt.tasks.run.all}
                  </Button>
                ))}
              <Button small onClick={() => setAdding((value) => !value)}>
                {pt.tasks.newButton}
              </Button>
              <Link
                to="executed"
                className="inline-flex items-center rounded-md border border-control-line bg-control px-2 py-0.5 text-xs font-medium text-fg no-underline hover:bg-control-hover"
              >
                {pt.tasks.executed.open(archived.data?.length ?? 0)}
              </Link>
            </div>
          }
        >
          <div className="flex flex-col gap-2 border-b border-line-muted px-4 py-3">
            <p className="text-sm text-muted">
              {pt.tasks.progress(done, list.length)}
            </p>
            <Progress done={done} total={list.length} />
          </div>
          <ErrorAlert error={action.error} />
          {project.role === 'dev' && project.specialty !== 'fullstack' && (
            <p className="border-b border-line-muted px-4 py-3 text-sm text-muted">
              {pt.tasks.area.scopeInfo(
                pt.tasks.area[project.specialty],
                project.specialty,
              )}
            </p>
          )}
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
                  projectId={project.id}
                  busy={action.pending}
                  running={anyBusy}
                  canRun={canRun}
                  areas={areas}
                  onExecute={() => executeOne(task)}
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
              <SelectField
                id="new-task-area"
                label={pt.tasks.area.label}
                hint={pt.tasks.area.hint}
                value={area}
                onChange={(event) => setArea(event.target.value as Specialty)}
              >
                {areas.map((item) => (
                  <option key={item} value={item}>
                    {pt.tasks.area[item]}
                  </option>
                ))}
              </SelectField>
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
          areas={areas}
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

import { useCallback } from 'react';
import { Link } from 'react-router-dom';
import { tasksApi } from '../../api';
import { useAction } from '../../api/useAction';
import { useRequest } from '../../api/useRequest';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { Card, ListRow } from '../../components/Card';
import { ErrorAlert } from '../../components/ErrorAlert';
import { Loading } from '../../components/Loading';
import { pt } from '../../i18n/pt';
import { allowedAreas } from '../../lib/areas';
import { useProject } from './ProjectLayout';

export function ExecutedTasksPage() {
  const { project } = useProject();
  const text = pt.tasks.executed;
  const areas = allowedAreas(project.specialty);
  const load = useCallback(() => tasksApi.list(project.id, true), [project.id]);
  const { data, error, reload } = useRequest(load);
  const action = useAction();

  if (error) return <ErrorAlert error={error} />;
  if (!data) return <Loading />;

  const reopen = async (taskId: number) => {
    const result = await action.run(() =>
      tasksApi.update(project.id, taskId, { status: 'todo' }),
    );
    if (result) reload();
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Link to="../tasks" className="text-sm">
          ← {text.back}
        </Link>
      </div>
      <Card title={`${text.title} (${data.length})`}>
        <p className="border-b border-line-muted px-4 py-3 text-sm text-muted">
          {text.intro}
        </p>
        <ErrorAlert error={action.error} />
        {data.length === 0 ? (
          <p className="px-4 py-3 text-sm text-muted">{text.empty}</p>
        ) : (
          <ul>
            {data.map((task) => (
              <ListRow key={task.id}>
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                    {task.title}
                    <Badge>{pt.tasks.area[task.area]}</Badge>
                  </p>
                  {task.description && (
                    <p className="mt-1 text-sm whitespace-pre-line text-muted">
                      {task.description}
                    </p>
                  )}
                  <p className="mt-1 text-xs text-muted">
                    {text.commit} <code>{task.archived_commit ?? '—'}</code>
                    {task.archived_at &&
                      ` · ${new Date(task.archived_at + 'Z').toLocaleString()}`}
                  </p>
                </div>
                {areas.includes(task.area) && (
                  <Button
                    small
                    disabled={action.pending}
                    onClick={() => reopen(task.id)}
                  >
                    {text.reopen}
                  </Button>
                )}
              </ListRow>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

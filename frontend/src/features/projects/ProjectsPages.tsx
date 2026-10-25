import { useCallback, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { projectsApi } from '../../api';
import type { ProjectType } from '../../api/types';
import { useAction } from '../../api/useAction';
import { useRequest } from '../../api/useRequest';
import { useAuth } from '../../auth/AuthContext';
import { Badge, RoleBadge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { Card, ListRow } from '../../components/Card';
import { ErrorAlert, fieldError } from '../../components/ErrorAlert';
import { SelectField, TextArea, TextField } from '../../components/Field';
import { Loading } from '../../components/Loading';
import { Progress } from '../../components/Progress';
import { pt } from '../../i18n/pt';

export const PROJECT_TYPES: ProjectType[] = ['web', 'youtube', 'mobile'];

export function ProjectsPage() {
  const { user } = useAuth();
  const [scope, setScope] = useState<'mine' | 'all'>('mine');
  const load = useCallback(() => projectsApi.list(scope), [scope]);
  const { data, error, loading, reload } = useRequest(load);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">{pt.projects.title}</h1>
        <Link to="/projects/new" className="no-underline">
          <span className="inline-flex rounded-md border border-transparent bg-success-emphasis px-3 py-1.5 text-sm font-medium text-on-emphasis hover:bg-success-emphasis-hover">
            {pt.projects.new}
          </span>
        </Link>
      </div>
      {user?.is_superadmin && (
        <div className="flex gap-2">
          <Button
            small
            variant={scope === 'mine' ? 'primary' : 'default'}
            onClick={() => setScope('mine')}
          >
            {pt.projects.scopeMine}
          </Button>
          <Button
            small
            variant={scope === 'all' ? 'primary' : 'default'}
            onClick={() => setScope('all')}
          >
            {pt.projects.scopeAll}
          </Button>
        </div>
      )}
      <ErrorAlert error={error} />
      {error && <Button onClick={reload}>{pt.common.retry}</Button>}
      {loading && !data && <Loading />}
      {data && data.length === 0 && (
        <Card className="px-4 py-10 text-center">
          <h2 className="text-base font-semibold">{pt.projects.emptyTitle}</h2>
          <p className="mt-1 text-sm text-muted">{pt.projects.emptyText}</p>
        </Card>
      )}
      {data && data.length > 0 && (
        <Card>
          <ul>
            {data.map((project) => (
              <ListRow key={project.id}>
                <div className="min-w-0 flex-1">
                  <Link
                    to={`/projects/${project.id}`}
                    className="font-semibold"
                  >
                    {project.name}
                  </Link>
                  <p className="truncate text-sm text-muted">
                    {project.description ?? pt.projects.noDescription}
                  </p>
                  {project.tasks_total > 0 && (
                    <div className="mt-2 flex items-center gap-2">
                      <div className="w-32">
                        <Progress
                          done={project.tasks_done}
                          total={project.tasks_total}
                        />
                      </div>
                      <span className="text-xs text-muted">
                        {project.tasks_done}/{project.tasks_total}
                      </span>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Badge>{pt.projects.types[project.type]}</Badge>
                  {project.member_role ? (
                    <RoleBadge role={project.member_role} />
                  ) : (
                    <Badge>{pt.roles.superadmin}</Badge>
                  )}
                </div>
              </ListRow>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

export function NewProjectPage() {
  const navigate = useNavigate();
  const { run, pending, error } = useAction();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<ProjectType>('web');

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const result = await run(() =>
      projectsApi.create({ name, description, type }),
    );
    if (result) navigate(`/projects/${result.value.id}`);
  };

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-4">
      <h1 className="text-xl font-semibold">{pt.projects.newTitle}</h1>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <ErrorAlert error={error} />
        <TextField
          id="name"
          label={pt.projects.name}
          autoFocus
          required
          maxLength={100}
          value={name}
          onChange={(event) => setName(event.target.value)}
          error={fieldError(error, 'name')}
        />
        <SelectField
          id="type"
          label={pt.projects.type}
          hint={pt.projects.typeHints[type]}
          value={type}
          onChange={(event) => setType(event.target.value as ProjectType)}
        >
          {PROJECT_TYPES.map((value) => (
            <option key={value} value={value}>
              {pt.projects.types[value]}
            </option>
          ))}
        </SelectField>
        <TextArea
          id="description"
          label={`${pt.projects.description} ${pt.common.optional}`}
          maxLength={5000}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          error={fieldError(error, 'description')}
        />
        <div className="flex gap-2">
          <Button type="submit" variant="primary" disabled={pending}>
            {pt.common.create}
          </Button>
          <Button onClick={() => navigate('/')}>{pt.common.cancel}</Button>
        </div>
      </form>
    </div>
  );
}

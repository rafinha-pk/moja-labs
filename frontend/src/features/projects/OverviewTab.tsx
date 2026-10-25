import { useCallback, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { githubApi, projectsApi } from '../../api';
import { useAction } from '../../api/useAction';
import { useRequest } from '../../api/useRequest';
import { Alert } from '../../components/Alert';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { ErrorAlert, fieldError } from '../../components/ErrorAlert';
import { TextArea, TextField } from '../../components/Field';
import { ConfirmDialog } from '../../components/Modal';
import { pt } from '../../i18n/pt';
import { useProject } from './ProjectLayout';

function LinkRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line-muted px-4 py-3 text-sm last:border-b-0">
      <span className="text-muted">{label}</span>
      <span className="flex items-center gap-2">{children}</span>
    </div>
  );
}

function ProjectLinks() {
  const { project } = useProject();
  const load = useCallback(() => githubApi.project(project.id), [project.id]);
  const { data } = useRequest(load);
  const repository = data?.repository;

  return (
    <Card title={pt.links.title}>
      <LinkRow label={pt.links.repository}>
        {repository ? (
          <>
            <a href={repository.html_url} target="_blank" rel="noreferrer">
              {repository.full_name}
            </a>
            <Badge>
              {repository.is_private ? pt.github.private : pt.github.public}
            </Badge>
          </>
        ) : (
          <Link to="github">{pt.links.goToGithub}</Link>
        )}
      </LinkRow>
      <LinkRow label={pt.links.accessUrl}>
        {project.access_url ? (
          <a href={project.access_url} target="_blank" rel="noreferrer">
            {project.access_url}
          </a>
        ) : (
          <span className="text-muted">{pt.links.none}</span>
        )}
      </LinkRow>
    </Card>
  );
}

export function OverviewTab() {
  const { project, setProject } = useProject();
  const navigate = useNavigate();
  const canEdit = project.role === 'owner' || project.role === 'po';
  const isOwner = project.role === 'owner';

  const save = useAction();
  const remove = useAction();
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description ?? '');
  const [accessUrl, setAccessUrl] = useState(project.access_url ?? '');
  const [saved, setSaved] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaved(false);
    const result = await save.run(() =>
      projectsApi.update(project.id, {
        name,
        description,
        access_url: accessUrl.trim() || null,
      }),
    );
    if (result) {
      setProject(result.value);
      setSaved(true);
    }
  };

  const destroy = async () => {
    const result = await remove.run(() => projectsApi.remove(project.id));
    if (result) navigate('/');
  };

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <ProjectLinks />

      <Card title={pt.projects.details}>
        {canEdit ? (
          <form onSubmit={submit} className="flex flex-col gap-4 p-4">
            <ErrorAlert error={save.error} />
            {saved && <Alert tone="success">{pt.common.saved}</Alert>}
            <TextField
              id="name"
              label={pt.projects.name}
              required
              maxLength={100}
              value={name}
              onChange={(event) => setName(event.target.value)}
              error={fieldError(save.error, 'name')}
            />
            <TextArea
              id="description"
              label={pt.projects.description}
              maxLength={5000}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              error={fieldError(save.error, 'description')}
            />
            <TextField
              id="access-url"
              label={pt.links.accessUrl}
              type="url"
              placeholder="https://"
              hint={pt.links.accessUrlHint}
              maxLength={300}
              value={accessUrl}
              onChange={(event) => setAccessUrl(event.target.value)}
              error={fieldError(save.error, 'access_url')}
            />
            <div>
              <Button type="submit" variant="primary" disabled={save.pending}>
                {pt.common.save}
              </Button>
            </div>
          </form>
        ) : (
          <p className="p-4 text-sm">
            {project.description ?? (
              <span className="text-muted">{pt.projects.noDescription}</span>
            )}
          </p>
        )}
      </Card>

      {isOwner && (
        <Card title={pt.projects.dangerZone} className="border-danger">
          <div className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div>
              <p className="text-sm font-semibold">{pt.projects.deleteTitle}</p>
              <p className="text-sm text-muted">{pt.projects.deleteText}</p>
            </div>
            <Button variant="danger" onClick={() => setConfirmDelete(true)}>
              {pt.common.delete}
            </Button>
          </div>
          <ErrorAlert error={remove.error} />
        </Card>
      )}

      <ConfirmDialog
        open={confirmDelete}
        title={pt.projects.deleteTitle}
        text={pt.projects.deleteText}
        confirmLabel={pt.projects.deleteConfirm}
        busy={remove.pending}
        onConfirm={destroy}
        onClose={() => setConfirmDelete(false)}
      />
    </div>
  );
}

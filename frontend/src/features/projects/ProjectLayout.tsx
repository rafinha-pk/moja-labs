import { useCallback } from 'react';
import {
  NavLink,
  Navigate,
  Outlet,
  useOutletContext,
  useParams,
} from 'react-router-dom';
import { projectsApi, setupApi } from '../../api';
import type { Project } from '../../api/types';
import { useRequest } from '../../api/useRequest';
import { Badge, RoleBadge } from '../../components/Badge';
import { ErrorAlert } from '../../components/ErrorAlert';
import { Loading } from '../../components/Loading';
import { pt } from '../../i18n/pt';

export interface ProjectContext {
  project: Project;
  setProject: (project: Project) => void;
  reloadSetup: () => void;
}

export function useProject(): ProjectContext {
  return useOutletContext<ProjectContext>();
}

const tabClass = ({ isActive }: { isActive: boolean }) =>
  `border-b-2 px-3 py-2 text-sm whitespace-nowrap no-underline hover:text-fg ${
    isActive
      ? 'border-accent-emphasis font-semibold text-fg'
      : 'border-transparent text-muted'
  }`;

export function ProjectLayout() {
  const params = useParams();
  const projectId = Number(params.projectId);
  const load = useCallback(() => projectsApi.get(projectId), [projectId]);
  const { data, error, setData } = useRequest(load);
  const loadSetup = useCallback(() => setupApi.get(projectId), [projectId]);
  const setup = useRequest(loadSetup);

  if (error?.status === 404 || Number.isNaN(projectId)) {
    return <Navigate to="/not-found" replace />;
  }
  if (error) return <ErrorAlert error={error} />;
  if (!data) return <Loading />;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold">{data.name}</h1>
        <Badge>{pt.projects.types[data.type]}</Badge>
        {data.member_role ? (
          <RoleBadge role={data.member_role} />
        ) : (
          <Badge>{pt.roles.superadmin}</Badge>
        )}
      </div>
      <nav className="flex overflow-x-auto border-b border-line">
        <NavLink to="." end className={tabClass}>
          {pt.projects.overview}
        </NavLink>
        <NavLink to="setup" className={tabClass}>
          {pt.setup.title}
        </NavLink>
        {setup.data?.complete && (
          <>
            <NavLink to="docs" className={tabClass}>
              {pt.docs.title}
            </NavLink>
            <NavLink to="run" className={tabClass}>
              {pt.run.title}
            </NavLink>
            <NavLink to="attachments" className={tabClass}>
              {pt.attachments.title}
            </NavLink>
          </>
        )}
        <NavLink to="tasks" className={tabClass}>
          {pt.tasks.title}
        </NavLink>
        {setup.data?.complete && (
          <NavLink to="git" className={tabClass}>
            {pt.git.title}
          </NavLink>
        )}
        <NavLink to="skills" className={tabClass}>
          {pt.skills.title}
        </NavLink>
        <NavLink to="members" className={tabClass}>
          {pt.projects.members}
        </NavLink>
      </nav>
      <Outlet
        context={{
          project: data,
          setProject: setData,
          reloadSetup: setup.reload,
        }}
      />
    </div>
  );
}

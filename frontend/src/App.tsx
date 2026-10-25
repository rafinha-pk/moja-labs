import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import { GuestOnly, RequireAuth, RequireSuperadmin } from './auth/guards';
import { Layout } from './components/Layout';
import { Loading } from './components/Loading';
import { AdminUsersPage } from './features/admin/AdminUsersPage';
import { LoginPage, RegisterPage } from './features/auth/AuthPages';
import { InvitesPage } from './features/invites/InvitesPage';
import { NotFoundPage } from './features/NotFoundPage';
import { MembersTab } from './features/projects/MembersTab';
import { OverviewTab } from './features/projects/OverviewTab';
import { ProjectLayout } from './features/projects/ProjectLayout';
import { RunTab } from './features/projects/RunTab';
import { SetupTab } from './features/projects/SetupTab';
import { SkillsTab } from './features/projects/SkillsTab';
import { TasksTab } from './features/projects/TasksTab';
import {
  NewProjectPage,
  ProjectsPage,
} from './features/projects/ProjectsPages';
import { SettingsPage } from './features/settings/SettingsPage';
import { SkillsPage } from './features/skills/SkillsPage';

const DocsTab = lazy(() =>
  import('./features/projects/DocsTab').then((module) => ({
    default: module.DocsTab,
  })),
);

const SkillEditorPage = lazy(() =>
  import('./features/skills/SkillEditorPage').then((module) => ({
    default: module.SkillEditorPage,
  })),
);

export function App() {
  return (
    <Routes>
      <Route element={<GuestOnly />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
      </Route>
      <Route element={<RequireAuth />}>
        <Route element={<Layout />}>
          <Route index element={<ProjectsPage />} />
          <Route path="projects/new" element={<NewProjectPage />} />
          <Route path="projects/:projectId" element={<ProjectLayout />}>
            <Route index element={<OverviewTab />} />
            <Route path="setup" element={<SetupTab />} />
            <Route
              path="docs"
              element={
                <Suspense fallback={<Loading />}>
                  <DocsTab />
                </Suspense>
              }
            />
            <Route path="run" element={<RunTab />} />
            <Route path="tasks" element={<TasksTab />} />
            <Route path="skills" element={<SkillsTab />} />
            <Route path="members" element={<MembersTab />} />
          </Route>
          <Route path="invites" element={<InvitesPage />} />
          <Route path="skills" element={<SkillsPage />} />
          <Route
            path="skills/new"
            element={
              <Suspense fallback={<Loading />}>
                <SkillEditorPage />
              </Suspense>
            }
          />
          <Route
            path="skills/:skillId"
            element={
              <Suspense fallback={<Loading />}>
                <SkillEditorPage />
              </Suspense>
            }
          />
          <Route path="settings" element={<SettingsPage />} />
          <Route element={<RequireSuperadmin />}>
            <Route path="admin" element={<AdminUsersPage />} />
          </Route>
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>
    </Routes>
  );
}

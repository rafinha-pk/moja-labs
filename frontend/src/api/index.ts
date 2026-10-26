import { download, request } from './client';
import type {
  AdminProject,
  AdminUser,
  ApkState,
  AssignableRole,
  GithubAccount,
  ProjectGithub,
  Invite,
  Member,
  Project,
  ProjectSkill,
  Environment,
  RunState,
  AgentKind,
  Usage,
  Specialty,
  AgentRun,
  PlanState,
  TaskSettings,
  TaskStatus,
  AgentRunSummary,
  Changes,
  DocumentContent,
  DocumentEntry,
  Setup,
  SkillDetail,
  Skill,
  SkillScope,
  Task,
  ProjectType,
  ThemeName,
  TokenPair,
  User,
} from './types';

export const authApi = {
  register: (email: string, name: string, password: string) =>
    request<User>('POST', '/auth/register', { email, name, password }, false),
  login: (email: string, password: string) =>
    request<TokenPair>('POST', '/auth/login', { email, password }, false),
  logout: (refreshToken: string) =>
    request<void>(
      'POST',
      '/auth/logout',
      { refresh_token: refreshToken },
      false,
    ),
  changePassword: (currentPassword: string, newPassword: string) =>
    request<void>('POST', '/auth/change-password', {
      current_password: currentPassword,
      new_password: newPassword,
    }),
};

export const usersApi = {
  me: () => request<User>('GET', '/users/me'),
  update: (data: { name?: string; theme?: ThemeName }) =>
    request<User>('PATCH', '/users/me', data),
};

export const projectsApi = {
  list: (scope: 'mine' | 'all' = 'mine') =>
    request<Project[]>('GET', `/projects?scope=${scope}`),
  get: (id: number) => request<Project>('GET', `/projects/${id}`),
  create: (data: { name: string; description?: string; type: ProjectType }) =>
    request<Project>('POST', '/projects', data),
  update: (
    id: number,
    data: {
      name?: string;
      description?: string | null;
      access_url?: string | null;
      android_package?: string;
      android_min_sdk?: number;
    },
  ) => request<Project>('PATCH', `/projects/${id}`, data),
  remove: (id: number) => request<void>('DELETE', `/projects/${id}`),
};

export const membersApi = {
  list: (projectId: number) =>
    request<Member[]>('GET', `/projects/${projectId}/members`),
  changeRole: (
    projectId: number,
    userId: number,
    role: AssignableRole,
    specialty?: Specialty,
  ) =>
    request<Member>('PATCH', `/projects/${projectId}/members/${userId}`, {
      role,
      specialty,
    }),
  remove: (projectId: number, userId: number) =>
    request<void>('DELETE', `/projects/${projectId}/members/${userId}`),
  transfer: (
    projectId: number,
    userId: number,
    previousOwnerRole: AssignableRole,
  ) =>
    request<Member>('POST', `/projects/${projectId}/transfer-ownership`, {
      user_id: userId,
      previous_owner_role: previousOwnerRole,
    }),
};

export const invitesApi = {
  forProject: (projectId: number) =>
    request<Invite[]>('GET', `/projects/${projectId}/invites`),
  create: (
    projectId: number,
    email: string,
    role: AssignableRole,
    specialty: Specialty,
  ) =>
    request<Invite>('POST', `/projects/${projectId}/invites`, {
      email,
      role,
      specialty,
    }),
  cancel: (projectId: number, inviteId: number) =>
    request<void>('DELETE', `/projects/${projectId}/invites/${inviteId}`),
  mine: () => request<Invite[]>('GET', '/invites'),
  accept: (id: number) => request<Invite>('POST', `/invites/${id}/accept`),
  decline: (id: number) => request<Invite>('POST', `/invites/${id}/decline`),
};

export const adminApi = {
  users: () => request<AdminUser[]>('GET', '/admin/users'),
  createUser: (data: {
    email: string;
    name: string;
    password: string;
    is_superadmin: boolean;
  }) => request<AdminUser>('POST', '/admin/users', data),
  updateUser: (
    id: number,
    data: { is_active?: boolean; is_superadmin?: boolean },
  ) => request<AdminUser>('PATCH', `/admin/users/${id}`, data),
  userProjects: (id: number) =>
    request<AdminProject[]>('GET', `/admin/users/${id}/projects`),
};

export const githubApi = {
  account: () => request<GithubAccount>('GET', '/users/me/github'),
  connect: (token: string) =>
    request<GithubAccount>('PUT', '/users/me/github', { token }),
  disconnect: () => request<void>('DELETE', '/users/me/github'),
  project: (id: number) =>
    request<ProjectGithub>('GET', `/projects/${id}/github`),
  setProjectToken: (id: number, token: string) =>
    request<ProjectGithub>('PUT', `/projects/${id}/github/token`, { token }),
  clearProjectToken: (id: number) =>
    request<void>('DELETE', `/projects/${id}/github/token`),
  createRepository: (
    id: number,
    data: { name: string; description?: string; private: boolean },
  ) =>
    request<ProjectGithub>('POST', `/projects/${id}/github/repository`, data),
  linkRepository: (id: number, fullName: string) =>
    request<ProjectGithub>('PUT', `/projects/${id}/github/repository`, {
      full_name: fullName,
    }),
  unlinkRepository: (id: number) =>
    request<void>('DELETE', `/projects/${id}/github/repository`),
};

export const setupApi = {
  get: (projectId: number) =>
    request<Setup>('GET', `/projects/${projectId}/setup`),
  run: (
    projectId: number,
    repository?: { name: string; description?: string; private: boolean },
  ) =>
    request<Setup>('POST', `/projects/${projectId}/setup/run`, { repository }),
  initialCommit: (projectId: number) =>
    request<Setup>('POST', `/projects/${projectId}/setup/initial-commit`),
  environment: (projectId: number) =>
    request<Environment>('GET', `/projects/${projectId}/setup/environment`),
  buildEnvironment: (projectId: number) =>
    request<Environment>('POST', `/projects/${projectId}/setup/environment`),
};

export const tasksApi = {
  list: (projectId: number, archived = false) =>
    request<Task[]>(
      'GET',
      `/projects/${projectId}/tasks${archived ? '?archived=true' : ''}`,
    ),
  create: (
    projectId: number,
    data: { title: string; description?: string; area?: Specialty },
  ) => request<Task>('POST', `/projects/${projectId}/tasks`, data),
  update: (
    projectId: number,
    taskId: number,
    data: {
      title?: string;
      description?: string | null;
      area?: Specialty;
      status?: TaskStatus;
      model?: string | null;
      effort?: string | null;
      thinking?: boolean | null;
    },
  ) => request<Task>('PATCH', `/projects/${projectId}/tasks/${taskId}`, data),
  remove: (projectId: number, taskId: number) =>
    request<void>('DELETE', `/projects/${projectId}/tasks/${taskId}`),
  execute: (projectId: number, taskId: number) =>
    request<Task>('POST', `/projects/${projectId}/tasks/${taskId}/execute`),
  executeAll: (projectId: number) =>
    request<Task[]>('POST', `/projects/${projectId}/tasks/execute-all`),
  stopExecution: (projectId: number) =>
    request<Task[]>('POST', `/projects/${projectId}/tasks/stop`),
  run: (projectId: number, taskId: number) =>
    request<AgentRun>('GET', `/projects/${projectId}/tasks/${taskId}/run`),
  settings: (projectId: number) =>
    request<TaskSettings>('GET', `/projects/${projectId}/tasks/settings`),
  saveSettings: (
    projectId: number,
    data: { model: string; effort: string; thinking: boolean },
  ) =>
    request<TaskSettings>('PUT', `/projects/${projectId}/tasks/settings`, data),
  plan: (projectId: number) =>
    request<PlanState>('GET', `/projects/${projectId}/tasks/plan`),
  search: (projectId: number) =>
    request<AgentRun>('POST', `/projects/${projectId}/tasks/plan/search`),
  apply: (projectId: number, runId: number) =>
    request<Task[]>('POST', `/projects/${projectId}/tasks/plan/apply`, {
      run_id: runId,
    }),
};

export const skillsApi = {
  list: () => request<Skill[]>('GET', '/skills'),
  get: (id: number) => request<SkillDetail>('GET', `/skills/${id}`),
  create: (data: { name: string; description?: string; content: string }) =>
    request<SkillDetail>('POST', '/skills', data),
  update: (
    id: number,
    data: { name?: string; description?: string | null; content?: string },
  ) => request<SkillDetail>('PATCH', `/skills/${id}`, data),
  remove: (id: number) => request<void>('DELETE', `/skills/${id}`),
  forProject: (projectId: number) =>
    request<ProjectSkill[]>('GET', `/projects/${projectId}/skills`),
  setForStage: (projectId: number, key: SkillScope, skillIds: number[]) =>
    request<ProjectSkill[]>('PUT', `/projects/${projectId}/skills/${key}`, {
      skill_ids: skillIds,
    }),
};

export const runApi = {
  get: (projectId: number) =>
    request<RunState>('GET', `/projects/${projectId}/run`),
  setCommand: (projectId: number, command: string) =>
    request<RunState>('PUT', `/projects/${projectId}/run/command`, {
      command,
    }),
  start: (projectId: number) =>
    request<RunState>('POST', `/projects/${projectId}/run/start`),
  stop: (projectId: number) =>
    request<RunState>('POST', `/projects/${projectId}/run/stop`),
  apk: (projectId: number) =>
    request<ApkState>('GET', `/projects/${projectId}/run/apk`),
  buildApk: (projectId: number) =>
    request<ApkState>('POST', `/projects/${projectId}/run/apk`),
  stopApk: (projectId: number) =>
    request<ApkState>('POST', `/projects/${projectId}/run/apk/stop`),
  apkFile: (projectId: number) =>
    download(`/projects/${projectId}/run/apk/file`),
};

export const documentsApi = {
  list: (projectId: number) =>
    request<DocumentEntry[]>('GET', `/projects/${projectId}/documents`),
  get: (projectId: number, path: string) =>
    request<DocumentContent>(
      'GET',
      `/projects/${projectId}/documents/file?path=${encodeURIComponent(path)}`,
    ),
  remove: (projectId: number, path: string) =>
    request<void>(
      'DELETE',
      `/projects/${projectId}/documents/file?path=${encodeURIComponent(path)}`,
    ),
  save: (projectId: number, path: string, content: string) =>
    request<DocumentContent>('PUT', `/projects/${projectId}/documents/file`, {
      path,
      content,
    }),
};

export const agentApi = {
  runs: (projectId: number, kind: AgentKind = 'docs') =>
    request<AgentRunSummary[]>(
      'GET',
      `/projects/${projectId}/agent/runs?kind=${kind}`,
    ),
  run: (projectId: number, runId: number) =>
    request<AgentRun>('GET', `/projects/${projectId}/agent/runs/${runId}`),
  start: (
    projectId: number,
    prompt: string,
    newConversation: boolean,
    kind: AgentKind = 'docs',
  ) =>
    request<AgentRun>('POST', `/projects/${projectId}/agent/runs`, {
      kind,
      prompt,
      new_conversation: newConversation,
    }),
  stop: (projectId: number, runId: number) =>
    request<AgentRun>(
      'POST',
      `/projects/${projectId}/agent/runs/${runId}/stop`,
    ),
  clear: (projectId: number, kind: AgentKind = 'docs') =>
    request<void>('DELETE', `/projects/${projectId}/agent/runs?kind=${kind}`),
};

export const changesApi = {
  get: (projectId: number) =>
    request<Changes>('GET', `/projects/${projectId}/changes`),
  commit: (projectId: number, message: string) =>
    request<Changes>('POST', `/projects/${projectId}/changes/commit`, {
      message,
    }),
  push: (projectId: number) =>
    request<Changes>('POST', `/projects/${projectId}/changes/push`),
  suggest: (projectId: number) =>
    request<AgentRun>('POST', `/projects/${projectId}/changes/suggest`),
};

export const usageApi = {
  get: () => request<Usage>('GET', '/usage'),
  refresh: () => request<Usage>('POST', '/usage/refresh'),
};

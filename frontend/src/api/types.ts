export type Role = 'owner' | 'po' | 'dev';
export type AssignableRole = Exclude<Role, 'owner'>;
export type ProjectType = 'web' | 'youtube' | 'mobile';
export type StageKey = 'modeling' | 'coding' | 'testing' | 'deploy';
export type StageStatus = 'todo' | 'doing' | 'done' | 'skipped';
export type ThemeName = 'dev-dark' | 'dev-light';

export interface User {
  id: number;
  email: string;
  name: string;
  theme: ThemeName;
  is_superadmin: boolean;
  created_at: string;
}

export interface TokenPair {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}

export interface Project {
  id: number;
  name: string;
  description: string | null;
  type: ProjectType;
  owner_id: number;
  role: Role;
  member_role: Role | null;
  access_url: string | null;
  tasks_total: number;
  tasks_done: number;
  created_at: string;
}

export interface Member {
  user_id: number;
  email: string;
  name: string;
  role: Role;
  joined_at: string;
}

export interface Invite {
  id: number;
  project_id: number;
  project_name: string;
  email: string;
  role: AssignableRole;
  invited_by_name: string;
  status: string;
  created_at: string;
}

export interface AdminUser {
  id: number;
  email: string;
  name: string;
  is_active: boolean;
  is_superadmin: boolean;
  created_at: string;
  projects_count: number;
  owned_projects_count: number;
}

export interface AdminProject {
  id: number;
  name: string;
  type: ProjectType;
  role: Role;
}

export interface GithubAccount {
  connected: boolean;
  login: string | null;
}

export interface Repository {
  full_name: string;
  html_url: string;
  is_private: boolean;
}

export interface ProjectGithub {
  token_source: 'project' | 'account' | 'none';
  login: string | null;
  repository: Repository | null;
}

export interface TaskStage {
  key: StageKey;
  status: StageStatus;
}

export interface Task {
  id: number;
  title: string;
  description: string | null;
  status: StageStatus;
  stages: TaskStage[];
  created_at: string;
  updated_at: string;
}

export interface SetupStep {
  key: string;
  status: 'todo' | 'doing' | 'done' | 'skipped' | 'failed';
}

export interface Setup {
  complete: boolean;
  steps: SetupStep[];
}

export interface Skill {
  id: number;
  name: string;
  description: string | null;
  updated_at: string;
}

export interface SkillDetail extends Skill {
  content: string;
}

export interface ProjectSkill {
  stage_key: StageKey;
  skill_id: number;
  name: string;
  description: string | null;
  position: number;
}

export interface Environment {
  status: 'todo' | 'building' | 'ready' | 'failed';
  container: string | null;
  image: string | null;
  workspace: string | null;
  port: number | null;
  error_code: string | null;
  log: string;
  claude_available: boolean;
}

export interface DocumentEntry {
  path: string;
  size: number;
  modified: string | null;
  exists: boolean;
  required: boolean;
}

export interface DocumentContent {
  path: string;
  content: string;
}

export type AgentStatus = 'running' | 'done' | 'failed' | 'stopped';

export interface AgentRunSummary {
  id: number;
  kind: string;
  prompt: string;
  status: AgentStatus;
  summary: string | null;
  resumed_from: number | null;
  error_code: string | null;
  created_at: string;
  finished_at: string | null;
}

export interface AgentRun extends AgentRunSummary {
  log: string;
}

export interface FileChange {
  status: string;
  path: string;
}

export interface CommitInfo {
  hash: string;
  subject: string;
}

export interface Changes {
  branch: string;
  files: FileChange[];
  diff: string;
  unpushed: CommitInfo[];
}

export interface RunState {
  command: string | null;
  running: boolean;
  ready: boolean;
  url: string | null;
  log: string;
}

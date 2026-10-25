import type { ProjectGithub, Setup } from '../api/types';

export type StepId = 'github' | 'repository' | 'commit' | 'environment';
export type StepState = 'done' | 'skipped' | 'current' | 'locked';

export interface WizardStep {
  id: StepId;
  state: StepState;
}

const ORDER = ['github', 'repository', 'commit', 'environment'] as const;

export function wizardSteps(
  setup: Setup,
  github: ProjectGithub,
): { steps: WizardStep[]; current: StepId | null } {
  const status = (key: string) =>
    setup.steps.find((step) => step.key === key)?.status;
  const commit = status('initial_commit');
  const finished = {
    github: github.token_source !== 'none' || github.repository !== null,
    repository: github.repository !== null,
    commit: commit === 'done' || commit === 'skipped',
    environment: status('environment') === 'done',
  };
  const current = ORDER.find((id) => !finished[id]) ?? null;

  const steps = ORDER.map((id): WizardStep => {
    if (id === 'commit' && commit === 'skipped') {
      return { id, state: 'skipped' };
    }
    if (finished[id]) return { id, state: 'done' };
    return { id, state: id === current ? 'current' : 'locked' };
  });
  return { steps, current };
}

export function landingStep(
  steps: WizardStep[],
  current: StepId | null,
): StepId {
  return current ?? steps[steps.length - 1]!.id;
}

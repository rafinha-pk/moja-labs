import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { githubApi, setupApi } from '../../api';
import { useRequest } from '../../api/useRequest';
import { Alert } from '../../components/Alert';
import { ErrorAlert } from '../../components/ErrorAlert';
import { Loading } from '../../components/Loading';
import { pt } from '../../i18n/pt';
import { landingStep, wizardSteps, type StepId } from '../../lib/wizard';
import { CommitStep } from './setup/CommitStep';
import { EnvironmentStep } from './setup/EnvironmentStep';
import { GithubStep } from './setup/GithubStep';
import { RepositoryStep } from './setup/RepositoryStep';
import { Stepper } from './setup/Stepper';
import { useProject } from './ProjectLayout';

export function SetupTab() {
  const { project, reloadSetup } = useProject();
  const text = pt.setup.wizard;
  const canManage = project.role === 'owner';
  const loadSetup = useCallback(() => setupApi.get(project.id), [project.id]);
  const loadGithub = useCallback(
    () => githubApi.project(project.id),
    [project.id],
  );
  const setup = useRequest(loadSetup);
  const github = useRequest(loadGithub);
  const [selected, setSelected] = useState<StepId | null>(null);

  if (setup.error || github.error) {
    return <ErrorAlert error={setup.error ?? github.error} />;
  }
  if (!setup.data || !github.data) return <Loading />;
  if (setup.data.steps.length === 0) {
    return <Alert tone="success">{text.noSetup}</Alert>;
  }

  const { steps, current } = wizardSteps(setup.data, github.data);
  const active = selected ?? landingStep(steps, current);
  const commitStatus = setup.data.steps.find(
    (step) => step.key === 'initial_commit',
  )?.status;

  const advance = () => {
    setSelected(null);
    setup.reload();
    github.reload();
    reloadSetup();
  };

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      {setup.data.complete ? (
        <Alert tone="success">
          {text.doneAll} <Link to="../tasks">{text.goToTasks}</Link>
        </Alert>
      ) : (
        !canManage && <Alert tone="info">{text.ownerOnly}</Alert>
      )}

      <Stepper steps={steps} active={active} onSelect={setSelected} />

      {active === 'github' && (
        <GithubStep
          projectId={project.id}
          github={github.data}
          canManage={canManage}
          onDone={advance}
        />
      )}
      {active === 'repository' && (
        <RepositoryStep
          projectId={project.id}
          projectName={project.name}
          github={github.data}
          canManage={canManage}
          onDone={advance}
        />
      )}
      {active === 'commit' && (
        <CommitStep
          projectId={project.id}
          status={commitStatus}
          canManage={canManage}
          onDone={advance}
        />
      )}
      {active === 'environment' && (
        <EnvironmentStep
          projectId={project.id}
          canManage={canManage}
          ready={steps
            .slice(0, 3)
            .every((step) => step.state === 'done' || step.state === 'skipped')}
          onChanged={advance}
        />
      )}
    </div>
  );
}

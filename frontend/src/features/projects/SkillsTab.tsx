import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { skillsApi } from '../../api';
import type { ProjectSkill, Skill, StageKey } from '../../api/types';
import { useAction } from '../../api/useAction';
import { useRequest } from '../../api/useRequest';
import { Alert } from '../../components/Alert';
import { Button } from '../../components/Button';
import { Card, ListRow } from '../../components/Card';
import { ErrorAlert } from '../../components/ErrorAlert';
import { Loading } from '../../components/Loading';
import { pt } from '../../i18n/pt';
import { useProject } from './ProjectLayout';

const STAGES: StageKey[] = ['modeling', 'coding', 'testing', 'deploy'];

function StageSkills({
  stage,
  attached,
  library,
  canEdit,
  onChange,
}: {
  stage: StageKey;
  attached: ProjectSkill[];
  library: Skill[];
  canEdit: boolean;
  onChange: (ids: number[]) => Promise<void>;
}) {
  const [pick, setPick] = useState('');
  const ids = attached.map((skill) => skill.skill_id);
  const available = library.filter((skill) => !ids.includes(skill.id));

  const add = async () => {
    if (!pick) return;
    await onChange([...ids, Number(pick)]);
    setPick('');
  };

  return (
    <Card title={pt.tasks.stageNames[stage]}>
      {attached.length === 0 && (
        <p className="px-4 py-3 text-sm text-muted">{pt.skills.none}</p>
      )}
      <ul>
        {attached.map((skill) => (
          <ListRow key={skill.skill_id}>
            <div className="min-w-0">
              <p className="text-sm font-semibold">{skill.name}</p>
              {skill.description && (
                <p className="truncate text-xs text-muted">
                  {skill.description}
                </p>
              )}
            </div>
            {canEdit && (
              <Button
                small
                variant="danger"
                onClick={() =>
                  onChange(ids.filter((id) => id !== skill.skill_id))
                }
              >
                {pt.common.remove}
              </Button>
            )}
          </ListRow>
        ))}
      </ul>
      {canEdit && available.length > 0 && (
        <div className="flex items-center gap-2 border-t border-line-muted p-4">
          <select
            aria-label={pt.skills.pick}
            value={pick}
            onChange={(event) => setPick(event.target.value)}
            className="min-w-0 flex-1 rounded-md border border-line bg-inset px-3 py-1.5 text-sm"
          >
            <option value="">{pt.skills.pick}</option>
            {available.map((skill) => (
              <option key={skill.id} value={skill.id}>
                {skill.name}
              </option>
            ))}
          </select>
          <Button disabled={!pick} onClick={add}>
            {pt.skills.add}
          </Button>
        </div>
      )}
    </Card>
  );
}

export function SkillsTab() {
  const { project } = useProject();
  const canEdit = project.role === 'owner' || project.role === 'po';
  const loadAttached = useCallback(
    () => skillsApi.forProject(project.id),
    [project.id],
  );
  const loadLibrary = useCallback(() => skillsApi.list(), []);
  const attached = useRequest(loadAttached);
  const library = useRequest(loadLibrary);
  const action = useAction();

  if (attached.error || library.error) {
    return <ErrorAlert error={attached.error ?? library.error} />;
  }
  if (!attached.data || !library.data) return <Loading />;

  const change = async (stage: StageKey, ids: number[]) => {
    const result = await action.run(() =>
      skillsApi.setForStage(project.id, stage, ids),
    );
    if (result) attached.setData(result.value);
  };

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <p className="text-sm text-muted">{pt.skills.projectIntro}</p>
      {!canEdit && <Alert tone="info">{pt.skills.readOnly}</Alert>}
      {canEdit && library.data.length === 0 && (
        <Alert tone="info">
          {pt.skills.noLibrary} <Link to="/skills">{pt.skills.library}</Link>
        </Alert>
      )}
      <ErrorAlert error={action.error} />
      {STAGES.map((stage) => (
        <StageSkills
          key={stage}
          stage={stage}
          attached={attached.data!.filter((skill) => skill.stage_key === stage)}
          library={library.data!}
          canEdit={canEdit}
          onChange={(ids) => change(stage, ids)}
        />
      ))}
    </div>
  );
}

import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { skillsApi } from '../../api';
import type { Skill } from '../../api/types';
import { useAction } from '../../api/useAction';
import { useRequest } from '../../api/useRequest';
import { Button } from '../../components/Button';
import { Card, ListRow } from '../../components/Card';
import { ErrorAlert } from '../../components/ErrorAlert';
import { Loading } from '../../components/Loading';
import { ConfirmDialog } from '../../components/Modal';
import { pt } from '../../i18n/pt';

export function SkillsPage() {
  const load = useCallback(() => skillsApi.list(), []);
  const { data, error, reload } = useRequest(load);
  const action = useAction();
  const [removing, setRemoving] = useState<Skill | null>(null);

  const remove = async () => {
    if (!removing) return;
    const result = await action.run(() => skillsApi.remove(removing.id));
    if (result) {
      setRemoving(null);
      reload();
    }
  };

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">{pt.skills.title}</h1>
        <Link to="/skills/new" className="no-underline">
          <span className="inline-flex rounded-md border border-transparent bg-success-emphasis px-3 py-1.5 text-sm font-medium text-on-emphasis hover:bg-success-emphasis-hover">
            {pt.skills.new}
          </span>
        </Link>
      </div>
      <p className="text-sm text-muted">{pt.skills.intro}</p>
      <ErrorAlert error={error ?? action.error} />
      {!data && !error && <Loading />}
      {data && data.length === 0 && (
        <Card className="px-4 py-10 text-center">
          <h2 className="text-base font-semibold">{pt.skills.emptyTitle}</h2>
          <p className="mt-1 text-sm text-muted">{pt.skills.emptyText}</p>
        </Card>
      )}
      {data && data.length > 0 && (
        <Card>
          <ul>
            {data.map((skill) => (
              <ListRow key={skill.id}>
                <div className="min-w-0">
                  <Link
                    to={`/skills/${skill.id}`}
                    className="text-sm font-semibold"
                  >
                    {skill.name}
                  </Link>
                  {skill.description && (
                    <p className="truncate text-xs text-muted">
                      {skill.description}
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  <Link to={`/skills/${skill.id}`} className="no-underline">
                    <span className="inline-flex rounded-md border border-control-line bg-control px-2 py-0.5 text-xs font-medium text-fg hover:bg-control-hover">
                      {pt.tasks.edit}
                    </span>
                  </Link>
                  <Button
                    small
                    variant="danger"
                    onClick={() => setRemoving(skill)}
                  >
                    {pt.common.delete}
                  </Button>
                </div>
              </ListRow>
            ))}
          </ul>
        </Card>
      )}

      <ConfirmDialog
        open={removing !== null}
        title={pt.skills.removeTitle}
        text={pt.skills.removeText}
        confirmLabel={pt.common.delete}
        busy={action.pending}
        onConfirm={remove}
        onClose={() => setRemoving(null)}
      />
    </div>
  );
}

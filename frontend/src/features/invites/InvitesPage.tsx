import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { invitesApi } from '../../api';
import type { Invite } from '../../api/types';
import { useAction } from '../../api/useAction';
import { useRequest } from '../../api/useRequest';
import { RoleBadge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { Card, ListRow } from '../../components/Card';
import { ErrorAlert } from '../../components/ErrorAlert';
import { Loading } from '../../components/Loading';
import { pt } from '../../i18n/pt';

export function InvitesPage() {
  const navigate = useNavigate();
  const load = useCallback(() => invitesApi.mine(), []);
  const { data, error, reload } = useRequest(load);
  const answer = useAction();

  const accept = async (invite: Invite) => {
    const result = await answer.run(() => invitesApi.accept(invite.id));
    if (result) navigate(`/projects/${invite.project_id}`);
  };

  const decline = async (invite: Invite) => {
    const result = await answer.run(() => invitesApi.decline(invite.id));
    if (result) reload();
  };

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">{pt.invites.title}</h1>
      <ErrorAlert error={error ?? answer.error} />
      {!data && !error && <Loading />}
      {data && data.length === 0 && (
        <Card className="px-4 py-10 text-center">
          <h2 className="text-base font-semibold">{pt.invites.emptyTitle}</h2>
          <p className="mt-1 text-sm text-muted">{pt.invites.emptyText}</p>
        </Card>
      )}
      {data && data.length > 0 && (
        <Card>
          <ul>
            {data.map((invite) => (
              <ListRow key={invite.id}>
                <div>
                  <p className="text-sm font-semibold">{invite.project_name}</p>
                  <p className="text-xs text-muted">
                    {pt.invites.from} {invite.invited_by_name}{' '}
                    {pt.invites.asRole} <RoleBadge role={invite.role} />
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    small
                    variant="primary"
                    disabled={answer.pending}
                    onClick={() => accept(invite)}
                  >
                    {pt.invites.accept}
                  </Button>
                  <Button
                    small
                    disabled={answer.pending}
                    onClick={() => decline(invite)}
                  >
                    {pt.invites.decline}
                  </Button>
                </div>
              </ListRow>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

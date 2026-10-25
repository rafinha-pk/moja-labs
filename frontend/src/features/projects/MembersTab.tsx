import { useCallback, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { invitesApi, membersApi, projectsApi } from '../../api';
import type { AssignableRole, Member } from '../../api/types';
import { useAction } from '../../api/useAction';
import { useRequest } from '../../api/useRequest';
import { useCurrentUser } from '../../auth/AuthContext';
import { Alert } from '../../components/Alert';
import { Avatar } from '../../components/Avatar';
import { RoleBadge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { Card, ListRow } from '../../components/Card';
import { ErrorAlert, fieldError } from '../../components/ErrorAlert';
import { SelectField, TextField } from '../../components/Field';
import { Loading } from '../../components/Loading';
import { ConfirmDialog, Modal } from '../../components/Modal';
import { pt } from '../../i18n/pt';
import { useProject } from './ProjectLayout';

const ASSIGNABLE: AssignableRole[] = ['po', 'dev'];

function RoleOptions() {
  return ASSIGNABLE.map((role) => (
    <option key={role} value={role}>
      {pt.roles[role]}
    </option>
  ));
}

function InviteForm({
  projectId,
  onInvited,
}: {
  projectId: number;
  onInvited: () => void;
}) {
  const { run, pending, error } = useAction();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<AssignableRole>('dev');
  const [sent, setSent] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSent(false);
    const result = await run(() => invitesApi.create(projectId, email, role));
    if (result) {
      setEmail('');
      setSent(true);
      onInvited();
    }
  };

  return (
    <Card title={pt.members.invite}>
      <form onSubmit={submit} className="flex flex-col gap-4 p-4">
        <ErrorAlert error={error} />
        {sent && <Alert tone="success">{pt.members.sent}</Alert>}
        <div className="grid gap-4 sm:grid-cols-[1fr_10rem]">
          <TextField
            id="invite-email"
            label={pt.members.email}
            type="email"
            required
            hint={pt.members.inviteHint}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            error={fieldError(error, 'email')}
          />
          <SelectField
            id="invite-role"
            label={pt.members.role}
            value={role}
            onChange={(event) => setRole(event.target.value as AssignableRole)}
          >
            <RoleOptions />
          </SelectField>
        </div>
        <div>
          <Button type="submit" variant="primary" disabled={pending}>
            {pt.members.send}
          </Button>
        </div>
      </form>
    </Card>
  );
}

function PendingInvites({
  projectId,
  version,
}: {
  projectId: number;
  version: number;
}) {
  const load = useCallback(
    () => invitesApi.forProject(projectId),
    [projectId, version],
  );
  const { data, reload } = useRequest(load);
  const { run, error } = useAction();

  const cancel = async (inviteId: number) => {
    const result = await run(() => invitesApi.cancel(projectId, inviteId));
    if (result) reload();
  };

  return (
    <Card title={pt.members.pending}>
      <ErrorAlert error={error} />
      {data && data.length === 0 && (
        <p className="px-4 py-3 text-sm text-muted">{pt.members.noPending}</p>
      )}
      <ul>
        {data?.map((invite) => (
          <ListRow key={invite.id}>
            <div>
              <span className="text-sm font-semibold">{invite.email}</span>{' '}
              <RoleBadge role={invite.role} />
            </div>
            <Button small onClick={() => cancel(invite.id)}>
              {pt.members.cancelInvite}
            </Button>
          </ListRow>
        ))}
      </ul>
    </Card>
  );
}

function TransferDialog({
  open,
  projectId,
  candidates,
  onClose,
  onDone,
}: {
  open: boolean;
  projectId: number;
  candidates: Member[];
  onClose: () => void;
  onDone: () => Promise<void>;
}) {
  const { run, pending, error } = useAction();
  const [target, setTarget] = useState('');
  const [previousRole, setPreviousRole] = useState<AssignableRole>('dev');
  const chosen = target || String(candidates[0]?.user_id ?? '');

  const confirm = async () => {
    const result = await run(() =>
      membersApi.transfer(projectId, Number(chosen), previousRole),
    );
    if (result) await onDone();
  };

  return (
    <Modal
      open={open}
      title={pt.members.transferTitle}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>{pt.common.cancel}</Button>
          <Button
            variant="primary"
            disabled={pending || !chosen}
            onClick={confirm}
          >
            {pt.members.transferConfirm}
          </Button>
        </>
      }
    >
      <p className="text-sm text-muted">{pt.members.transferText}</p>
      <ErrorAlert error={error} />
      <SelectField
        id="transfer-to"
        label={pt.members.transferTo}
        value={chosen}
        onChange={(event) => setTarget(event.target.value)}
      >
        {candidates.map((member) => (
          <option key={member.user_id} value={member.user_id}>
            {member.name} ({member.email})
          </option>
        ))}
      </SelectField>
      <SelectField
        id="previous-role"
        label={pt.members.previousRole}
        value={previousRole}
        onChange={(event) =>
          setPreviousRole(event.target.value as AssignableRole)
        }
      >
        <RoleOptions />
      </SelectField>
    </Modal>
  );
}

export function MembersTab() {
  const { project, setProject } = useProject();
  const me = useCurrentUser();
  const navigate = useNavigate();
  const isOwner = project.role === 'owner';

  const load = useCallback(() => membersApi.list(project.id), [project.id]);
  const { data: members, error, reload } = useRequest(load);
  const change = useAction();
  const removal = useAction();
  const [invitesVersion, setInvitesVersion] = useState(0);
  const [toRemove, setToRemove] = useState<Member | null>(null);
  const [transferring, setTransferring] = useState(false);

  const changeRole = async (member: Member, role: AssignableRole) => {
    const result = await change.run(() =>
      membersApi.changeRole(project.id, member.user_id, role),
    );
    if (result) reload();
  };

  const confirmRemoval = async () => {
    if (!toRemove) return;
    const leaving = toRemove.user_id === me.id;
    const result = await removal.run(() =>
      membersApi.remove(project.id, toRemove.user_id),
    );
    if (!result) return;
    setToRemove(null);
    if (leaving) navigate('/');
    else reload();
  };

  const finishTransfer = async () => {
    setTransferring(false);
    setProject(await projectsApi.get(project.id));
    reload();
  };

  if (error) return <ErrorAlert error={error} />;
  if (!members) return <Loading />;

  const candidates = members.filter((member) => member.role !== 'owner');
  const leaving = toRemove?.user_id === me.id;

  return (
    <div className="flex flex-col gap-6">
      <Card
        title={pt.members.title}
        action={
          isOwner && candidates.length > 0 ? (
            <Button small onClick={() => setTransferring(true)}>
              {pt.members.transfer}
            </Button>
          ) : undefined
        }
      >
        <ErrorAlert error={change.error} />
        <ul>
          {members.map((member) => {
            const isMe = member.user_id === me.id;
            return (
              <ListRow key={member.user_id}>
                <div className="flex items-center gap-3">
                  <Avatar name={member.name} size={32} />
                  <div>
                    <p className="text-sm font-semibold">
                      {member.name}
                      {isMe && (
                        <span className="font-normal text-muted">
                          {' '}
                          ({pt.members.you})
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-muted">{member.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {isOwner && member.role !== 'owner' ? (
                    <select
                      aria-label={pt.members.changeRole}
                      value={member.role}
                      onChange={(event) =>
                        changeRole(member, event.target.value as AssignableRole)
                      }
                      className="rounded-md border border-control-line bg-control px-2 py-1 text-sm"
                    >
                      <RoleOptions />
                    </select>
                  ) : (
                    <RoleBadge role={member.role} />
                  )}
                  {isOwner && member.role !== 'owner' && (
                    <Button
                      small
                      variant="danger"
                      onClick={() => setToRemove(member)}
                    >
                      {pt.common.remove}
                    </Button>
                  )}
                  {!isOwner && isMe && (
                    <Button
                      small
                      variant="danger"
                      onClick={() => setToRemove(member)}
                    >
                      {pt.members.leave}
                    </Button>
                  )}
                </div>
              </ListRow>
            );
          })}
        </ul>
      </Card>

      {isOwner && (
        <>
          <InviteForm
            projectId={project.id}
            onInvited={() => setInvitesVersion((value) => value + 1)}
          />
          <PendingInvites projectId={project.id} version={invitesVersion} />
        </>
      )}

      <ConfirmDialog
        open={toRemove !== null}
        title={leaving ? pt.members.leaveTitle : pt.members.removeTitle}
        text={leaving ? pt.members.leaveText : pt.members.removeText}
        confirmLabel={leaving ? pt.members.leave : pt.common.remove}
        busy={removal.pending}
        onConfirm={confirmRemoval}
        onClose={() => setToRemove(null)}
      />
      <ErrorAlert error={removal.error} />

      <TransferDialog
        open={transferring}
        projectId={project.id}
        candidates={candidates}
        onClose={() => setTransferring(false)}
        onDone={finishTransfer}
      />
    </div>
  );
}

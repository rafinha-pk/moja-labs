import { useCallback, useState, type FormEvent } from 'react';
import { adminApi } from '../../api';
import type { AdminUser } from '../../api/types';
import { useAction } from '../../api/useAction';
import { useRequest } from '../../api/useRequest';
import { useCurrentUser } from '../../auth/AuthContext';
import { Avatar } from '../../components/Avatar';
import { Badge, RoleBadge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { Card, ListRow } from '../../components/Card';
import { ErrorAlert, fieldError } from '../../components/ErrorAlert';
import { TextField } from '../../components/Field';
import { Loading } from '../../components/Loading';
import { ConfirmDialog, Modal } from '../../components/Modal';
import { pt } from '../../i18n/pt';

type Change = 'block' | 'promote' | 'demote';

const CHANGES: Record<
  Change,
  {
    title: string;
    text: string;
    patch: Parameters<typeof adminApi.updateUser>[1];
  }
> = {
  block: {
    title: pt.admin.blockTitle,
    text: pt.admin.blockText,
    patch: { is_active: false },
  },
  promote: {
    title: pt.admin.promoteTitle,
    text: pt.admin.promoteText,
    patch: { is_superadmin: true },
  },
  demote: {
    title: pt.admin.demoteTitle,
    text: pt.admin.demoteText,
    patch: { is_superadmin: false },
  },
};

function CreateUserDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const { run, pending, error } = useAction();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [superadmin, setSuperadmin] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const result = await run(() =>
      adminApi.createUser({
        name,
        email,
        password,
        is_superadmin: superadmin,
      }),
    );
    if (result) onCreated();
  };

  return (
    <Modal
      open
      title={pt.admin.createTitle}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>{pt.common.cancel}</Button>
          <Button
            type="submit"
            form="create-user"
            variant="primary"
            disabled={pending}
          >
            {pt.common.create}
          </Button>
        </>
      }
    >
      <form id="create-user" onSubmit={submit} className="flex flex-col gap-4">
        <ErrorAlert error={error} />
        <TextField
          id="new-name"
          label={pt.auth.name}
          required
          maxLength={100}
          value={name}
          onChange={(event) => setName(event.target.value)}
          error={fieldError(error, 'name')}
        />
        <TextField
          id="new-email"
          label={pt.auth.email}
          type="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          error={fieldError(error, 'email')}
        />
        <TextField
          id="new-password"
          label={pt.auth.password}
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          maxLength={128}
          hint={pt.auth.passwordHint}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          error={fieldError(error, 'password')}
        />
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={superadmin}
            onChange={(event) => setSuperadmin(event.target.checked)}
          />
          {pt.admin.grantSuperadmin}
        </label>
      </form>
    </Modal>
  );
}

function UserProjectsDialog({
  user,
  onClose,
}: {
  user: AdminUser;
  onClose: () => void;
}) {
  const load = useCallback(() => adminApi.userProjects(user.id), [user.id]);
  const { data, error } = useRequest(load);

  return (
    <Modal
      open
      title={`${pt.admin.projectsOf} ${user.name}`}
      onClose={onClose}
      footer={<Button onClick={onClose}>{pt.admin.close}</Button>}
    >
      <ErrorAlert error={error} />
      {!data && !error && <Loading />}
      {data?.length === 0 && (
        <p className="text-sm text-muted">{pt.admin.noProjects}</p>
      )}
      <ul>
        {data?.map((project) => (
          <ListRow key={project.id} className="px-0">
            <span className="text-sm font-semibold">{project.name}</span>
            <span className="flex gap-2">
              <Badge>{pt.projects.types[project.type]}</Badge>
              <RoleBadge role={project.role} />
            </span>
          </ListRow>
        ))}
      </ul>
    </Modal>
  );
}

export function AdminUsersPage() {
  const me = useCurrentUser();
  const load = useCallback(() => adminApi.users(), []);
  const { data, error, reload } = useRequest(load);
  const update = useAction();
  const [creating, setCreating] = useState(false);
  const [viewing, setViewing] = useState<AdminUser | null>(null);
  const [pending, setPending] = useState<{
    user: AdminUser;
    change: Change;
  } | null>(null);

  const apply = async (
    user: AdminUser,
    patch: Parameters<typeof adminApi.updateUser>[1],
  ) => {
    const result = await update.run(() => adminApi.updateUser(user.id, patch));
    if (result) reload();
    return result !== null;
  };

  const confirm = async () => {
    if (!pending) return;
    if (await apply(pending.user, CHANGES[pending.change].patch)) {
      setPending(null);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">{pt.admin.title}</h1>
        <Button variant="primary" onClick={() => setCreating(true)}>
          {pt.admin.newUser}
        </Button>
      </div>
      <ErrorAlert error={error ?? update.error} />
      {!data && !error && <Loading />}
      {data && (
        <Card>
          <ul>
            {data.map((user) => (
              <ListRow key={user.id}>
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar name={user.name} size={32} />
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                      {user.name}
                      {user.is_superadmin && (
                        <Badge>{pt.roles.superadmin}</Badge>
                      )}
                      {!user.is_active && <Badge>{pt.admin.blocked}</Badge>}
                    </p>
                    <p className="truncate text-xs text-muted">{user.email}</p>
                  </div>
                </div>
                <p className="text-xs text-muted">
                  {user.projects_count} {pt.admin.projects} · {pt.admin.ownerIn}{' '}
                  {user.owned_projects_count}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button small onClick={() => setViewing(user)}>
                    {pt.admin.viewProjects}
                  </Button>
                  {user.id !== me.id && (
                    <>
                      <Button
                        small
                        onClick={() =>
                          setPending({
                            user,
                            change: user.is_superadmin ? 'demote' : 'promote',
                          })
                        }
                      >
                        {user.is_superadmin
                          ? pt.admin.demote
                          : pt.admin.promote}
                      </Button>
                      {user.is_active ? (
                        <Button
                          small
                          variant="danger"
                          onClick={() => setPending({ user, change: 'block' })}
                        >
                          {pt.admin.block}
                        </Button>
                      ) : (
                        <Button
                          small
                          onClick={() => apply(user, { is_active: true })}
                        >
                          {pt.admin.unblock}
                        </Button>
                      )}
                    </>
                  )}
                </div>
              </ListRow>
            ))}
          </ul>
        </Card>
      )}

      {creating && (
        <CreateUserDialog
          onClose={() => setCreating(false)}
          onCreated={() => {
            setCreating(false);
            reload();
          }}
        />
      )}
      {viewing && (
        <UserProjectsDialog user={viewing} onClose={() => setViewing(null)} />
      )}
      <ConfirmDialog
        open={pending !== null}
        title={pending ? CHANGES[pending.change].title : ''}
        text={pending ? CHANGES[pending.change].text : ''}
        confirmLabel={pt.common.confirm}
        busy={update.pending}
        onConfirm={confirm}
        onClose={() => setPending(null)}
      />
    </div>
  );
}

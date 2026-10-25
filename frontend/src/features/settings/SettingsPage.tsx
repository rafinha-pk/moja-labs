import { useCallback, useState, type FormEvent } from 'react';
import { authApi, githubApi } from '../../api';
import type { ThemeName } from '../../api/types';
import { useAction } from '../../api/useAction';
import { useRequest } from '../../api/useRequest';
import { useAuth, useCurrentUser } from '../../auth/AuthContext';
import { Alert } from '../../components/Alert';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { ErrorAlert, fieldError } from '../../components/ErrorAlert';
import { SelectField, TextField } from '../../components/Field';
import { pt } from '../../i18n/pt';
import { THEMES } from '../../theme/theme';

function ProfileCard() {
  const user = useCurrentUser();
  const { updateProfile } = useAuth();
  const { run, pending, error } = useAction();
  const [name, setName] = useState(user.name);
  const [saved, setSaved] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaved(false);
    const result = await run(() => updateProfile({ name }));
    if (result) setSaved(true);
  };

  return (
    <Card title={pt.settings.profile}>
      <form onSubmit={submit} className="flex flex-col gap-4 p-4">
        <ErrorAlert error={error} />
        {saved && <Alert tone="success">{pt.common.saved}</Alert>}
        <TextField
          id="profile-name"
          label={pt.auth.name}
          required
          maxLength={100}
          value={name}
          onChange={(event) => setName(event.target.value)}
          error={fieldError(error, 'name')}
        />
        <TextField
          id="profile-email"
          label={pt.auth.email}
          value={user.email}
          disabled
          readOnly
        />
        <div>
          <Button type="submit" variant="primary" disabled={pending}>
            {pt.common.save}
          </Button>
        </div>
      </form>
    </Card>
  );
}

function AppearanceCard() {
  const user = useCurrentUser();
  const { updateProfile } = useAuth();
  const { run, error } = useAction();

  return (
    <Card title={pt.settings.appearance}>
      <div className="flex flex-col gap-4 p-4">
        <ErrorAlert error={error} />
        <SelectField
          id="theme"
          label={pt.settings.theme}
          value={user.theme}
          onChange={(event) =>
            void run(() =>
              updateProfile({ theme: event.target.value as ThemeName }),
            )
          }
        >
          {THEMES.map((theme) => (
            <option key={theme} value={theme}>
              {pt.settings.themes[theme]}
            </option>
          ))}
        </SelectField>
      </div>
    </Card>
  );
}

function GitHubCard() {
  const load = useCallback(() => githubApi.account(), []);
  const { data, setData } = useRequest(load);
  const { run, pending, error } = useAction();
  const [token, setToken] = useState('');

  const connect = async (event: FormEvent) => {
    event.preventDefault();
    const result = await run(() => githubApi.connect(token));
    if (result) {
      setData(result.value);
      setToken('');
    }
  };

  const disconnect = async () => {
    const result = await run(() => githubApi.disconnect());
    if (result) setData({ connected: false, login: null });
  };

  return (
    <Card title={pt.github.title}>
      <div className="flex flex-col gap-4 p-4">
        <ErrorAlert error={error} />
        <p className="text-sm text-muted">{pt.github.accountHint}</p>
        {data?.connected ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm">
              {pt.github.connectedAs} <strong>{data.login}</strong>
            </p>
            <Button variant="danger" disabled={pending} onClick={disconnect}>
              {pt.github.disconnect}
            </Button>
          </div>
        ) : (
          <form onSubmit={connect} className="flex flex-col gap-4">
            <TextField
              id="github-token"
              label={pt.github.token}
              type="password"
              autoComplete="off"
              hint={pt.github.tokenHint}
              value={token}
              onChange={(event) => setToken(event.target.value)}
              error={fieldError(error, 'token')}
            />
            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="submit"
                variant="primary"
                disabled={pending || token.length === 0}
              >
                {pt.github.connect}
              </Button>
              <a
                href="https://github.com/settings/tokens/new?scopes=repo&description=Moja+Labs"
                target="_blank"
                rel="noreferrer"
              >
                {pt.github.generateToken}
              </a>
            </div>
          </form>
        )}
      </div>
    </Card>
  );
}

function PasswordCard() {
  const { logout } = useAuth();
  const { run, pending, error } = useAction();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [changed, setChanged] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const result = await run(() => authApi.changePassword(current, next));
    if (!result) return;
    setChanged(true);
    setTimeout(() => void logout(), 1500);
  };

  return (
    <Card title={pt.settings.password}>
      <form onSubmit={submit} className="flex flex-col gap-4 p-4">
        <ErrorAlert error={error} />
        {changed && <Alert tone="success">{pt.settings.passwordChanged}</Alert>}
        <TextField
          id="current-password"
          label={pt.settings.currentPassword}
          type="password"
          autoComplete="current-password"
          required
          value={current}
          onChange={(event) => setCurrent(event.target.value)}
        />
        <TextField
          id="new-password"
          label={pt.settings.newPassword}
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          maxLength={128}
          hint={pt.auth.passwordHint}
          value={next}
          onChange={(event) => setNext(event.target.value)}
          error={fieldError(error, 'new_password')}
        />
        <div>
          <Button type="submit" variant="primary" disabled={pending || changed}>
            {pt.common.save}
          </Button>
        </div>
      </form>
    </Card>
  );
}

export function SettingsPage() {
  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6">
      <h1 className="text-xl font-semibold">{pt.settings.title}</h1>
      <ProfileCard />
      <AppearanceCard />
      <GitHubCard />
      <PasswordCard />
    </div>
  );
}

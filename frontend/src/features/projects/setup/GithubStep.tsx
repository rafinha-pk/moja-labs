import { useState, type FormEvent } from 'react';
import { githubApi } from '../../../api';
import type { ProjectGithub } from '../../../api/types';
import { useAction } from '../../../api/useAction';
import { Button } from '../../../components/Button';
import { Card } from '../../../components/Card';
import { ErrorAlert, fieldError } from '../../../components/ErrorAlert';
import { TextField } from '../../../components/Field';
import { pt } from '../../../i18n/pt';

const TOKEN_URL =
  'https://github.com/settings/tokens/new?scopes=repo&description=Moja+Labs';

export function GithubStep({
  projectId,
  github,
  canManage,
  onDone,
}: {
  projectId: number;
  github: ProjectGithub;
  canManage: boolean;
  onDone: () => void;
}) {
  const text = pt.setup.wizard.github;
  const { run, pending, error } = useAction();
  const [token, setToken] = useState('');
  const [projectOnly, setProjectOnly] = useState(
    github.token_source === 'project',
  );
  const [changing, setChanging] = useState(false);
  const connected = github.token_source !== 'none';

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const result = await run(async () => {
      if (projectOnly) await githubApi.setProjectToken(projectId, token);
      else await githubApi.connect(token);
    });
    if (result) {
      setToken('');
      setChanging(false);
      onDone();
    }
  };

  return (
    <Card title={text.title}>
      <div className="flex flex-col gap-4 p-4">
        <p className="text-sm text-muted">{text.text}</p>

        {connected && (
          <p className="text-sm">
            {text.connectedAs} <strong>{github.login}</strong> (
            {github.token_source === 'project'
              ? text.viaProject
              : text.viaAccount}
            )
          </p>
        )}

        {!canManage && !connected && (
          <p className="text-sm text-muted">{text.waiting}</p>
        )}

        {canManage && connected && !changing && (
          <div>
            <Button small onClick={() => setChanging(true)}>
              {text.change}
            </Button>
          </div>
        )}

        {canManage && (!connected || changing) && (
          <form onSubmit={submit} className="flex flex-col gap-4">
            <ErrorAlert error={error} />
            <TextField
              id="github-token"
              label={pt.github.token}
              type="password"
              autoComplete="off"
              required
              hint={pt.github.tokenHint}
              value={token}
              onChange={(event) => setToken(event.target.value)}
              error={fieldError(error, 'token')}
            />
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-1"
                checked={projectOnly}
                onChange={(event) => setProjectOnly(event.target.checked)}
              />
              <span>
                {text.projectOnly}
                <span className="block text-xs text-muted">
                  {text.projectOnlyHint}
                </span>
              </span>
            </label>
            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="submit"
                variant="primary"
                disabled={pending || token.length === 0}
              >
                {text.connect}
              </Button>
              {changing && (
                <Button onClick={() => setChanging(false)}>
                  {pt.common.cancel}
                </Button>
              )}
              <a href={TOKEN_URL} target="_blank" rel="noreferrer">
                {pt.github.generateToken}
              </a>
            </div>
          </form>
        )}
      </div>
    </Card>
  );
}

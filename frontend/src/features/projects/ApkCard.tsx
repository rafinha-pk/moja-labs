import { useCallback, useEffect, useRef, useState } from 'react';
import { projectsApi, runApi } from '../../api';
import { useAction } from '../../api/useAction';
import { useRequest } from '../../api/useRequest';
import { Alert } from '../../components/Alert';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { ErrorAlert } from '../../components/ErrorAlert';
import { SelectField, TextField } from '../../components/Field';
import { pt } from '../../i18n/pt';
import {
  ANDROID_ABIS,
  ANDROID_LEVELS,
  androidName,
  formatSize,
  isValidPackage,
  sameAbis,
  toggleAbi,
} from '../../lib/android';
import { useProject } from './ProjectLayout';

const POLL_MS = 3000;

export function ApkCard() {
  const { project, setProject } = useProject();
  const text = pt.run.apk;
  const canRun = project.role === 'owner' || project.role === 'dev';
  const load = useCallback(() => runApi.apk(project.id), [project.id]);
  const { data, error, reload } = useRequest(load);
  const action = useAction();
  const [pack, setPack] = useState<string | null>(null);
  const [level, setLevel] = useState<number | null>(null);
  const [chosen, setChosen] = useState<string[] | null>(null);
  const logEnd = useRef<HTMLPreElement>(null);
  const building = data?.state === 'running';

  useEffect(() => {
    if (!building) return;
    const timer = setInterval(reload, POLL_MS);
    return () => clearInterval(timer);
  }, [building, reload]);

  useEffect(() => {
    logEnd.current?.scrollTo({ top: logEnd.current.scrollHeight });
  }, [data?.log]);

  if (error) return <ErrorAlert error={error} />;
  if (!data) return null;

  const packageName = pack ?? project.android_package ?? '';
  const minSdk = level ?? project.android_min_sdk;
  const abis = chosen ?? project.android_abis;
  const changed =
    packageName !== (project.android_package ?? '') ||
    minSdk !== project.android_min_sdk ||
    !sameAbis(abis, project.android_abis);
  const valid = isValidPackage(packageName);

  const saveSettings = async () => {
    setProject(
      await projectsApi.update(project.id, {
        android_package: packageName,
        android_min_sdk: minSdk,
        android_abis: abis,
      }),
    );
    setPack(null);
    setLevel(null);
    setChosen(null);
  };

  const save = async () => {
    await action.run(saveSettings);
    reload();
  };

  const build = async () => {
    await action.run(async () => {
      if (changed) await saveSettings();
      await runApi.buildApk(project.id);
    });
    reload();
  };

  const cancel = async () => {
    await action.run(() => runApi.stopApk(project.id));
    reload();
  };

  const download = async () => {
    const result = await action.run(() => runApi.apkFile(project.id));
    if (!result) return;
    const url = URL.createObjectURL(result.value);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${project.name}.apk`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const status = {
    idle: text.idle,
    running: text.running,
    done: text.done,
    failed: text.failed,
  }[data.state];

  return (
    <Card title={text.title}>
      <div className="flex flex-col gap-4 p-4">
        <p className="text-sm text-muted">{text.hint}</p>
        <div className="flex flex-wrap items-center gap-3">
          <Badge>{status}</Badge>
          {data.size !== null && (
            <span className="text-sm text-muted">
              {formatSize(data.size)}
              {data.built_at &&
                ` · ${new Date(data.built_at).toLocaleString('pt-BR')}`}
            </span>
          )}
        </div>
        {!data.available && <Alert tone="info">{text.needsEnvironment}</Alert>}
        <ErrorAlert error={action.error} />
        {canRun && (
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              id="android-package"
              label={text.package}
              hint={text.packageHint}
              maxLength={150}
              value={packageName}
              disabled={building}
              error={
                packageName !== '' && !valid ? text.packageInvalid : undefined
              }
              onChange={(event) => setPack(event.target.value.trim())}
            />
            <SelectField
              id="android-min"
              label={text.minimum}
              hint={`${text.minimumHint} ${text.minimumNow(androidName(minSdk))}`}
              value={minSdk}
              disabled={building}
              onChange={(event) => setLevel(Number(event.target.value))}
            >
              {ANDROID_LEVELS.map((item) => (
                <option key={item.api} value={item.api}>
                  {item.name} (API {item.api})
                </option>
              ))}
            </SelectField>
          </div>
        )}
        {canRun && (
          <fieldset className="flex flex-col gap-2" disabled={building}>
            <legend className="text-sm font-semibold">{text.abis}</legend>
            <p className="text-xs text-muted">{text.abisHint}</p>
            {ANDROID_ABIS.map((abi) => (
              <label key={abi} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={abis.includes(abi)}
                  disabled={abis.length === 1 && abis.includes(abi)}
                  onChange={() => setChosen(toggleAbi(abis, abi))}
                />
                <code>{abi}</code>
                <span className="text-muted">{text.abiNames[abi]}</span>
              </label>
            ))}
          </fieldset>
        )}
        <div className="flex flex-wrap gap-2">
          {canRun &&
            (building ? (
              <Button
                variant="danger"
                disabled={action.pending}
                onClick={cancel}
              >
                {text.cancel}
              </Button>
            ) : (
              <>
                <Button
                  variant="primary"
                  disabled={action.pending || !data.available || !valid}
                  onClick={build}
                >
                  {data.size === null ? text.build : text.buildAgain}
                </Button>
                <Button
                  disabled={action.pending || !changed || !valid}
                  onClick={save}
                >
                  {text.save}
                </Button>
              </>
            ))}
          {data.size !== null && (
            <Button disabled={action.pending} onClick={download}>
              {text.download}
            </Button>
          )}
        </div>
        {data.log && (
          <div>
            <p className="mb-1 text-xs font-semibold text-muted">{text.log}</p>
            <pre
              ref={logEnd}
              className="max-h-64 overflow-auto rounded-md border border-line bg-inset p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap"
            >
              {data.log}
            </pre>
          </div>
        )}
      </div>
    </Card>
  );
}

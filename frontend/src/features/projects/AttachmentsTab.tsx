import { useCallback, useRef } from 'react';
import { attachmentsApi } from '../../api';
import { useAction } from '../../api/useAction';
import { useRequest } from '../../api/useRequest';
import { Alert } from '../../components/Alert';
import { Button } from '../../components/Button';
import { Card, ListRow } from '../../components/Card';
import { ErrorAlert } from '../../components/ErrorAlert';
import { Loading } from '../../components/Loading';
import { pt } from '../../i18n/pt';
import { formatSize } from '../../lib/files';
import { useProject } from './ProjectLayout';

export function AttachmentsTab() {
  const { project } = useProject();
  const text = pt.attachments;
  const load = useCallback(() => attachmentsApi.list(project.id), [project.id]);
  const { data, error, reload } = useRequest(load);
  const action = useAction();
  const input = useRef<HTMLInputElement>(null);

  if (error) return <ErrorAlert error={error} />;
  if (!data) return <Loading />;

  const upload = async (selected: FileList | null) => {
    const chosen = Array.from(selected ?? []);
    if (input.current) input.current.value = '';
    for (const file of chosen) {
      const result = await action.run(() =>
        attachmentsApi.upload(project.id, file),
      );
      if (!result) break;
    }
    reload();
  };

  const remove = async (name: string) => {
    await action.run(() => attachmentsApi.remove(project.id, name));
    reload();
  };

  const total = data.reduce((sum, item) => sum + item.size, 0);

  return (
    <Card
      title={text.title}
      action={
        <>
          <input
            ref={input}
            type="file"
            multiple
            hidden
            accept=".png,.jpg,.jpeg,.webp,.gif,.pdf,.md,.txt,.json,.csv"
            onChange={(event) => void upload(event.target.files)}
          />
          <Button
            small
            variant="primary"
            disabled={action.pending}
            onClick={() => input.current?.click()}
          >
            {action.pending ? text.uploading : text.add}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4 p-4">
        <Alert tone="info">{text.hint}</Alert>
        <ErrorAlert error={action.error} />
        {data.length === 0 ? (
          <p className="text-sm text-muted">{text.empty}</p>
        ) : (
          <>
            <p className="text-xs text-muted">
              {text.summary(data.length, formatSize(total))}
            </p>
            <ul className="rounded-md border border-line">
              {data.map((item) => (
                <ListRow key={item.name}>
                  <div className="flex min-w-0 flex-col">
                    <code className="truncate text-sm">{item.name}</code>
                    <span className="text-xs text-muted">
                      {formatSize(item.size)} ·{' '}
                      {new Date(item.modified).toLocaleString('pt-BR')}
                    </span>
                  </div>
                  <Button
                    small
                    variant="danger"
                    disabled={action.pending}
                    onClick={() => void remove(item.name)}
                  >
                    {text.delete}
                  </Button>
                </ListRow>
              ))}
            </ul>
          </>
        )}
      </div>
    </Card>
  );
}

import { useCallback, useState } from 'react';
import { documentsApi } from '../../api';
import { useAction } from '../../api/useAction';
import { useRequest } from '../../api/useRequest';
import { Alert } from '../../components/Alert';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { ErrorAlert } from '../../components/ErrorAlert';
import { Loading } from '../../components/Loading';
import { Markdown } from '../../components/Markdown';
import { MarkdownEditor } from '../../components/MarkdownEditor';
import { ConfirmDialog } from '../../components/Modal';
import { pt } from '../../i18n/pt';

const MAX_CONTENT = 500000;
const BODY_HEIGHT = 'h-[max(20rem,calc(100dvh-23rem))]';

type View = 'edit' | 'split' | 'preview';

const VIEWS: View[] = ['edit', 'split', 'preview'];

interface DocumentEditorProps {
  projectId: number;
  path: string;
  exists: boolean;
  onSaved: () => void;
  onDeleted: () => void;
}

export function DocumentEditor({
  projectId,
  path,
  exists,
  onSaved,
  onDeleted,
}: DocumentEditorProps) {
  const text = pt.docs.files;
  const starter = text.starters[path] ?? '';
  const load = useCallback(
    () =>
      exists
        ? documentsApi.get(projectId, path)
        : Promise.resolve({ path, content: starter }),
    [projectId, path, exists, starter],
  );
  const { data, error } = useRequest(load);
  const action = useAction();
  const [content, setContent] = useState<string | null>(
    exists ? null : starter,
  );
  const [view, setView] = useState<View>('edit');
  const [saved, setSaved] = useState(false);
  const [confirming, setConfirming] = useState(false);

  if (error) return <ErrorAlert error={error} />;
  if (!data) return <Loading />;

  const value = content ?? data.content;

  const save = async () => {
    setSaved(false);
    const result = await action.run(() =>
      documentsApi.save(projectId, path, value),
    );
    if (!result) return;
    setSaved(true);
    onSaved();
  };

  const remove = async () => {
    const result = await action.run(() => documentsApi.remove(projectId, path));
    setConfirming(false);
    if (result) onDeleted();
  };

  const actions = (
    <div className="flex flex-wrap items-center gap-2">
      <div
        role="group"
        aria-label={text.view}
        className="flex gap-1 rounded-md border border-line p-0.5"
      >
        {VIEWS.map((item) => (
          <Button
            key={item}
            small
            variant={view === item ? 'default' : 'invisible'}
            aria-pressed={view === item}
            onClick={() => setView(item)}
          >
            {text.views[item]}
          </Button>
        ))}
      </div>
      <Button
        small
        variant="primary"
        disabled={action.pending || content === null}
        onClick={save}
      >
        {text.save}
      </Button>
      {exists && (
        <Button
          small
          variant="danger"
          disabled={action.pending}
          onClick={() => setConfirming(true)}
        >
          {text.delete}
        </Button>
      )}
    </div>
  );

  return (
    <Card title={text.editorTitle} action={actions}>
      <div className="flex flex-col gap-3 p-4">
        <code className="text-sm">{path}</code>
        <ErrorAlert error={action.error} />
        {saved && <Alert tone="success">{text.saved}</Alert>}
        <div
          className={`grid gap-4 ${view === 'split' ? 'xl:grid-cols-2' : 'grid-cols-1'}`}
        >
          <div className={view === 'preview' ? 'hidden' : ''}>
            <MarkdownEditor
              value={data.content}
              maxLength={MAX_CONTENT}
              label={path}
              heightClass={BODY_HEIGHT}
              onChange={(next) => {
                setSaved(false);
                setContent(next);
              }}
              onSave={save}
            />
          </div>
          {view !== 'edit' && (
            <div
              className={`${BODY_HEIGHT} overflow-auto rounded-md border border-line bg-canvas p-4`}
            >
              <Markdown source={value} />
            </div>
          )}
        </div>
      </div>
      <ConfirmDialog
        open={confirming}
        title={text.deleteTitle}
        text={text.deleteText}
        confirmLabel={text.delete}
        busy={action.pending}
        onConfirm={remove}
        onClose={() => setConfirming(false)}
      />
    </Card>
  );
}

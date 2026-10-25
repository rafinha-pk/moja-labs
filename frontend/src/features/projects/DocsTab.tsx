import { useCallback, useMemo, useState, type FormEvent } from 'react';
import { documentsApi, setupApi } from '../../api';
import type { DocumentEntry } from '../../api/types';
import { useRequest } from '../../api/useRequest';
import { Alert } from '../../components/Alert';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { ErrorAlert } from '../../components/ErrorAlert';
import { TextField } from '../../components/Field';
import { Loading } from '../../components/Loading';
import { pt } from '../../i18n/pt';
import { buildTree, documentPath } from '../../lib/documents';
import { AgentPanel } from '../docs/AgentPanel';
import { ChangesPanel } from '../docs/ChangesPanel';
import { DocTree } from '../docs/DocTree';
import { DocumentEditor } from '../docs/DocumentEditor';
import { useProject } from './ProjectLayout';

export function DocsTab() {
  const { project } = useProject();
  const text = pt.docs;
  const canCommit = project.role === 'owner' || project.role === 'dev';
  const loadDocs = useCallback(
    () => documentsApi.list(project.id),
    [project.id],
  );
  const loadEnvironment = useCallback(
    () => setupApi.environment(project.id),
    [project.id],
  );
  const docs = useRequest(loadDocs);
  const environment = useRequest(loadEnvironment);
  const [selected, setSelected] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const [changesKey, setChangesKey] = useState(0);
  const [name, setName] = useState('');

  const entries = docs.data;
  const current = entries?.find((entry) => entry.path === selected);
  const draft = selected !== null && current === undefined ? selected : null;
  const tree = useMemo(() => {
    if (!entries) return [];
    const draftEntry: DocumentEntry[] = draft
      ? [
          {
            path: draft,
            size: 0,
            modified: null,
            exists: false,
            required: false,
          },
        ]
      : [];
    return buildTree([...entries, ...draftEntry]);
  }, [entries, draft]);

  if (docs.error) return <ErrorAlert error={docs.error} />;
  if (!entries) return <Loading />;

  const changed = () => {
    docs.reload();
    setChangesKey((value) => value + 1);
  };

  const finished = () => {
    setVersion((value) => value + 1);
    changed();
  };

  const deleted = () => {
    setSelected(null);
    changed();
  };

  const create = (event: FormEvent) => {
    event.preventDefault();
    const path = documentPath(name);
    if (!path) return;
    setSelected(path);
    setName('');
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-6 lg:grid-cols-[18rem_1fr]">
        <Card title={text.files.title} className="self-start">
          <DocTree
            nodes={tree}
            selected={selected}
            unsaved={draft}
            onSelect={setSelected}
          />
          <form
            onSubmit={create}
            className="flex items-end gap-2 border-t border-line p-3"
          >
            <div className="flex-1">
              <TextField
                id="new-document"
                label={text.files.newName}
                hint={text.files.newHint}
                maxLength={80}
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </div>
            <Button type="submit" disabled={documentPath(name) === ''}>
              {text.files.create}
            </Button>
          </form>
        </Card>
        <div className="min-w-0">
          {selected ? (
            <DocumentEditor
              key={`${selected}:${version}`}
              projectId={project.id}
              path={selected}
              exists={current?.exists ?? false}
              onSaved={changed}
              onDeleted={deleted}
            />
          ) : (
            <p className="text-sm text-muted">{text.files.choose}</p>
          )}
        </div>
      </div>
      <ChangesPanel
        projectId={project.id}
        canCommit={canCommit}
        refreshKey={changesKey}
      />
      {environment.data && !environment.data.claude_available && (
        <Alert tone="info">{text.agent.noClaude}</Alert>
      )}
      <AgentPanel projectId={project.id} onFinished={finished} />
    </div>
  );
}

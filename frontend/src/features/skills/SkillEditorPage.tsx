import {
  useCallback,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { skillsApi } from '../../api';
import type { SkillDetail } from '../../api/types';
import { useAction } from '../../api/useAction';
import { useRequest } from '../../api/useRequest';
import { Alert } from '../../components/Alert';
import { Button } from '../../components/Button';
import { ErrorAlert, fieldError } from '../../components/ErrorAlert';
import { TextField } from '../../components/Field';
import { Loading } from '../../components/Loading';
import { Markdown } from '../../components/Markdown';
import { MarkdownEditor } from '../../components/MarkdownEditor';
import { pt } from '../../i18n/pt';

const MAX_CONTENT = 20000;

type View = 'edit' | 'split' | 'preview';

const VIEWS: View[] = ['edit', 'split', 'preview'];

function Editor({ skill }: { skill: SkillDetail | null }) {
  const navigate = useNavigate();
  const form = useRef<HTMLFormElement>(null);
  const { run, pending, error } = useAction();
  const [name, setName] = useState(skill?.name ?? '');
  const [description, setDescription] = useState(skill?.description ?? '');
  const [content, setContent] = useState(skill?.content ?? '');
  const [view, setView] = useState<View>('edit');
  const [saved, setSaved] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaved(false);
    const data = { name, description, content };
    const result = await run(() =>
      skill ? skillsApi.update(skill.id, data) : skillsApi.create(data),
    );
    if (!result) return;
    if (skill) setSaved(true);
    else navigate(`/skills/${result.value.id}`, { replace: true });
  };

  const saveShortcut = (event: KeyboardEvent) => {
    if (
      !event.defaultPrevented &&
      (event.ctrlKey || event.metaKey) &&
      event.key.toLowerCase() === 's'
    ) {
      event.preventDefault();
      form.current?.requestSubmit();
    }
  };

  const showEditor = view !== 'preview';
  const showPreview = view !== 'edit';

  return (
    <form
      ref={form}
      onSubmit={submit}
      onKeyDown={saveShortcut}
      className="flex flex-col gap-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link to="/skills" className="text-sm">
            ← {pt.skills.back}
          </Link>
          <h1 className="text-xl font-semibold">
            {skill ? pt.skills.editTitle : pt.skills.createTitle}
          </h1>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => navigate('/skills')}>
            {pt.common.cancel}
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={pending || !content.trim()}
          >
            {pt.common.save}
          </Button>
        </div>
      </div>

      <ErrorAlert error={error} />
      {saved && <Alert tone="success">{pt.common.saved}</Alert>}

      <div className="grid gap-4 md:grid-cols-2">
        <TextField
          id="skill-name"
          label={pt.skills.name}
          required
          maxLength={100}
          value={name}
          onChange={(event) => setName(event.target.value)}
          error={fieldError(error, 'name')}
        />
        <TextField
          id="skill-description"
          label={`${pt.skills.description} ${pt.common.optional}`}
          maxLength={300}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          error={fieldError(error, 'description')}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">{pt.skills.content}</h2>
          <p className="text-xs text-muted">{pt.skills.contentHint}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted">
            {content.length}/{MAX_CONTENT}
          </span>
          <div
            role="group"
            aria-label={pt.skills.view}
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
                {pt.skills.views[item]}
              </Button>
            ))}
          </div>
        </div>
      </div>

      <div
        className={`grid gap-4 ${view === 'split' ? 'lg:grid-cols-2' : 'grid-cols-1'}`}
      >
        <div className={showEditor ? '' : 'hidden'}>
          <MarkdownEditor
            value={content}
            maxLength={MAX_CONTENT}
            label={pt.skills.content}
            onChange={setContent}
            onSave={() => form.current?.requestSubmit()}
          />
        </div>
        {showPreview && (
          <div
            aria-label={pt.skills.preview}
            className="h-[65vh] overflow-auto rounded-md border border-line bg-canvas p-4"
          >
            {content.trim() ? (
              <Markdown source={content} />
            ) : (
              <p className="text-sm text-muted">{pt.skills.previewEmpty}</p>
            )}
          </div>
        )}
      </div>
      {fieldError(error, 'content') && (
        <p role="alert" className="text-xs text-danger">
          {fieldError(error, 'content')}
        </p>
      )}
    </form>
  );
}

export function SkillEditorPage() {
  const { skillId } = useParams();
  const id = skillId === undefined ? null : Number(skillId);
  const load = useCallback(
    () => (id === null ? Promise.resolve(null) : skillsApi.get(id)),
    [id],
  );
  const { data, error, loading } = useRequest(load);

  if (error) return <ErrorAlert error={error} />;
  if (loading) return <Loading />;
  return <Editor key={id ?? 'new'} skill={data} />;
}

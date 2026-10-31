import { useRef, useState } from 'react';
import { attachmentsApi } from '../api';
import { useAction } from '../api/useAction';
import { pt } from '../i18n/pt';
import {
  MAX_ATTACHMENT_BYTES,
  MAX_ATTACHMENTS_PER_MESSAGE,
} from '../lib/files';
import { Button } from './Button';
import { ErrorAlert } from './ErrorAlert';

export function AttachmentPicker({
  projectId,
  files,
  disabled,
  onChange,
}: {
  projectId: number;
  files: string[];
  disabled: boolean;
  onChange: (files: string[]) => void;
}) {
  const text = pt.attachments;
  const input = useRef<HTMLInputElement>(null);
  const action = useAction();
  const [tooBig, setTooBig] = useState(false);
  const full = files.length >= MAX_ATTACHMENTS_PER_MESSAGE;

  const pick = async (selected: FileList | null) => {
    setTooBig(false);
    const chosen = Array.from(selected ?? []);
    if (input.current) input.current.value = '';
    const room = MAX_ATTACHMENTS_PER_MESSAGE - files.length;
    let next = files;
    for (const file of chosen.slice(0, room)) {
      if (file.size > MAX_ATTACHMENT_BYTES) {
        setTooBig(true);
        continue;
      }
      const result = await action.run(() =>
        attachmentsApi.upload(projectId, file),
      );
      if (!result) break;
      next = [...next, result.value.name];
      onChange(next);
    }
  };

  return (
    <div className="flex flex-col gap-1">
      <ErrorAlert error={action.error} />
      {tooBig && <p className="text-xs text-danger">{text.tooBig}</p>}
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={input}
          type="file"
          multiple
          hidden
          accept=".png,.jpg,.jpeg,.webp,.gif,.pdf,.md,.txt,.json,.csv"
          onChange={(event) => void pick(event.target.files)}
        />
        <Button
          small
          disabled={disabled || action.pending || full}
          onClick={() => input.current?.click()}
        >
          {action.pending ? text.uploading : text.attach}
        </Button>
        {files.map((name) => (
          <span
            key={name}
            className="inline-flex items-center gap-1 rounded-full border border-line px-2 py-px text-xs"
          >
            {name}
            <button
              type="button"
              aria-label={`${text.remove} ${name}`}
              disabled={disabled}
              className="text-muted hover:text-fg"
              onClick={() => onChange(files.filter((item) => item !== name))}
            >
              ×
            </button>
          </span>
        ))}
      </div>
    </div>
  );
}

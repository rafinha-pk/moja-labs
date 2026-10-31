import { splitAttachments } from '../lib/files';

export function UserMessage({ text }: { text: string }) {
  const { text: message, files } = splitAttachments(text);
  return (
    <>
      <p className="whitespace-pre-wrap">{message}</p>
      {files.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {files.map((name) => (
            <span
              key={name}
              className="rounded-full border border-line px-2 py-px text-xs text-muted"
            >
              {name}
            </span>
          ))}
        </div>
      )}
    </>
  );
}

import {
  useState,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { pt } from '../i18n/pt';

const CONTROL =
  'w-full rounded-md border bg-inset px-3 py-1.5 text-sm text-fg placeholder:text-muted focus:border-accent-emphasis disabled:opacity-60';

interface Shared {
  id: string;
  label: string;
  error?: string;
  hint?: string;
}

interface FrameProps extends Shared {
  children: (className: string) => ReactNode;
}

function FieldFrame({ id, label, error, hint, children }: FrameProps) {
  const border = error ? 'border-danger' : 'border-line';
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-semibold">
        {label}
      </label>
      {children(`${CONTROL} ${border}`)}
      {hint && !error && <p className="text-xs text-muted">{hint}</p>}
      {error && (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

function EyeIcon({ crossed }: { crossed: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
      {crossed && <path d="M4 4l16 16" />}
    </svg>
  );
}

export function TextField({
  label,
  error,
  hint,
  ...props
}: Shared & InputHTMLAttributes<HTMLInputElement>) {
  const [revealed, setRevealed] = useState(false);
  const secret = props.type === 'password';
  return (
    <FieldFrame label={label} error={error} hint={hint} id={props.id}>
      {(className) => (
        <div className="relative">
          <input
            className={secret ? `${className} pr-10` : className}
            aria-invalid={Boolean(error)}
            {...props}
            type={secret && revealed ? 'text' : props.type}
          />
          {secret && (
            <button
              type="button"
              aria-label={revealed ? pt.common.hide : pt.common.show}
              aria-pressed={revealed}
              onClick={() => setRevealed((value) => !value)}
              className="absolute inset-y-0 right-0 flex w-9 items-center justify-center rounded-r-md text-muted hover:text-fg"
            >
              <EyeIcon crossed={revealed} />
            </button>
          )}
        </div>
      )}
    </FieldFrame>
  );
}

export function TextArea({
  label,
  error,
  hint,
  ...props
}: Shared & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <FieldFrame label={label} error={error} hint={hint} id={props.id}>
      {(className) => (
        <textarea
          rows={4}
          className={className}
          aria-invalid={Boolean(error)}
          {...props}
        />
      )}
    </FieldFrame>
  );
}

export function SelectField({
  label,
  error,
  hint,
  children,
  ...props
}: Shared & SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <FieldFrame label={label} error={error} hint={hint} id={props.id}>
      {(className) => (
        <select className={className} aria-invalid={Boolean(error)} {...props}>
          {children}
        </select>
      )}
    </FieldFrame>
  );
}

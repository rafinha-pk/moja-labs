import type { ReactNode } from 'react';

type Tone = 'error' | 'success' | 'info';

const TONES: Record<Tone, string> = {
  error: 'border-danger text-danger',
  success: 'border-success text-success',
  info: 'border-accent text-accent',
};

export function Alert({
  tone = 'info',
  children,
}: {
  tone?: Tone;
  children: ReactNode;
}) {
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={`rounded-md border bg-subtle px-4 py-3 text-sm ${TONES[tone]}`}
    >
      {children}
    </div>
  );
}

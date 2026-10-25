import type { ReactNode } from 'react';

export function Bubble({
  mine,
  children,
}: {
  mine: boolean;
  children: ReactNode;
}) {
  return (
    <div className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[92%] rounded-md border px-3 py-2 text-sm ${
          mine ? 'border-accent-emphasis bg-subtle' : 'border-line bg-canvas'
        }`}
      >
        {children}
      </div>
    </div>
  );
}

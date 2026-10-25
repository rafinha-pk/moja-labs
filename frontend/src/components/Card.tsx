import type { ReactNode } from 'react';

interface CardProps {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function Card({ title, action, children, className = '' }: CardProps) {
  return (
    <section className={`rounded-md border border-line bg-canvas ${className}`}>
      {title && (
        <header className="flex items-center justify-between gap-3 rounded-t-md border-b border-line bg-subtle px-4 py-3">
          <h2 className="text-sm font-semibold">{title}</h2>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

export function ListRow({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <li
      className={`flex flex-wrap items-center justify-between gap-3 border-b border-line-muted px-4 py-3 last:border-b-0 ${className}`}
    >
      {children}
    </li>
  );
}

import type { Role } from '../api/types';
import { pt } from '../i18n/pt';

export function Badge({ children }: { children: string }) {
  return (
    <span className="inline-flex items-center rounded-full border border-line px-2 py-px text-xs font-medium text-muted">
      {children}
    </span>
  );
}

export function RoleBadge({ role }: { role: Role }) {
  return <Badge>{pt.roles[role]}</Badge>;
}

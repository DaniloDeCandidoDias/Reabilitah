import type { LucideIcon } from 'lucide-react';

export function EmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
}) {
  return (
    <div className="empty">
      <span className="empty-icon">
        <Icon size={28} aria-hidden="true" />
      </span>
      <h2>{title}</h2>
      {description && <p>{description}</p>}
    </div>
  );
}

export function Avatar({ name }: { name: string }) {
  const parts = name.trim().split(/\s+/);
  const initials = parts.length > 1 ? parts[0][0] + parts.at(-1)![0] : name.slice(0, 2);
  return (
    <span className="avatar" aria-hidden="true">
      {initials.toLocaleUpperCase('pt-BR')}
    </span>
  );
}

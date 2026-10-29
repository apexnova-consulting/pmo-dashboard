import type { TeamMember } from '@/data/schema';

export function OwnerAvatar({
  member,
  name,
  color,
  size = 'md',
}: {
  member?: TeamMember | null;
  name?: string;
  color?: string;
  size?: 'sm' | 'md';
}) {
  const label = member?.displayName ?? name ?? 'Unassigned';
  const background = member?.avatarColor ?? color ?? 'var(--series-neutral)';
  const initial = label.slice(0, 1).toUpperCase();
  const dimension = size === 'sm' ? 'h-7 w-7 text-xs' : 'h-10 w-10 text-sm';
  return (
    <span className="inline-flex items-center gap-2">
      <span
        aria-hidden="true"
        className={`inline-flex items-center justify-center rounded-full font-bold text-white ${dimension}`}
        style={{ background }}
      >
        {initial}
      </span>
      <span>{label}</span>
    </span>
  );
}

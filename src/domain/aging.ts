import type { Ticket } from '@/data/schema';

export const AGING_BUCKETS = [
  { id: '0-7', label: '0–7 days', min: 0, max: 7 },
  { id: '8-14', label: '8–14 days', min: 8, max: 14 },
  { id: '15-30', label: '15–30 days', min: 15, max: 30 },
  { id: '31-59', label: '31–59 days', min: 31, max: 59 },
  { id: '60+', label: '60+ days', min: 60, max: Number.POSITIVE_INFINITY },
] as const;

export function agingBucket(ageDays: number): (typeof AGING_BUCKETS)[number]['id'] {
  const match = AGING_BUCKETS.find((bucket) => ageDays >= bucket.min && ageDays <= bucket.max);
  return match?.id ?? '60+';
}

export function countAging(tickets: { ageDays: number; open: boolean }[]) {
  const counts = new Map<string, number>(AGING_BUCKETS.map((bucket) => [bucket.id, 0]));
  for (const ticket of tickets) {
    if (!ticket.open) continue;
    const id = agingBucket(ticket.ageDays);
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return AGING_BUCKETS.map((bucket) => ({
    id: bucket.id,
    label: bucket.label,
    count: counts.get(bucket.id) ?? 0,
  }));
}

export function wasOpenOn(
  ticket: Ticket,
  day: string,
  timeZone: string,
  calendarDate: (iso: string, tz: string) => string,
) {
  const created = calendarDate(ticket.created, timeZone);
  if (created > day) return false;
  if (ticket.statusCategory === 'done') {
    if (!ticket.resolvedAt) return false;
    return calendarDate(ticket.resolvedAt, timeZone) > day;
  }
  if (ticket.resolvedAt && calendarDate(ticket.resolvedAt, timeZone) <= day) return false;
  return true;
}

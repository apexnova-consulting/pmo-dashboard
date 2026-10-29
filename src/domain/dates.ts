import { formatInTimeZone } from 'date-fns-tz';
import { parseISO } from 'date-fns';

const DAY_MS = 86_400_000;

export function addDaysYmd(ymd: string, days: number): string {
  const [year, month, day] = ymd.split('-').map(Number);
  if (year == null || month == null || day == null) return ymd;
  const utc = new Date(Date.UTC(year, month - 1, day));
  utc.setUTCDate(utc.getUTCDate() + days);
  return utc.toISOString().slice(0, 10);
}

export function calendarDaysBetween(laterYmd: string, earlierYmd: string): number {
  const later = Date.parse(`${laterYmd}T00:00:00Z`);
  const earlier = Date.parse(`${earlierYmd}T00:00:00Z`);
  return Math.round((later - earlier) / DAY_MS);
}

function formatParts(ms: number, timeZone: string) {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const map: Record<string, string> = {};
  for (const part of dtf.formatToParts(new Date(ms))) {
    if (part.type !== 'literal') map[part.type] = part.value;
  }
  if (map.hour === '24') map.hour = '00';
  return map;
}

/** Wall-clock time in a zone, as an ISO string with a numeric offset. Independent of the host timezone. */
export function zonedWallTimeToIso(ymd: string, hms: string, timeZone: string): string {
  const [year, month, day] = ymd.split('-').map(Number);
  const [hour, minute, second] = hms.split(':').map(Number);
  if (
    year == null ||
    month == null ||
    day == null ||
    hour == null ||
    minute == null ||
    second == null
  ) {
    throw new Error(`Invalid wall time ${ymd} ${hms}`);
  }
  const desired = Date.UTC(year, month - 1, day, hour, minute, second);
  let utc = desired;
  for (let pass = 0; pass < 3; pass += 1) {
    const parts = formatParts(utc, timeZone);
    const asUtc = Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      Number(parts.hour),
      Number(parts.minute),
      Number(parts.second),
    );
    utc = desired - (asUtc - utc);
  }
  const parts = formatParts(utc, timeZone);
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  const offsetMin = Math.round((asUtc - utc) / 60_000);
  const sign = offsetMin >= 0 ? '+' : '-';
  const abs = Math.abs(offsetMin);
  const oh = String(Math.floor(abs / 60)).padStart(2, '0');
  const om = String(abs % 60).padStart(2, '0');
  const hh = String(hour).padStart(2, '0');
  const mm = String(minute).padStart(2, '0');
  const ss = String(second).padStart(2, '0');
  return `${ymd}T${hh}:${mm}:${ss}${sign}${oh}:${om}`;
}

export function calendarDate(iso: string, timeZone: string): string {
  return formatInTimeZone(parseISO(iso), timeZone, 'yyyy-MM-dd');
}

export function formatWhen(iso: string, timeZone: string, pattern: string): string {
  return formatInTimeZone(parseISO(iso), timeZone, pattern);
}

export function formatDataAsOf(iso: string, timeZone: string): string {
  return formatWhen(iso, timeZone, 'MMM d, h:mm a');
}

export function formatDay(isoOrYmd: string, timeZone: string): string {
  const iso = isoOrYmd.length === 10 ? `${isoOrYmd}T12:00:00Z` : isoOrYmd;
  return formatInTimeZone(parseISO(iso), isoOrYmd.length === 10 ? 'UTC' : timeZone, 'EEE, MMM d');
}

export function hoursSince(iso: string, now: Date): number {
  return (now.getTime() - parseISO(iso).getTime()) / 3_600_000;
}

export function shiftIsoDays(iso: string, days: number, timeZone: string): string {
  const ymd = addDaysYmd(calendarDate(iso, timeZone), days);
  const time = formatInTimeZone(parseISO(iso), timeZone, 'HH:mm:ss');
  return zonedWallTimeToIso(ymd, time, timeZone);
}

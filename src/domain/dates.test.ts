import { describe, expect, it } from 'vitest';
import { addDaysYmd, calendarDate, calendarDaysBetween, zonedWallTimeToIso } from '@/domain/dates';
import { formatInTimeZone } from 'date-fns-tz';
import { parseISO } from 'date-fns';

describe('dates', () => {
  it('adds calendar days without depending on the host zone', () => {
    expect(addDaysYmd('2026-10-28', -7)).toBe('2026-10-21');
    expect(addDaysYmd('2026-03-01', -1)).toBe('2026-02-28');
    expect(calendarDaysBetween('2026-10-28', '2026-10-21')).toBe(7);
  });

  it('builds an offset timestamp for New York wall time', () => {
    const summer = zonedWallTimeToIso('2026-10-28', '06:00:00', 'America/New_York');
    const winter = zonedWallTimeToIso('2026-01-15', '06:00:00', 'America/New_York');
    expect(summer).toBe('2026-10-28T06:00:00-04:00');
    expect(winter).toBe('2026-01-15T06:00:00-05:00');
    expect(formatInTimeZone(parseISO(summer), 'America/New_York', 'yyyy-MM-dd HH:mm')).toBe(
      '2026-10-28 06:00',
    );
    expect(calendarDate(summer, 'America/New_York')).toBe('2026-10-28');
    expect(calendarDate('2026-10-28T03:30:00Z', 'America/New_York')).toBe('2026-10-27');
  });
});

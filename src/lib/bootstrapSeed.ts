import { normalizeCalendarPayload, splitCalendarByMonth } from './parsers/calendarParser';
import { parseEml } from './parsers/emailParser';
import { countCalendarMonths, putCalendarMonth } from './repositories/calendarRepo';
import { countEmails, putEmails } from './repositories/emailRepo';

import type { CalendarMonth } from '../types/content';

const calendarModules = import.meta.glob('../../data/calendar/**/*.json', {
  eager: true,
  import: 'default',
}) as Record<string, unknown>;

const emlModules = import.meta.glob('../../data/emails/**/*.eml', {
  eager: true,
  import: 'default',
  query: '?raw',
}) as Record<string, string>;

export async function seedDatabaseIfNeeded() {
  const [emailCount, calendarCount] = await Promise.all([countEmails(), countCalendarMonths()]);

  if (emailCount > 0 && calendarCount > 0) {
    return {
      seeded: false,
      emailCount,
      calendarCount,
    };
  }

  if (calendarCount === 0) {
    const grouped: Record<string, CalendarMonth> = {};

    for (const rawCalendarData of Object.values(calendarModules)) {
      const normalized = normalizeCalendarPayload(rawCalendarData);
      const byMonth = splitCalendarByMonth(normalized);

      for (const [monthKey, monthData] of Object.entries(byMonth)) {
        if (!grouped[monthKey]) {
          grouped[monthKey] = {};
        }

        grouped[monthKey] = {
          ...grouped[monthKey],
          ...monthData,
        };
      }
    }

    await Promise.all(Object.entries(grouped).map(([monthKey, data]) => putCalendarMonth(monthKey, data)));
  }

  if (emailCount === 0) {
    const parsedEmails = Object.entries(emlModules)
      .map(([path, raw]) => parseEml(raw, path))
      .sort((a, b) => Date.parse(a.unlockAtUtc) - Date.parse(b.unlockAtUtc));

    if (parsedEmails.length > 0) {
      await putEmails(parsedEmails);
    }
  }

  const [nextEmailCount, nextCalendarCount] = await Promise.all([countEmails(), countCalendarMonths()]);

  return {
    seeded: true,
    emailCount: nextEmailCount,
    calendarCount: nextCalendarCount,
  };
}

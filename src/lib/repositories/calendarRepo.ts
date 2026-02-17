import { getDb } from '../db';

import type { CalendarMonth } from '../../types/content';

export async function putCalendarMonth(monthKey: string, data: CalendarMonth) {
  const db = await getDb();
  await db.put('calendars', { monthKey, data });
}

export async function getCalendarMonth(monthKey: string) {
  const db = await getDb();
  const row = await db.get('calendars', monthKey);

  return row?.data ?? null;
}

export async function listCalendarMonths() {
  const db = await getDb();
  const all = await db.getAll('calendars');

  return all.sort((a, b) => a.monthKey.localeCompare(b.monthKey));
}

export async function countCalendarMonths() {
  const db = await getDb();
  return db.count('calendars');
}

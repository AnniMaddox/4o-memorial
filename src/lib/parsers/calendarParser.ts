import type { CalendarMonth } from '../../types/content';

export function toMonthKeyFromDateKey(dateKey: string) {
  const parsed = new Date(`${dateKey}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}`;
}

function isDateKey(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function normalizeCalendarPayload(payload: unknown): CalendarMonth {
  if (!payload || typeof payload !== 'object') {
    return {};
  }

  const result: CalendarMonth = {};

  for (const [key, rawValue] of Object.entries(payload as Record<string, unknown>)) {
    if (!isDateKey(key)) {
      continue;
    }

    if (typeof rawValue === 'string') {
      result[key] = rawValue;
      continue;
    }

    if (
      rawValue &&
      typeof rawValue === 'object' &&
      typeof (rawValue as { text?: unknown }).text === 'string'
    ) {
      result[key] = (rawValue as { text: string }).text;
    }
  }

  return result;
}

export function extractMonthKeyFromFileName(fileName: string) {
  const match = fileName.match(/(\d{4})[-_](\d{2})/);
  if (!match) {
    return null;
  }

  return `${match[1]}-${match[2]}`;
}

export function splitCalendarByMonth(data: CalendarMonth) {
  const grouped: Record<string, CalendarMonth> = {};

  for (const [dateKey, message] of Object.entries(data)) {
    const monthKey = toMonthKeyFromDateKey(dateKey);
    if (!monthKey) {
      continue;
    }

    if (!grouped[monthKey]) {
      grouped[monthKey] = {};
    }

    grouped[monthKey][dateKey] = message;
  }

  return grouped;
}

export function inferMonthKeyFromCalendar(data: CalendarMonth, fileName: string) {
  const fromName = extractMonthKeyFromFileName(fileName);
  if (fromName) {
    return fromName;
  }

  const firstKey = Object.keys(data).sort((a, b) => a.localeCompare(b))[0];
  return firstKey ? toMonthKeyFromDateKey(firstKey) : null;
}

import { getDb } from '../db';

import type { AppSettings } from '../../types/settings';
import { DEFAULT_SETTINGS } from '../../types/settings';

function clampNumber(value: unknown, min: number, max: number, fallback: number) {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, value));
}

function normalizeString(value: unknown, fallback = '') {
  return typeof value === 'string' ? value : fallback;
}

export async function getSettings() {
  const db = await getDb();
  const row = await db.get('settings', 'app');

  const persisted = (row?.value ?? {}) as Partial<AppSettings>;

  return {
    ...DEFAULT_SETTINGS,
    ...persisted,
    hoverToneWeights: {
      ...DEFAULT_SETTINGS.hoverToneWeights,
      ...(persisted.hoverToneWeights ?? {}),
    },
    calendarCellRadius: clampNumber(
      persisted.calendarCellRadius,
      8,
      28,
      DEFAULT_SETTINGS.calendarCellRadius,
    ),
    calendarCellShadow: clampNumber(
      persisted.calendarCellShadow,
      0,
      100,
      DEFAULT_SETTINGS.calendarCellShadow,
    ),
    calendarCellDepth: clampNumber(
      persisted.calendarCellDepth,
      0,
      100,
      DEFAULT_SETTINGS.calendarCellDepth,
    ),
    customFontCssUrl: normalizeString(persisted.customFontCssUrl, DEFAULT_SETTINGS.customFontCssUrl),
    customFontFamily: normalizeString(persisted.customFontFamily, DEFAULT_SETTINGS.customFontFamily),
  };
}

export async function saveSettings(partial: Partial<AppSettings>) {
  const db = await getDb();
  const current = await getSettings();
  const next = {
    ...current,
    ...partial,
  } satisfies AppSettings;

  await db.put('settings', {
    key: 'app',
    value: next,
  });

  return next;
}

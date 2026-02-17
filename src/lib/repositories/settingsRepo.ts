import { getDb } from '../db';

import type { AppSettings } from '../../types/settings';
import { DEFAULT_SETTINGS } from '../../types/settings';

export async function getSettings() {
  const db = await getDb();
  const row = await db.get('settings', 'app');

  return row?.value ?? DEFAULT_SETTINGS;
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

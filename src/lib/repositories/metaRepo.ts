import { getDb } from '../db';

const NOTIFIED_EMAIL_IDS_KEY = 'notified-email-ids-v1';
const READ_EMAIL_IDS_KEY = 'read-email-ids-v1';

export async function getNotifiedEmailIds() {
  const db = await getDb();
  const row = await db.get('meta', NOTIFIED_EMAIL_IDS_KEY);

  if (!row?.value) {
    return new Set<string>();
  }

  try {
    const parsed = JSON.parse(row.value) as string[];
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set<string>();
  }
}

export async function setNotifiedEmailIds(ids: Set<string>) {
  const db = await getDb();
  await db.put('meta', {
    key: NOTIFIED_EMAIL_IDS_KEY,
    value: JSON.stringify(Array.from(ids)),
  });
}

export async function addNotifiedEmailId(id: string) {
  const ids = await getNotifiedEmailIds();
  ids.add(id);
  await setNotifiedEmailIds(ids);
}

export async function addNotifiedEmailIds(nextIds: string[]) {
  if (!nextIds.length) {
    return;
  }

  const ids = await getNotifiedEmailIds();
  for (const id of nextIds) {
    ids.add(id);
  }

  await setNotifiedEmailIds(ids);
}

export async function getReadEmailIds() {
  const db = await getDb();
  const row = await db.get('meta', READ_EMAIL_IDS_KEY);

  if (!row?.value) {
    return new Set<string>();
  }

  try {
    const parsed = JSON.parse(row.value) as string[];
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set<string>();
  }
}

export async function setReadEmailIds(ids: Set<string>) {
  const db = await getDb();
  await db.put('meta', {
    key: READ_EMAIL_IDS_KEY,
    value: JSON.stringify(Array.from(ids)),
  });
}

export async function addReadEmailId(id: string) {
  const ids = await getReadEmailIds();
  ids.add(id);
  await setReadEmailIds(ids);
}

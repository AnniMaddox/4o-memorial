import { openDB } from 'idb';

const DB_NAME = 'wishlist-db';
const DB_VERSION = 1;
const WISH_STORE = 'wishes';
const BIRTHDAY_STORE = 'birthdayTasks';
const PREFS_STORE = 'prefs';
const PREFS_KEY = 'wishlist-prefs';

const COMPLETE_EXPORT_KIND = 'memorial-wishlist-complete-export';

export type WishlistWish = {
  id: string;
  text: string;
  order: number;
  createdAt: number;
  updatedAt: number;
  doneAt: number | null;
};

export type BirthdayTask = {
  id: string;
  year: string;
  text: string;
  order: number;
  createdAt: number;
  updatedAt: number;
  doneAt: number | null;
};

export type WishlistPrefs = {
  showChibi: boolean;
  chibiWidth: number;
};

export type WishlistSnapshot = {
  wishes: WishlistWish[];
  birthdayTasks: BirthdayTask[];
  prefs: WishlistPrefs;
};

export type BirthdaySeedItem = {
  year: string;
  text: string;
};

export type WishlistCompleteExport = {
  kind: typeof COMPLETE_EXPORT_KIND;
  version: 1;
  exportedAt: string;
  completedWishes: Array<{
    text: string;
    doneAt: string;
  }>;
  completedBirthdayTasks: Array<{
    year: string;
    text: string;
    doneAt: string;
  }>;
};

function uniqueId(prefix: string) {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function normalizeText(input: string) {
  return input.trim().replace(/\s+/g, ' ');
}

function normalizeWishKey(text: string) {
  return normalizeText(text).toLocaleLowerCase('zh-TW');
}

function normalizeBirthdayKey(item: BirthdaySeedItem | BirthdayTask) {
  const year = String(item.year).trim();
  const text = normalizeText(item.text).toLocaleLowerCase('zh-TW');
  return `${year}|${text}`;
}

function clampChibiWidth(value: number | undefined, fallback = 144) {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(104, Math.min(196, Math.round(value ?? fallback)));
}

function normalizeWish(item: WishlistWish, fallbackOrder: number): WishlistWish | null {
  const text = normalizeText(item.text);
  if (!text) return null;
  const createdAt = Number.isFinite(item.createdAt) && item.createdAt > 0 ? item.createdAt : Date.now();
  const updatedAt = Number.isFinite(item.updatedAt) && item.updatedAt > 0 ? item.updatedAt : createdAt;
  return {
    id: item.id?.trim() || uniqueId('wish'),
    text,
    order: Number.isFinite(item.order) ? item.order : fallbackOrder,
    createdAt,
    updatedAt,
    doneAt: Number.isFinite(item.doneAt) && (item.doneAt ?? 0) > 0 ? Number(item.doneAt) : null,
  };
}

function normalizeBirthdayTask(item: BirthdayTask, fallbackOrder: number): BirthdayTask | null {
  const year = String(item.year ?? '').trim();
  const text = normalizeText(item.text ?? '');
  if (!year || !text) return null;
  const createdAt = Number.isFinite(item.createdAt) && item.createdAt > 0 ? item.createdAt : Date.now();
  const updatedAt = Number.isFinite(item.updatedAt) && item.updatedAt > 0 ? item.updatedAt : createdAt;
  return {
    id: item.id?.trim() || uniqueId('birthday'),
    year,
    text,
    order: Number.isFinite(item.order) ? item.order : fallbackOrder,
    createdAt,
    updatedAt,
    doneAt: Number.isFinite(item.doneAt) && (item.doneAt ?? 0) > 0 ? Number(item.doneAt) : null,
  };
}

function normalizePrefs(input: Partial<WishlistPrefs> | null | undefined): WishlistPrefs {
  return {
    showChibi: input?.showChibi !== false,
    chibiWidth: clampChibiWidth(input?.chibiWidth, 144),
  };
}

function sortByOrder<T extends { order: number; createdAt: number }>(items: T[]) {
  return [...items].sort((a, b) => {
    if (a.order !== b.order) return a.order - b.order;
    return a.createdAt - b.createdAt;
  });
}

function normalizeSnapshot(snapshot: WishlistSnapshot): WishlistSnapshot {
  const wishMap = new Map<string, WishlistWish>();
  for (const [index, item] of snapshot.wishes.entries()) {
    const normalized = normalizeWish(item, index);
    if (!normalized) continue;
    wishMap.set(normalized.id, normalized);
  }

  const birthdayMap = new Map<string, BirthdayTask>();
  for (const [index, item] of snapshot.birthdayTasks.entries()) {
    const normalized = normalizeBirthdayTask(item, index);
    if (!normalized) continue;
    birthdayMap.set(normalized.id, normalized);
  }

  const wishes = sortByOrder(Array.from(wishMap.values())).map((item, index) => ({ ...item, order: index }));
  const birthdayTasks = sortByOrder(Array.from(birthdayMap.values())).map((item, index) => ({ ...item, order: index }));

  return {
    wishes,
    birthdayTasks,
    prefs: normalizePrefs(snapshot.prefs),
  };
}

async function getDB() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(WISH_STORE)) {
        db.createObjectStore(WISH_STORE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(BIRTHDAY_STORE)) {
        db.createObjectStore(BIRTHDAY_STORE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(PREFS_STORE)) {
        db.createObjectStore(PREFS_STORE, { keyPath: 'key' });
      }
    },
  });
}

export async function loadWishlistSnapshot(): Promise<WishlistSnapshot> {
  const db = await getDB();
  const [rawWishes, rawBirthdayTasks, rawPrefs] = await Promise.all([
    db.getAll(WISH_STORE),
    db.getAll(BIRTHDAY_STORE),
    db.get(PREFS_STORE, PREFS_KEY),
  ]);

  return normalizeSnapshot({
    wishes: rawWishes as WishlistWish[],
    birthdayTasks: rawBirthdayTasks as BirthdayTask[],
    prefs: normalizePrefs((rawPrefs as { value?: WishlistPrefs } | undefined)?.value),
  });
}

export async function saveWishlistSnapshot(snapshot: WishlistSnapshot): Promise<void> {
  const normalized = normalizeSnapshot(snapshot);
  const db = await getDB();
  const tx = db.transaction([WISH_STORE, BIRTHDAY_STORE, PREFS_STORE], 'readwrite');

  await tx.objectStore(WISH_STORE).clear();
  for (const wish of normalized.wishes) {
    await tx.objectStore(WISH_STORE).put(wish);
  }

  await tx.objectStore(BIRTHDAY_STORE).clear();
  for (const task of normalized.birthdayTasks) {
    await tx.objectStore(BIRTHDAY_STORE).put(task);
  }

  await tx.objectStore(PREFS_STORE).put({ key: PREFS_KEY, value: normalized.prefs });
  await tx.done;
}

export function mergeWishlistSeed(
  snapshot: WishlistSnapshot,
  wishTexts: string[],
  birthdayItems: BirthdaySeedItem[],
): WishlistSnapshot {
  const now = Date.now();
  const base = normalizeSnapshot(snapshot);

  const existingWishByKey = new Map(base.wishes.map((item) => [normalizeWishKey(item.text), item]));
  const incomingWishKeys = new Set<string>();
  const mergedWishes: WishlistWish[] = [];

  for (const raw of wishTexts) {
    const text = normalizeText(raw);
    if (!text) continue;
    const key = normalizeWishKey(text);
    if (incomingWishKeys.has(key)) continue;
    incomingWishKeys.add(key);
    const existing = existingWishByKey.get(key);
    if (existing) {
      mergedWishes.push({
        ...existing,
        text,
        order: mergedWishes.length,
      });
    } else {
      mergedWishes.push({
        id: uniqueId('wish'),
        text,
        order: mergedWishes.length,
        createdAt: now,
        updatedAt: now,
        doneAt: null,
      });
    }
  }

  // Keep local-only extras so user edits are not lost when JSON updates.
  for (const existing of base.wishes) {
    const key = normalizeWishKey(existing.text);
    if (incomingWishKeys.has(key)) continue;
    mergedWishes.push({
      ...existing,
      order: mergedWishes.length,
    });
  }

  const existingBirthdayByKey = new Map(base.birthdayTasks.map((item) => [normalizeBirthdayKey(item), item]));
  const incomingBirthdayKeys = new Set<string>();
  const mergedBirthday: BirthdayTask[] = [];

  for (const raw of birthdayItems) {
    const year = String(raw.year).trim();
    const text = normalizeText(raw.text);
    if (!year || !text) continue;
    const key = normalizeBirthdayKey({ year, text });
    if (incomingBirthdayKeys.has(key)) continue;
    incomingBirthdayKeys.add(key);
    const existing = existingBirthdayByKey.get(key);
    if (existing) {
      mergedBirthday.push({
        ...existing,
        year,
        text,
        order: mergedBirthday.length,
      });
    } else {
      mergedBirthday.push({
        id: uniqueId('birthday'),
        year,
        text,
        order: mergedBirthday.length,
        createdAt: now,
        updatedAt: now,
        doneAt: null,
      });
    }
  }

  for (const existing of base.birthdayTasks) {
    const key = normalizeBirthdayKey(existing);
    if (incomingBirthdayKeys.has(key)) continue;
    mergedBirthday.push({
      ...existing,
      order: mergedBirthday.length,
    });
  }

  return normalizeSnapshot({
    wishes: mergedWishes,
    birthdayTasks: mergedBirthday,
    prefs: base.prefs,
  });
}

export function toggleWishDone(snapshot: WishlistSnapshot, wishId: string): WishlistSnapshot {
  const now = Date.now();
  return normalizeSnapshot({
    ...snapshot,
    wishes: snapshot.wishes.map((item) =>
      item.id === wishId
        ? {
            ...item,
            doneAt: item.doneAt ? null : now,
            updatedAt: now,
          }
        : item,
    ),
  });
}

export function toggleBirthdayTaskDone(snapshot: WishlistSnapshot, taskId: string): WishlistSnapshot {
  const now = Date.now();
  return normalizeSnapshot({
    ...snapshot,
    birthdayTasks: snapshot.birthdayTasks.map((item) =>
      item.id === taskId
        ? {
            ...item,
            doneAt: item.doneAt ? null : now,
            updatedAt: now,
          }
        : item,
    ),
  });
}

export function updateWishlistPrefs(snapshot: WishlistSnapshot, patch: Partial<WishlistPrefs>): WishlistSnapshot {
  return normalizeSnapshot({
    ...snapshot,
    prefs: normalizePrefs({
      ...snapshot.prefs,
      ...patch,
    }),
  });
}

export function buildWishlistCompleteExport(snapshot: WishlistSnapshot): WishlistCompleteExport {
  const completedWishes = snapshot.wishes
    .filter((item) => Boolean(item.doneAt))
    .map((item) => ({
      text: item.text,
      doneAt: new Date(item.doneAt!).toISOString(),
    }));

  const completedBirthdayTasks = snapshot.birthdayTasks
    .filter((item) => Boolean(item.doneAt))
    .map((item) => ({
      year: item.year,
      text: item.text,
      doneAt: new Date(item.doneAt!).toISOString(),
    }));

  return {
    kind: COMPLETE_EXPORT_KIND,
    version: 1,
    exportedAt: new Date().toISOString(),
    completedWishes,
    completedBirthdayTasks,
  };
}

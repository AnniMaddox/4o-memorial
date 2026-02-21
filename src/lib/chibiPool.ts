const LEGACY_ACTIVE_BASE_CHIBI_POOL_STORAGE_KEY = 'memorial-active-base-chibi-pool-v1';
const ACTIVE_BASE_CHIBI_POOL_A_STORAGE_KEY = 'memorial-active-base-chibi-pool-a-v1';
const ACTIVE_BASE_CHIBI_POOL_B_STORAGE_KEY = 'memorial-active-base-chibi-pool-b-v1';
const ACTIVE_BASE_CHIBI_MODE_STORAGE_KEY = 'memorial-active-base-chibi-mode-v1';
const ACTIVE_BASE_CHIBI_SIZE_STORAGE_KEY = 'memorial-active-base-chibi-size-v1';
const DEFAULT_POOL_SIZE = 60;
const MIN_POOL_SIZE = 20;

export const CHIBI_POOL_UPDATED_EVENT = 'memorial:chibi-pool-updated';

export type BaseChibiPoolMode = 'a' | 'b' | 'all';

function toSortedSources(modules: Record<string, string>) {
  return Object.entries(modules)
    .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
    .map(([, src]) => src);
}

const BASE_CHIBI_MODULES = import.meta.glob('../../public/chibi/*.{png,jpg,jpeg,webp,gif,avif}', {
  eager: true,
  import: 'default',
}) as Record<string, string>;

const BASE_CHIBI_SOURCES = toSortedSources(BASE_CHIBI_MODULES);

const MDIARY_CHIBI_MODULES = import.meta.glob('../../public/mdiary-chibi/*.{png,jpg,jpeg,webp,gif,avif}', {
  eager: true,
  import: 'default',
}) as Record<string, string>;
const FITNESS_CHIBI_MODULES = import.meta.glob('../../public/fitness-chibi/*.{png,jpg,jpeg,webp,gif,avif}', {
  eager: true,
  import: 'default',
}) as Record<string, string>;
const POMODORO_CHIBI_MODULES = import.meta.glob('../../public/pomodoro-chibi/*.{png,jpg,jpeg,webp,gif,avif}', {
  eager: true,
  import: 'default',
}) as Record<string, string>;
const NOTES_CHIBI_MODULES = import.meta.glob('../../public/notes-chibi/*.{png,jpg,jpeg,webp,gif,avif}', {
  eager: true,
  import: 'default',
}) as Record<string, string>;
const CALENDAR_CHIBI_MODULES = import.meta.glob('../../public/calendar-chibi/*.{png,jpg,jpeg,webp,gif,avif}', {
  eager: true,
  import: 'default',
}) as Record<string, string>;
const LETTERS_AB_CHIBI_MODULES = import.meta.glob('../../public/letters-ab-chibi/*.{png,jpg,jpeg,webp,gif,avif}', {
  eager: true,
  import: 'default',
}) as Record<string, string>;

export type ScopedChibiPoolKey = 'mdiary' | 'fitness' | 'pomodoro' | 'notes' | 'calendar' | 'lettersAB';

const SCOPED_CHIBI_SOURCES: Record<ScopedChibiPoolKey, string[]> = {
  mdiary: toSortedSources(MDIARY_CHIBI_MODULES),
  fitness: toSortedSources(FITNESS_CHIBI_MODULES),
  pomodoro: toSortedSources(POMODORO_CHIBI_MODULES),
  notes: toSortedSources(NOTES_CHIBI_MODULES),
  calendar: toSortedSources(CALENDAR_CHIBI_MODULES),
  lettersAB: toSortedSources(LETTERS_AB_CHIBI_MODULES),
};

type ChibiPoolInfo = {
  allCount: number;
  activeCount: number;
  targetCount: number;
};

function clampPoolSize(size: number) {
  if (!BASE_CHIBI_SOURCES.length) {
    return 0;
  }
  if (!Number.isFinite(size)) {
    return Math.min(DEFAULT_POOL_SIZE, BASE_CHIBI_SOURCES.length);
  }
  return Math.max(MIN_POOL_SIZE, Math.min(Math.floor(size), BASE_CHIBI_SOURCES.length));
}

function uniqueStrings(values: string[]) {
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const value of values) {
    if (seen.has(value)) {
      continue;
    }
    seen.add(value);
    unique.push(value);
  }
  return unique;
}

function shuffleCopy<T>(items: T[]) {
  const next = [...items];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    const current = next[index]!;
    next[index] = next[randomIndex]!;
    next[randomIndex] = current;
  }
  return next;
}

function getPoolStorageKey(mode: 'a' | 'b') {
  return mode === 'a' ? ACTIVE_BASE_CHIBI_POOL_A_STORAGE_KEY : ACTIVE_BASE_CHIBI_POOL_B_STORAGE_KEY;
}

function readStoredMode(): BaseChibiPoolMode {
  if (typeof window === 'undefined') return 'a';
  try {
    const raw = window.localStorage.getItem(ACTIVE_BASE_CHIBI_MODE_STORAGE_KEY);
    return raw === 'a' || raw === 'b' || raw === 'all' ? raw : 'a';
  } catch {
    return 'a';
  }
}

function writeStoredMode(mode: BaseChibiPoolMode) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(ACTIVE_BASE_CHIBI_MODE_STORAGE_KEY, mode);
  } catch {
    // ignore
  }
}

function readStoredPoolSize() {
  if (typeof window === 'undefined') return DEFAULT_POOL_SIZE;
  try {
    const raw = Number(window.localStorage.getItem(ACTIVE_BASE_CHIBI_SIZE_STORAGE_KEY) ?? DEFAULT_POOL_SIZE);
    return Number.isFinite(raw) ? raw : DEFAULT_POOL_SIZE;
  } catch {
    return DEFAULT_POOL_SIZE;
  }
}

function writeStoredPoolSize(size: number) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(ACTIVE_BASE_CHIBI_SIZE_STORAGE_KEY, String(size));
  } catch {
    // ignore
  }
}

function resolvePoolMode(mode?: BaseChibiPoolMode) {
  if (mode === 'a' || mode === 'b' || mode === 'all') return mode;
  return readStoredMode();
}

function resolvePoolSize(size?: number) {
  if (typeof size === 'number' && Number.isFinite(size)) return clampPoolSize(size);
  return clampPoolSize(readStoredPoolSize());
}

function readStoredPool(mode: 'a' | 'b') {
  if (typeof window === 'undefined') {
    return [] as string[];
  }

  const key = getPoolStorageKey(mode);
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw && mode === 'a') {
      // Keep old users' active pool as the initial A pool.
      const legacyRaw = window.localStorage.getItem(LEGACY_ACTIVE_BASE_CHIBI_POOL_STORAGE_KEY);
      if (legacyRaw) {
        const legacyParsed = JSON.parse(legacyRaw) as unknown;
        if (Array.isArray(legacyParsed)) {
          return legacyParsed.filter((value): value is string => typeof value === 'string');
        }
      }
      return [];
    }
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter((value): value is string => typeof value === 'string');
  } catch {
    return [];
  }
}

function writeStoredPool(mode: 'a' | 'b', pool: string[]) {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    const key = getPoolStorageKey(mode);
    window.localStorage.setItem(key, JSON.stringify(pool));
    if (mode === 'a') {
      // Maintain backward compatibility with previous single-pool key.
      window.localStorage.setItem(LEGACY_ACTIVE_BASE_CHIBI_POOL_STORAGE_KEY, JSON.stringify(pool));
    }
  } catch {
    // Ignore storage write failures to avoid crashing app render paths.
  }
}

function dispatchPoolUpdated(info: ChibiPoolInfo, mode: BaseChibiPoolMode) {
  if (typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(
    new CustomEvent(CHIBI_POOL_UPDATED_EVENT, {
      detail: {
        ...info,
        mode,
      },
    }),
  );
}

function normalizeStoredPool(mode: 'a' | 'b') {
  if (!BASE_CHIBI_SOURCES.length) {
    return [];
  }

  const allowed = new Set(BASE_CHIBI_SOURCES);
  return uniqueStrings(readStoredPool(mode).filter((item) => allowed.has(item)));
}

function samplePool(targetCount: number) {
  if (!BASE_CHIBI_SOURCES.length || targetCount <= 0) {
    return [];
  }

  if (BASE_CHIBI_SOURCES.length <= targetCount) {
    return [...BASE_CHIBI_SOURCES];
  }

  return shuffleCopy(BASE_CHIBI_SOURCES).slice(0, targetCount);
}

function syncPoolLength(pool: string[], targetCount: number) {
  if (targetCount <= 0) {
    return [];
  }

  if (pool.length === targetCount) {
    return pool;
  }

  if (pool.length > targetCount) {
    return pool.slice(0, targetCount);
  }

  const poolSet = new Set(pool);
  const remaining = BASE_CHIBI_SOURCES.filter((item) => !poolSet.has(item));
  return [...pool, ...shuffleCopy(remaining).slice(0, targetCount - pool.length)];
}

export function getAllBaseChibiSources() {
  return [...BASE_CHIBI_SOURCES];
}

export function getScopedChibiSources(scope: ScopedChibiPoolKey) {
  return [...(SCOPED_CHIBI_SOURCES[scope] ?? [])];
}

export function getScopedMixedChibiSources(
  scope: ScopedChibiPoolKey,
  poolSize?: number,
  mode?: BaseChibiPoolMode,
) {
  const scoped = getScopedChibiSources(scope);
  const activeBase = getActiveBaseChibiSources(poolSize, mode);

  if (!scoped.length) {
    return activeBase;
  }

  if (!activeBase.length) {
    return scoped;
  }

  const baseMixTarget = Math.max(4, Math.min(48, Math.round(Math.max(activeBase.length, 20) * 0.2)));
  const mixedBase = activeBase.slice(0, Math.min(baseMixTarget, activeBase.length));
  return uniqueStrings([...scoped, ...mixedBase]);
}

export function getActiveBaseChibiSources(poolSize?: number, mode?: BaseChibiPoolMode) {
  const resolvedMode = resolvePoolMode(mode);
  writeStoredMode(resolvedMode);
  const resolvedSize = resolvePoolSize(poolSize);
  writeStoredPoolSize(resolvedSize);

  if (resolvedMode === 'all') {
    return [...BASE_CHIBI_SOURCES];
  }

  const targetCount = clampPoolSize(resolvedSize);
  if (targetCount <= 0) {
    return [];
  }

  const normalized = syncPoolLength(normalizeStoredPool(resolvedMode), targetCount);
  if (normalized.length) {
    const rawLength = readStoredPool(resolvedMode).length;
    if (normalized.length !== rawLength) {
      writeStoredPool(resolvedMode, normalized);
    }
    return normalized;
  }

  const next = samplePool(targetCount);
  writeStoredPool(resolvedMode, next);
  return next;
}

export function refreshActiveBaseChibiPool(poolSize?: number, mode?: BaseChibiPoolMode) {
  const resolvedMode = resolvePoolMode(mode);
  writeStoredMode(resolvedMode);
  const resolvedSize = resolvePoolSize(poolSize);
  writeStoredPoolSize(resolvedSize);

  let next: string[];
  let targetCount: number;
  if (resolvedMode === 'all') {
    next = [...BASE_CHIBI_SOURCES];
    targetCount = BASE_CHIBI_SOURCES.length;
  } else {
    targetCount = clampPoolSize(resolvedSize);
    next = samplePool(targetCount);
    writeStoredPool(resolvedMode, next);
  }

  const info = {
    allCount: BASE_CHIBI_SOURCES.length,
    activeCount: next.length,
    targetCount,
  };
  dispatchPoolUpdated(info, resolvedMode);
  return next;
}

export function syncActiveBaseChibiPool(poolSize?: number, mode?: BaseChibiPoolMode) {
  const resolvedMode = resolvePoolMode(mode);
  writeStoredMode(resolvedMode);
  const resolvedSize = resolvePoolSize(poolSize);
  writeStoredPoolSize(resolvedSize);

  let next: string[];
  let targetCount: number;
  if (resolvedMode === 'all') {
    next = [...BASE_CHIBI_SOURCES];
    targetCount = BASE_CHIBI_SOURCES.length;
  } else {
    targetCount = clampPoolSize(resolvedSize);
    next = syncPoolLength(normalizeStoredPool(resolvedMode), targetCount);
    writeStoredPool(resolvedMode, next);
  }

  const info = {
    allCount: BASE_CHIBI_SOURCES.length,
    activeCount: next.length,
    targetCount,
  };
  dispatchPoolUpdated(info, resolvedMode);
  return next;
}

export function getBaseChibiPoolInfo(poolSize?: number, mode?: BaseChibiPoolMode): ChibiPoolInfo {
  const resolvedMode = resolvePoolMode(mode);
  const active = getActiveBaseChibiSources(poolSize, resolvedMode);
  return {
    allCount: BASE_CHIBI_SOURCES.length,
    activeCount: active.length,
    targetCount: resolvedMode === 'all' ? BASE_CHIBI_SOURCES.length : clampPoolSize(resolvePoolSize(poolSize)),
  };
}

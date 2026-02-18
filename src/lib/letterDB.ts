import { openDB } from 'idb';

const DB_NAME = 'letter-db';
const STORE = 'handles';
const FOLDER_KEY = 'folder';

async function getDB() {
  return openDB(DB_NAME, 1, {
    upgrade(database) {
      database.createObjectStore(STORE);
    },
  });
}

export async function saveFolderHandle(handle: FileSystemDirectoryHandle): Promise<void> {
  const d = await getDB();
  await d.put(STORE, handle, FOLDER_KEY);
}

export async function loadFolderHandle(): Promise<FileSystemDirectoryHandle | null> {
  try {
    const d = await getDB();
    const result = await d.get(STORE, FOLDER_KEY);
    return (result as FileSystemDirectoryHandle | undefined) ?? null;
  } catch {
    return null;
  }
}

export async function clearFolderHandle(): Promise<void> {
  const d = await getDB();
  await d.delete(STORE, FOLDER_KEY);
}

/** Re-verify read permission for a persisted handle (required after page reload). */
export async function verifyFolderPermission(
  handle: FileSystemDirectoryHandle,
): Promise<boolean> {
  const permissionHandle = handle as FileSystemDirectoryHandle & {
    queryPermission?: (descriptor: { mode: 'read' | 'readwrite' }) => Promise<PermissionState>;
    requestPermission?: (descriptor: { mode: 'read' | 'readwrite' }) => Promise<PermissionState>;
  };

  if (!permissionHandle.queryPermission || !permissionHandle.requestPermission) {
    return false;
  }

  try {
    const perm = await permissionHandle.queryPermission({ mode: 'read' });
    if (perm === 'granted') return true;
    const req = await permissionHandle.requestPermission({ mode: 'read' });
    return req === 'granted';
  } catch {
    return false;
  }
}

/** Load and verify the persisted folder handle. Returns null if missing or permission denied. */
export async function initLetterFolder(): Promise<FileSystemDirectoryHandle | null> {
  const handle = await loadFolderHandle();
  if (!handle) return null;
  const ok = await verifyFolderPermission(handle);
  return ok ? handle : null;
}

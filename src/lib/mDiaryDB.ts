import { openDB } from 'idb';

const DB_NAME = 'm-diary-db';
const STORE = 'entries';

export type StoredMDiary = {
  name: string;
  title: string;
  content: string;
  htmlContent: string;
  importedAt: number;
};

async function getDB() {
  return openDB(DB_NAME, 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'name' });
      }
    },
  });
}

export async function saveMDiaries(entries: StoredMDiary[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(STORE, 'readwrite');
  for (const entry of entries) {
    await tx.store.put(entry);
  }
  await tx.done;
}

export async function loadMDiaries(): Promise<StoredMDiary[]> {
  const db = await getDB();
  const all = await db.getAll(STORE);
  return all.sort((a, b) => a.name.localeCompare(b.name, 'zh-TW'));
}

export async function clearAllMDiaries(): Promise<void> {
  const db = await getDB();
  await db.clear(STORE);
}

/** Parse a File into a StoredMDiary. Supports .txt and .docx */
export async function parseMDiaryFile(file: File): Promise<StoredMDiary> {
  const name = file.name;
  const title = name.replace(/\.(txt|docx?)$/i, '');
  const importedAt = Date.now();

  if (/\.docx?$/i.test(name)) {
    const mammoth = await import('mammoth');
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.convertToHtml({ arrayBuffer });
    return { name, title, content: '', htmlContent: result.value, importedAt };
  }

  const content = await file.text();
  return { name, title, content, htmlContent: '', importedAt };
}

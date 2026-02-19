import { openDB } from 'idb';

const DB_NAME = 'diary-db';
const STORE = 'entries';

export type StoredDiary = {
  name: string;        // filename (key)
  title: string;       // display title (filename without extension)
  content: string;     // plain text (TXT files)
  htmlContent: string; // converted HTML (DOCX via mammoth), empty for TXT
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

export async function saveDiaries(entries: StoredDiary[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(STORE, 'readwrite');
  for (const entry of entries) {
    await tx.store.put(entry);
  }
  await tx.done;
}

export async function loadDiaries(): Promise<StoredDiary[]> {
  const db = await getDB();
  const all = await db.getAll(STORE);
  return all.sort((a, b) => a.name.localeCompare(b.name, 'zh-TW'));
}

export async function deleteDiary(name: string): Promise<void> {
  const db = await getDB();
  await db.delete(STORE, name);
}

export async function clearAllDiaries(): Promise<void> {
  const db = await getDB();
  await db.clear(STORE);
}

/** Parse a File into a StoredDiary. Supports .txt and .docx */
export async function parseDiaryFile(file: File): Promise<StoredDiary> {
  const name = file.name;
  const title = name.replace(/\.(txt|docx?)$/i, '');
  const importedAt = Date.now();

  if (/\.docx?$/i.test(name)) {
    const mammoth = await import('mammoth');
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.convertToHtml({ arrayBuffer });
    return { name, title, content: '', htmlContent: result.value, importedAt };
  }

  // TXT (and any other text format)
  const content = await file.text();
  return { name, title, content, htmlContent: '', importedAt };
}

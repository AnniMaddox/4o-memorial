import { useEffect, useMemo, useState } from 'react';

import {
  MANAGE_BOX_ID,
  MAX_SOULMATE_BOXES,
  UNCATEGORIZED_BOX_ID,
  buildSoulmateBoxBackupPayload,
  buildSoulmatePageBackupPayload,
  createSoulmateEntriesFromFiles,
  importSoulmateBackupFiles,
  loadSoulmateSnapshot,
  saveSoulmateSnapshot,
  type SoulmateBox,
  type SoulmateEntry,
  type SoulmateSnapshot,
} from '../lib/soulmateDB';

type ViewMode = 'shelf' | 'box' | 'entry' | 'manage';
type ManagePanelKey = 'boxes' | 'directImport' | 'batchImport' | 'backup';

type BatchImportDraft = {
  id: string;
  file: File;
  targetBoxId: string;
};

type ManageSectionProps = {
  title: string;
  description: string;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
};

interface Props {
  onExit: () => void;
}

function makeTempId(prefix = 'soulmate') {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function isFixedBox(boxId: string) {
  return boxId === UNCATEGORIZED_BOX_ID || boxId === MANAGE_BOX_ID;
}

function hexWithAlpha(hex: string, alpha: number): string {
  const safeHex = /^#[0-9a-fA-F]{6}$/.test(hex) ? hex : '#d6d3d1';
  const r = parseInt(safeHex.slice(1, 3), 16);
  const g = parseInt(safeHex.slice(3, 5), 16);
  const b = parseInt(safeHex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function toPlainText(html: string) {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildPreview(entry: SoulmateEntry) {
  const source = entry.content.trim() || toPlainText(entry.htmlContent);
  if (!source) return '（沒有內容）';
  return source.length > 56 ? `${source.slice(0, 56)}...` : source;
}

function formatImportedAt(value: number) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '未知時間';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}/${month}/${day}`;
}

function normalizeBoxOrder(boxes: SoulmateBox[]) {
  return boxes
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((box, index) => ({ ...box, order: index }));
}

function downloadJson(filename: string, payload: unknown) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = href;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(href);
}

function ManageSection({ title, description, isOpen, onToggle, children }: ManageSectionProps) {
  return (
    <section className="rounded-2xl border border-stone-200/80 bg-white/78 p-3.5 shadow-sm">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-2 text-left"
      >
        <div className="min-w-0">
          <p className="text-sm text-stone-800">{title}</p>
          <p className="mt-0.5 text-xs text-stone-500">{description}</p>
        </div>
        <span className={`text-lg text-stone-500 transition-transform ${isOpen ? 'rotate-180' : ''}`}>⌄</span>
      </button>
      {isOpen ? <div className="mt-3">{children}</div> : null}
    </section>
  );
}

export default function SoulmateHousePage({ onExit }: Props) {
  const [mode, setMode] = useState<ViewMode>('shelf');
  const [snapshot, setSnapshot] = useState<SoulmateSnapshot>({ boxes: [], entries: [] });
  const [draftBoxes, setDraftBoxes] = useState<SoulmateBox[]>([]);
  const [selectedBoxId, setSelectedBoxId] = useState<string>(UNCATEGORIZED_BOX_ID);
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [importTargetBoxId, setImportTargetBoxId] = useState<string>(UNCATEGORIZED_BOX_ID);
  const [backupBoxId, setBackupBoxId] = useState<string>(UNCATEGORIZED_BOX_ID);
  const [batchDrafts, setBatchDrafts] = useState<BatchImportDraft[]>([]);
  const [openPanels, setOpenPanels] = useState<Record<ManagePanelKey, boolean>>({
    boxes: true,
    directImport: true,
    batchImport: false,
    backup: false,
  });
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [status, setStatus] = useState('');

  const boxes = snapshot.boxes;
  const entries = snapshot.entries;

  const importableBoxes = useMemo(() => boxes.filter((box) => box.id !== MANAGE_BOX_ID), [boxes]);

  const entryCountMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const entry of entries) {
      map.set(entry.boxId, (map.get(entry.boxId) ?? 0) + 1);
    }
    return map;
  }, [entries]);

  const selectedBox = useMemo(
    () => importableBoxes.find((box) => box.id === selectedBoxId) ?? importableBoxes[0] ?? null,
    [importableBoxes, selectedBoxId],
  );

  const selectedBoxEntries = useMemo(() => {
    if (!selectedBox) return [] as SoulmateEntry[];
    return entries.filter((entry) => entry.boxId === selectedBox.id);
  }, [entries, selectedBox]);

  const selectedEntry = useMemo(
    () => entries.find((entry) => entry.id === selectedEntryId) ?? null,
    [entries, selectedEntryId],
  );

  const getImportFallbackId = (targetBoxes: SoulmateBox[]) => targetBoxes.find((box) => box.id !== MANAGE_BOX_ID)?.id ?? UNCATEGORIZED_BOX_ID;

  const refreshSnapshot = async () => {
    const next = await loadSoulmateSnapshot();
    setSnapshot(next);
    setDraftBoxes(next.boxes);
    return next;
  };

  const persistSnapshot = async (next: SoulmateSnapshot, successMessage: string) => {
    setWorking(true);
    try {
      await saveSoulmateSnapshot(next);
      const reloaded = await refreshSnapshot();
      const fallbackId = getImportFallbackId(reloaded.boxes);
      setImportTargetBoxId((current) =>
        reloaded.boxes.some((box) => box.id === current && box.id !== MANAGE_BOX_ID) ? current : fallbackId,
      );
      setBackupBoxId((current) =>
        reloaded.boxes.some((box) => box.id === current && box.id !== MANAGE_BOX_ID) ? current : fallbackId,
      );
      setStatus(successMessage);
    } catch (error) {
      setStatus(`儲存失敗：${error instanceof Error ? error.message : '未知錯誤'}`);
    } finally {
      setWorking(false);
    }
  };

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const data = await loadSoulmateSnapshot();
        if (!active) return;
        const fallbackId = getImportFallbackId(data.boxes);
        setSnapshot(data);
        setDraftBoxes(data.boxes);
        setSelectedBoxId(fallbackId);
        setImportTargetBoxId(fallbackId);
        setBackupBoxId(fallbackId);
      } catch (error) {
        if (!active) return;
        setStatus(`讀取失敗：${error instanceof Error ? error.message : '未知錯誤'}`);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!importableBoxes.length) return;
    const fallbackId = importableBoxes[0].id;
    if (!importableBoxes.some((box) => box.id === selectedBoxId)) {
      setSelectedBoxId(fallbackId);
    }
    if (!importableBoxes.some((box) => box.id === importTargetBoxId)) {
      setImportTargetBoxId(fallbackId);
    }
    if (!importableBoxes.some((box) => box.id === backupBoxId)) {
      setBackupBoxId(fallbackId);
    }
  }, [importableBoxes, selectedBoxId, importTargetBoxId, backupBoxId]);

  useEffect(() => {
    if (mode === 'manage') {
      setDraftBoxes(snapshot.boxes);
    }
  }, [mode, snapshot.boxes]);

  useEffect(() => {
    if (mode === 'box' && !selectedBox) {
      setMode('shelf');
    }
  }, [mode, selectedBox]);

  const toggleManagePanel = (key: ManagePanelKey) => {
    setOpenPanels((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const addBox = () => {
    if (draftBoxes.length >= MAX_SOULMATE_BOXES) {
      setStatus(`最多 ${MAX_SOULMATE_BOXES} 格，已達上限。`);
      return;
    }
    const now = Date.now();
    const insertIndex = draftBoxes.findIndex((box) => isFixedBox(box.id));
    const targetIndex = insertIndex >= 0 ? insertIndex : draftBoxes.length;
    const next = [...draftBoxes];
    next.splice(targetIndex, 0, {
      id: makeTempId('box'),
      title: `新主題 ${Math.max(1, draftBoxes.length - 1)}`,
      subtitle: '未設定副標',
      emoji: '📦',
      accentHex: '#f3e8d5',
      order: targetIndex,
      createdAt: now,
      updatedAt: now,
    });
    setDraftBoxes(normalizeBoxOrder(next));
  };

  const updateDraftBox = (boxId: string, patch: Partial<SoulmateBox>) => {
    setDraftBoxes((prev) =>
      prev.map((box) =>
        box.id === boxId
          ? {
              ...box,
              ...patch,
              title: (patch.title ?? box.title).trimStart(),
              subtitle: (patch.subtitle ?? box.subtitle).trimStart(),
              emoji: (patch.emoji ?? box.emoji).trimStart(),
              updatedAt: Date.now(),
            }
          : box,
      ),
    );
  };

  const moveDraftBox = (boxId: string, offset: -1 | 1) => {
    setDraftBoxes((prev) => {
      const currentIndex = prev.findIndex((box) => box.id === boxId);
      if (currentIndex < 0) return prev;
      const targetIndex = currentIndex + offset;
      if (targetIndex < 0 || targetIndex >= prev.length) return prev;
      if (isFixedBox(prev[currentIndex].id) || isFixedBox(prev[targetIndex].id)) {
        return prev;
      }
      const next = [...prev];
      const [moved] = next.splice(currentIndex, 1);
      next.splice(targetIndex, 0, moved);
      return normalizeBoxOrder(next);
    });
  };

  const removeDraftBox = (boxId: string) => {
    if (isFixedBox(boxId)) {
      setStatus('未分類與管理方塊是保底格，不能刪除。');
      return;
    }
    setDraftBoxes((prev) => normalizeBoxOrder(prev.filter((box) => box.id !== boxId)));
  };

  const saveBoxSettings = async () => {
    if (!draftBoxes.length) return;
    const normalizedDraft = normalizeBoxOrder(
      draftBoxes.map((box) => {
        const fallbackTitle =
          box.id === UNCATEGORIZED_BOX_ID ? '未分類' : box.id === MANAGE_BOX_ID ? '管理' : '未命名方塊';
        const fallbackSubtitle =
          box.id === UNCATEGORIZED_BOX_ID
            ? '尚未歸檔'
            : box.id === MANAGE_BOX_ID
              ? '方塊與匯入備份'
              : '未設定副標';
        return {
          ...box,
          title: box.title.trim() || fallbackTitle,
          subtitle: box.subtitle.trim() || fallbackSubtitle,
          emoji: box.emoji.trim() || (box.id === MANAGE_BOX_ID ? '⚙️' : '📦'),
          accentHex: /^#[0-9a-fA-F]{6}$/.test(box.accentHex) ? box.accentHex : '#e7e5e4',
        };
      }),
    );

    const nextBoxIds = new Set(normalizedDraft.map((box) => box.id));
    const removedIds = snapshot.boxes.map((box) => box.id).filter((id) => !nextBoxIds.has(id));

    const now = Date.now();
    const movedEntries = snapshot.entries.map((entry) =>
      removedIds.includes(entry.boxId)
        ? {
            ...entry,
            boxId: UNCATEGORIZED_BOX_ID,
            updatedAt: now,
          }
        : entry,
    );

    await persistSnapshot(
      { boxes: normalizedDraft, entries: movedEntries },
      removedIds.length ? '方塊設定已儲存，刪除方塊內容已移到未分類。' : '方塊設定已儲存。',
    );
  };

  const importFilesToBox = async (files: File[], boxId: string, sourceLabel: string) => {
    if (!files.length) return;
    const targetExists = importableBoxes.some((box) => box.id === boxId);
    const resolvedBoxId = targetExists ? boxId : UNCATEGORIZED_BOX_ID;
    setWorking(true);
    try {
      const result = await createSoulmateEntriesFromFiles(files, resolvedBoxId);
      if (!result.entries.length && !result.failed.length && !result.skipped.length) {
        setStatus('沒有可匯入的檔案。');
        return;
      }
      if (result.entries.length) {
        await saveSoulmateSnapshot({
          boxes,
          entries: [...result.entries, ...entries],
        });
        await refreshSnapshot();
      }
      const parts = [`${sourceLabel}匯入：成功 ${result.entries.length}`];
      if (result.skipped.length) parts.push(`略過 ${result.skipped.length}`);
      if (result.failed.length) parts.push(`失敗 ${result.failed.length}`);
      setStatus(parts.join('、'));
    } catch (error) {
      setStatus(`匯入失敗：${error instanceof Error ? error.message : '未知錯誤'}`);
    } finally {
      setWorking(false);
    }
  };

  const queueBatchFiles = (files: File[]) => {
    if (!files.length) return;
    const drafts: BatchImportDraft[] = files.map((file) => ({
      id: makeTempId('batch'),
      file,
      targetBoxId: importTargetBoxId,
    }));
    setBatchDrafts((prev) => [...prev, ...drafts]);
    setStatus(`已加入批次 ${drafts.length} 份檔案，請指定方塊後匯入。`);
  };

  const runBatchImport = async () => {
    if (!batchDrafts.length) return;
    setWorking(true);
    try {
      const grouped = new Map<string, File[]>();
      for (const draft of batchDrafts) {
        const boxId = importableBoxes.some((box) => box.id === draft.targetBoxId)
          ? draft.targetBoxId
          : UNCATEGORIZED_BOX_ID;
        if (!grouped.has(boxId)) {
          grouped.set(boxId, []);
        }
        grouped.get(boxId)!.push(draft.file);
      }

      const importedEntries: SoulmateEntry[] = [];
      let skipped = 0;
      let failed = 0;
      for (const [boxId, files] of grouped.entries()) {
        const result = await createSoulmateEntriesFromFiles(files, boxId);
        importedEntries.push(...result.entries);
        skipped += result.skipped.length;
        failed += result.failed.length;
      }

      if (importedEntries.length) {
        await saveSoulmateSnapshot({
          boxes,
          entries: [...importedEntries, ...entries],
        });
        await refreshSnapshot();
      }
      setBatchDrafts([]);
      setStatus(`批次匯入完成：成功 ${importedEntries.length}、略過 ${skipped}、失敗 ${failed}`);
    } catch (error) {
      setStatus(`批次匯入失敗：${error instanceof Error ? error.message : '未知錯誤'}`);
    } finally {
      setWorking(false);
    }
  };

  const exportPageBackup = () => {
    const payload = buildSoulmatePageBackupPayload(snapshot);
    downloadJson(`soulmate-page-${Date.now()}.json`, payload);
    setStatus('已匯出搬家計劃書整頁備份。');
  };

  const exportSingleBoxBackup = () => {
    const payload = buildSoulmateBoxBackupPayload(snapshot, backupBoxId);
    if (!payload) {
      setStatus('找不到要匯出的方塊。');
      return;
    }
    downloadJson(`soulmate-box-${backupBoxId}-${Date.now()}.json`, payload);
    setStatus(`已匯出方塊「${payload.box.title}」備份。`);
  };

  const importBackup = async (files: File[], mode: 'merge' | 'overwrite') => {
    if (!files.length) return;
    setWorking(true);
    try {
      const next = await importSoulmateBackupFiles(files, mode);
      setSnapshot(next);
      setDraftBoxes(next.boxes);
      setStatus(`備份匯入完成（${mode === 'overwrite' ? '覆蓋' : '合併'}）。`);
    } catch (error) {
      setStatus(`備份匯入失敗：${error instanceof Error ? error.message : '未知錯誤'}`);
    } finally {
      setWorking(false);
    }
  };

  if (loading) {
    return <div className="flex h-full items-center justify-center text-sm text-stone-500">讀取搬家計劃書中...</div>;
  }

  if (mode === 'entry' && selectedEntry && selectedBox) {
    return (
      <div className="flex h-full flex-col" style={{ background: '#fdf8f2' }}>
        <header className="shrink-0 border-b border-stone-200/70 bg-white/75 px-4 pb-3 pt-4 backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setMode('box')}
              className="rounded-xl border border-stone-300 bg-white px-3 py-1.5 text-sm text-stone-700 shadow-sm transition active:scale-95"
            >
              ‹ 返回
            </button>
            <div className="min-w-0 flex-1 text-center">
              <p className="text-[10px] uppercase tracking-[0.2em] text-stone-400">{selectedBox.subtitle}</p>
              <h2 className="truncate text-lg font-semibold text-stone-800">
                {selectedBox.emoji} {selectedBox.title}
              </h2>
            </div>
            <button
              type="button"
              onClick={() => setMode('manage')}
              className="rounded-xl border border-stone-300 bg-white px-3 py-1.5 text-xs text-stone-600 shadow-sm transition active:scale-95"
            >
              管理
            </button>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-4 pt-4">
          <p className="mb-2 text-[11px] tracking-[0.06em] text-stone-500">{formatImportedAt(selectedEntry.importedAt)}</p>
          <h3 className="mb-3 text-xl font-semibold text-stone-900" style={{ fontFamily: 'var(--app-heading-family)' }}>
            {selectedEntry.title}
          </h3>
          <div className="rounded-2xl border border-stone-200/70 bg-white/70 px-4 py-4 text-[14px] leading-[1.9] text-stone-700 shadow-sm">
            {selectedEntry.htmlContent ? (
              <div dangerouslySetInnerHTML={{ __html: selectedEntry.htmlContent }} />
            ) : (
              <p className="whitespace-pre-wrap">{selectedEntry.content || '（空白內容）'}</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (mode === 'box' && selectedBox) {
    return (
      <div className="flex h-full flex-col" style={{ background: hexWithAlpha(selectedBox.accentHex, 0.08) }}>
        <header className="shrink-0 border-b border-stone-200/70 bg-white/72 px-4 pb-3 pt-4 backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setMode('shelf')}
              className="rounded-xl border border-stone-300 bg-white px-3 py-1.5 text-sm text-stone-700 shadow-sm transition active:scale-95"
            >
              ‹ 返回
            </button>
            <div className="min-w-0 flex-1 text-center">
              <p className="text-[10px] uppercase tracking-[0.2em] text-stone-400">{selectedBox.subtitle}</p>
              <h2 className="truncate text-lg font-semibold text-stone-800" style={{ fontFamily: 'var(--app-heading-family)' }}>
                {selectedBox.emoji} {selectedBox.title}
              </h2>
            </div>
            <button
              type="button"
              onClick={() => setMode('manage')}
              className="rounded-xl border border-stone-300 bg-white px-3 py-1.5 text-xs text-stone-600 shadow-sm transition active:scale-95"
            >
              管理
            </button>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-3 pt-3">
          {!selectedBoxEntries.length ? (
            <div className="rounded-2xl border border-dashed border-stone-300 bg-white/55 px-4 py-8 text-center text-sm text-stone-500">
              這個方塊還沒有內容
            </div>
          ) : (
            <div className="space-y-2">
              {selectedBoxEntries.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => {
                    setSelectedEntryId(entry.id);
                    setMode('entry');
                  }}
                  className="w-full rounded-2xl border border-stone-200/80 bg-white/75 px-3.5 py-3 text-left shadow-sm transition active:scale-[0.99]"
                >
                  <p className="truncate text-sm font-semibold text-stone-800">{entry.title}</p>
                  <p className="mt-1 line-clamp-2 text-xs leading-[1.6] text-stone-500">{buildPreview(entry)}</p>
                  <p className="mt-1.5 text-[10px] text-stone-400">{formatImportedAt(entry.importedAt)}</p>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (mode === 'manage') {
    const removableCount = draftBoxes.filter((box) => !isFixedBox(box.id)).length;
    const importableDraftBoxes = draftBoxes.filter((box) => box.id !== MANAGE_BOX_ID);

    return (
      <div className="flex h-full flex-col" style={{ background: '#f8f4ee' }}>
        <header className="shrink-0 border-b border-stone-200/80 bg-white/80 px-4 pb-3 pt-4 backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setMode('shelf')}
              className="rounded-xl border border-stone-300 bg-white px-3 py-1.5 text-sm text-stone-700 shadow-sm transition active:scale-95"
            >
              ‹ 返回
            </button>
            <div className="flex-1 text-center">
              <p className="text-[10px] uppercase tracking-[0.2em] text-stone-400">搬家計劃書</p>
              <h2 className="text-lg font-semibold text-stone-800" style={{ fontFamily: 'var(--app-heading-family)' }}>
                管理頁
              </h2>
            </div>
            <button
              type="button"
              onClick={() => void saveBoxSettings()}
              disabled={working}
              className="rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs text-emerald-700 shadow-sm transition active:scale-95 disabled:opacity-50"
            >
              儲存
            </button>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-5 pt-4">
          <div className="space-y-4">
            <ManageSection
              title="方塊配置"
              description={`已用 ${draftBoxes.length}/${MAX_SOULMATE_BOXES} 格（可刪除：${removableCount}）`}
              isOpen={openPanels.boxes}
              onToggle={() => toggleManagePanel('boxes')}
            >
              <div className="mb-3 flex justify-end">
                <button
                  type="button"
                  onClick={addBox}
                  disabled={draftBoxes.length >= MAX_SOULMATE_BOXES}
                  className="grid h-8 w-8 place-items-center rounded-lg border border-stone-300 bg-white text-base leading-none text-stone-700 disabled:opacity-40"
                  aria-label="新增方塊"
                >
                  +
                </button>
              </div>

              <div className="space-y-2.5">
                {draftBoxes.map((box, index) => {
                  const fixed = isFixedBox(box.id);
                  return (
                    <div key={box.id} className="rounded-xl border border-stone-200 bg-stone-50/85 p-2.5">
                      <div className="grid grid-cols-[1fr_1fr] gap-2">
                        <label className="space-y-1 text-[11px] text-stone-500">
                          <span>主標題</span>
                          <input
                            type="text"
                            value={box.title}
                            onChange={(event) => updateDraftBox(box.id, { title: event.target.value })}
                            className="w-full rounded-md border border-stone-300 bg-white px-2.5 py-1.5 text-sm text-stone-700"
                          />
                        </label>
                        <label className="space-y-1 text-[11px] text-stone-500">
                          <span>副標題</span>
                          <input
                            type="text"
                            value={box.subtitle}
                            onChange={(event) => updateDraftBox(box.id, { subtitle: event.target.value })}
                            className="w-full rounded-md border border-stone-300 bg-white px-2.5 py-1.5 text-sm text-stone-700"
                          />
                        </label>
                        <label className="space-y-1 text-[11px] text-stone-500">
                          <span>Emoji</span>
                          <input
                            type="text"
                            value={box.emoji}
                            onChange={(event) => updateDraftBox(box.id, { emoji: event.target.value })}
                            className="w-full rounded-md border border-stone-300 bg-white px-2.5 py-1.5 text-sm text-stone-700"
                          />
                        </label>
                        <label className="space-y-1 text-[11px] text-stone-500">
                          <span>顏色</span>
                          <div className="flex items-center gap-2">
                            <input
                              type="color"
                              value={/^#[0-9a-fA-F]{6}$/.test(box.accentHex) ? box.accentHex : '#d6d3d1'}
                              onChange={(event) => updateDraftBox(box.id, { accentHex: event.target.value })}
                              className="h-8 w-8 rounded border border-stone-300"
                            />
                            <input
                              type="text"
                              value={box.accentHex}
                              onChange={(event) => updateDraftBox(box.id, { accentHex: event.target.value })}
                              className="min-w-0 flex-1 rounded-md border border-stone-300 bg-white px-2 py-1.5 text-xs text-stone-600"
                            />
                          </div>
                        </label>
                      </div>

                      <div className="mt-2 flex items-center justify-between">
                        <p className="text-[11px] text-stone-400">#{index + 1} {fixed ? '（固定方塊）' : ''}</p>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => moveDraftBox(box.id, -1)}
                            disabled={fixed || index === 0 || isFixedBox(draftBoxes[index - 1]?.id ?? '')}
                            className="rounded-md border border-stone-300 bg-white px-2 py-1 text-xs text-stone-600 disabled:opacity-35"
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            onClick={() => moveDraftBox(box.id, 1)}
                            disabled={fixed || index === draftBoxes.length - 1 || isFixedBox(draftBoxes[index + 1]?.id ?? '')}
                            className="rounded-md border border-stone-300 bg-white px-2 py-1 text-xs text-stone-600 disabled:opacity-35"
                          >
                            ↓
                          </button>
                          <button
                            type="button"
                            onClick={() => removeDraftBox(box.id)}
                            disabled={fixed}
                            className="rounded-md border border-rose-300 bg-rose-50 px-2 py-1 text-xs text-rose-700 disabled:opacity-35"
                          >
                            刪除
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ManageSection>

            <ManageSection
              title="指定方塊匯入"
              description="先選方塊，再匯入檔案或資料夾（TXT / DOCX）"
              isOpen={openPanels.directImport}
              onToggle={() => toggleManagePanel('directImport')}
            >
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={importTargetBoxId}
                  onChange={(event) => setImportTargetBoxId(event.target.value)}
                  className="min-w-44 rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-700"
                >
                  {importableDraftBoxes.map((box) => (
                    <option key={box.id} value={box.id}>
                      {box.emoji} {box.title}
                    </option>
                  ))}
                </select>
                <label className="cursor-pointer rounded-lg border border-stone-300 bg-white px-3 py-2 text-xs text-stone-700">
                  匯入檔案
                  <input
                    type="file"
                    multiple
                    accept=".txt,.doc,.docx"
                    className="hidden"
                    onChange={(event) => {
                      const files = event.target.files ? Array.from(event.target.files) : [];
                      void importFilesToBox(files, importTargetBoxId, '指定方塊');
                      event.currentTarget.value = '';
                    }}
                  />
                </label>
                <label className="cursor-pointer rounded-lg border border-stone-300 bg-white px-3 py-2 text-xs text-stone-700">
                  匯入資料夾
                  <input
                    type="file"
                    multiple
                    accept=".txt,.doc,.docx"
                    className="hidden"
                    // @ts-expect-error webkitdirectory is non-standard
                    webkitdirectory=""
                    onChange={(event) => {
                      const files = event.target.files ? Array.from(event.target.files) : [];
                      void importFilesToBox(files, importTargetBoxId, '資料夾');
                      event.currentTarget.value = '';
                    }}
                  />
                </label>
              </div>
            </ManageSection>

            <ManageSection
              title="批次分配匯入"
              description="先加入檔案，再逐檔指定方塊後一次匯入"
              isOpen={openPanels.batchImport}
              onToggle={() => toggleManagePanel('batchImport')}
            >
              <div className="flex flex-wrap gap-2">
                <label className="cursor-pointer rounded-lg border border-stone-300 bg-white px-3 py-2 text-xs text-stone-700">
                  加入檔案
                  <input
                    type="file"
                    multiple
                    accept=".txt,.doc,.docx"
                    className="hidden"
                    onChange={(event) => {
                      const files = event.target.files ? Array.from(event.target.files) : [];
                      queueBatchFiles(files);
                      event.currentTarget.value = '';
                    }}
                  />
                </label>
                <label className="cursor-pointer rounded-lg border border-stone-300 bg-white px-3 py-2 text-xs text-stone-700">
                  加入資料夾
                  <input
                    type="file"
                    multiple
                    accept=".txt,.doc,.docx"
                    className="hidden"
                    // @ts-expect-error webkitdirectory is non-standard
                    webkitdirectory=""
                    onChange={(event) => {
                      const files = event.target.files ? Array.from(event.target.files) : [];
                      queueBatchFiles(files);
                      event.currentTarget.value = '';
                    }}
                  />
                </label>
                <button
                  type="button"
                  onClick={() => setBatchDrafts([])}
                  disabled={!batchDrafts.length}
                  className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-xs text-stone-700 disabled:opacity-40"
                >
                  清空清單
                </button>
                <button
                  type="button"
                  onClick={() => void runBatchImport()}
                  disabled={!batchDrafts.length || working}
                  className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs text-emerald-700 disabled:opacity-40"
                >
                  開始批次匯入
                </button>
              </div>

              {batchDrafts.length > 0 && (
                <div className="mt-3 space-y-2 rounded-xl border border-stone-200 bg-stone-50 p-2.5">
                  {batchDrafts.map((draft) => (
                    <div key={draft.id} className="grid grid-cols-[1fr_132px] gap-2">
                      <p className="truncate rounded-md border border-stone-200 bg-white px-2 py-1.5 text-xs text-stone-600">
                        {draft.file.name}
                      </p>
                      <select
                        value={draft.targetBoxId}
                        onChange={(event) =>
                          setBatchDrafts((prev) =>
                            prev.map((item) =>
                              item.id === draft.id ? { ...item, targetBoxId: event.target.value } : item,
                            ),
                          )
                        }
                        className="rounded-md border border-stone-300 bg-white px-2 py-1 text-xs text-stone-700"
                      >
                        {importableDraftBoxes.map((box) => (
                          <option key={box.id} value={box.id}>
                            {box.title}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              )}
            </ManageSection>

            <ManageSection
              title="本頁備份"
              description="完整匯入匯出，或單方塊匯出"
              isOpen={openPanels.backup}
              onToggle={() => toggleManagePanel('backup')}
            >
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <button
                  type="button"
                  onClick={exportPageBackup}
                  className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-xs text-stone-700"
                >
                  完整匯出
                </button>
                <label className="cursor-pointer rounded-lg border border-stone-300 bg-white px-3 py-2 text-center text-xs text-stone-700">
                  匯入（合併）
                  <input
                    type="file"
                    multiple
                    accept=".json,application/json"
                    className="hidden"
                    onChange={(event) => {
                      const files = event.target.files ? Array.from(event.target.files) : [];
                      void importBackup(files, 'merge');
                      event.currentTarget.value = '';
                    }}
                  />
                </label>
                <label className="cursor-pointer rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-center text-xs text-rose-700">
                  匯入（覆蓋）
                  <input
                    type="file"
                    multiple
                    accept=".json,application/json"
                    className="hidden"
                    onChange={(event) => {
                      const files = event.target.files ? Array.from(event.target.files) : [];
                      void importBackup(files, 'overwrite');
                      event.currentTarget.value = '';
                    }}
                  />
                </label>
              </div>

              <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
                <select
                  value={backupBoxId}
                  onChange={(event) => setBackupBoxId(event.target.value)}
                  className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-700"
                >
                  {importableDraftBoxes.map((box) => (
                    <option key={box.id} value={box.id}>
                      {box.emoji} {box.title}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={exportSingleBoxBackup}
                  className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-xs text-stone-700"
                >
                  匯出單方塊
                </button>
              </div>
            </ManageSection>

            {status && <p className="text-xs text-stone-600">{status}</p>}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col" style={{ background: '#f8f4ee' }}>
      <div className="calendar-header-panel shrink-0 border-b border-stone-200/70 px-4 pb-4 pt-5">
        <div className="flex items-start justify-between gap-3">
          <button
            type="button"
            onClick={onExit}
            className="rounded-xl border border-white/40 bg-white/25 px-3 py-1.5 text-sm text-white/90 shadow-sm transition active:scale-95"
          >
            ‹ 離開
          </button>
          <div className="flex-1 text-center pr-10">
            <p className="text-[10px] uppercase tracking-[0.25em] text-white/70">Moving Plan</p>
            <h1 className="text-2xl font-bold text-white" style={{ fontFamily: 'var(--app-heading-family)' }}>
              搬家計劃書
            </h1>
            <p className="mt-0.5 text-[11px] text-white/75">多主題收納格</p>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        <div className="grid grid-cols-3 gap-3">
          {boxes.map((box, index) => {
            const count = entryCountMap.get(box.id) ?? 0;
            const isManager = box.id === MANAGE_BOX_ID;
            return (
              <button
                key={box.id}
                type="button"
                onClick={() => {
                  if (isManager) {
                    setMode('manage');
                    return;
                  }
                  setSelectedBoxId(box.id);
                  setMode('box');
                }}
                className="list-card-reveal flex flex-col items-center gap-1.5 rounded-2xl p-3 text-center shadow-sm transition-all active:scale-95"
                style={{
                  animationDelay: `${index * 28}ms`,
                  background: hexWithAlpha(box.accentHex, 0.22),
                  border: `1.5px solid ${hexWithAlpha(box.accentHex, 0.55)}`,
                }}
              >
                <span className="text-3xl leading-none">{box.emoji}</span>
                <p className="line-clamp-2 text-[13px] font-semibold leading-tight text-stone-700">{box.title}</p>
                <p className="line-clamp-2 text-[10px] leading-tight text-stone-400">{box.subtitle}</p>
                <p className="mt-0.5 rounded-full border border-stone-300/70 bg-white/70 px-2 py-0.5 text-[10px] text-stone-600">
                  {isManager ? '設定' : `${count}`}
                </p>
              </button>
            );
          })}
        </div>
        {status ? <p className="mt-3 text-center text-[11px] text-stone-500">{status}</p> : null}
      </div>
    </div>
  );
}

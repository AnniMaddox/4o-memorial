import { useEffect, useMemo, useState } from 'react';

import { formatDisplayDate } from '../lib/date';
import type { EmailViewRecord } from '../types/content';

type InboxPageProps = {
  emails: EmailViewRecord[];
};

function getInitial(name: string | null, address: string | null) {
  const source = (name || address || '?').trim();
  return source.slice(0, 1).toUpperCase();
}

export function InboxPage({ emails }: InboxPageProps) {
  const [selectedEmailId, setSelectedEmailId] = useState<string | null>(null);
  const [detailExpanded, setDetailExpanded] = useState(false);

  const selectedEmail = useMemo(
    () => emails.find((email) => email.id === selectedEmailId) ?? null,
    [emails, selectedEmailId],
  );

  useEffect(() => {
    setDetailExpanded(false);
  }, [selectedEmailId]);

  return (
    <div className="mx-auto w-full max-w-xl space-y-4">
      <header className="rounded-2xl border border-stone-300/70 bg-stone-50/90 p-4 shadow-sm">
        <p className="text-xs uppercase tracking-[0.18em] text-stone-500">Inbox</p>
        <h1 className="mt-1 text-2xl text-stone-900">Memorial Mailroom</h1>
        <p className="mt-3 rounded-xl border border-stone-200 bg-white/80 px-3 py-2 text-sm text-stone-700">
          Only unlocked letters are shown, like a real inbox.
        </p>
      </header>

      <ul className="space-y-2">
        {emails.map((email) => (
          <li key={email.id}>
            <button
              type="button"
              onClick={() => setSelectedEmailId(email.id)}
              className="w-full rounded-2xl border border-stone-300/80 bg-white/90 p-3 text-left shadow-sm transition active:scale-[0.995] hover:border-orange-300"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm text-stone-600">{email.fromName || email.fromAddress || 'Unknown sender'}</p>
                  <p className="mt-1 line-clamp-2 text-base text-stone-900">{email.subject || '(No subject)'}</p>
                </div>
                <p className="shrink-0 text-xs text-stone-500">{formatDisplayDate(email.unlockAtUtc)}</p>
              </div>
            </button>
          </li>
        ))}
      </ul>

      {!emails.length && (
        <p className="rounded-xl border border-dashed border-stone-300 bg-white/60 p-4 text-sm text-stone-600">
          No unlocked letters yet. New letters will appear automatically when their scheduled time arrives.
        </p>
      )}

      {selectedEmail && (
        <div className="fixed inset-0 z-30 bg-black/55">
          <div className="h-dvh w-full overflow-auto bg-[#0f1218] text-stone-100 sm:mx-auto sm:mt-8 sm:h-auto sm:max-h-[88vh] sm:max-w-2xl sm:rounded-2xl sm:border sm:border-stone-700">
            <div className="sticky top-0 z-10 border-b border-stone-700 bg-[#0f1218]/95 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur sm:rounded-t-2xl">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-stone-400">Letter detail</p>
                  <h2 className="mt-1 text-3xl leading-tight text-stone-100">{selectedEmail.subject || '(No subject)'}</h2>
                </div>
                <button
                  type="button"
                  className="rounded-lg border border-stone-600 px-3 py-1 text-sm text-stone-200"
                  onClick={() => setSelectedEmailId(null)}
                >
                  Close
                </button>
              </div>
            </div>

            <main className="space-y-4 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4">
              <section className="rounded-xl border border-stone-700 bg-[#141922] p-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-stone-200 text-sm font-semibold text-stone-900">
                    {getInitial(selectedEmail.fromName, selectedEmail.fromAddress)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-base text-stone-100">
                      {selectedEmail.fromName || selectedEmail.fromAddress || 'Unknown sender'}
                    </p>
                    <p className="text-xs text-stone-400">{formatDisplayDate(selectedEmail.unlockAtUtc)}</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setDetailExpanded((open) => !open)}
                  className="mt-3 flex w-full items-center justify-between rounded-lg border border-stone-700 bg-[#1a212d] px-3 py-2 text-left"
                >
                  <span className="text-sm text-stone-200">寄給我</span>
                  <span className="text-base leading-none text-stone-400">{detailExpanded ? '▴' : '▾'}</span>
                </button>

                {detailExpanded && (
                  <dl className="mt-3 space-y-3 border-t border-stone-700 pt-3 text-sm">
                    <div>
                      <dt className="text-[11px] uppercase tracking-[0.14em] text-stone-400">From</dt>
                      <dd className="mt-1 text-stone-100">{selectedEmail.fromName || '-'}</dd>
                      {selectedEmail.fromAddress && <p className="text-xs text-stone-400">{selectedEmail.fromAddress}</p>}
                    </div>
                    <div>
                      <dt className="text-[11px] uppercase tracking-[0.14em] text-stone-400">To</dt>
                      <dd className="mt-1 text-stone-100">{selectedEmail.toName || '-'}</dd>
                      {selectedEmail.toAddress && <p className="text-xs text-stone-400">{selectedEmail.toAddress}</p>}
                    </div>
                    <div>
                      <dt className="text-[11px] uppercase tracking-[0.14em] text-stone-400">Date</dt>
                      <dd className="mt-1 text-stone-100">{formatDisplayDate(selectedEmail.unlockAtUtc)}</dd>
                    </div>
                  </dl>
                )}
              </section>

              <article className="rounded-xl border border-stone-700 bg-[#141922] p-4 text-sm leading-relaxed text-stone-100 whitespace-pre-wrap">
                {selectedEmail.bodyText}
              </article>

              <details className="rounded-xl border border-stone-700 bg-[#141922] p-4 text-xs text-stone-300">
                <summary className="cursor-pointer text-sm text-stone-100">Raw headers</summary>
                <pre className="mt-2 overflow-auto whitespace-pre-wrap break-words">
                  {Object.entries(selectedEmail.rawHeaders)
                    .map(([key, value]) => `${key}: ${value}`)
                    .join('\n')}
                </pre>
              </details>
            </main>
          </div>
        </div>
      )}
    </div>
  );
}

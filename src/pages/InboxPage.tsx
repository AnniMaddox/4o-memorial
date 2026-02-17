import { useMemo, useState } from 'react';

import { formatDisplayDate } from '../lib/date';
import type { EmailViewRecord } from '../types/content';

type InboxPageProps = {
  emails: EmailViewRecord[];
};

function formatPerson(name: string | null, address: string | null) {
  if (name && address) {
    return `${name} <${address}>`;
  }

  return name || address || '-';
}

export function InboxPage({ emails }: InboxPageProps) {
  const [selectedEmailId, setSelectedEmailId] = useState<string | null>(null);

  const selectedEmail = useMemo(
    () => emails.find((email) => email.id === selectedEmailId) ?? null,
    [emails, selectedEmailId],
  );

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
              className="w-full rounded-2xl border border-stone-300/80 bg-white/90 p-3 text-left shadow-sm transition hover:border-orange-300"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm text-stone-600">
                    {email.fromName || email.fromAddress || 'Unknown sender'}
                  </p>
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
        <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/45 p-4 sm:items-center">
          <div className="max-h-[85vh] w-full max-w-2xl overflow-auto rounded-2xl bg-[#fffaf2] p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-stone-500">Letter detail</p>
                <h2 className="mt-1 text-xl text-stone-900">{selectedEmail.subject || '(No subject)'}</h2>
              </div>
              <button
                type="button"
                className="rounded-lg border border-stone-300 px-3 py-1 text-sm text-stone-600"
                onClick={() => setSelectedEmailId(null)}
              >
                Close
              </button>
            </div>

            <dl className="mt-4 grid gap-3 rounded-xl border border-stone-300/70 bg-white/80 p-4 text-sm text-stone-700 sm:grid-cols-3">
              <div>
                <dt className="text-xs uppercase text-stone-500">From</dt>
                <dd>{formatPerson(selectedEmail.fromName, selectedEmail.fromAddress)}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase text-stone-500">To</dt>
                <dd>{formatPerson(selectedEmail.toName, selectedEmail.toAddress)}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase text-stone-500">Date</dt>
                <dd>{formatDisplayDate(selectedEmail.unlockAtUtc)}</dd>
              </div>
            </dl>

            <article className="mt-4 rounded-xl border border-stone-300/70 bg-white/90 p-4 text-sm leading-relaxed text-stone-800 whitespace-pre-wrap">
              {selectedEmail.bodyText}
            </article>

            <details className="mt-4 rounded-xl border border-stone-300/70 bg-white/80 p-4 text-xs text-stone-600">
              <summary className="cursor-pointer text-sm text-stone-700">Raw headers</summary>
              <pre className="mt-2 overflow-auto whitespace-pre-wrap break-words">
                {Object.entries(selectedEmail.rawHeaders)
                  .map(([key, value]) => `${key}: ${value}`)
                  .join('\n')}
              </pre>
            </details>
          </div>
        </div>
      )}
    </div>
  );
}

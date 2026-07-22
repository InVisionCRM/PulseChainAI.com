'use client';

// 👍 / 👎 community rating for a token, shown in the geicko stats panel.
// Votes persist server-side (de-duplicated by hashed IP with a 24h cooldown)
// and the caller's choice is mirrored in localStorage for an instant highlight.

import React, { useCallback, useEffect, useState } from 'react';

type Vote = 0 | 1 | -1;

export default function GeickoRating({ token, chain }: { token: string; chain: string }) {
  const [up, setUp] = useState(0);
  const [down, setDown] = useState(0);
  const [yourVote, setYourVote] = useState<Vote>(0);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const key = token ? `geicko_vote_${chain}_${token.toLowerCase()}` : '';

  useEffect(() => {
    if (!token || !key) return;
    let alive = true;
    try {
      const v = Number(localStorage.getItem(key));
      if (v === 1 || v === -1) setYourVote(v);
    } catch {}
    fetch(`/api/geicko/ratings?chain=${chain}&token=${token}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!alive || !d) return;
        setUp(d.up || 0);
        setDown(d.down || 0);
        if (d.yourVote === 1 || d.yourVote === -1) setYourVote(d.yourVote);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [token, chain, key]);

  const vote = useCallback(
    async (v: 1 | -1) => {
      if (busy || !token) return;
      setBusy(true);
      setNote(null);
      try {
        const r = await fetch('/api/geicko/ratings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chain, token, vote: v === 1 ? 'up' : 'down' }),
        });
        const d = await r.json().catch(() => null);
        if (d && typeof d.up === 'number') {
          setUp(d.up);
          setDown(d.down);
        }
        if (r.ok) {
          setYourVote(v);
          try {
            if (key) localStorage.setItem(key, String(v));
          } catch {}
        } else {
          if (d?.yourVote === 1 || d?.yourVote === -1) setYourVote(d.yourVote);
          setNote(d?.error || 'Could not vote.');
        }
      } catch {
        setNote('Could not vote.');
      } finally {
        setBusy(false);
      }
    },
    [busy, token, chain, key],
  );

  const total = up + down;
  const pct = total > 0 ? Math.round((up / total) * 100) : null;

  const btn =
    'flex-1 flex items-center justify-center gap-1.5 rounded-lg border py-2 text-sm font-semibold transition-colors disabled:opacity-60';

  return (
    <div className="relative bg-gradient-to-br from-white/5 via-blue-500/5 to-white/5 rounded-lg shadow-[inset_2px_2px_4px_rgba(0,0,0,0.4),inset_-1px_-1px_2px_rgba(255,255,255,0.1)] border border-[var(--line-soft)] px-3 py-2.5">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-[var(--text-muted)] font-medium uppercase tracking-wider">Community</span>
        {pct !== null && (
          <span className="text-xs text-[var(--text-muted)] tabular-nums">{pct}% 👍 · {total} vote{total === 1 ? '' : 's'}</span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => vote(1)}
          aria-pressed={yourVote === 1}
          className={`${btn} ${yourVote === 1 ? 'border-[var(--up)] text-[var(--up)] bg-[var(--up)]/10' : 'border-[var(--line)] text-[var(--text)] hover:bg-[var(--surface)]'}`}
        >
          <span aria-hidden>👍</span>
          <span className="tabular-nums">{up}</span>
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => vote(-1)}
          aria-pressed={yourVote === -1}
          className={`${btn} ${yourVote === -1 ? 'border-red-400 text-red-400 bg-red-400/10' : 'border-[var(--line)] text-[var(--text)] hover:bg-[var(--surface)]'}`}
        >
          <span aria-hidden>👎</span>
          <span className="tabular-nums">{down}</span>
        </button>
      </div>
      {note && <div className="mt-1.5 text-[11px] text-[var(--text-faint)] text-center">{note}</div>}
    </div>
  );
}

'use client';

// Community comment section for a token, shown below the geicko tab content.
// No accounts — users type a display name (≤30) and a message (≤150). Bodies
// render as PLAIN TEXT (React escapes) so there's no injection surface. An
// owner can unlock inline moderation by storing their admin secret locally.

import React, { useCallback, useEffect, useRef, useState } from 'react';

const NAME_MAX = 30;
const BODY_MAX = 150;
const NAME_KEY = 'geicko_comment_name';
const ADMIN_KEY = 'geicko_admin_secret';

interface Comment {
  id: number;
  name: string;
  body: string;
  createdAt: string;
}

function relTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return '';
  const s = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

export default function GeickoComments({ token, chain }: { token: string; chain: string }) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [adminSecret, setAdminSecret] = useState<string | null>(null);
  const honeypot = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      setName(localStorage.getItem(NAME_KEY) || '');
      setAdminSecret(localStorage.getItem(ADMIN_KEY));
    } catch {}
  }, []);

  const load = useCallback(
    async (offset: number) => {
      if (!token) return;
      try {
        const r = await fetch(`/api/geicko/comments?chain=${chain}&token=${token}&offset=${offset}`);
        const d = r.ok ? await r.json() : null;
        const rows: Comment[] = Array.isArray(d?.comments) ? d.comments : [];
        setComments((prev) => (offset === 0 ? rows : [...prev, ...rows]));
        setHasMore(!!d?.hasMore);
      } catch {
        /* leave whatever we have */
      } finally {
        setLoading(false);
      }
    },
    [token, chain],
  );

  useEffect(() => {
    setLoading(true);
    setComments([]);
    setHasMore(false);
    void load(0);
  }, [load]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = body.trim();
    if (!text || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const r = await fetch('/api/geicko/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chain,
          token,
          name: name.trim(),
          body: text,
          website: honeypot.current?.value || '', // honeypot
        }),
      });
      const d = await r.json().catch(() => null);
      if (!r.ok) {
        setError(d?.error || 'Could not post your comment.');
      } else {
        if (d?.comment) setComments((prev) => [d.comment as Comment, ...prev]);
        setBody('');
        try {
          localStorage.setItem(NAME_KEY, name.trim());
        } catch {}
      }
    } catch {
      setError('Could not post your comment.');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleAdmin = () => {
    if (adminSecret) {
      try {
        localStorage.removeItem(ADMIN_KEY);
      } catch {}
      setAdminSecret(null);
      return;
    }
    const s = window.prompt('Enter admin secret to enable comment moderation:');
    if (s && s.trim()) {
      try {
        localStorage.setItem(ADMIN_KEY, s.trim());
      } catch {}
      setAdminSecret(s.trim());
    }
  };

  const remove = async (id: number) => {
    if (!adminSecret) return;
    if (!window.confirm('Delete this comment?')) return;
    try {
      const r = await fetch(`/api/geicko/comments?id=${id}`, {
        method: 'DELETE',
        headers: { 'x-admin-secret': adminSecret },
      });
      if (r.ok) {
        setComments((prev) => prev.filter((c) => c.id !== id));
      } else if (r.status === 401) {
        setError('Admin secret rejected.');
        try {
          localStorage.removeItem(ADMIN_KEY);
        } catch {}
        setAdminSecret(null);
      }
    } catch {
      /* ignore */
    }
  };

  const remaining = BODY_MAX - body.length;

  return (
    <div className="mt-4 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-3 md:p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-[var(--text)]">
          Comments{comments.length > 0 ? ` · ${comments.length}${hasMore ? '+' : ''}` : ''}
        </h3>
        <button
          type="button"
          onClick={toggleAdmin}
          title={adminSecret ? 'Moderation on — click to lock' : 'Moderator? Click to unlock deletes'}
          className="text-xs text-[var(--text-faint)] hover:text-[var(--text-muted)] transition-colors"
          aria-label="Toggle moderation"
        >
          {adminSecret ? '🔓' : '🔒'}
        </button>
      </div>

      <form onSubmit={submit} className="mb-4 space-y-2">
        <div className="flex items-center gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value.slice(0, NAME_MAX))}
            maxLength={NAME_MAX}
            placeholder="Your name (optional)"
            className="w-40 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text-faint)] focus:outline-none focus:border-[#FA4616]/60"
          />
          <span className="text-[10px] text-[var(--text-faint)] tabular-nums">{name.length}/{NAME_MAX}</span>
        </div>
        {/* honeypot: hidden from real users, catches bots */}
        <input
          ref={honeypot}
          type="text"
          name="website"
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          className="hidden"
        />
        <div className="relative">
          <textarea
            id="geicko-comment-input"
            value={body}
            onChange={(e) => setBody(e.target.value.slice(0, BODY_MAX))}
            maxLength={BODY_MAX}
            rows={2}
            placeholder="Add a comment…"
            className="w-full resize-none rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text-faint)] focus:outline-none focus:border-[#FA4616]/60"
          />
          <div className="mt-1 flex items-center justify-between">
            <span className={`text-[10px] tabular-nums ${remaining <= 15 ? 'text-red-400' : 'text-[var(--text-faint)]'}`}>
              {remaining} left
            </span>
            <button
              type="submit"
              disabled={submitting || body.trim().length === 0}
              className="rounded-lg bg-[#FA4616] px-4 py-1.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {submitting ? 'Posting…' : 'Post'}
            </button>
          </div>
        </div>
        {error && <div className="text-xs text-red-400">{error}</div>}
      </form>

      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-12 rounded-lg bg-[var(--surface)] animate-pulse" />
          ))}
        </div>
      ) : comments.length === 0 ? (
        <div className="py-6 text-center text-sm text-[var(--text-faint)]">Be the first to comment.</div>
      ) : (
        <ul className="space-y-2">
          {comments.map((c) => (
            <li key={c.id} className="group rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-sm font-semibold text-[var(--text)] truncate">{c.name}</span>
                  <span className="text-[10px] text-[var(--text-faint)] whitespace-nowrap">{relTime(c.createdAt)}</span>
                </div>
                {adminSecret && (
                  <button
                    type="button"
                    onClick={() => remove(c.id)}
                    className="text-xs text-[var(--text-faint)] opacity-0 group-hover:opacity-100 hover:text-red-400 transition"
                    aria-label="Delete comment"
                  >
                    ✕
                  </button>
                )}
              </div>
              <p className="mt-0.5 text-sm text-[var(--text-muted)] break-words whitespace-pre-wrap">{c.body}</p>
            </li>
          ))}
          {hasMore && (
            <li>
              <button
                type="button"
                onClick={() => load(comments.length)}
                className="w-full rounded-lg border border-[var(--line)] py-2 text-xs font-medium text-[var(--text-muted)] hover:bg-[var(--surface)] transition-colors"
              >
                Load more
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

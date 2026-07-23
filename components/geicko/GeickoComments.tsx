'use client';

// Community comment section for a token, shown below the geicko tab content.
// No accounts — users type a display name (≤30) and a message (≤150). Bodies
// render as PLAIN TEXT (React escapes) so there's no injection surface. An
// owner can unlock inline moderation by storing their admin secret locally.
//
// Layout follows the common modern pattern (avatar + name·time + body rows and
// a single cohesive composer card) adapted to the app's design tokens.

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
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d`;
  return new Date(iso).toLocaleDateString();
}

// Deterministic avatar colour from a name, so the same person keeps a colour.
function avatarStyle(seed: string): React.CSSProperties {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return { backgroundColor: `hsl(${h % 360} 45% 42%)` };
}

function Avatar({ name }: { name: string }) {
  const label = (name.trim()[0] || 'A').toUpperCase();
  return (
    <div
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white select-none"
      style={avatarStyle(name || 'Anon')}
      aria-hidden
    >
      {label}
    </div>
  );
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
        /* keep what we have */
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
  const canPost = body.trim().length > 0 && !submitting;

  return (
    <section className="mt-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[var(--text)]">
          Comments
          {comments.length > 0 && (
            <span className="ml-1.5 font-normal text-[var(--text-faint)]">
              {comments.length}
              {hasMore ? '+' : ''}
            </span>
          )}
        </h3>
        <button
          type="button"
          onClick={toggleAdmin}
          title={adminSecret ? 'Moderation on — click to lock' : 'Moderator? Click to unlock deletes'}
          className="text-xs text-[var(--text-faint)] transition-colors hover:text-[var(--text-muted)]"
          aria-label="Toggle moderation"
        >
          {adminSecret ? '🔓' : '🔒'}
        </button>
      </div>

      {/* Composer — avatar + one cohesive input card */}
      <form onSubmit={submit} className="mb-6 flex gap-3">
        <Avatar name={name || 'You'} />
        <div className="min-w-0 flex-1">
          <div className="overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--surface)] transition-colors focus-within:border-[#FA4616]/60">
            <input
              value={name}
              onChange={(e) => setName(e.target.value.slice(0, NAME_MAX))}
              maxLength={NAME_MAX}
              placeholder="Your name (optional)"
              className="w-full border-0 bg-transparent px-3 pt-2.5 pb-1 text-sm font-medium text-[var(--text)] placeholder:text-[var(--text-faint)] focus:outline-none"
            />
            <textarea
              id="geicko-comment-input"
              value={body}
              onChange={(e) => setBody(e.target.value.slice(0, BODY_MAX))}
              maxLength={BODY_MAX}
              rows={2}
              placeholder="Share your thoughts…"
              className="w-full resize-none border-0 bg-transparent px-3 pb-2 text-sm text-[var(--text)] placeholder:text-[var(--text-faint)] focus:outline-none"
            />
            <div className="flex items-center justify-between border-t border-[var(--line)] px-3 py-1.5">
              <span className={`text-[11px] tabular-nums ${remaining <= 15 ? 'text-red-400' : 'text-[var(--text-faint)]'}`}>
                {remaining} left
              </span>
              <button
                type="submit"
                disabled={!canPost}
                className="rounded-full bg-[#FA4616] px-4 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
              >
                {submitting ? 'Posting…' : 'Post'}
              </button>
            </div>
          </div>
          {/* honeypot: hidden from real users, catches bots */}
          <input ref={honeypot} type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" />
          {error && <div className="mt-1.5 text-xs text-red-400">{error}</div>}
        </div>
      </form>

      {/* Thread */}
      {loading ? (
        <div className="space-y-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex gap-3">
              <div className="h-9 w-9 shrink-0 animate-pulse rounded-full bg-[var(--surface)]" />
              <div className="flex-1 space-y-2 py-1">
                <div className="h-3 w-24 animate-pulse rounded bg-[var(--surface)]" />
                <div className="h-3 w-3/4 animate-pulse rounded bg-[var(--surface)]" />
              </div>
            </div>
          ))}
        </div>
      ) : comments.length === 0 ? (
        <div className="py-8 text-center text-sm text-[var(--text-faint)]">Be the first to comment.</div>
      ) : (
        <ul className="space-y-4">
          {comments.map((c) => (
            <li key={c.id} className="group flex gap-3">
              <Avatar name={c.name} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-semibold text-[var(--text)]">{c.name}</span>
                  <span className="shrink-0 text-[11px] text-[var(--text-faint)]">{relTime(c.createdAt)}</span>
                  {adminSecret && (
                    <button
                      type="button"
                      onClick={() => remove(c.id)}
                      className="ml-auto shrink-0 text-xs text-[var(--text-faint)] opacity-0 transition hover:text-red-400 group-hover:opacity-100"
                      aria-label="Delete comment"
                    >
                      ✕
                    </button>
                  )}
                </div>
                <p className="mt-0.5 whitespace-pre-wrap break-words text-sm text-[var(--text-muted)]">{c.body}</p>
              </div>
            </li>
          ))}
          {hasMore && (
            <li>
              <button
                type="button"
                onClick={() => load(comments.length)}
                className="text-xs font-medium text-[var(--text-muted)] transition-colors hover:text-[var(--text)]"
              >
                Load more comments
              </button>
            </li>
          )}
        </ul>
      )}
    </section>
  );
}

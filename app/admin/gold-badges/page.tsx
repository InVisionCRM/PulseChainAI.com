'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { GripVertical, Trash2, Plus, ArrowUp, ArrowDown, Lock, LogOut, FileText, Link as LinkIcon, Upload } from 'lucide-react';
import { useVercelBlob } from '@/hooks/useVercelBlob';

const API = '/api/gold-badges';
const PROFILE_API = '/api/token-profile';
const STORAGE_KEY = 'gold-admin-secret';

type GoldEntry = { token_address: string; display_order: number; symbol: string | null; name: string | null; logo_url?: string | null };
type CustomLink = { label: string; url: string };
type TokenProfile = { description: string | null; logo_url: string | null; custom_links: CustomLink[] };

const FALLBACK_ADDRESSES = [
  '0xB7d4eB5fDfE3d4d3B5C16a44A49948c6EC77c6F1',
  '0xB5C4ecEF450fd36d0eBa1420F6A19DBfBeE5292e',
  '0xCA35638A3fdDD02fEC597D8c1681198C06b23F58',
  '0x2b591e99afE9f32eAA6214f7B7629768c40Eeb39',
  '0x8CDaf3d630Da9E1450832924D5701CC0500E9cfC',
  '0x95B303987A60C71504D99Aa1b13B4DA07b0790ab',
  '0xA1077a294dDE1B09bB078844df40758a5D0f9a27',
  '0x2fa878Ab3F87CC1C9737Fc071108F904c0B0C95d',
  '0xc10A4Ed9b4042222d69ff0B374eddd47ed90fC1F',
  '0x33779a40987F729a7DF6cc08B1dAD1a21b58A220',
  '0x9deeaF046e144Fb6304A5ACD2aF142bBfE958030',
  '0xC70CF25DFCf5c5e9757002106C096ab72fab299E',
  '0x483287DEd4F43552f201a103670853b5dc57D59d',
];

function headers(secret: string): HeadersInit {
  return { 'Content-Type': 'application/json', 'x-admin-secret': secret };
}

export default function AdminGoldBadgesPage() {
  const [secret, setSecret] = useState('');
  const [inputSecret, setInputSecret] = useState('');
  const [list, setList] = useState<GoldEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addAddress, setAddAddress] = useState('');
  const [addOrder, setAddOrder] = useState('');
  const [addSymbol, setAddSymbol] = useState('');
  const [addName, setAddName] = useState('');
  const [seeding, setSeeding] = useState(false);
  const [profileModalAddress, setProfileModalAddress] = useState<string | null>(null);
  const [profileForm, setProfileForm] = useState<TokenProfile>({ description: '', logo_url: '', custom_links: [] });
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [dexLogoCache, setDexLogoCache] = useState<Record<string, string>>({});
  const [orderDirty, setOrderDirty] = useState(false);
  const [savingOrder, setSavingOrder] = useState(false);
  const dexLogoRequested = useRef<Set<string>>(new Set());
  const logoFileInputRef = useRef<HTMLInputElement>(null);
  const { uploadFile: uploadBlob, isUploading: isUploadingLogo } = useVercelBlob();

  const fetchDexLogo = useCallback((address: string) => {
    if (dexLogoCache[address] || dexLogoRequested.current.has(address)) return;
    dexLogoRequested.current.add(address);
    fetch(`https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(address)}`)
      .then((r) => r.json())
      .then((d) => {
        const pairs = d?.pairs ?? [];
        const pc = pairs.find((p: { chainId?: string }) => p.chainId === 'pulsechain');
        const pair = pc || pairs[0];
        if (!pair) return;
        const base = pair.baseToken?.address?.toLowerCase();
        const addr = address.toLowerCase();
        const token = base === addr ? pair.baseToken : pair.quoteToken;
        const url = token?.logoURI || pair.info?.imageUrl;
        if (url) setDexLogoCache((prev) => ({ ...prev, [address]: url }));
      })
      .catch(() => {});
  }, [dexLogoCache]);

  const loadList = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(API);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed to load');
      setList(data.list || []);
      setOrderDirty(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
      setList([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const stored = typeof window !== 'undefined' ? sessionStorage.getItem(STORAGE_KEY) : null;
    if (stored) setSecret(stored);
  }, []);

  useEffect(() => {
    loadList();
  }, [loadList]);

  const login = (e: React.FormEvent) => {
    e.preventDefault();
    const s = inputSecret.trim();
    if (!s) return;
    setSecret(s);
    if (typeof window !== 'undefined') sessionStorage.setItem(STORAGE_KEY, s);
  };

  const logout = () => {
    setSecret('');
    setInputSecret('');
    if (typeof window !== 'undefined') sessionStorage.removeItem(STORAGE_KEY);
  };

  const addBadge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!secret || !addAddress.trim()) return;
    const order = addOrder.trim() ? parseInt(addOrder, 10) : undefined;
    if (addOrder.trim() && (isNaN(order!) || order! < 1)) {
      setError('Display order must be a positive number');
      return;
    }
    setError(null);
    try {
      const res = await fetch(API, {
        method: 'POST',
        headers: headers(secret),
        body: JSON.stringify({
          address: addAddress.trim(),
          display_order: order,
          symbol: addSymbol.trim() || undefined,
          name: addName.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed to add');
      setAddAddress('');
      setAddOrder('');
      setAddSymbol('');
      setAddName('');
      await loadList();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add');
    }
  };

  const removeBadge = async (address: string) => {
    if (!secret) return;
    if (!confirm('Remove this GOLD badge?')) return;
    setError(null);
    try {
      const res = await fetch(`${API}/remove?address=${encodeURIComponent(address)}`, {
        method: 'DELETE',
        headers: headers(secret),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed to remove');
      await loadList();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to remove');
    }
  };

  const move = (index: number, dir: 'up' | 'down') => {
    if (list.length === 0) return;
    const next = [...list];
    const j = dir === 'up' ? index - 1 : index + 1;
    if (j < 0 || j >= next.length) return;
    [next[index], next[j]] = [next[j], next[index]];
    setList(next.map((r, i) => ({ ...r, display_order: i + 1 })));
    setOrderDirty(true);
  };

  const moveToPosition = (fromIndex: number, newPositionOneBased: number) => {
    if (list.length === 0) return;
    const toIndex = Math.max(0, Math.min(list.length - 1, newPositionOneBased - 1));
    if (toIndex === fromIndex) return;
    const next = [...list];
    const a = next[fromIndex];
    const b = next[toIndex];
    next[fromIndex] = b;
    next[toIndex] = a;
    setList(next.map((r, i) => ({ ...r, display_order: i + 1 })));
    setOrderDirty(true);
  };

  const saveOrder = async () => {
    if (!secret || list.length === 0 || !orderDirty) return;
    setSavingOrder(true);
    setError(null);
    try {
      const orderedAddresses = list.map((r) => r.token_address);
      const res = await fetch(`${API}/reorder`, {
        method: 'PATCH',
        headers: headers(secret),
        body: JSON.stringify({ orderedAddresses }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed to save order');
      setOrderDirty(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save order');
    } finally {
      setSavingOrder(false);
    }
  };

  const seedDefaults = async () => {
    if (!secret) return;
    if (!confirm('Add all 13 default GOLD token addresses? This will not remove existing entries.')) return;
    setSeeding(true);
    setError(null);
    try {
      for (let i = 0; i < FALLBACK_ADDRESSES.length; i++) {
        const res = await fetch(API, {
          method: 'POST',
          headers: headers(secret),
          body: JSON.stringify({ address: FALLBACK_ADDRESSES[i], display_order: i + 1 }),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data?.error || `Failed at ${i + 1}`);
        }
      }
      await loadList();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Seed failed');
    } finally {
      setSeeding(false);
    }
  };

  const openProfileModal = async (address: string) => {
    setProfileModalAddress(address);
    setProfileForm({ description: '', logo_url: '', custom_links: [] });
    setProfileLoading(true);
    try {
      const res = await fetch(`${PROFILE_API}?address=${encodeURIComponent(address)}`);
      const data = await res.json();
      setProfileForm({
        description: data.description ?? '',
        logo_url: data.logo_url ?? '',
        custom_links: Array.isArray(data.custom_links) && data.custom_links.length > 0
          ? data.custom_links
          : [{ label: '', url: '' }],
      });
    } catch {
      setProfileForm({ description: '', logo_url: '', custom_links: [{ label: '', url: '' }] });
    } finally {
      setProfileLoading(false);
    }
  };

  const closeProfileModal = () => {
    setProfileModalAddress(null);
  };

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!secret || !profileModalAddress) return;
    setProfileSaving(true);
    setError(null);
    try {
      const links = profileForm.custom_links.filter((l) => (l.label || '').trim() || (l.url || '').trim());
      const res = await fetch(PROFILE_API, {
        method: 'POST',
        headers: headers(secret),
        body: JSON.stringify({
          address: profileModalAddress,
          description: (profileForm.description || '').trim() || null,
          logo_url: (profileForm.logo_url || '').trim() || null,
          custom_links: links.length ? links : [],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed to save');
      closeProfileModal();
      await loadList();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save profile');
    } finally {
      setProfileSaving(false);
    }
  };

  const addProfileLink = () => {
    setProfileForm((f) => ({ ...f, custom_links: [...f.custom_links, { label: '', url: '' }] }));
  };
  const removeProfileLink = (i: number) => {
    setProfileForm((f) => {
      const next = f.custom_links.filter((_, j) => j !== i);
      return { ...f, custom_links: next.length ? next : [{ label: '', url: '' }] };
    });
  };
  const updateProfileLink = (i: number, field: 'label' | 'url', value: string) => {
    setProfileForm((f) => ({
      ...f,
      custom_links: f.custom_links.map((l, j) => (j === i ? { ...l, [field]: value } : l)),
    }));
  };

  const panelStyle = {
    background: 'linear-gradient(325deg, rgba(20, 20, 20, 0.8), rgba(40, 40, 40, 0.6))',
    boxShadow: 'inset 0 3px 6px rgba(0, 0, 0, 0.8), inset 0 -3px 6px rgba(255, 255, 255, 0.1), 0 1px 3px rgba(0, 0, 0, 0.5)',
    border: '1px inset rgba(60, 60, 60, 0.5)',
  };

  if (!secret) {
    return (
      <div className="min-h-screen bg-black/90 flex items-center justify-center p-4">
        <div className="w-full max-w-md rounded-2xl overflow-hidden border-2 border-cyan-500/30 bg-gradient-to-br from-slate-900 to-slate-800 shadow-2xl p-6">
          <div className="flex items-center gap-2 text-cyan-400 mb-4">
            <Lock className="w-5 h-5" />
            <h1 className="text-xl font-semibold">GOLD Badges Admin</h1>
          </div>
          <p className="text-slate-400 text-sm mb-4">Enter the admin secret from .env (GOLD_ADMIN_SECRET or ADMIN_SECRET).</p>
          <form onSubmit={login} className="space-y-3">
            <input
              type="password"
              value={inputSecret}
              onChange={(e) => setInputSecret(e.target.value)}
              placeholder="Admin secret"
              className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-cyan-500/30 text-white placeholder-slate-500 focus:ring-2 focus:ring-cyan-500/50"
              autoComplete="current-password"
            />
            <button
              type="submit"
              className="w-full py-2 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 text-white font-medium hover:opacity-90"
            >
              Continue
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black/90 text-white p-4 md:p-6">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-semibold text-cyan-400">GOLD Badges Admin</h1>
          <button
            onClick={logout}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-600 text-slate-400 hover:bg-white/5 text-sm"
          >
            <LogOut className="w-4 h-4" /> Log out
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-sm">
            {error}
          </div>
        )}

        <div className="rounded-xl p-4 mb-6" style={panelStyle}>
          <h2 className="text-lg font-medium text-slate-200 mb-3">Add token</h2>
          <form onSubmit={addBadge} className="grid gap-3 md:grid-cols-2">
            <input
              value={addAddress}
              onChange={(e) => setAddAddress(e.target.value)}
              placeholder="Token address (0x...)"
              className="md:col-span-2 px-3 py-2 rounded-lg bg-slate-800/80 border border-cyan-500/30 text-white placeholder-slate-500 font-mono text-sm"
              required
            />
            <input
              value={addOrder}
              onChange={(e) => setAddOrder(e.target.value)}
              placeholder="Display order (optional)"
              type="number"
              min={1}
              className="px-3 py-2 rounded-lg bg-slate-800/80 border border-cyan-500/30 text-white placeholder-slate-500"
            />
            <input
              value={addSymbol}
              onChange={(e) => setAddSymbol(e.target.value)}
              placeholder="Symbol (optional)"
              className="px-3 py-2 rounded-lg bg-slate-800/80 border border-cyan-500/30 text-white placeholder-slate-500"
            />
            <input
              value={addName}
              onChange={(e) => setAddName(e.target.value)}
              placeholder="Name (optional)"
              className="px-3 py-2 rounded-lg bg-slate-800/80 border border-cyan-500/30 text-white placeholder-slate-500"
            />
            <div className="md:col-span-2">
              <button
                type="submit"
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 text-white font-medium hover:opacity-90"
              >
                <Plus className="w-4 h-4" /> Add GOLD badge
              </button>
            </div>
          </form>
        </div>

        <div className="rounded-xl p-4 mb-4" style={panelStyle}>
          <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
            <h2 className="text-lg font-medium text-slate-200">Current GOLD badges ({list.length})</h2>
            <div className="flex items-center gap-2">
              {orderDirty && (
                <button
                  type="button"
                  onClick={saveOrder}
                  disabled={savingOrder}
                  className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-sm font-medium disabled:opacity-50"
                >
                  {savingOrder ? 'Saving…' : 'Save order'}
                </button>
              )}
              {list.length === 0 && (
                <button
                  onClick={seedDefaults}
                  disabled={seeding}
                  className="px-3 py-1.5 rounded-lg bg-cyan-600/80 text-white text-sm hover:bg-cyan-600 disabled:opacity-50"
                >
                  {seeding ? 'Adding…' : 'Seed 13 defaults'}
                </button>
              )}
            </div>
          </div>
          {orderDirty && (
            <p className="text-amber-200/90 text-xs mb-2">Change position number or use ↑↓ then click Save order to apply.</p>
          )}
          {loading ? (
            <p className="text-slate-500">Loading…</p>
          ) : list.length === 0 ? (
            <p className="text-slate-500">No GOLD badges yet. Add one above or seed defaults.</p>
          ) : (
            <ul className="space-y-2">
              {list.map((row, index) => (
                <li
                  key={`${row.token_address}-${index}`}
                  className="flex items-center gap-2 py-2 px-3 rounded-lg bg-slate-800/50 border border-slate-700/50"
                >
                  <div className="flex flex-col">
                    <button
                      type="button"
                      onClick={() => move(index, 'up')}
                      disabled={index === 0}
                      className="p-0.5 text-slate-400 hover:text-cyan-400 disabled:opacity-30"
                      aria-label="Move up"
                    >
                      <ArrowUp className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => move(index, 'down')}
                      disabled={index === list.length - 1}
                      className="p-0.5 text-slate-400 hover:text-cyan-400 disabled:opacity-30"
                      aria-label="Move down"
                    >
                      <ArrowDown className="w-4 h-4" />
                    </button>
                  </div>
                  <input
                    type="number"
                    min={1}
                    max={list.length}
                    defaultValue={index + 1}
                    className="w-9 h-7 text-center text-sm tabular-nums rounded bg-slate-700/80 border border-slate-600 text-slate-200 focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30 focus:outline-none"
                    aria-label={`Position 1–${list.length}`}
                    onBlur={(e) => {
                      const n = parseInt(e.target.value, 10);
                      if (!Number.isNaN(n)) moveToPosition(index, n);
                      e.target.value = String(index + 1);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.currentTarget.blur();
                      }
                    }}
                  />
                  <GripVertical className="w-4 h-4 text-slate-600 flex-shrink-0" />
                  {/* Logo: uploaded/custom first, else DexScreener fallback */}
                  <div className="flex-shrink-0 w-9 h-9 rounded-full bg-slate-700/50 flex items-center justify-center overflow-hidden">
                    {(() => {
                      const src = row.logo_url || dexLogoCache[row.token_address];
                      if (!src) {
                        fetchDexLogo(row.token_address);
                        return <span className="text-slate-500 text-xs">—</span>;
                      }
                      return (
                        <img
                          src={src}
                          alt=""
                          className="w-full h-full object-cover"
                          onError={() => fetchDexLogo(row.token_address)}
                        />
                      );
                    })()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-slate-200 truncate" title={row.token_address}>
                      {row.name || row.symbol || `${row.token_address.slice(0, 10)}…${row.token_address.slice(-8)}`}
                    </div>
                    <div className="text-xs text-slate-500 font-mono truncate" title={row.token_address}>
                      {(row.name || row.symbol) ? `${row.token_address.slice(0, 8)}…${row.token_address.slice(-6)}` : row.token_address}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => openProfileModal(row.token_address)}
                    className="p-1.5 rounded text-cyan-400 hover:bg-cyan-500/20"
                    title="Edit profile (description, logo, links)"
                  >
                    <FileText className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeBadge(row.token_address)}
                    className="p-1.5 rounded text-red-400 hover:bg-red-500/20"
                    aria-label="Remove"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {profileModalAddress && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-gradient-to-br from-slate-900 to-slate-800 border-2 border-cyan-500/30 rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-hidden flex flex-col">
              <div className="p-4 border-b border-slate-700">
                <h3 className="text-lg font-semibold text-cyan-400">Token profile</h3>
                <p className="text-xs text-slate-500 font-mono mt-0.5 truncate">{profileModalAddress}</p>
              </div>
              <form onSubmit={saveProfile} className="p-4 overflow-y-auto flex-1 space-y-4">
                {profileLoading ? (
                  <p className="text-slate-500">Loading…</p>
                ) : (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-slate-400 mb-1">Description</label>
                      <textarea
                        value={profileForm.description}
                        onChange={(e) => setProfileForm((f) => ({ ...f, description: e.target.value }))}
                        rows={4}
                        placeholder="Custom description for token profile tab"
                        className="w-full px-3 py-2 rounded-lg bg-slate-800/80 border border-cyan-500/30 text-white placeholder-slate-500 text-sm resize-y"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-400 mb-1">Logo (URL or upload)</label>
                      <div className="flex gap-2">
                        <input
                          type="url"
                          value={profileForm.logo_url}
                          onChange={(e) => setProfileForm((f) => ({ ...f, logo_url: e.target.value }))}
                          placeholder="https://… or upload below"
                          className="flex-1 min-w-0 px-3 py-2 rounded-lg bg-slate-800/80 border border-cyan-500/30 text-white placeholder-slate-500 text-sm"
                        />
                        <input
                          ref={logoFileInputRef}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          aria-label="Upload logo image"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            setError(null);
                            const result = await uploadBlob(file);
                            if (result?.url) {
                              setProfileForm((f) => ({ ...f, logo_url: result.url }));
                            } else {
                              setError('Upload failed. Add BLOB_READ_WRITE_TOKEN to .env for Vercel Blob, or paste a logo URL instead.');
                            }
                            e.target.value = '';
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => logoFileInputRef.current?.click()}
                          disabled={isUploadingLogo}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-cyan-500/30 text-cyan-400 text-sm hover:bg-cyan-500/10 disabled:opacity-50"
                        >
                          <Upload className="w-4 h-4" /> {isUploadingLogo ? 'Uploading…' : 'Upload'}
                        </button>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">Uses custom logo if set; otherwise DexScreener logo is shown.</p>
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-sm font-medium text-slate-400">Custom links</label>
                        <button type="button" onClick={addProfileLink} className="text-xs text-cyan-400 hover:underline flex items-center gap-1">
                          <LinkIcon className="w-3 h-3" /> Add link
                        </button>
                      </div>
                      <div className="space-y-2">
                        {profileForm.custom_links.map((link, i) => (
                          <div key={i} className="flex gap-2 items-center">
                            <input
                              value={link.label}
                              onChange={(e) => updateProfileLink(i, 'label', e.target.value)}
                              placeholder="Label"
                              className="flex-1 min-w-0 px-3 py-1.5 rounded-lg bg-slate-800/80 border border-cyan-500/30 text-white placeholder-slate-500 text-sm"
                            />
                            <input
                              type="url"
                              value={link.url}
                              onChange={(e) => updateProfileLink(i, 'url', e.target.value)}
                              placeholder="https://…"
                              className="flex-1 min-w-0 px-3 py-1.5 rounded-lg bg-slate-800/80 border border-cyan-500/30 text-white placeholder-slate-500 text-sm"
                            />
                            <button
                              type="button"
                              onClick={() => removeProfileLink(i)}
                              disabled={profileForm.custom_links.length <= 1}
                              className="p-1.5 rounded text-red-400 hover:bg-red-500/20 disabled:opacity-30"
                              aria-label="Remove link"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={closeProfileModal}
                    className="flex-1 py-2 rounded-lg border border-slate-600 text-slate-400 hover:bg-white/5"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={profileLoading || profileSaving}
                    className="flex-1 py-2 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 text-white font-medium hover:opacity-90 disabled:opacity-50"
                  >
                    {profileSaving ? 'Saving…' : 'Save profile'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        <p className="text-slate-500 text-sm">
          TokenTable and TopTickerBar use this list. Set <code className="bg-slate-800 px-1 rounded">GOLD_ADMIN_SECRET</code> or{' '}
          <code className="bg-slate-800 px-1 rounded">ADMIN_SECRET</code> in .env to protect add/remove/reorder.
        </p>
      </div>
    </div>
  );
}

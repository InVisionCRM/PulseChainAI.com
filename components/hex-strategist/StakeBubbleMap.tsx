'use client';

// HEX stake bubble map — every staker is one bubble, sized by their total
// active staked HEX (all their stakes bundled together). Direct HEX transfers
// between stakers draw edges, and linked wallets tint into clusters — the same
// signal as the holder bubble map. Click a bubble to open a modal with each of
// that address's active stakes and its full HEX stake history.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  forceSimulation, forceManyBody, forceCollide, forceLink, forceX, forceY,
  type Simulation, type ForceX, type ForceY,
} from 'd3-force';
import { IconRefresh, IconExternalLink, IconX, IconMaximize, IconMinimize, IconCopy, IconCheck, IconCirclePlus } from '@tabler/icons-react';
import { createPortal } from 'react-dom';
import { type Network, type Rates, loadRates } from '@/lib/hex/strategistData';
import { fmtHex, fmtTShares, fmtDuration, fmtHexDate, fmtUsdShort, HEX_ADDRESS } from '@/lib/hex/hexDay';
import { HexAmount } from '@/components/hex/HexAmount';
import { pulsechainAddressUrl } from '@/lib/pulsechainExplorer';
import { usePortfolioStore } from '@/lib/stores/portfolioStore';
import { HexStakes } from '@/components/portfolio/HexStakes';

interface StakeInfo {
  stakeId: string; principalHex: number; tShares: number;
  startDay: number; endDay: number; daysToEnd: number; progressPct: number;
}
interface ApiBubble {
  address: string; totalHex: number; tShares: number; stakeCount: number;
  label: string | null; isContract: boolean; category: string | null; stakes: StakeInfo[];
}
interface ApiEdge { from: string; to: string; count: number }

interface BNode extends ApiBubble {
  cluster: number; color: string; r: number; short: string;
  x: number; y: number; vx: number; vy: number; fx: number | null; fy: number | null; pinned: boolean;
}
interface BEdge { a: number; b: number }

const LIMIT_OPTIONS: { v: number; label: string }[] = [
  { v: 50, label: '50' }, { v: 250, label: '250' }, { v: 500, label: '500' }, { v: 1000, label: 'All' },
];
// Lowest option by default — fastest first paint; larger counts are one click away.
const DEFAULT_LIMIT = LIMIT_OPTIONS[0].v;
const CLUSTER_PALETTE = ['#f59e0b', '#a855f7', '#22d3ee', '#34d399', '#f472b6', '#60a5fa', '#fb923c', '#a3e635', '#e879f9', '#2dd4bf'];
const SOLO = '#8b5cf6'; // a staker with no detected link

const addrUrl = (net: Network, a: string) => (net === 'ethereum' ? `https://etherscan.io/address/${a}` : pulsechainAddressUrl(a));
const truncate = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;
function hexA(h: string, a: number) { const n = parseInt(h.slice(1), 16); return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`; }

export default function StakeBubbleMap({ net }: { net: Network }) {
  const [limit, setLimit] = useState(DEFAULT_LIMIT);
  const [fs, setFs] = useState(false);
  const [status, setStatus] = useState<'loading' | 'ready' | 'empty' | 'error'>('loading');
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [selected, setSelected] = useState<BNode | null>(null);
  const [rates, setRates] = useState<Rates | null>(null);
  const [meta, setMeta] = useState<{ bubbles: number; clusters: number }>({ bubbles: 0, clusters: 0 });

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const tipRef = useRef<HTMLDivElement | null>(null);
  const dataRef = useRef<{ nodes: BNode[]; edges: BEdge[] } | null>(null);
  const selectedRef = useRef<BNode | null>(null);
  const simRef = useRef<Simulation<BNode, undefined> | null>(null);
  const viewRef = useRef({ scale: 0.92, ox: 0, oy: 0 });

  useEffect(() => { loadRates(net).then(setRates).catch(() => {}); }, [net]);

  const load = useCallback(async () => {
    setStatus('loading');
    setErrMsg(null);
    setSelected(null);
    selectedRef.current = null;
    try {
      const res = await fetch(`/api/hex/stake-bubbles?network=${net}&limit=${limit}`);
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      const apiBubbles: ApiBubble[] = data.bubbles ?? [];
      if (apiBubbles.length === 0) { dataRef.current = null; setStatus('empty'); return; }

      const clusterOf = new Map<string, number>();
      (data.clusters as string[][] | undefined)?.forEach((members, ci) => {
        for (const a of members) clusterOf.set(a.toLowerCase(), ci);
      });

      const maxHex = Math.max(1, ...apiBubbles.map((b) => b.totalHex));
      const nodes: BNode[] = apiBubbles.map((b) => {
        const cluster = clusterOf.get(b.address) ?? -1;
        const color = cluster >= 0 ? CLUSTER_PALETTE[cluster % CLUSTER_PALETTE.length] : SOLO;
        return {
          ...b,
          cluster,
          color,
          r: 5 + Math.sqrt(b.totalHex / maxHex) * 34,
          short: truncate(b.address),
          x: 0, y: 0, vx: 0, vy: 0, fx: null, fy: null, pinned: false,
        };
      });
      const idx = new Map(nodes.map((n, i) => [n.address, i]));
      const edges: BEdge[] = [];
      for (const e of (data.edges as ApiEdge[] | undefined) ?? []) {
        const a = idx.get(e.from.toLowerCase());
        const b = idx.get(e.to.toLowerCase());
        if (a != null && b != null) edges.push({ a, b });
      }
      dataRef.current = { nodes, edges };
      setMeta({ bubbles: nodes.length, clusters: (data.clusters ?? []).length });
      setStatus('ready');
    } catch (e) {
      setErrMsg(e instanceof Error ? e.message : null);
      setStatus('error');
    }
  }, [net, limit]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!fs) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setFs(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [fs]);

  // Canvas + d3-force (same Barnes-Hut setup as the holder bubble map).
  useEffect(() => {
    if (status !== 'ready' || !dataRef.current) return;
    const cvs = canvasRef.current!;
    const ctx = cvs.getContext('2d')!;
    const tip = tipRef.current!;
    const DPR = Math.min(window.devicePixelRatio || 1, 2);
    const data = dataRef.current;
    const nodes = data.nodes;
    const view = viewRef.current;
    let W = 0, H = 0, cx = 0, cy = 0, raf = 0;
    let hover: BNode | null = null;
    let drag: BNode | null = null;
    let ddx = 0, ddy = 0;
    let moved = false;

    function measure() {
      const r = cvs.getBoundingClientRect();
      W = r.width; H = Math.max(1, r.height);
      cvs.width = W * DPR; cvs.height = H * DPR;
      view.scale = 0.92; view.ox = W * 0.04; view.oy = H * 0.04;
      cx = W / 2; cy = H / 2;
    }
    measure();
    nodes.forEach((n, i) => { const a = i * 2.399, rad = 12 + Math.sqrt(i) * 18; n.x = cx + Math.cos(a) * rad; n.y = cy + Math.sin(a) * rad; });

    const fxF: ForceX<BNode> = forceX<BNode>(cx).strength(0.045);
    const fyF: ForceY<BNode> = forceY<BNode>(cy).strength(0.045);
    const links = data.edges.map((e) => ({ source: e.a, target: e.b }));
    const sim = forceSimulation<BNode>(nodes)
      .alphaDecay(0.02).velocityDecay(0.32)
      .force('charge', forceManyBody<BNode>().strength(-20).theta(0.85).distanceMax(320))
      .force('collide', forceCollide<BNode>().radius((d) => d.r + 1.5))
      .force('x', fxF).force('y', fyF)
      .force('link', links.length ? forceLink(links).distance(46).strength(0.6) : null)
      .stop();
    simRef.current = sim;
    for (let i = 0; i < 90; i++) sim.tick();

    function drawNode(n: BNode) {
      const hov = n === hover, sel = n === selectedRef.current, r = n.r;
      ctx.fillStyle = n.color;
      ctx.beginPath(); ctx.arc(n.x, n.y, r, 0, 6.2832); ctx.fill();
      ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath(); ctx.arc(n.x, n.y, r - 0.5, 0, 6.2832); ctx.stroke();
      // Multiple stakes → a thin inner ring hints at the bundle.
      if (n.stakeCount > 1 && r > 6) {
        ctx.lineWidth = 1.4; ctx.strokeStyle = 'rgba(255,255,255,0.45)';
        ctx.beginPath(); ctx.arc(n.x, n.y, r * 0.55, 0, 6.2832); ctx.stroke();
      }
      if (hov || sel) {
        ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(255,255,255,0.9)';
        ctx.beginPath(); ctx.arc(n.x, n.y, r + 2.5, 0, 6.2832); ctx.stroke();
      }
      if (n.pinned) {
        ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(255,255,255,0.45)'; ctx.setLineDash([2.5, 3]);
        ctx.beginPath(); ctx.arc(n.x, n.y, r + 4.5, 0, 6.2832); ctx.stroke(); ctx.setLineDash([]);
      }
      if (hov || n.label || r > 18) {
        const txt = n.label || fmtHex(n.totalHex);
        ctx.font = '600 10px ui-sans-serif,system-ui,sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        if (r > 22 && !n.label) { ctx.fillStyle = 'rgba(0,0,0,0.8)'; ctx.fillText(txt, n.x, n.y); }
        else if (hov || n.label) {
          const w = ctx.measureText(txt).width, ty = n.y + r + 8;
          ctx.fillStyle = 'rgba(8,16,28,0.82)'; ctx.fillRect(n.x - w / 2 - 4, ty - 7, w + 8, 14);
          ctx.fillStyle = 'rgba(226,232,240,0.95)'; ctx.fillText(txt, n.x, ty);
        }
      }
    }
    function draw() {
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      ctx.fillStyle = '#0a1525'; ctx.fillRect(0, 0, W, H);
      const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.12, W / 2, H / 2, Math.max(W, H) * 0.7);
      g.addColorStop(0, 'rgba(140,92,246,0.06)'); g.addColorStop(1, 'rgba(0,0,0,0.3)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      ctx.setTransform(DPR * view.scale, 0, 0, DPR * view.scale, view.ox * DPR, view.oy * DPR);
      const focus = hover || selectedRef.current;
      const fc = focus && focus.cluster >= 0 ? focus.cluster : null;
      const lit = (n: BNode) => (!focus ? true : n === focus || (fc != null && n.cluster === fc));
      for (const e of data.edges) {
        const a = nodes[e.a], b = nodes[e.b]; if (!a || !b) continue;
        const on = !focus || lit(a) || lit(b);
        ctx.globalAlpha = on ? 0.5 : 0.06; ctx.lineWidth = on ? 1.4 : 0.6;
        ctx.strokeStyle = hexA(a.color, 0.8);
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      }
      ctx.globalAlpha = 1;
      for (const n of nodes) { ctx.globalAlpha = lit(n) ? 1 : 0.16; drawNode(n); }
      ctx.globalAlpha = 1;
    }
    function frame() {
      sim.tick();
      for (const n of nodes) {
        if (n.fx == null) { const pad = n.r + 4; n.x = Math.max(pad, Math.min(W - pad, n.x)); n.y = Math.max(pad, Math.min(H - pad, n.y)); }
      }
      draw(); raf = requestAnimationFrame(frame);
    }
    function mpos(e: MouseEvent) { const r = cvs.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
    function toWorld(sx: number, sy: number) { return { x: (sx - view.ox) / view.scale, y: (sy - view.oy) / view.scale }; }
    function pick(p: { x: number; y: number }) {
      let best = 1e9, f: BNode | null = null;
      for (const n of nodes) { const d = Math.hypot(n.x - p.x, n.y - p.y); if (d < n.r + 5 / view.scale && d < best) { best = d; f = n; } }
      return f;
    }
    function showTip(n: BNode) {
      const sub = 'font-size:11px;color:rgba(255,255,255,.55);margin-top:1px';
      const row = 'color:rgba(255,255,255,.8);margin-top:2px';
      let html = `<div style="display:flex;align-items:center;gap:6px;font-weight:600"><span style="width:9px;height:9px;border-radius:50%;flex:none;background:${n.color}"></span>${n.label || n.short}</div>`;
      html += `<div style="${sub}">${n.short}</div>`;
      html += `<div style="${row};display:flex;align-items:center;gap:4px"><img src="/hex-logo.svg" alt="" style="width:11px;height:11px"/>${fmtHex(n.totalHex)} HEX · ${n.stakeCount} stake${n.stakeCount === 1 ? '' : 's'}</div>`;
      if (n.cluster >= 0) html += `<div style="${row}">Cluster #${n.cluster + 1}</div>`;
      tip.innerHTML = html; tip.style.opacity = '1';
      const sx = n.x * view.scale + view.ox, sy = n.y * view.scale + view.oy;
      let tx = sx + 16; if (tx > W - 168) tx = sx - 168;
      tip.style.left = `${tx}px`; tip.style.top = `${Math.max(2, sy - 12)}px`;
    }
    const hideTip = () => { tip.style.opacity = '0'; };
    const onMove = (e: MouseEvent) => {
      const sp = mpos(e), p = toWorld(sp.x, sp.y);
      if (drag) { moved = true; drag.fx = p.x - ddx; drag.fy = p.y - ddy; showTip(drag); return; }
      hover = pick(p); cvs.style.cursor = hover ? 'pointer' : 'default';
      if (hover) showTip(hover); else hideTip();
    };
    const onDown = (e: MouseEvent) => {
      const sp = mpos(e), p = toWorld(sp.x, sp.y), n = pick(p);
      moved = false;
      if (n) { drag = n; n.fx = n.x; n.fy = n.y; ddx = p.x - n.x; ddy = p.y - n.y; sim.alphaTarget(0.2).restart(); }
    };
    const onUp = () => {
      if (drag) {
        // A click (no real drag) opens the detail modal; a drag pins the node.
        if (!moved) { selectedRef.current = drag; setSelected(drag); }
        else drag.pinned = true;
        drag = null; sim.alphaTarget(0);
      }
    };
    const onDbl = (e: MouseEvent) => {
      const sp = mpos(e), p = toWorld(sp.x, sp.y), n = pick(p);
      if (n) { n.fx = null; n.fy = null; n.pinned = false; sim.alpha(0.4); }
    };
    const onLeave = () => { if (!drag) { hover = null; hideTip(); } };
    const onResize = () => { measure(); fxF.x(cx); fyF.y(cy); sim.alpha(0.4); };

    cvs.addEventListener('mousemove', onMove);
    cvs.addEventListener('mousedown', onDown);
    window.addEventListener('mouseup', onUp);
    cvs.addEventListener('dblclick', onDbl);
    cvs.addEventListener('mouseleave', onLeave);
    window.addEventListener('resize', onResize);
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf); sim.stop(); simRef.current = null;
      cvs.removeEventListener('mousemove', onMove);
      cvs.removeEventListener('mousedown', onDown);
      window.removeEventListener('mouseup', onUp);
      cvs.removeEventListener('dblclick', onDbl);
      cvs.removeEventListener('mouseleave', onLeave);
      window.removeEventListener('resize', onResize);
    };
  }, [status, fs]);

  const legend = useMemo(() => {
    const items = [{ label: 'Staker', color: SOLO }];
    if (meta.clusters > 0) items.unshift({ label: `${meta.clusters} cluster${meta.clusters === 1 ? '' : 's'}`, color: CLUSTER_PALETTE[0] });
    return items;
  }, [meta.clusters]);

  const card = (
    <div className={fs ? 'fixed inset-0 z-[200] flex flex-col bg-[var(--app-bg)] p-3 sm:p-4' : 'rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-3'}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
          Stake bubble map
          {status === 'ready' && <span className="font-normal normal-case text-[var(--text-faint)]">{meta.bubbles.toLocaleString()} stakers</span>}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center overflow-hidden rounded-md border border-[var(--line)]">
            {LIMIT_OPTIONS.map((o) => (
              <button
                key={o.v}
                type="button"
                onClick={() => { if (o.v !== limit) setLimit(o.v); }}
                disabled={status === 'loading'}
                className={`px-2 py-0.5 text-[11px] font-semibold tabular-nums transition-colors disabled:opacity-40 ${o.v === limit ? 'bg-[var(--surface-2)] text-[var(--text)]' : 'text-[var(--text-faint)] hover:text-[var(--text)]'}`}
                title={`Top ${o.label} stakes`}
              >
                {o.label}
              </button>
            ))}
          </div>
          <button type="button" onClick={() => void load()} disabled={status === 'loading'} className="text-[var(--text-faint)] hover:text-[var(--text)] disabled:opacity-40" title="Re-scan">
            <IconRefresh className={`h-4 w-4 ${status === 'loading' ? 'animate-spin' : ''}`} />
          </button>
          <button type="button" onClick={() => setFs((v) => !v)} className="text-[var(--text-faint)] hover:text-[var(--text)]" title={fs ? 'Exit full screen (Esc)' : 'Full screen'}>
            {fs ? <IconMinimize className="h-4 w-4" /> : <IconMaximize className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {status === 'error' ? (
        <div className="rounded border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-200">
          Couldn’t build the stake bubble map.{errMsg ? ` ${errMsg}` : ''}
        </div>
      ) : status === 'empty' ? (
        <div className="py-10 text-center text-sm text-[var(--text-faint)]">No active stakes found on {net}.</div>
      ) : status === 'loading' ? (
        <div className={`grid place-items-center rounded-lg bg-[var(--surface)] ${fs ? 'flex-1' : 'h-[460px]'}`}>
          <span className="inline-flex items-center gap-2 text-sm text-[var(--text-faint)]"><IconRefresh className="h-4 w-4 animate-spin" /> Building bubbles…</span>
        </div>
      ) : (
        <>
          <div className={fs ? 'relative w-full flex-1 min-h-0' : 'relative w-full'}>
            <canvas ref={canvasRef} role="img" aria-label="Stake bubble map" className="block w-full rounded-lg border border-[var(--line)]" style={{ height: fs ? '100%' : 460 }} />
            <div ref={tipRef} className="pointer-events-none absolute z-10 max-w-[200px] rounded-[10px] border border-[var(--line)] px-2.5 py-2 text-xs leading-snug text-[var(--text)] opacity-0 transition-opacity" style={{ background: 'rgba(6,18,34,.94)' }} />
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[var(--text-faint)]">
            {legend.map((l) => (
              <span key={l.label} className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: l.color }} />{l.label}</span>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-[var(--text-muted)]">
            Bubble size = total active staked HEX (all of an address’s stakes bundled) · inner ring = more than one stake · lines = direct HEX transfers between stakers · clusters = likely-linked wallets. Click a bubble for stake details · drag to pin.
          </p>
        </>
      )}
    </div>
  );

  return (
    <>
      {fs && typeof document !== 'undefined' ? createPortal(card, document.body) : card}
      {selected && (
        <StakeModal node={selected} net={net} rates={rates} onClose={() => { selectedRef.current = null; setSelected(null); }} />
      )}
    </>
  );
}

function StakeModal({ node, net, rates, onClose }: { node: BNode; net: Network; rates: Rates | null; onClose: () => void }) {
  const [tab, setTab] = useState<'stakes' | 'history'>('stakes');
  const usd = (hex: number) => (rates?.priceUsd ? hex * rates.priceUsd : null);

  return (
    <div className="fixed inset-0 z-[210] flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div className="flex h-[80vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl border border-[var(--line)] bg-[var(--panel)] mb-16 sm:mb-0 sm:max-h-[85vh] sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-2 border-b border-[var(--line)] p-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: node.color }} />
              <a href={addrUrl(net, node.address)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-mono text-sm text-[var(--text)] hover:text-purple-300">
                {node.label ?? truncate(node.address)}
                <IconExternalLink className="h-3.5 w-3.5 text-[var(--text-faint)]" />
              </a>
              {node.cluster >= 0 && (
                <span className="shrink-0 rounded px-1.5 py-px text-[9px] font-bold uppercase" style={{ color: node.color, background: hexA(node.color, 0.18) }}>Cluster #{node.cluster + 1}</span>
              )}
              <AddrActions address={node.address} net={net} />
            </div>
            <div className="flex flex-wrap items-center gap-1 mt-0.5 text-[11px] text-[var(--text-muted)] tabular-nums">
              <HexAmount hex={node.totalHex} />{usd(node.totalHex) != null ? ` · ${fmtUsdShort(usd(node.totalHex))}` : ''} · {fmtTShares(node.tShares)} T · {node.stakeCount} active stake{node.stakeCount === 1 ? '' : 's'}
            </div>
          </div>
          <button type="button" onClick={onClose} className="text-[var(--text-faint)] hover:text-[var(--text)]"><IconX className="h-5 w-5" /></button>
        </div>

        <div className="px-3 pt-3">
          <div className="inline-flex rounded-lg border border-[var(--line)] bg-[var(--surface)] p-0.5">
            <button onClick={() => setTab('stakes')} className={`rounded-md px-3 py-1 text-xs font-semibold ${tab === 'stakes' ? 'bg-[var(--surface-2)] text-purple-300' : 'text-[var(--text-muted)]'}`}>Active stakes ({node.stakeCount})</button>
            <button onClick={() => setTab('history')} className={`rounded-md px-3 py-1 text-xs font-semibold ${tab === 'history' ? 'bg-[var(--surface-2)] text-purple-300' : 'text-[var(--text-muted)]'}`}>Full history</button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {tab === 'stakes' ? (
            <div className="space-y-2">
              {node.stakes.map((s) => (
                <div key={s.stakeId} className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3">
                  <div className="flex items-center justify-between text-sm">
                    <HexAmount hex={s.principalHex} className="font-semibold text-[var(--text)]" />
                    <span className="text-[var(--text-muted)] tabular-nums">{fmtTShares(s.tShares)} T</span>
                  </div>
                  <div className="mt-1 flex items-center justify-between text-[11px] text-[var(--text-muted)] tabular-nums">
                    <span>Ends {fmtHexDate(s.endDay)} · in {fmtDuration(s.daysToEnd)}</span>
                    <span>{s.progressPct.toFixed(0)}% served</span>
                  </div>
                  <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-2)]">
                    <div className="h-full rounded-full bg-purple-500" style={{ width: `${s.progressPct}%` }} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <HexStakes address={node.address} hexUsd={rates?.priceUsd ?? null} payoutPerTShare={rates?.dailyPayoutPerTShare ?? null} />
          )}
        </div>
      </div>
    </div>
  );
}

function AddrActions({ address, net }: { address: string; net: Network }) {
  const addWallet = usePortfolioStore((s) => s.addWallet);
  const [copied, setCopied] = useState(false);
  const [added, setAdded] = useState(false);
  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        title="Copy address"
        onClick={() => navigator.clipboard?.writeText(address).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1200); }, () => {})}
        className="text-[var(--text-faint)] hover:text-[var(--text)]"
      >
        {copied ? <IconCheck className="h-4 w-4 text-[var(--up)]" /> : <IconCopy className="h-4 w-4" />}
      </button>
      <button
        type="button"
        title="Add to portfolio"
        onClick={() => { addWallet(address, undefined, [net]); setAdded(true); setTimeout(() => setAdded(false), 1600); }}
        className="text-[var(--text-faint)] hover:text-purple-300"
      >
        {added ? <IconCheck className="h-4 w-4 text-[var(--up)]" /> : <IconCirclePlus className="h-4 w-4" />}
      </button>
    </div>
  );
}

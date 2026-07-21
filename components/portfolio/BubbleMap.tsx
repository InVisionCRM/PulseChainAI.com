'use client';

// Holder bubble map — a token's top holders as an interactive force-directed
// graph. Each bubble is a holder sized by its share of supply; edges are direct
// transfers of the token between two holders, and connected holders are tinted
// into clusters (wallets likely controlled together). This is our own,
// chain-agnostic take on Bubblemaps — it works across every chain the app
// supports (PulseChain, Robinhood, …), including ones Bubblemaps doesn't.
//
// Two independent costs, decoupled so we can show lots of bubbles without a long
// wait:
//   • Bubbles  — /api/portfolio/holders (cheap paginated fetch). Rendered with a
//     d3-force Barnes-Hut simulation (O(n log n)), so 500–1000 nodes stay smooth.
//   • Clusters — /api/portfolio/holder-graph, computed over the TOP `edgeLimit`
//     holders only (one transfer scan each), so first-load is ~constant no
//     matter how many bubbles are shown. Contracts (LP pair, routers, CEX) are
//     excluded from clusters server-side but still render as bubbles.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  forceSimulation,
  forceManyBody,
  forceCollide,
  forceLink,
  forceX,
  forceY,
  type Simulation,
  type ForceX,
  type ForceY,
} from 'd3-force';
import { createPortal } from 'react-dom';
import { IconRefresh, IconExternalLink, IconX, IconMaximize, IconMinimize } from '@tabler/icons-react';
import type { ChainId } from '@/services';
import type { AddressCategory } from '@/lib/gumshoe/address-labels';
import { AddToGroupButton } from '@/components/portfolio/AddToGroupButton';

// Clusters are only computed for the top N holders (the whales + mid-tier where
// linked-wallet signal lives); dust holders rarely cluster and aren't worth a
// network call each. Kept constant so wait time doesn't grow with bubble count.
const EDGE_LIMIT = 150;
const NODE_OPTIONS = [250, 500, 1000] as const;
// Default to the lowest option for the fastest first paint — bigger counts are
// one click away, and clusters always cover the top EDGE_LIMIT regardless.
const DEFAULT_LIMIT = NODE_OPTIONS[0];

// Bubble radius bounds. A gentle power curve (< 0.5) spreads the mid/small
// holders out so sizes vary visibly instead of collapsing to a dot when one
// holder dominates; MAX_R hard-caps the biggest bubble so a single whale can't
// swallow the map.
const MIN_R = 5;
const MAX_R = 52;
const SIZE_POWER = 0.4;
const bubbleRadius = (pct: number, maxPct: number) =>
  Math.max(MIN_R, Math.min(MAX_R, MIN_R + Math.pow(Math.max(0, pct) / maxPct, SIZE_POWER) * (MAX_R - MIN_R)));

const EXPLORER_ADDRESS: Record<ChainId, string> = {
  ethereum: 'https://etherscan.io/address/',
  pulsechain: 'https://scan.pulsechain.com/address/',
  robinhood: 'https://robinhoodchain.blockscout.com/address/',
};

const CLUSTER_PALETTE = [
  '#f59e0b', '#a855f7', '#22d3ee', '#34d399', '#f472b6',
  '#60a5fa', '#fb923c', '#a3e635', '#e879f9', '#2dd4bf',
];
const CATEGORY_COLOR: Partial<Record<AddressCategory, string>> = {
  burn: '#64748b',
  locker: '#22c55e',
  exchange: '#3b82f6',
  router: '#64748b',
  factory: '#64748b',
  wrapped: '#64748b',
  ofac: '#ef4444',
};
const CONTRACT_COLOR = '#7c3aed'; // unlabelled contract — usually the LP pair
const EOA_COLOR = '#5eead4'; // plain holder, no detected cluster

const truncate = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;
const fmtPct = (n: number) => (n >= 1 ? n.toFixed(2) : n >= 0.01 ? n.toFixed(3) : n.toFixed(4));
function hexA(h: string, a: number) {
  const n = parseInt(h.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

interface ApiNode {
  address: string;
  pctSupply: number;
  isContract: boolean;
  label: string | null;
  category: AddressCategory | null;
}
interface ApiEdge { from: string; to: string; count: number }

interface BNode {
  address: string;
  pct: number;
  isContract: boolean;
  label: string | null;
  category: AddressCategory | null;
  cluster: number; // -1 = none
  color: string;
  r: number;
  short: string;
  // d3-force mutates these:
  x: number; y: number; vx: number; vy: number;
  fx: number | null; fy: number | null;
  pinned: boolean;
}
interface BEdge { a: number; b: number }

function nodeColor(n: { category: AddressCategory | null; cluster: number; isContract: boolean }) {
  if (n.category && CATEGORY_COLOR[n.category]) return CATEGORY_COLOR[n.category]!;
  if (n.cluster >= 0) return CLUSTER_PALETTE[n.cluster % CLUSTER_PALETTE.length];
  if (n.isContract) return CONTRACT_COLOR;
  return EOA_COLOR;
}

interface Props {
  /** ERC-20 contract address (native coins must be passed as their wrapped address). */
  token: string;
  chain: ChainId;
  symbol?: string;
}

export function BubbleMap({ token, chain, symbol }: Props) {
  const [limit, setLimit] = useState<number>(DEFAULT_LIMIT);
  const [fs, setFs] = useState(false);
  const [status, setStatus] = useState<'loading' | 'ready' | 'empty' | 'error'>('loading');
  const [edgesStatus, setEdgesStatus] = useState<'idle' | 'loading' | 'done'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<BNode | null>(null);
  const [meta, setMeta] = useState<{
    holders: number | null;
    clusters: number;
    shown: number;
    partial: boolean;
    scanned: number;
  }>({ holders: null, clusters: 0, shown: 0, partial: false, scanned: 0 });

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const tipRef = useRef<HTMLDivElement | null>(null);
  const dataRef = useRef<{ nodes: BNode[]; edges: BEdge[] } | null>(null);
  const selectedRef = useRef<BNode | null>(null);
  const simRef = useRef<Simulation<BNode, undefined> | null>(null);
  // Lets the async edge fetch reheat the running simulation once links arrive.
  const applyLinksRef = useRef<(() => void) | null>(null);
  const viewRef = useRef({ scale: 0.92, ox: 0, oy: 0 });

  const load = useCallback(async () => {
    setStatus('loading');
    setEdgesStatus('idle');
    setError(null);
    setSelected(null);
    selectedRef.current = null;

    try {
      const res = await fetch('/api/portfolio/holders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: token, chain, limit }),
      });
      if (!res.ok) {
        if (res.status === 404) { dataRef.current = null; setStatus('empty'); return; }
        throw new Error(`Holders request failed (${res.status})`);
      }
      const data = await res.json();
      const apiNodes: ApiNode[] = data.nodes ?? [];
      if (apiNodes.length === 0) { dataRef.current = null; setStatus('empty'); return; }

      const maxPct = Math.max(0.0001, ...apiNodes.map((n) => n.pctSupply));
      const nodes: BNode[] = apiNodes.map((n) => {
        const base = { category: n.category, cluster: -1, isContract: n.isContract };
        return {
          address: n.address,
          pct: n.pctSupply,
          isContract: n.isContract,
          label: n.label,
          category: n.category,
          cluster: -1,
          color: nodeColor(base),
          r: bubbleRadius(n.pctSupply, maxPct),
          short: truncate(n.address),
          x: 0, y: 0, vx: 0, vy: 0, fx: null, fy: null, pinned: false,
        };
      });
      dataRef.current = { nodes, edges: [] };
      setMeta({ holders: data.holdersCount ?? null, clusters: 0, shown: nodes.length, partial: false, scanned: 0 });
      setStatus('ready');

      // Phase 2: edges + clusters over the top EDGE_LIMIT holders. Mutates live
      // node/edge objects and reheats the running sim so clusters pull together.
      setEdgesStatus('loading');
      void fetch('/api/portfolio/holder-graph', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: token, chain, edgeLimit: EDGE_LIMIT }),
        // Safety net — the server budgets the scan to ~28s, this guards a hang.
        signal: AbortSignal.timeout(45_000),
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((g) => {
          const cur = dataRef.current;
          if (!g || !cur) { setEdgesStatus('done'); return; }
          const idx = new Map(cur.nodes.map((n, i) => [n.address, i]));
          const clusters: string[][] = g.clusters ?? [];
          clusters.forEach((members: string[], ci: number) => {
            for (const addr of members) {
              const i = idx.get(addr.toLowerCase());
              if (i == null) continue;
              const n = cur.nodes[i];
              n.cluster = ci;
              n.color = nodeColor(n);
            }
          });
          const apiEdges: ApiEdge[] = g.edges ?? [];
          const edges: BEdge[] = [];
          for (const e of apiEdges) {
            const a = idx.get(e.from.toLowerCase());
            const b = idx.get(e.to.toLowerCase());
            if (a != null && b != null) edges.push({ a, b });
          }
          cur.edges.length = 0;
          cur.edges.push(...edges);
          applyLinksRef.current?.();
          setMeta((m) => ({ ...m, clusters: clusters.length, partial: !!g.partial, scanned: g.scannedHolders ?? 0 }));
          setEdgesStatus('done');
        })
        .catch(() => setEdgesStatus('done'));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to build bubble map');
      setStatus('error');
    }
  }, [token, chain, limit]);

  useEffect(() => { void load(); }, [load]);

  // Exit fullscreen on Escape.
  useEffect(() => {
    if (!fs) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setFs(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [fs]);

  // Canvas render + d3-force (Barnes-Hut) simulation. Reads dataRef each frame
  // so edges that arrive in phase 2 are incorporated live.
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

    function measure() {
      const r = cvs.getBoundingClientRect();
      W = r.width; H = Math.max(1, r.height);
      cvs.width = W * DPR; cvs.height = H * DPR;
      view.scale = 0.92; view.ox = W * 0.04; view.oy = H * 0.04;
      cx = W / 2; cy = H / 2;
    }
    measure();
    // Seed on a phyllotaxis spiral so the sim settles fast and deterministically.
    nodes.forEach((n, i) => {
      const a = i * 2.399, rad = 12 + Math.sqrt(i) * 18;
      n.x = cx + Math.cos(a) * rad; n.y = cy + Math.sin(a) * rad;
      n.vx = 0; n.vy = 0;
    });

    const fxF: ForceX<BNode> = forceX<BNode>(cx).strength(0.045);
    const fyF: ForceY<BNode> = forceY<BNode>(cy).strength(0.045);
    const sim = forceSimulation<BNode>(nodes)
      .alphaDecay(0.02)
      .velocityDecay(0.32)
      // Barnes-Hut repulsion — theta + distanceMax keep it O(n log n) at 1000 nodes.
      .force('charge', forceManyBody<BNode>().strength(-18).theta(0.85).distanceMax(300))
      .force('collide', forceCollide<BNode>().radius((d) => d.r + 1.5))
      .force('x', fxF)
      .force('y', fyF)
      .stop();
    simRef.current = sim;

    function applyLinks() {
      const links = data.edges.map((e) => ({ source: e.a, target: e.b }));
      sim.force('link', links.length ? forceLink(links).distance(46).strength(0.6) : null);
    }
    applyLinks(); // pick up edges if phase 2 already finished
    applyLinksRef.current = () => { applyLinks(); sim.alpha(0.6); };

    // Pre-settle off-screen so it opens already laid out.
    for (let i = 0; i < 90; i++) sim.tick();

    function drawNode(n: BNode, time: number) {
      const hov = n === hover, sel = n === selectedRef.current, r = n.r;
      ctx.fillStyle = n.color;
      ctx.beginPath(); ctx.arc(n.x, n.y, r, 0, 6.2832); ctx.fill();
      ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath(); ctx.arc(n.x, n.y, r - 0.5, 0, 6.2832); ctx.stroke();
      if (n.isContract && r > 4) {
        ctx.lineWidth = 1.4; ctx.strokeStyle = 'rgba(255,255,255,0.5)';
        ctx.beginPath(); ctx.arc(n.x, n.y, r * 0.5, 0, 6.2832); ctx.stroke();
      }
      if (n.category === 'ofac') {
        const pulse = Math.sin(time * 0.005) + 1;
        ctx.lineWidth = 1.25; ctx.strokeStyle = hexA('#ef4444', 0.3 + pulse * 0.22);
        ctx.beginPath(); ctx.arc(n.x, n.y, r + 3 + pulse * 1.5, 0, 6.2832); ctx.stroke();
      }
      if (hov || sel) {
        ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(255,255,255,0.9)';
        ctx.beginPath(); ctx.arc(n.x, n.y, r + 2.5, 0, 6.2832); ctx.stroke();
      }
      if (n.pinned) {
        ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(255,255,255,0.45)'; ctx.setLineDash([2.5, 3]);
        ctx.beginPath(); ctx.arc(n.x, n.y, r + 4.5, 0, 6.2832); ctx.stroke(); ctx.setLineDash([]);
      }
      // Label only meaningful bubbles to avoid clutter at high node counts.
      if (hov || n.label || r > 16) {
        const txt = n.label || `${fmtPct(n.pct)}%`;
        ctx.font = '500 10px ui-sans-serif,system-ui,sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        if (r > 20 && !n.label) {
          ctx.fillStyle = 'rgba(0,0,0,0.75)';
          ctx.fillText(txt, n.x, n.y);
        } else if (hov || n.label) {
          const w = ctx.measureText(txt).width, ty = n.y + r + 8;
          ctx.fillStyle = 'rgba(8,16,28,0.82)';
          ctx.fillRect(n.x - w / 2 - 4, ty - 7, w + 8, 14);
          ctx.fillStyle = 'rgba(226,232,240,0.95)';
          ctx.fillText(txt, n.x, ty);
        }
      }
    }
    function draw(time: number) {
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      ctx.fillStyle = '#0a1525'; ctx.fillRect(0, 0, W, H);
      const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.12, W / 2, H / 2, Math.max(W, H) * 0.7);
      g.addColorStop(0, 'rgba(120,160,210,0.05)'); g.addColorStop(1, 'rgba(0,0,0,0.3)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      ctx.setTransform(DPR * view.scale, 0, 0, DPR * view.scale, view.ox * DPR, view.oy * DPR);

      const focus = hover || selectedRef.current;
      const focusCluster = focus && focus.cluster >= 0 ? focus.cluster : null;
      const isLit = (n: BNode) =>
        !focus ? true : n === focus || (focusCluster != null && n.cluster === focusCluster);

      for (const e of data.edges) {
        const a = nodes[e.a], b = nodes[e.b];
        if (!a || !b) continue;
        const lit = !focus || isLit(a) || isLit(b);
        ctx.globalAlpha = lit ? 0.5 : 0.06;
        ctx.lineWidth = lit ? 1.4 : 0.6;
        ctx.strokeStyle = hexA(a.color, 0.8);
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      }
      ctx.globalAlpha = 1;
      for (const n of nodes) {
        ctx.globalAlpha = isLit(n) ? 1 : 0.16;
        drawNode(n, time);
      }
      ctx.globalAlpha = 1;
    }
    function frame(t: number) {
      sim.tick();
      for (const n of nodes) {
        if (n.fx == null) {
          const pad = n.r + 4;
          n.x = Math.max(pad, Math.min(W - pad, n.x));
          n.y = Math.max(pad, Math.min(H - pad, n.y));
        }
      }
      draw(t);
      raf = requestAnimationFrame(frame);
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
      let html = `<div style="display:flex;align-items:center;gap:6px;font-weight:500"><span style="width:9px;height:9px;border-radius:50%;flex:none;background:${n.color}"></span>${n.label || n.short}</div>`;
      html += `<div style="${sub}">${n.short}${n.isContract ? ' · contract' : ''}</div>`;
      html += `<div style="${row}">${fmtPct(n.pct)}% of supply</div>`;
      if (n.cluster >= 0) html += `<div style="${row}">Cluster #${n.cluster + 1}</div>`;
      tip.innerHTML = html; tip.style.opacity = '1';
      const sx = n.x * view.scale + view.ox, sy = n.y * view.scale + view.oy;
      let tx = sx + 16; if (tx > W - 168) tx = sx - 168;
      tip.style.left = `${tx}px`; tip.style.top = `${Math.max(2, sy - 12)}px`;
    }
    const hideTip = () => { tip.style.opacity = '0'; };
    const onMove = (e: MouseEvent) => {
      const sp = mpos(e), p = toWorld(sp.x, sp.y);
      if (drag) { drag.fx = p.x - ddx; drag.fy = p.y - ddy; showTip(drag); return; }
      hover = pick(p); cvs.style.cursor = hover ? 'grab' : 'default';
      if (hover) showTip(hover); else hideTip();
    };
    const onDown = (e: MouseEvent) => {
      const sp = mpos(e), p = toWorld(sp.x, sp.y), n = pick(p);
      if (n) {
        selectedRef.current = n; setSelected(n);
        drag = n; n.fx = n.x; n.fy = n.y; ddx = p.x - n.x; ddy = p.y - n.y;
        cvs.style.cursor = 'grabbing'; sim.alphaTarget(0.25).restart();
      } else { selectedRef.current = null; setSelected(null); }
    };
    const onUp = () => {
      if (drag) { drag.pinned = true; drag = null; cvs.style.cursor = 'grab'; sim.alphaTarget(0); }
    };
    const onDbl = (e: MouseEvent) => {
      const sp = mpos(e), p = toWorld(sp.x, sp.y), n = pick(p);
      if (n) { n.fx = null; n.fy = null; n.pinned = false; sim.alpha(0.4); }
    };
    const onLeave = () => { if (!drag) { hover = null; hideTip(); } };
    // Right-click removes a bubble from the map; edges touching it drop and the
    // rest re-settle live (collide fills the gap, re-centering pulls in).
    const onContext = (e: MouseEvent) => {
      e.preventDefault();
      const sp = mpos(e), p = toWorld(sp.x, sp.y), n = pick(p);
      if (!n) return;
      const ti = nodes.indexOf(n);
      if (ti < 0) return;
      // Drop edges touching the node; shift every index above it down by one.
      const remapped: BEdge[] = [];
      for (const ed of data.edges) {
        if (ed.a === ti || ed.b === ti) continue;
        remapped.push({ a: ed.a > ti ? ed.a - 1 : ed.a, b: ed.b > ti ? ed.b - 1 : ed.b });
      }
      data.edges.length = 0; data.edges.push(...remapped);
      nodes.splice(ti, 1);
      if (selectedRef.current === n) { selectedRef.current = null; setSelected(null); }
      if (hover === n) { hover = null; hideTip(); }
      if (drag === n) drag = null;
      sim.nodes(nodes);
      applyLinks();
      sim.alpha(0.6).restart();
      setMeta((m) => ({ ...m, shown: nodes.length }));
    };
    const onResize = () => { measure(); fxF.x(cx); fyF.y(cy); sim.alpha(0.4); };

    cvs.addEventListener('mousemove', onMove);
    cvs.addEventListener('mousedown', onDown);
    window.addEventListener('mouseup', onUp);
    cvs.addEventListener('dblclick', onDbl);
    cvs.addEventListener('contextmenu', onContext);
    cvs.addEventListener('mouseleave', onLeave);
    window.addEventListener('resize', onResize);
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      sim.stop();
      simRef.current = null;
      applyLinksRef.current = null;
      cvs.removeEventListener('mousemove', onMove);
      cvs.removeEventListener('mousedown', onDown);
      window.removeEventListener('mouseup', onUp);
      cvs.removeEventListener('dblclick', onDbl);
      cvs.removeEventListener('contextmenu', onContext);
      cvs.removeEventListener('mouseleave', onLeave);
      window.removeEventListener('resize', onResize);
    };
  }, [status, fs]);

  const legend = useMemo(() => {
    const items: { label: string; color: string }[] = [];
    if (meta.clusters > 0) items.push({ label: `${meta.clusters} cluster${meta.clusters === 1 ? '' : 's'}`, color: CLUSTER_PALETTE[0] });
    items.push({ label: 'Contract / LP', color: CONTRACT_COLOR });
    items.push({ label: 'Holder', color: EOA_COLOR });
    return items;
  }, [meta.clusters]);

  const card = (
    <div
      className={
        fs
          ? 'fixed inset-0 z-[200] flex flex-col bg-[var(--app-bg)] p-3 sm:p-4'
          : 'rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3'
      }
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
          Holder bubble map
          {meta.holders != null && (
            <span className="font-normal normal-case text-[var(--text-faint)]">
              {meta.holders.toLocaleString()} holders{symbol ? ` · ${symbol}` : ''}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Bubble-count selector — clusters always cover the top 150, so a
              bigger number adds bubbles without slowing first-load. */}
          <div className="flex items-center rounded-md border border-[var(--line)] overflow-hidden">
            {NODE_OPTIONS.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => { if (opt !== limit) setLimit(opt); }}
                disabled={status === 'loading'}
                className={`px-2 py-0.5 text-[11px] font-semibold tabular-nums transition-colors disabled:opacity-40 ${
                  opt === limit
                    ? 'bg-[var(--surface-2)] text-[var(--text)]'
                    : 'text-[var(--text-faint)] hover:text-[var(--text)]'
                }`}
                title={`Show top ${opt} holders`}
              >
                {opt}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => void load()}
            disabled={status === 'loading'}
            className="text-[var(--text-faint)] hover:text-[var(--text)] disabled:opacity-40"
            title="Re-scan"
          >
            <IconRefresh className={`h-4 w-4 ${status === 'loading' ? 'animate-spin' : ''}`} />
          </button>
          <button
            type="button"
            onClick={() => setFs((v) => !v)}
            className="text-[var(--text-faint)] hover:text-[var(--text)]"
            title={fs ? 'Exit full screen (Esc)' : 'Full screen'}
          >
            {fs ? <IconMinimize className="h-4 w-4" /> : <IconMaximize className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {status === 'error' ? (
        <div className="rounded border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-200">{error}</div>
      ) : status === 'empty' ? (
        <div className="py-10 text-center text-sm text-[var(--text-faint)]">No holder data indexed for this token.</div>
      ) : status === 'loading' ? (
        <div className={`grid place-items-center rounded-lg bg-[var(--surface)] ${fs ? 'flex-1' : 'h-[460px]'}`}>
          <span className="inline-flex items-center gap-2 text-sm text-[var(--text-faint)]">
            <IconRefresh className="h-4 w-4 animate-spin" /> Loading top {limit} holders…
          </span>
        </div>
      ) : (
        <>
          <div className={fs ? 'relative w-full flex-1 min-h-0' : 'relative w-full'}>
            <canvas
              ref={canvasRef}
              role="img"
              aria-label="Force-directed bubble map of this token's top holders"
              className="block w-full rounded-lg border border-[var(--line)]"
              style={{ height: fs ? '100%' : 460 }}
            />
            <div
              ref={tipRef}
              className="pointer-events-none absolute z-10 max-w-[200px] rounded-[10px] border border-[var(--line)] px-2.5 py-2 text-xs leading-snug text-[var(--text)] opacity-0 transition-opacity"
              style={{ background: 'rgba(6,18,34,.94)' }}
            />
            {edgesStatus === 'loading' && (
              <div className="absolute bottom-2 left-2 inline-flex items-center gap-1.5 rounded-full bg-[rgba(6,18,34,.85)] px-2.5 py-1 text-[11px] text-[var(--text-faint)]">
                <IconRefresh className="h-3 w-3 animate-spin" /> Finding clusters (top {EDGE_LIMIT})…
              </div>
            )}
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[var(--text-faint)]">
            {legend.map((l) => (
              <span key={l.label} className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full" style={{ background: l.color }} />
                {l.label}
              </span>
            ))}
          </div>

          {selected && <SelectedBar node={selected} chain={chain} onClose={() => { selectedRef.current = null; setSelected(null); }} />}

          {meta.partial && (
            <p className="mt-2 text-[11px] text-amber-300/80">
              Busy token — clusters computed from the first {meta.scanned} of the top {EDGE_LIMIT} holders before the scan budget was hit.
            </p>
          )}

          <p className="mt-2 text-[11px] text-[var(--text-muted)]">
            Bubble size = share of supply · lines link wallets that trade the token directly or share a funding source · clusters = likely-linked wallets among the top {EDGE_LIMIT} (recent transfers; contracts excluded). Hover to focus · drag to pin · double-click to unpin · right-click to remove a bubble.
          </p>
        </>
      )}
    </div>
  );
  // Portal to <body> when fullscreen so the fixed overlay escapes the token-card
  // modal's transformed (containing-block) ancestor and truly fills the viewport.
  return fs && typeof document !== 'undefined' ? createPortal(card, document.body) : card;
}

function SelectedBar({ node: n, chain, onClose }: { node: BNode; chain: ChainId; onClose: () => void }) {
  const explorer = `${EXPLORER_ADDRESS[chain]}${n.address}`;
  return (
    <div className="mt-2 flex items-center gap-2 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2">
      <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: n.color }} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-sm font-medium text-[var(--text)]">{n.label ?? n.short}</span>
          {n.cluster >= 0 && (
            <span className="shrink-0 rounded px-1.5 py-px text-[9px] font-bold uppercase" style={{ color: n.color, background: hexA(n.color, 0.18) }}>
              Cluster #{n.cluster + 1}
            </span>
          )}
          {n.isContract && (
            <span className="shrink-0 rounded px-1.5 py-px text-[9px] font-bold uppercase text-[var(--text-faint)] bg-[var(--surface-2)]">
              Contract
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-[11px] text-[var(--text-faint)]">
          <a href={explorer} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 font-mono hover:text-[var(--text-muted)]">
            {n.short}
            <IconExternalLink className="h-2.5 w-2.5" />
          </a>
          <span>· {fmtPct(n.pct)}% of supply</span>
        </div>
      </div>
      <AddToGroupButton address={n.address} source="tx" chain={chain} context={{ direction: 'counterparty' }} className="shrink-0 text-[var(--text-faint)] hover:text-orange-300" />
      <button type="button" onClick={onClose} className="shrink-0 text-[var(--text-faint)] hover:text-[var(--text)]" aria-label="Deselect">
        <IconX className="h-4 w-4" />
      </button>
    </div>
  );
}

export default BubbleMap;

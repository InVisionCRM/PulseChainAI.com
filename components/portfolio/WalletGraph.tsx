'use client';

// Wallet connections, as an interactive force-directed graph. Nodes are the
// wallet's counterparties (sized by interaction count, coloured by what they
// ARE — wallet / contract / token / pool / exchange / router / locker / OFAC),
// edges carry animated particles whose direction shows net money flow (out vs
// in). Data: the same aggregated history as the Connections list, enriched with
// on-chain classification from /api/portfolio/classify.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { IconRefresh, IconExternalLink, IconX } from '@tabler/icons-react';
import type { ChainId, WalletHistoryResponse, WalletTransaction } from '@/services';
import { aggregateCounterparties } from '@/lib/walletGraph/aggregate';
import {
  TYPE_META,
  type AddressType,
  type Classification,
} from '@/lib/walletGraph/classify';
import { AddToGroupButton } from '@/components/portfolio/AddToGroupButton';

const MAX_PAGES_PER_CHAIN = 3;
const TOP_N = 14;

const EXPLORER_ADDRESS: Record<ChainId, string> = {
  ethereum: 'https://etherscan.io/address/',
  pulsechain: 'https://scan.pulsechain.com/address/',
};

const truncate = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;
const fmtUsd = (n: number) => {
  if (!n) return '$0';
  if (n >= 1000) return `$${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
  return `$${Math.round(n)}`;
};
function hexA(h: string, a: number) {
  const n = parseInt(h.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

interface GNode {
  address: string;
  chain: ChainId;
  type: AddressType;
  label: string | null;
  short: string;
  txs: number;
  inUsd: number;
  outUsd: number;
  color: string;
  r: number;
  edgeW: number;
  restLen: number;
  curve: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  drag: boolean;
  parts: { t: number; sp: number; dir: number; r: number }[];
}

async function fetchHistory(
  address: string,
  chain: ChainId,
  maxPages: number,
): Promise<WalletTransaction[]> {
  const all: WalletTransaction[] = [];
  let cursor: WalletHistoryResponse['nextCursor'] | undefined;
  for (let p = 0; p < maxPages; p++) {
    const res = await fetch('/api/portfolio/history', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address, chain, cursor }),
    });
    if (!res.ok) break;
    const data = (await res.json()) as WalletHistoryResponse;
    all.push(...data.items);
    if (!data.nextCursor) break;
    cursor = data.nextCursor;
  }
  return all;
}

interface Props {
  walletAddress: string;
  chains: ChainId[];
}

export function WalletGraph({ walletAddress, chains }: Props) {
  const [status, setStatus] = useState<'loading' | 'ready' | 'empty' | 'error'>(
    'loading',
  );
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<GNode | null>(null);
  const [typesPresent, setTypesPresent] = useState<AddressType[]>([]);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const tipRef = useRef<HTMLDivElement | null>(null);
  const dataRef = useRef<{ center: GNode; nodes: GNode[] } | null>(null);
  const selectedRef = useRef<GNode | null>(null);

  const load = useCallback(async () => {
    setStatus('loading');
    setError(null);
    setSelected(null);
    selectedRef.current = null;
    try {
      const txs: WalletTransaction[] = [];
      for (const chain of chains) {
        txs.push(...(await fetchHistory(walletAddress, chain, MAX_PAGES_PER_CHAIN)));
      }
      const summaries = aggregateCounterparties(txs, walletAddress).slice(0, TOP_N);
      if (summaries.length === 0) {
        dataRef.current = null;
        setStatus('empty');
        return;
      }

      let classifications: Record<string, Classification> = {};
      try {
        const res = await fetch('/api/portfolio/classify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            addresses: summaries.map((s) => ({ address: s.address, chain: s.chain })),
          }),
        });
        if (res.ok) classifications = (await res.json()).classifications ?? {};
      } catch {
        /* classification is best-effort — fall back to 'eoa'/'contract' */
      }

      const center: GNode = {
        address: walletAddress.toLowerCase(),
        chain: chains[0],
        type: 'self',
        label: 'This wallet',
        short: truncate(walletAddress),
        txs: 0,
        inUsd: 0,
        outUsd: 0,
        color: TYPE_META.self.color,
        r: 22,
        edgeW: 0,
        restLen: 0,
        curve: 0,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        drag: false,
        parts: [],
      };

      const present = new Set<AddressType>();
      const nodes: GNode[] = summaries.map((s, i) => {
        const cls = classifications[`${s.chain}:${s.address}`];
        const type: AddressType = cls?.type ?? 'eoa';
        present.add(type);
        const flow = s.inUsd + s.outUsd;
        const dir = s.outUsd > s.inUsd * 1.15 ? 1 : s.inUsd > s.outUsd * 1.15 ? -1 : 0;
        const pc = Math.max(1, Math.min(4, 1 + Math.round(flow / 4000) + (s.txCount >= 8 ? 1 : 0)));
        const parts = Array.from({ length: pc }, (_, k) => ({
          t: Math.random(),
          sp: 0.003 + Math.min(flow, 160000) / 160000 * 0.006 + (s.txCount / 22) * 0.004,
          dir: dir || (k % 2 ? 1 : -1),
          r: 1.6 + Math.random() * 1.1,
        }));
        return {
          address: s.address,
          chain: s.chain,
          type,
          label: s.label ?? cls?.label ?? null,
          short: truncate(s.address),
          txs: s.txCount,
          inUsd: s.inUsd,
          outUsd: s.outUsd,
          color: TYPE_META[type].color,
          r: 6 + Math.sqrt(s.txCount) * 3,
          edgeW: 0.8 + Math.sqrt(s.txCount) * 0.7,
          restLen: Math.max(72, 168 - s.txCount * 4),
          curve: (i % 2 ? 1 : -1) * (0.14 + (i % 3) * 0.04),
          x: 0,
          y: 0,
          vx: 0,
          vy: 0,
          drag: false,
          parts,
        };
      });

      dataRef.current = { center, nodes };
      setTypesPresent([...present]);
      setStatus('ready');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to build graph');
      setStatus('error');
    }
  }, [walletAddress, chains]);

  useEffect(() => {
    void load();
  }, [load]);

  // Canvas force simulation + render. Runs once data is ready; mutates node
  // positions in dataRef (no React re-render per frame).
  useEffect(() => {
    if (status !== 'ready' || !dataRef.current) return;
    const cvs = canvasRef.current!;
    const ctx = cvs.getContext('2d')!;
    const tip = tipRef.current!;
    const DPR = Math.min(window.devicePixelRatio || 1, 2);
    const { center, nodes } = dataRef.current;
    let W = 0, H = 0, cx = 0, cy = 0, raf = 0;
    let hover: GNode | null = null;
    let drag: GNode | null = null;
    let ddx = 0, ddy = 0;

    function resize() {
      const r = cvs.getBoundingClientRect();
      W = r.width; H = 420;
      cvs.width = W * DPR; cvs.height = H * DPR;
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      cx = W / 2; cy = H / 2; center.x = cx; center.y = cy;
    }
    resize();
    nodes.forEach((n, i) => {
      const a = (i / nodes.length) * Math.PI * 2;
      n.x = cx + Math.cos(a) * (120 + (i % 2) * 40);
      n.y = cy + Math.sin(a) * (110 + (i % 2) * 30);
    });

    const REP = 5200, SPRING = 0.018, DAMP = 0.88;
    function step() {
      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i];
        for (let j = i + 1; j < nodes.length; j++) {
          const b = nodes[j];
          let dx = a.x - b.x, dy = a.y - b.y, d2 = dx * dx + dy * dy;
          if (d2 < 1) d2 = 1;
          const d = Math.sqrt(d2), f = REP / d2, ux = dx / d, uy = dy / d;
          a.vx += ux * f; a.vy += uy * f; b.vx -= ux * f; b.vy -= uy * f;
        }
      }
      for (const n of nodes) {
        const dx = cx - n.x, dy = cy - n.y, d = Math.hypot(dx, dy) || 1;
        const ux = dx / d, uy = dy / d, f = SPRING * (d - n.restLen);
        n.vx += ux * f; n.vy += uy * f; n.vx *= DAMP; n.vy *= DAMP;
        if (!n.drag) { n.x += n.vx; n.y += n.vy; }
        const pad = n.r + 24;
        n.x = Math.max(pad, Math.min(W - pad, n.x));
        n.y = Math.max(pad + 10, Math.min(H - pad, n.y));
      }
    }
    function ctrl(n: GNode) {
      const mx = (cx + n.x) / 2, my = (cy + n.y) / 2;
      const dx = n.x - cx, dy = n.y - cy, len = Math.hypot(dx, dy) || 1;
      const px = -dy / len, py = dx / len, amt = len * n.curve;
      return { x: mx + px * amt, y: my + py * amt };
    }
    function quad(P0: { x: number; y: number }, C: { x: number; y: number }, P1: { x: number; y: number }, t: number) {
      const u = 1 - t, a = u * u, b = 2 * u * t, c = t * t;
      return { x: a * P0.x + b * C.x + c * P1.x, y: a * P0.y + b * C.y + c * P1.y };
    }
    function drawNode(n: GNode, time: number, isC: boolean) {
      const col = n.color, hov = n === hover, r = n.r;
      let glow = r * 1.9;
      if (isC) glow = r * 2.1 + Math.sin(time * 0.003) * 4;
      if (n.type === 'ofac') glow += (Math.sin(time * 0.006) + 1) * 5;
      const hg = ctx.createRadialGradient(n.x, n.y, r * 0.3, n.x, n.y, glow);
      hg.addColorStop(0, hexA(col, 0.55)); hg.addColorStop(1, hexA(col, 0));
      ctx.fillStyle = hg; ctx.beginPath(); ctx.arc(n.x, n.y, glow, 0, 6.2832); ctx.fill();
      ctx.save(); ctx.shadowColor = col; ctx.shadowBlur = hov || n === selectedRef.current ? 24 : 12;
      ctx.fillStyle = col; ctx.beginPath(); ctx.arc(n.x, n.y, r, 0, 6.2832); ctx.fill(); ctx.restore();
      if (n.type === 'pool') {
        ctx.strokeStyle = 'rgba(6,18,34,0.85)'; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.arc(n.x, n.y, r * 0.5, 0, 6.2832); ctx.stroke();
      }
      ctx.fillStyle = 'rgba(255,255,255,0.28)';
      ctx.beginPath(); ctx.arc(n.x - r * 0.32, n.y - r * 0.32, r * 0.42, 0, 6.2832); ctx.fill();
      if (hov || n === selectedRef.current) {
        ctx.strokeStyle = 'rgba(255,255,255,0.92)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(n.x, n.y, r + 4, 0, 6.2832); ctx.stroke();
      }
      if (isC || n.label || hov) {
        const txt = isC ? 'This wallet' : (n.label || n.short);
        ctx.font = '500 11px ui-sans-serif,system-ui,sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'top';
        const w = ctx.measureText(txt).width, ty = n.y + r + 5;
        ctx.fillStyle = 'rgba(4,14,26,0.55)';
        const rx = n.x - w / 2 - 5, ry = ty - 2, rw = w + 10, rh = 16;
        ctx.beginPath();
        ctx.moveTo(rx + 4, ry); ctx.arcTo(rx + rw, ry, rx + rw, ry + rh, 4);
        ctx.arcTo(rx + rw, ry + rh, rx, ry + rh, 4); ctx.arcTo(rx, ry + rh, rx, ry, 4);
        ctx.arcTo(rx, ry, rx + rw, ry, 4); ctx.fill();
        ctx.fillStyle = isC ? '#ffe1bf' : 'rgba(255,255,255,0.92)';
        ctx.fillText(txt, n.x, ty);
      }
    }
    function draw(time: number) {
      const g = ctx.createRadialGradient(cx, cy - 20, 40, cx, cy, Math.max(W, H) * 0.75);
      g.addColorStop(0, '#103056'); g.addColorStop(0.6, '#0b2240'); g.addColorStop(1, '#06121f');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      for (const n of nodes) {
        const C = ctrl(n), hov = n === hover, col = n.color;
        ctx.lineWidth = n.edgeW * (hov ? 2 : 1);
        const gr = ctx.createLinearGradient(cx, cy, n.x, n.y);
        gr.addColorStop(0, hexA(TYPE_META.self.color, hov ? 0.5 : 0.16));
        gr.addColorStop(1, hexA(col, hov ? 0.95 : 0.5));
        ctx.strokeStyle = gr; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.quadraticCurveTo(C.x, C.y, n.x, n.y); ctx.stroke();
      }
      for (const n of nodes) {
        const C = ctrl(n);
        for (const p of n.parts) {
          const pos = quad(center, C, n, p.t);
          ctx.save(); ctx.shadowColor = n.color; ctx.shadowBlur = 9;
          ctx.fillStyle = 'rgba(255,255,255,0.95)';
          ctx.beginPath(); ctx.arc(pos.x, pos.y, p.r, 0, 6.2832); ctx.fill();
          ctx.fillStyle = n.color; ctx.globalAlpha = 0.5;
          ctx.beginPath(); ctx.arc(pos.x, pos.y, p.r * 1.7, 0, 6.2832); ctx.fill();
          ctx.globalAlpha = 1; ctx.restore();
        }
      }
      drawNode(center, time, true);
      for (const n of nodes) drawNode(n, time, false);
    }
    function frame(t: number) {
      step();
      for (const n of nodes) for (const p of n.parts) { p.t += p.sp * p.dir; if (p.t > 1) p.t -= 1; if (p.t < 0) p.t += 1; }
      draw(t); raf = requestAnimationFrame(frame);
    }
    for (let s = 0; s < 140; s++) step();

    function mpos(e: MouseEvent | Touch) {
      const r = cvs.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    }
    function pick(p: { x: number; y: number }) {
      const all = [center, ...nodes];
      let best = 1e9, f: GNode | null = null;
      for (const n of all) { const d = Math.hypot(n.x - p.x, n.y - p.y); if (d < n.r + 7 && d < best) { best = d; f = n; } }
      return f;
    }
    function showTip(n: GNode) {
      const isC = n === center;
      const sub = 'font-size:11px;color:rgba(255,255,255,.55);margin-top:1px';
      const row = 'color:rgba(255,255,255,.8);margin-top:2px';
      let html = `<div style="display:flex;align-items:center;gap:6px;font-weight:500"><span style="width:9px;height:9px;border-radius:50%;flex:none;background:${n.color}"></span>${isC ? 'This wallet' : (n.label || n.short)}</div>`;
      if (isC) html += `<div style="${sub}">${center.short} · ${nodes.length} connections</div>`;
      else {
        html += `<div style="${sub}">${TYPE_META[n.type].label}${n.type === 'ofac' ? ' · ⚠' : ''} · ${n.short}</div>`;
        html += `<div style="${row}">${n.txs} tx${n.txs === 1 ? '' : 's'}</div>`;
        const fr: string[] = [];
        if (n.inUsd) fr.push(`in ${fmtUsd(n.inUsd)}`);
        if (n.outUsd) fr.push(`out ${fmtUsd(n.outUsd)}`);
        if (fr.length) html += `<div style="${row}">${fr.join(' · ')}</div>`;
      }
      tip.innerHTML = html; tip.style.opacity = '1';
      let tx = n.x + 16; if (tx > W - 168) tx = n.x - 168;
      tip.style.left = `${tx}px`; tip.style.top = `${Math.max(2, n.y - 12)}px`;
    }
    const hideTip = () => { tip.style.opacity = '0'; };
    const onMove = (e: MouseEvent) => {
      const p = mpos(e);
      if (drag) { drag.x = p.x - ddx; drag.y = p.y - ddy; drag.vx = 0; drag.vy = 0; showTip(drag); return; }
      hover = pick(p); cvs.style.cursor = hover ? 'grab' : 'default';
      if (hover) showTip(hover); else hideTip();
    };
    const onDown = (e: MouseEvent) => {
      const p = mpos(e), n = pick(p);
      const sel = n && n !== center ? n : null;
      selectedRef.current = sel;
      setSelected(sel);
      if (n && n !== center) { drag = n; n.drag = true; ddx = p.x - n.x; ddy = p.y - n.y; cvs.style.cursor = 'grabbing'; }
    };
    const onUp = () => { if (drag) { drag.drag = false; drag = null; } };
    const onLeave = () => { if (!drag) { hover = null; hideTip(); } };
    cvs.addEventListener('mousemove', onMove);
    cvs.addEventListener('mousedown', onDown);
    window.addEventListener('mouseup', onUp);
    cvs.addEventListener('mouseleave', onLeave);
    window.addEventListener('resize', resize);
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      cvs.removeEventListener('mousemove', onMove);
      cvs.removeEventListener('mousedown', onDown);
      window.removeEventListener('mouseup', onUp);
      cvs.removeEventListener('mouseleave', onLeave);
      window.removeEventListener('resize', resize);
    };
  }, [status]);

  const legend = useMemo(
    () => typesPresent.filter((t) => t !== 'self').map((t) => ({ t, ...TYPE_META[t] })),
    [typesPresent],
  );

  return (
    <div className="rounded-xl border border-white/10 bg-black/20 p-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-white/70">
          Connections graph
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={status === 'loading'}
          className="text-white/50 hover:text-white disabled:opacity-40"
          title="Re-scan"
        >
          <IconRefresh className={`h-4 w-4 ${status === 'loading' ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {status === 'error' ? (
        <div className="rounded border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-200">
          {error}
        </div>
      ) : status === 'empty' ? (
        <div className="py-10 text-center text-sm text-white/40">
          No counterparties found in recent history.
        </div>
      ) : status === 'loading' ? (
        <div className="grid h-[420px] place-items-center rounded-lg bg-white/5">
          <span className="inline-flex items-center gap-2 text-sm text-white/50">
            <IconRefresh className="h-4 w-4 animate-spin" /> Mapping connections…
          </span>
        </div>
      ) : (
        <>
          <div className="relative w-full">
            <canvas
              ref={canvasRef}
              role="img"
              aria-label="Force-directed graph of this wallet's on-chain connections"
              className="block h-[420px] w-full rounded-lg border border-white/10"
            />
            <div
              ref={tipRef}
              className="pointer-events-none absolute z-10 max-w-[200px] rounded-[10px] border border-white/15 px-2.5 py-2 text-xs leading-snug text-white opacity-0 transition-opacity"
              style={{ background: 'rgba(6,18,34,.94)' }}
            />
          </div>

          {legend.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-white/50">
              {legend.map((l) => (
                <span key={l.t} className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full" style={{ background: l.color }} />
                  {l.label}
                </span>
              ))}
            </div>
          )}

          {selected && (
            <SelectedBar
              node={selected}
              onClose={() => {
                selectedRef.current = null;
                setSelected(null);
              }}
            />
          )}

          <p className="mt-2 text-[11px] text-white/35">
            Drag nodes · hover for details · click to act. Particle direction shows
            net flow (out vs in).
          </p>
        </>
      )}
    </div>
  );
}

function SelectedBar({ node: n, onClose }: { node: GNode; onClose: () => void }) {
  const explorer = `${EXPLORER_ADDRESS[n.chain]}${n.address}`;
  return (
    <div className="mt-2 flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2">
      <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: n.color }} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-sm font-medium text-white">{n.label ?? n.short}</span>
          <span
            className="shrink-0 rounded px-1.5 py-px text-[9px] font-bold uppercase"
            style={{ color: n.color, background: hexA(n.color, 0.18) }}
          >
            {TYPE_META[n.type].label}
          </span>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-white/45">
          <a
            href={explorer}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-0.5 font-mono hover:text-white/70"
          >
            {n.short}
            <IconExternalLink className="h-2.5 w-2.5" />
          </a>
          <span>· {n.txs} tx{n.txs === 1 ? '' : 's'}</span>
          {n.inUsd > 0 && <span>· in {fmtUsd(n.inUsd)}</span>}
          {n.outUsd > 0 && <span>· out {fmtUsd(n.outUsd)}</span>}
        </div>
      </div>
      <AddToGroupButton
        address={n.address}
        source="tx"
        chain={n.chain}
        context={{ direction: 'counterparty' }}
        className="shrink-0 text-white/40 hover:text-orange-300"
      />
      <button
        type="button"
        onClick={onClose}
        className="shrink-0 text-white/40 hover:text-white"
        aria-label="Deselect"
      >
        <IconX className="h-4 w-4" />
      </button>
    </div>
  );
}

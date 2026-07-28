'use client';

// The two things the SuperStake contract actually does, drawn rather than
// described: the 5.5% split on every trade, and the 60-day end-stake loop.
// Percentages are from the pSSH whitepaper (5.5% on buys/sells, 0% on
// transfers) and match the rates the model in lib/superstake/model.ts uses.
//
// Both diagrams encode the split in the geometry, not just in the label — the
// ribbons are sized by their share of the 5.5%, so 2.5% is visibly two and a
// half times the 1%. A flow chart with equal-weight arrows would have made
// three very different cuts look interchangeable.
//
// Motion is declarative SVG (<animateMotion>), so it costs no JS and no
// re-renders, and is dropped entirely under prefers-reduced-motion.

const INK = 'var(--app-bg)';
const MONO = 'var(--font-jetbrains-mono), ui-monospace, monospace';

const SVG_CLS = 'block h-auto w-full';

function Panel({
  title, note, children,
}: { title: string; note: string; children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--panel)]">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-[var(--line)] px-4 py-3">
        <h3 className="text-sm font-bold tracking-tight text-[var(--text)]">{title}</h3>
        <span
          className="text-[9.5px] uppercase tracking-[0.14em] text-orange-400"
          style={{ fontFamily: MONO }}
        >
          {note}
        </span>
      </div>
      <div className="overflow-x-auto px-2.5 pb-3 pt-2">{children}</div>
    </div>
  );
}

/* ───────────────────────── panel one: the 5.5% split ───────────────────────── */

const SRC_X = 56;
const DST_X = 190;

/**
 * One band of the split, drawn as a filled ribbon whose thickness is its share
 * of the tax at both ends — so the picture is readable without the numbers.
 */
function Ribbon({
  id, a0, a1, b0, b1, from, to,
}: {
  id: string;
  /** Where the band sits on the source bar. */
  a0: number; a1: number;
  /** Where it lands on its destination card. */
  b0: number; b1: number;
  from: string; to: string;
}) {
  const m = (SRC_X + DST_X) / 2;
  return (
    <>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={from} stopOpacity="0.5" />
          <stop offset="1" stopColor={to} stopOpacity="0.28" />
        </linearGradient>
      </defs>
      <path
        d={`M ${SRC_X} ${a0} C ${m} ${a0}, ${m} ${b0}, ${DST_X} ${b0}
            L ${DST_X} ${b1} C ${m} ${b1}, ${m} ${a1}, ${SRC_X} ${a1} Z`}
        fill={`url(#${id})`}
      />
      {/* centreline: invisible, but it is what the travelling dot follows */}
      <path
        id={`${id}-c`}
        d={`M ${SRC_X} ${(a0 + a1) / 2} C ${m} ${(a0 + a1) / 2}, ${m} ${(b0 + b1) / 2}, ${DST_X} ${(b0 + b1) / 2}`}
        fill="none"
        stroke="none"
      />
    </>
  );
}

function Packet({ href, delay, fill }: { href: string; delay?: string; fill: string }) {
  return (
    <circle r="4.5" fill={fill} className="motion-reduce:hidden">
      <animateMotion dur="2.8s" begin={delay} repeatCount="indefinite">
        <mpath href={href} />
      </animateMotion>
    </circle>
  );
}

function Dest({
  y, h, pct, pctW, title, body, accent,
}: {
  y: number; h: number; pct: string;
  /** Width the percentage takes, so the title starts clear of it. */
  pctW: number;
  title: string; body?: string; accent: string;
}) {
  // A tall card has room to stack the caption; the 1% band is only 32 units
  // high, so it gets the one line and nothing else.
  const midline = body ? y + h / 2 - 4 : y + h / 2 + 5;
  return (
    <g>
      <rect x={DST_X} y={y} width="272" height={h} rx="11" fill={INK} stroke={accent} strokeOpacity="0.5" />
      <rect x={DST_X} y={y} width="3.5" height={h} fill={accent} />
      <text x={DST_X + 14} y={midline} style={{ fontFamily: MONO }} fontSize="16" fontWeight="800" fill={accent}>
        {pct}
      </text>
      <text x={DST_X + 14 + pctW} y={midline} fontSize="13.5" fontWeight="700" fill="var(--text)">
        {title}
      </text>
      {body && (
        <text x={DST_X + 14} y={midline + 21} fontSize="11" fill="var(--text-faint)">
          {body}
        </text>
      )}
    </g>
  );
}

function TaxSplit() {
  return (
    <svg
      viewBox="0 0 470 242"
      className={SVG_CLS}
      role="img"
      aria-label="Of the 5.5% every buy and sell pays, 2.5% becomes HEX paid straight to holders, 2% buys HEX for the staking pool, and 1% buys pSSH and burns it. The three bands are drawn in proportion to their share."
    >
      <defs>
        <linearGradient id="ssf-src" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FB9438" />
          <stop offset="0.55" stopColor="#AE176A" />
          <stop offset="1" stopColor="#7E089D" />
        </linearGradient>
      </defs>

      {/* the whole 5.5%, as one bar to be divided */}
      <rect x="24" y="32" width="32" height="176" rx="10" fill="url(#ssf-src)" />
      <text x="40" y="22" textAnchor="middle" fontSize="15" fontWeight="800" fill="var(--text)">
        5.5%
      </text>
      <text x="40" y="227" textAnchor="middle" style={{ fontFamily: MONO }} fontSize="8.5"
            letterSpacing="1" fill="var(--text-faint)">
        OF EACH TRADE
      </text>

      {/* 176 units of bar, cut 2.5 : 2 : 1 — 80, 64 and 32 units */}
      <Ribbon id="ssf-r1" a0={32} a1={112} b0={22} b1={102} from="#FB9438" to="#FB9438" />
      <Ribbon id="ssf-r2" a0={112} a1={176} b0={118} b1={182} from="#AE176A" to="#AE176A" />
      <Ribbon id="ssf-r3" a0={176} a1={208} b0={198} b1={230} from="#7E089D" to="#D83639" />

      <Packet href="#ssf-r1-c" fill="#FB9438" />
      <Packet href="#ssf-r2-c" fill="#AE176A" delay="-0.95s" />
      <Packet href="#ssf-r3-c" fill="#D83639" delay="-1.9s" />

      <Dest y={22} h={80} pct="2.5%" pctW={46} accent="#FB9438"
            title="HEX straight to holders" body="split by how much pSSH you hold" />
      <Dest y={118} h={64} pct="2%" pctW={32} accent="#AE176A"
            title="buys HEX for the pool" body="waits there for the next restake" />
      <Dest y={198} h={32} pct="1%" pctW={32} accent="#D83639"
            title="buys pSSH and burns it" />
    </svg>
  );
}

/* ───────────────────────── panel two: the 60-day loop ───────────────────────── */

// Wider than the left panel's box on purpose: the side labels sit outside the
// ring, so the ring has to leave them room rather than take the whole width.
const CX = 250;
const CY = 124;
const R = 72;

/** A stop on the loop: the dot on the ring plus its label, set outside it. */
function Stop({
  x, y, tx, ty, anchor, lead, rest, sub, accent,
}: {
  x: number; y: number; tx: number; ty: number;
  anchor: 'start' | 'middle' | 'end';
  /** The figure, coloured — or '' for a stop that has no percentage. */
  lead: string;
  rest: string; sub: string; accent: string;
}) {
  return (
    <g>
      <circle cx={x} cy={y} r="10" fill={INK} stroke={accent} strokeWidth="3.5" />
      <circle cx={x} cy={y} r="3.5" fill={accent} />
      <text x={tx} y={ty} textAnchor={anchor} fontSize="13.5" fontWeight="700" fill="var(--text)">
        {lead && <tspan fill={accent} fontWeight="800">{lead} </tspan>}
        {rest}
      </text>
      <text x={tx} y={ty + 16} textAnchor={anchor} fontSize="11" fill="var(--text-faint)">
        {sub}
      </text>
    </g>
  );
}

/** Little clockwise chevron on the ring, so the direction of travel is obvious. */
function Way({ deg }: { deg: number }) {
  const t = (deg * Math.PI) / 180;
  const x = CX + R * Math.sin(t);
  const y = CY - R * Math.cos(t);
  return (
    <polygon
      points="-3,-4.5 5,0 -3,4.5"
      fill="var(--text-faint)"
      transform={`translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${deg - 90})`}
    />
  );
}

function CycleLoop() {
  return (
    <svg
      viewBox="0 0 500 258"
      className={SVG_CLS}
      role="img"
      aria-label="Every 60 days the stake ends, 1% of the whole pool is paid to every holder, and the other 99% plus all the HEX bought during the cycle is staked again for another 60 days."
    >
      <defs>
        <linearGradient id="ssf-ring" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#7E089D" />
          <stop offset="0.5" stopColor="#D83639" />
          <stop offset="1" stopColor="#FB9438" />
        </linearGradient>
      </defs>

      <circle cx={CX} cy={CY} r={R} fill="none" stroke="var(--line)" strokeWidth="15" />
      <circle cx={CX} cy={CY} r={R} fill="none" stroke="url(#ssf-ring)" strokeWidth="15" opacity="0.8" />

      <Way deg={45} />
      <Way deg={135} />
      <Way deg={225} />
      <Way deg={315} />

      {/* one lap of the ring, which is also the dot's route */}
      <path
        id="ssf-lap"
        d={`M ${CX} ${CY - R} A ${R} ${R} 0 1 1 ${CX} ${CY + R} A ${R} ${R} 0 1 1 ${CX} ${CY - R}`}
        fill="none"
        stroke="none"
      />
      <circle r="6" fill="#fff" className="motion-reduce:hidden">
        <animateMotion dur="7s" repeatCount="indefinite"><mpath href="#ssf-lap" /></animateMotion>
      </circle>

      <text x={CX} y={CY + 4} textAnchor="middle" fontSize="38" fontWeight="800" fill="var(--text)">
        60
      </text>
      <text x={CX} y={CY + 25} textAnchor="middle" style={{ fontFamily: MONO }} fontSize="11"
            letterSpacing="3" fill="var(--text-faint)">
        DAYS
      </text>

      <Stop x={CX} y={CY - R} tx={CX} ty={18} anchor="middle" accent="#FB9438"
            lead="" rest="The stake ends" sub="principal + all the yield it made" />
      <Stop x={CX + R} y={CY} tx={CX + R + 22} ty={120} anchor="start" accent="#D83639"
            lead="1%" rest="pays out" sub="to every holder, in HEX" />
      <Stop x={CX} y={CY + R} tx={CX} ty={224} anchor="middle" accent="#AE176A"
            lead="99%" rest="goes straight back in" sub="plus all the HEX the 2% bought" />
      <Stop x={CX - R} y={CY} tx={CX - R - 22} ty={120} anchor="end" accent="#7E089D"
            lead="" rest="Staked again" sub="a bigger pool each time" />
    </svg>
  );
}

export default function MachineFlow() {
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <Panel title="Every buy and sell" note="5.5% tax · 0% on transfers">
        <TaxSplit />
      </Panel>
      <Panel title="Every 60 days" note="end-stake · then straight back in">
        <CycleLoop />
      </Panel>
    </div>
  );
}

'use client';

// The two things the SuperStake contract actually does, drawn rather than
// described: the 5.5% split on every trade, and the 60-day end-stake loop.
// Percentages are from the pSSH whitepaper (5.5% on buys/sells, 0% on
// transfers) and match the rates the model in lib/superstake/model.ts uses.
//
// The travelling dots are declarative SVG <animateMotion>, so they cost no
// JS and no re-renders. Motion is dropped entirely under prefers-reduced-motion.

const INK = 'var(--app-bg)';
const MONO = 'var(--font-jetbrains-mono), ui-monospace, monospace';

/** Below this the labels would shrink past legibility, so the box scrolls instead. */
const SVG_CLS = 'block h-auto w-full min-w-[430px]';

function Packet({ path, delay, fill }: { path: string; delay?: string; fill: string }) {
  return (
    <circle r="5" fill={fill} className="motion-reduce:hidden">
      <animateMotion dur="2.6s" begin={delay} repeatCount="indefinite">
        <mpath href={path} />
      </animateMotion>
    </circle>
  );
}

function Dest({
  y, pct, title, body, stroke, pctX = 212, titleX = 250,
}: {
  y: number; pct: string; title: string; body: string; stroke: string;
  pctX?: number; titleX?: number;
}) {
  return (
    <g>
      <rect x="196" y={y} width="270" height="52" rx="11" fill={INK} stroke={stroke} strokeOpacity="0.55" />
      <text x={pctX} y={y + 22} style={{ fontFamily: MONO }} fontSize="14" fontWeight="700" fill={stroke}>
        {pct}
      </text>
      <text x={titleX} y={y + 22} fontSize="13" fontWeight="700" fill="var(--text)">
        {title}
      </text>
      <text x={pctX} y={y + 40} fontSize="11" fill="var(--text-faint)">
        {body}
      </text>
    </g>
  );
}

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
      <div className="overflow-x-auto px-2.5 pb-3.5 pt-1.5">{children}</div>
    </div>
  );
}

export default function MachineFlow() {
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <Panel title="Every buy and sell" note="5.5% tax · 0% on transfers">
        <svg
          viewBox="0 0 470 244"
          className={SVG_CLS}
          role="img"
          aria-label="Every trade pays 5.5%: 2.5% becomes HEX paid straight to holders, 1% buys pSSH and burns it, and 2% buys HEX for the staking pool."
        >
          <defs>
            <linearGradient id="ssf-a" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#7E089D" /><stop offset="1" stopColor="#FB9438" />
            </linearGradient>
            <linearGradient id="ssf-b" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#7E089D" /><stop offset="1" stopColor="#D83639" />
            </linearGradient>
            <linearGradient id="ssf-c" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#7E089D" /><stop offset="1" stopColor="#AE176A" />
            </linearGradient>
          </defs>

          <rect x="4" y="94" width="100" height="52" rx="11" fill={INK} stroke="var(--line-strong)" />
          <text x="54" y="116" textAnchor="middle" fontSize="14" fontWeight="700" fill="var(--text)">Trade</text>
          <text x="54" y="133" textAnchor="middle" style={{ fontFamily: MONO }} fontSize="10.5" fill="var(--text-faint)">
            buy or sell
          </text>

          <path id="ssf-w1" d="M104 120 C 150 120, 158 42, 196 42" fill="none" stroke="url(#ssf-a)" strokeWidth="2.5" opacity="0.6" />
          <path id="ssf-w2" d="M104 120 L 196 120" fill="none" stroke="url(#ssf-b)" strokeWidth="2.5" opacity="0.6" />
          <path id="ssf-w3" d="M104 120 C 150 120, 158 198, 196 198" fill="none" stroke="url(#ssf-c)" strokeWidth="2.5" opacity="0.6" />

          <Packet path="#ssf-w1" fill="#FB9438" />
          <Packet path="#ssf-w2" fill="#D83639" delay="-0.85s" />
          <Packet path="#ssf-w3" fill="#AE176A" delay="-1.7s" />

          <Dest y={16} pct="2.5%" titleX={256} title="HEX straight to holders"
                body="split by how much pSSH you hold" stroke="#FB9438" />
          <Dest y={94} pct="1%" titleX={242} title="buys pSSH and burns it"
                body="supply only ever goes down" stroke="#D83639" />
          <Dest y={172} pct="2%" titleX={242} title="buys HEX for the pool"
                body="waits there for the next restake" stroke="#AE176A" />
        </svg>
      </Panel>

      <Panel title="Every 60 days" note="end-stake · then straight back in">
        <svg
          viewBox="0 0 470 244"
          className={SVG_CLS}
          role="img"
          aria-label="At each 60-day end-stake, 1% of principal plus yield is paid to every holder, and the remaining 99% plus the HEX bought during the cycle is staked again."
        >
          <defs>
            <linearGradient id="ssf-d" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#D83639" /><stop offset="1" stopColor="#FB9438" />
            </linearGradient>
            <linearGradient id="ssf-e" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#7E089D" /><stop offset="1" stopColor="#E96635" />
            </linearGradient>
          </defs>

          <rect x="4" y="80" width="112" height="52" rx="11" fill={INK} stroke="var(--line-strong)" />
          <text x="60" y="102" textAnchor="middle" fontSize="14" fontWeight="700" fill="var(--text)">Stake ends</text>
          <text x="60" y="119" textAnchor="middle" style={{ fontFamily: MONO }} fontSize="10.5" fill="var(--text-faint)">
            principal + yield
          </text>

          <path id="ssf-v1" d="M116 106 C 156 106, 162 42, 196 42" fill="none" stroke="url(#ssf-d)" strokeWidth="2.5" opacity="0.6" />
          <path id="ssf-v2" d="M116 106 C 156 106, 162 158, 196 158" fill="none" stroke="url(#ssf-e)" strokeWidth="2.5" opacity="0.6" />

          <Packet path="#ssf-v1" fill="#FB9438" />
          <Packet path="#ssf-v2" fill="#E96635" delay="-1.3s" />

          <Dest y={16} pct="1%" titleX={242} title="paid out to every holder"
                body="of the whole pool · hold 5,555+ pSSH" stroke="#FB9438" />
          <Dest y={132} pct="99%" titleX={250} title="goes straight back in"
                body="plus all the HEX the 2% bought this cycle" stroke="#E96635" />

          {/* the loop closing back on itself */}
          <path
            id="ssf-v3"
            d="M331 184 C 331 218, 328 224, 300 224 L 92 224 C 62 224, 60 196, 60 140"
            fill="none" stroke="var(--line-strong)" strokeWidth="2" strokeDasharray="5 5"
          />
          <circle r="4" fill="var(--text-faint)" className="motion-reduce:hidden">
            <animateMotion dur="3.4s" repeatCount="indefinite"><mpath href="#ssf-v3" /></animateMotion>
          </circle>
          {/* knock a gap in the dashes so the label reads cleanly */}
          <rect x="118" y="214" width="164" height="19" fill="var(--panel)" />
          <text x="200" y="228" textAnchor="middle" style={{ fontFamily: MONO }} fontSize="9.5"
                letterSpacing="1.4" fill="var(--text-faint)">
            60 DAYS LATER, AGAIN
          </text>
        </svg>
      </Panel>
    </div>
  );
}

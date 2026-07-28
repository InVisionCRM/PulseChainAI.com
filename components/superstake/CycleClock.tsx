'use client';

// Countdown to the running cycle's end-stake, with a progress ring showing how
// far through the 60 days it is. Both dates come from the cycle record (HEX
// days converted to UTC midnights), so this stays correct as cycles roll over.

import { useEffect, useState } from 'react';

const R = 72;
const CIRC = 2 * Math.PI * R;
const MONO = 'var(--font-jetbrains-mono), ui-monospace, monospace';

const utcMs = (iso: string) => Date.parse(`${iso}T00:00:00Z`);

export default function CycleClock({
  cycleNo, startISO, endISO,
}: { cycleNo: number; startISO: string; endISO: string }) {
  // Rendered on the client only — server and client clocks differ, and a
  // hydration mismatch on a ticking value is guaranteed otherwise.
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const start = utcMs(startISO);
  const end = utcMs(endISO);
  const left = now == null ? 0 : Math.max(0, end - now);
  const progress = now == null ? 0 : Math.min(1, Math.max(0, (now - start) / (end - start)));

  const secs = Math.floor(left / 1000);
  const days = Math.floor(secs / 86_400);
  const hh = String(Math.floor((secs % 86_400) / 3600)).padStart(2, '0');
  const mm = String(Math.floor((secs % 3600) / 60)).padStart(2, '0');
  const ss = String(secs % 60).padStart(2, '0');

  return (
    <div className="flex flex-col items-center rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-4 text-center">
      <div
        className="text-[9.5px] uppercase tracking-[0.16em] text-[var(--text-faint)]"
        style={{ fontFamily: MONO }}
      >
        Cycle {cycleNo} ends in
      </div>

      <div className="relative mt-2.5 h-[168px] w-[168px]">
        <svg viewBox="0 0 168 168" width="168" height="168" className="block -rotate-90" aria-hidden="true">
          <defs>
            <linearGradient id="ssc-ring" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#7E089D" />
              <stop offset="0.5" stopColor="#D83639" />
              <stop offset="1" stopColor="#FB9438" />
            </linearGradient>
          </defs>
          <circle cx="84" cy="84" r={R} fill="none" stroke="var(--line)" strokeWidth="9" />
          <circle
            cx="84" cy="84" r={R} fill="none" stroke="url(#ssc-ring)" strokeWidth="9"
            strokeLinecap="round" strokeDasharray={CIRC}
            strokeDashoffset={CIRC * (1 - progress)}
            style={{ transition: 'stroke-dashoffset 1s linear' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="text-[41px] font-bold leading-none tracking-[-0.05em] tabular-nums text-[var(--text)]">
            {now == null ? '—' : days}
          </div>
          <div
            className="mt-0.5 text-[9px] uppercase tracking-[0.18em] text-[var(--text-faint)]"
            style={{ fontFamily: MONO }}
          >
            days left
          </div>
          <div className="mt-1 text-xs tabular-nums text-[var(--text-muted)]" style={{ fontFamily: MONO }}>
            {now == null ? '--:--:--' : `${hh}:${mm}:${ss}`}
          </div>
        </div>
      </div>

      <p className="mt-3 text-[11.5px] leading-relaxed text-[var(--text-muted)]">
        Then <b className="text-[var(--text)]">1% of the whole pool</b> pays out to every holder, and
        the rest restakes.
      </p>
    </div>
  );
}

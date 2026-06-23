'use client';

import { useState } from 'react';
import { IconBolt, IconStethoscope } from '@tabler/icons-react';
import type { Network } from '@/lib/hex/strategistData';
import HexStrategist from './HexStrategist';
import StakeDoctor from './StakeDoctor';

type Mode = 'designer' | 'doctor';

export default function HexStrategistTabs() {
  const [net, setNet] = useState<Network>('pulsechain');
  const [mode, setMode] = useState<Mode>('designer');

  return (
    <div className="mx-auto w-full max-w-5xl space-y-4 px-3 py-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-[var(--text)]">
            <IconBolt className="h-5 w-5 text-orange-400" /> HEX Stake Strategist
          </h1>
          <p className="text-xs text-[var(--text-muted)]">
            {mode === 'designer'
              ? 'Design a stake — the math tells you the best length, not just the numbers.'
              : 'Diagnose your stakes — when to end each one, and what ending early costs.'}
          </p>
        </div>
        <div className="flex items-center gap-0.5 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-0.5">
          {(['pulsechain', 'ethereum'] as const).map((n) => (
            <button
              key={n}
              onClick={() => setNet(n)}
              className={`rounded-lg px-3 py-1 text-xs font-semibold capitalize transition-colors ${
                net === n ? 'bg-[var(--surface-2)] text-orange-300' : 'text-[var(--text-muted)] hover:text-[var(--text)]'
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      {/* Mode switch */}
      <div className="inline-flex rounded-xl border border-[var(--line)] bg-[var(--surface)] p-0.5">
        <button
          onClick={() => setMode('designer')}
          className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
            mode === 'designer' ? 'bg-[var(--surface-2)] text-orange-300' : 'text-[var(--text-muted)] hover:text-[var(--text)]'
          }`}
        >
          <IconBolt className="h-3.5 w-3.5" /> Designer
        </button>
        <button
          onClick={() => setMode('doctor')}
          className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
            mode === 'doctor' ? 'bg-[var(--surface-2)] text-cyan-300' : 'text-[var(--text-muted)] hover:text-[var(--text)]'
          }`}
        >
          <IconStethoscope className="h-3.5 w-3.5" /> Doctor
        </button>
      </div>

      {mode === 'designer' ? <HexStrategist net={net} /> : <StakeDoctor net={net} />}
    </div>
  );
}

'use client';

interface DexScreenerChartProps {
  pairAddress: string;
}

export default function DexScreenerChart({ pairAddress }: DexScreenerChartProps) {
  if (!pairAddress) {
    return (
      <div className="flex items-center justify-center h-96 bg-[var(--panel)] rounded">
        <p className="text-[var(--text-muted)] text-sm">No pair address provided</p>
      </div>
    );
  }

  return (
    <div className="bg-[var(--panel)] rounded overflow-hidden">
      <iframe
        src={`https://dexscreener.com/pulsechain/${pairAddress}?embed=1&theme=dark&trades=0&info=0`}
        className="w-full h-[550px] border-0"
        title="DexScreener Chart"
      />
    </div>
  );
}

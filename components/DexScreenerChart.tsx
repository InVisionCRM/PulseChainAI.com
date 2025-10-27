'use client';

interface DexScreenerChartProps {
  pairAddress: string;
}

export default function DexScreenerChart({ pairAddress }: DexScreenerChartProps) {
  if (!pairAddress) {
    return (
      <div className="flex items-center justify-center h-96 bg-slate-900/50 rounded">
        <p className="text-slate-400 text-sm">No pair address provided</p>
      </div>
    );
  }

  return (
    <div className="bg-slate-900/50 rounded overflow-hidden">
      <iframe
        src={`https://dexscreener.com/pulsechain/${pairAddress}?embed=1&theme=dark&trades=0&info=0`}
        className="w-full h-[541px] sm:h-[773px] md:h-[805px] lg:h-[869px] xl:h-[935px] border-0"
        title="DexScreener Chart"
      />
    </div>
  );
}

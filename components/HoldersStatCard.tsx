'use client';

interface HoldersStatCardProps {
  data: {
    totalHolders: number;
  };
  isLoading?: boolean;
  error?: string;
}

export default function HoldersStatCard({ data, isLoading, error }: HoldersStatCardProps) {
  if (isLoading) {
    return (
      <div className="bg-[var(--surface)] backdrop-blur-md border border-[var(--line-strong)] rounded-lg p-4">
        <div className="animate-pulse">
          <div className="h-4 bg-[var(--surface-2)] rounded mb-2"></div>
          <div className="h-6 bg-[var(--surface-2)] rounded mb-4"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-500/10 backdrop-blur-md border border-red-500/30 rounded-lg p-4">
        <p className="text-red-300 text-sm">Error: {error}</p>
      </div>
    );
  }

  return (
    <div className="bg-[var(--surface)] backdrop-blur-md border border-[var(--line-strong)] rounded-lg p-4 animate-fade-in">
      <div className="mb-3">
        <h3 className="text-lg font-semibold text-[var(--text)] mb-1">Holders</h3>
        <div className="text-2xl font-bold text-[var(--text)]">
          {data.totalHolders.toLocaleString()}
        </div>
      </div>
      
      <div className="text-sm text-[var(--text-muted)]">
        Total token holders
      </div>
    </div>
  );
} 
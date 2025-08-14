'use client';

interface TokensBurnedStatCardProps {
  data: {
    totalBurned: number;
    burnedAddresses: {
      [address: string]: number;
    };
    decimals: number;
  };
  isLoading?: boolean;
  error?: string;
}

export default function TokensBurnedStatCard({ data, isLoading, error }: TokensBurnedStatCardProps) {
  if (isLoading) {
    return (
      <div className="bg-white/5 backdrop-blur-md border border-white/20 rounded-lg p-4">
        <div className="animate-pulse">
          <div className="h-4 bg-white/10 rounded mb-2"></div>
          <div className="h-6 bg-white/10 rounded mb-4"></div>
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
    <div className="bg-white/5 backdrop-blur-md border border-white/20 rounded-lg p-4 animate-fade-in">
      <div className="mb-3">
        <h3 className="text-lg font-semibold text-white mb-1">Tokens Burned</h3>
        <div className="text-2xl font-bold text-white">
          {data.totalBurned.toLocaleString()}
        </div>
      </div>
      
      <div className="text-sm text-gray-400">
        Total tokens burned across all burn addresses
      </div>
    </div>
  );
} 
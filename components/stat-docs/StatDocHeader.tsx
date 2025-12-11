'use client';

interface StatDocHeaderProps {
  statName: string;
  statId: string;
  description: string;
  category: string;
}

export default function StatDocHeader({ statName, statId, description, category }: StatDocHeaderProps) {
  return (
    <div className="mb-8">
      <div className="flex items-center gap-3 mb-4">
        <h1 className="text-3xl md:text-4xl font-bold text-white">{statName}</h1>
        <span className="px-3 py-1 text-xs font-semibold bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 rounded-full uppercase tracking-wider">
          GET STAT
        </span>
      </div>
      
      <div className="flex items-center gap-2 mb-4">
        <span className="px-2 py-1 text-xs bg-purple-600/20 text-purple-300 border border-purple-500/30 rounded">
          {category}
        </span>
        <span className="text-gray-500">•</span>
        <code className="text-sm text-gray-400 font-mono">ID: {statId}</code>
      </div>
      
      <p className="text-base text-gray-300 leading-relaxed max-w-4xl">
        {description}
      </p>
    </div>
  );
}


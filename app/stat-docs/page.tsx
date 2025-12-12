'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { availableStats } from '@/lib/stats';
import { detectStatParameters } from '@/lib/stat-docs/parameter-detector';
import MorbiusBanner from '@/components/stat-docs/MorbiusBanner';

export default function StatDocsIndexPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFormat, setSelectedFormat] = useState<string>('all');
  
  // Group stats by format
  const statsByFormat = useMemo(() => {
    const grouped: Record<string, typeof availableStats> = {
      all: availableStats
    };
    
    availableStats.forEach(stat => {
      if (!grouped[stat.format]) {
        grouped[stat.format] = [];
      }
      grouped[stat.format].push(stat);
    });
    
    return grouped;
  }, []);
  
  // Filter stats based on search query
  const filteredStats = useMemo(() => {
    let stats = selectedFormat === 'all' ? availableStats : statsByFormat[selectedFormat] || [];
    
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      stats = stats.filter(stat =>
        stat.name.toLowerCase().includes(query) ||
        stat.description.toLowerCase().includes(query) ||
        stat.id.toLowerCase().includes(query)
      );
    }
    
    return stats;
  }, [searchQuery, selectedFormat, availableStats, statsByFormat]);
  
  const formatLabels: Record<string, string> = {
    all: 'All Stats',
    number: 'Numbers',
    currency: 'Currency',
    percentage: 'Percentages',
    address: 'Addresses',
    text: 'Text'
  };
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Morbius Banner */}
      <MorbiusBanner />
      
      {/* Header */}
      <div className="border-b border-slate-800 bg-slate-950/50 backdrop-blur">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-4xl font-bold text-white mb-2">Stats API Documentation</h1>
              <p className="text-gray-400">
                Comprehensive documentation for all {availableStats.length} PulseChain stats
              </p>
            </div>
            <a
              href="/admin-stats"
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
            >
              Admin Panel
            </a>
          </div>
          
          {/* Search and Filter */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <input
                type="text"
                placeholder="Search stats by name, ID, or description..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
              />
            </div>
            <select
              value={selectedFormat}
              onChange={(e) => setSelectedFormat(e.target.value)}
              className="px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-purple-500"
            >
              {Object.entries(formatLabels).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
      
      {/* Stats Grid */}
      <div className="max-w-7xl mx-auto px-6 py-12">
        {filteredStats.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-400 text-lg mb-2">No stats found</p>
            <p className="text-gray-500 text-sm">Try adjusting your search or filter</p>
          </div>
        ) : (
          <>
            <div className="mb-6 text-gray-400 text-sm">
              Showing {filteredStats.length} {filteredStats.length === 1 ? 'stat' : 'stats'}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredStats.map(stat => {
                const parameters = detectStatParameters(stat.id);
                const requiredParams = parameters.filter(p => p.required);
                
                return (
                  <Link
                    key={stat.id}
                    href={`/stat-docs/${stat.id}`}
                    className="group bg-slate-900/60 border border-slate-700 hover:border-purple-500/50 rounded-xl p-6 transition-all hover:shadow-lg hover:shadow-purple-500/10"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <h3 className="text-lg font-semibold text-white group-hover:text-purple-400 transition-colors">
                        {stat.name}
                      </h3>
                      <span className={`px-2 py-1 text-xs rounded font-mono ${
                        stat.format === 'currency' ? 'bg-green-500/20 text-green-400 border border-green-500/30' :
                        stat.format === 'percentage' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' :
                        stat.format === 'address' ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' :
                        'bg-gray-500/20 text-gray-400 border border-gray-500/30'
                      }`}>
                        {stat.format}
                      </span>
                    </div>
                    
                    <p className="text-sm text-gray-400 mb-4 line-clamp-2">
                      {stat.description}
                    </p>
                    
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <span>ID: <code className="text-purple-400">{stat.id}</code></span>
                      {requiredParams.length > 0 && (
                        <>
                          <span>•</span>
                          <span>{requiredParams.length} required param{requiredParams.length !== 1 ? 's' : ''}</span>
                        </>
                      )}
                    </div>
                    
                    <div className="mt-4 pt-4 border-t border-slate-700 flex items-center justify-between text-xs">
                      <span className="text-gray-500">View Documentation</span>
                      <span className="text-purple-400 group-hover:translate-x-1 transition-transform">→</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}



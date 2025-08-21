import React from 'react';
import { Calendar } from 'lucide-react';
import type { FilterControlsProps } from './types';

const FilterControls: React.FC<FilterControlsProps> = ({
  filterDate,
  setFilterDate,
  paginatedDataLength,
  sortedDataLength,
  activeTab,
}) => {
  if (activeTab === 'staking') {
    return null;
  }

  return (
    <div className="flex flex-col sm:flex-row flex-wrap gap-2 sm:gap-4 mb-2 sm:mb-4">
      <div className="flex items-center gap-2">
        <Calendar className="w-3 h-3 sm:w-4 sm:h-4 text-slate-400" />
        <input
          type="date"
          value={filterDate}
          onChange={(e) => setFilterDate(e.target.value)}
          className="border border-white/10 bg-white/5 backdrop-blur text-white rounded px-2 sm:px-3 py-1 text-xs sm:text-sm flex-1 sm:flex-initial"
          placeholder="Filter by date"
        />
      </div>
      <div className="text-xs sm:text-sm text-slate-400 text-center sm:text-left">
        <span className="hidden sm:inline">Showing {paginatedDataLength} of {sortedDataLength} records</span>
        <span className="sm:hidden">{paginatedDataLength}/{sortedDataLength}</span>
      </div>
    </div>
  );
};

export default FilterControls;
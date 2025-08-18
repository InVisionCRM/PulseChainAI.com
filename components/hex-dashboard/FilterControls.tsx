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
    <div className="flex flex-wrap gap-4 mb-4">
      <div className="flex items-center gap-2">
        <Calendar className="w-4 h-4 text-slate-400" />
        <input
          type="date"
          value={filterDate}
          onChange={(e) => setFilterDate(e.target.value)}
          className="border border-white/10 bg-white/5 backdrop-blur text-white rounded px-3 py-1 text-sm"
          placeholder="Filter by date"
        />
      </div>
      <div className="text-sm text-slate-400">
        Showing {paginatedDataLength} of {sortedDataLength} records
      </div>
    </div>
  );
};

export default FilterControls;
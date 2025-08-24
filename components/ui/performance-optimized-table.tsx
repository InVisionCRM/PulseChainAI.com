"use client";

import React, { useMemo, useState } from 'react';
import { FixedSizeList as List } from 'react-window';

interface Column<T> {
  key: keyof T;
  label: string;
  width: number;
  render?: (value: any, item: T) => React.ReactNode;
  sortable?: boolean;
}

interface PerformanceOptimizedTableProps<T> {
  data: T[];
  columns: Column<T>[];
  maxHeight?: number;
  className?: string;
  itemHeight?: number;
  overscan?: number;
  loading?: boolean;
  emptyMessage?: string;
}

export function PerformanceOptimizedTable<T extends Record<string, any>>({
  data,
  columns,
  maxHeight = 600,
  className = '',
  itemHeight = 60,
  overscan = 5,
  loading = false,
  emptyMessage = 'No data available'
}: PerformanceOptimizedTableProps<T>) {
  const [sortField, setSortField] = useState<keyof T | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Memoized sorted data to prevent unnecessary re-calculations
  const sortedData = useMemo(() => {
    if (!sortField) return data;
    
    return [...data].sort((a, b) => {
      const aValue = a[sortField];
      const bValue = b[sortField];
      
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
      }
      
      const aStr = String(aValue).toLowerCase();
      const bStr = String(bValue).toLowerCase();
      
      return sortDirection === 'asc' 
        ? aStr.localeCompare(bStr)
        : bStr.localeCompare(aStr);
    });
  }, [data, sortField, sortDirection]);

  const handleSort = (field: keyof T) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const getSortIcon = (field: keyof T) => {
    if (sortField !== field) return '↕️';
    return sortDirection === 'desc' ? '↓' : '↑';
  };

  // Row renderer for react-window
  const Row = ({ index, style }: { index: number; style: React.CSSProperties }) => {
    const item = sortedData[index];
    
    return (
      <div 
        style={style} 
        className="flex items-center border-b border-white/10 hover:bg-white/5 transition-colors duration-150"
      >
        {columns.map((column, colIndex) => (
          <div
            key={String(column.key)}
            className="px-3 py-2 text-sm"
            style={{ width: column.width, minWidth: column.width }}
          >
            {column.render 
              ? column.render(item[column.key], item)
              : String(item[column.key] || '')
            }
          </div>
        ))}
      </div>
    );
  };

  if (loading) {
    return (
      <div className={`bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl overflow-hidden ${className}`}>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
          <span className="ml-3 text-white">Loading...</span>
        </div>
      </div>
    );
  }

  if (!data.length) {
    return (
      <div className={`bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl overflow-hidden ${className}`}>
        <div className="flex items-center justify-center py-12 text-white">
          {emptyMessage}
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl overflow-hidden ${className}`}>
      {/* Header */}
      <div className="bg-slate-900 sticky top-0 z-10 flex">
        {columns.map((column) => (
          <div
            key={String(column.key)}
            className={`px-3 py-3 text-xs font-medium uppercase tracking-wider text-white border-r border-white/10 last:border-r-0 ${
              column.sortable !== false ? 'cursor-pointer hover:bg-slate-800 transition-colors' : ''
            }`}
            style={{ width: column.width, minWidth: column.width }}
            onClick={column.sortable !== false ? () => handleSort(column.key) : undefined}
          >
            <div className="flex items-center gap-1">
              {column.label}
              {column.sortable !== false && getSortIcon(column.key)}
            </div>
          </div>
        ))}
      </div>

      {/* Virtualized Body */}
      <List
        height={Math.min(maxHeight, sortedData.length * itemHeight)}
        itemCount={sortedData.length}
        itemSize={itemHeight}
        overscanCount={overscan}
        style={{ backgroundColor: 'transparent' }}
      >
        {Row}
      </List>

      {/* Footer with count */}
      {sortedData.length > 100 && (
        <div className="px-3 py-2 text-xs text-center text-slate-400 border-t border-white/10 bg-white/5">
          Showing {sortedData.length.toLocaleString()} items (virtualized for performance)
        </div>
      )}
    </div>
  );
}
import React from 'react';
import { TrendingUp, TrendingDown, Minus, ChevronLeft, ChevronRight } from 'lucide-react';
import type { DataTableProps, HexRow } from './types';

// Utility functions (extracted from main component)
const formatNumber = (num: unknown, decimals = 2, showFullNumber = false) => {
  if (num === null || num === undefined) return 'N/A';
  const number = Number(num);
  if (isNaN(number)) return 'N/A';
  
  const validDecimals = Math.max(0, Math.min(20, Math.floor(decimals || 2)));
  
  if (showFullNumber || Math.abs(number) < 1000) {
    return number.toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: validDecimals
    });
  }
  
  if (Math.abs(number) >= 1e12) return (number / 1e12).toFixed(validDecimals) + 'T';
  if (Math.abs(number) >= 1e9) return (number / 1e9).toFixed(validDecimals) + 'B';
  if (Math.abs(number) >= 1e6) return (number / 1e6).toFixed(validDecimals) + 'M';
  if (Math.abs(number) >= 1e3) return (number / 1e3).toFixed(validDecimals) + 'K';
  return number.toFixed(validDecimals);
};

const formatCurrency = (num: unknown, decimals = 6) => {
  if (num === null || num === undefined) return 'N/A';
  const number = Number(num);
  if (isNaN(number)) return 'N/A';
  
  const validDecimals = Math.max(0, Math.min(20, Math.floor(decimals || 2)));
  
  if (Math.abs(number) >= 1e12) return '$' + (number / 1e12).toFixed(2) + 'T';
  if (Math.abs(number) >= 1e9) return '$' + (number / 1e9).toFixed(2) + 'B';
  if (Math.abs(number) >= 1e6) return '$' + (number / 1e6).toFixed(2) + 'M';
  if (Math.abs(number) >= 1e3) return '$' + (number / 1e3).toFixed(2) + 'K';
  
  return '$' + number.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: validDecimals
  });
};

const formatPercent = (num: unknown, decimals = 2) => {
  if (num === null || num === undefined) return 'N/A';
  const number = Number(num);
  if (isNaN(number)) return 'N/A';
  
  const validDecimals = Math.max(0, Math.min(20, Math.floor(decimals || 2)));
  return number.toFixed(validDecimals) + '%';
};

const formatHEX = (num: unknown, decimals = 0) => {
  if (num === null || num === undefined) return 'N/A';
  return formatNumber(num, decimals) + ' HEX';
};

const formatTShares = (num: unknown, decimals = 2) => {
  if (num === null || num === undefined) return 'N/A';
  return formatNumber(num, decimals) + ' T-SHARES';
};

const formatPrice = (num: unknown, decimals = 8) => {
  if (num === null || num === undefined) return 'N/A';
  const number = Number(num);
  if (isNaN(number)) return 'N/A';
  
  const validDecimals = Math.max(0, Math.min(20, Math.floor(decimals || 8)));
  
  if (Math.abs(number) < 0.000001) return '$' + number.toExponential(2);
  return '$' + number.toFixed(validDecimals);
};

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
};

const getChangeColor = (value: unknown) => {
  const num = Number(value);
  if (isNaN(num) || num === 0) return 'text-slate-400';
  return num > 0 ? 'text-green-400' : 'text-red-400';
};

const getChangeIcon = (value: unknown) => {
  const num = Number(value);
  if (isNaN(num) || num === 0) return <Minus className="w-3 h-3" />;
  return num > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />;
};

const DataTable: React.FC<DataTableProps> = ({
  data,
  sortConfig,
  setSortConfig,
  currentPage,
  itemsPerPage,
  setCurrentPage,
  activeTab,
}) => {
  const handleSort = (key: keyof HexRow) => {
    const direction = sortConfig.key === key && sortConfig.direction === 'asc' ? 'desc' : 'asc';
    setSortConfig({ key, direction });
  };

  const getSortIcon = (key: keyof HexRow) => {
    if (sortConfig.key !== key) return '↕️';
    return sortConfig.direction === 'asc' ? '↑' : '↓';
  };

  // Calculate pagination
  const totalPages = Math.ceil(data.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedData = data.slice(startIndex, startIndex + itemsPerPage);

  // Mobile-optimized columns - show fewer columns on mobile
  const allColumns = [
    { key: 'date', label: 'Date', width: 'w-24 sm:w-32', mobile: true },
    { key: 'currentDay', label: 'Day', width: 'w-16 sm:w-20', mobile: true },
    { key: 'priceUV2UV3', label: 'HEX Price', shortLabel: 'Price', width: 'w-20 sm:w-28', mobile: true },
    { key: 'priceChangeUV2UV3', label: 'Price Change (%)', shortLabel: 'Change', width: 'w-20 sm:w-24', mobile: true },
    { key: 'marketCap', label: 'Market Cap', shortLabel: 'Cap', width: 'w-24 sm:w-32', mobile: false },
    { key: 'totalValueLocked', label: 'Total Value Locked', shortLabel: 'TVL', width: 'w-24 sm:w-32', mobile: false },
    { key: 'totalHEX', label: 'Total Supply', shortLabel: 'Supply', width: 'w-24 sm:w-32', mobile: false },
    { key: 'circulatingHEX', label: 'Circulating Supply', shortLabel: 'Circ', width: 'w-24 sm:w-32', mobile: false },
    { key: 'circulatingSupplyChange', label: 'Circulation Change', shortLabel: 'Circ Δ', width: 'w-24 sm:w-32', mobile: false },
    { key: 'stakedHEX', label: 'Staked Supply', shortLabel: 'Staked', width: 'w-24 sm:w-32', mobile: true },
    { key: 'stakedSupplyChange', label: 'Staked Change', shortLabel: 'Staked Δ', width: 'w-24 sm:w-32', mobile: false },
    { key: 'stakedHEXPercent', label: 'Staked %', shortLabel: '%', width: 'w-16 sm:w-24', mobile: false },
    { key: 'totalTshares', label: 'Total T-Shares', shortLabel: 'T-Shares', width: 'w-24 sm:w-32', mobile: false },
    { key: 'totalTsharesChange', label: 'T-Shares Change', shortLabel: 'T-Δ', width: 'w-24 sm:w-32', mobile: false },
    { key: 'tshareRateHEX', label: 'T-Share Rate (HEX)', shortLabel: 'T-Rate', width: 'w-24 sm:w-32', mobile: false },
    { key: 'tshareMarketCap', label: 'T-Share Market Cap', shortLabel: 'T-Cap', width: 'w-24 sm:w-32', mobile: false },
    { key: 'payoutPerTshareHEX', label: 'Payout/T-Share', shortLabel: 'Payout', width: 'w-20 sm:w-28', mobile: false },
    { key: 'dailyPayoutHEX', label: 'Daily Payout', shortLabel: 'Daily', width: 'w-24 sm:w-32', mobile: false },
    { key: 'dailyMintedInflationTotal', label: 'Daily Inflation', shortLabel: 'Inflation', width: 'w-24 sm:w-32', mobile: false },
    { key: 'actualAPYRate', label: 'APY Rate (%)', shortLabel: 'APY', width: 'w-16 sm:w-24', mobile: true },
    { key: 'currentStakerCount', label: 'Active Stakers', shortLabel: 'Stakers', width: 'w-20 sm:w-28', mobile: false },
    { key: 'currentStakerCountChange', label: 'Staker Change', shortLabel: 'Staker Δ', width: 'w-20 sm:w-28', mobile: false },
    { key: 'currentHolders', label: 'Current Holders', shortLabel: 'Holders', width: 'w-20 sm:w-28', mobile: false },
    { key: 'currentHoldersChange', label: 'Holder Change', shortLabel: 'Holder Δ', width: 'w-20 sm:w-28', mobile: false },
    { key: 'numberOfHolders', label: 'Total Holders', shortLabel: 'Total H', width: 'w-20 sm:w-28', mobile: false },
    { key: 'averageStakeLength', label: 'Avg Stake Length', shortLabel: 'Avg Len', width: 'w-20 sm:w-28', mobile: false },
    { key: 'penaltiesHEX', label: 'Penalties (HEX)', shortLabel: 'Penalties', width: 'w-24 sm:w-32', mobile: false },
    { key: 'roiMultiplierFromATL', label: 'ROI from ATL', shortLabel: 'ROI', width: 'w-20 sm:w-28', mobile: false },
    ...(activeTab === 'ethereum' ? [
      { key: 'priceBTC', label: 'BTC Price', shortLabel: 'BTC', width: 'w-20 sm:w-28', mobile: false },
      { key: 'priceETH', label: 'ETH Price', shortLabel: 'ETH', width: 'w-20 sm:w-28', mobile: false },
    ] : []),
    ...(activeTab === 'pulsechain' ? [
      { key: 'pricePulseX', label: 'PulseX Price', shortLabel: 'PulseX', width: 'w-20 sm:w-28', mobile: false },
      { key: 'pricePulseX_PLS', label: 'PLS Price', shortLabel: 'PLS', width: 'w-20 sm:w-28', mobile: false },
    ] : [])
  ];

  // Filter columns for mobile
  const columns = allColumns;

  if (activeTab === 'staking') {
    return null;
  }

  return (
    <div className="bg-slate-950/5 backdrop-blur-xl border border-white/10 rounded-xl sm:rounded-2xl shadow-[0_8px_30px_-12px_rgba(0,0,0,0.6)] overflow-hidden">
      <div className="overflow-auto max-h-[50vh] sm:max-h-[70vh]">
        <table className="min-w-full divide-y divide-white/10">
          <thead className="bg-slate-900 text-white">
            <tr>
              {columns.map((column) => {
                const isMobileVisible = column.mobile;
                return (
                  <th
                    key={column.key}
                    onClick={() => handleSort(column.key as keyof HexRow)}
                    className={`sticky top-0 z-10 bg-slate-950/80 backdrop-blur px-1 sm:px-3 py-2 sm:py-3 text-left text-xs font-medium uppercase tracking-wider cursor-pointer hover:bg-white/20 select-none ${!isMobileVisible ? 'hidden sm:table-cell' : ''}`}
                  >
                    <div className="flex items-center gap-1">
                      <span className="hidden sm:inline">{column.label}</span>
                      <span className="sm:hidden">{column.shortLabel || column.label}</span>
                      <span className="text-slate-300 text-xs">{getSortIcon(column.key as keyof HexRow)}</span>
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="bg-transparent divide-y divide-white/10">
            {paginatedData.map((row, index) => (
              <tr key={row._id || index} className="hover:bg-white/5">
                {columns.map((column) => {
                  const isMobileVisible = column.mobile;
                  const cellClass = `px-1 sm:px-3 py-2 sm:py-4 whitespace-nowrap text-xs sm:text-sm ${!isMobileVisible ? 'hidden sm:table-cell' : ''}`;
                  
                  // Get cell content based on column key
                  const getCellContent = () => {
                    switch (column.key) {
                      case 'date':
                        return <span className="font-medium text-white">{formatDate(row.date)}</span>;
                      case 'currentDay':
                        return <span className="text-white">{formatNumber(row.currentDay, 0, true)}</span>;
                      case 'priceUV2UV3':
                        return <span className="text-green-600 font-semibold">{formatPrice(row.priceUV2UV3, 8)}</span>;
                      case 'priceChangeUV2UV3':
                        return (
                          <div className={`flex items-center gap-1 ${getChangeColor(row.priceChangeUV2UV3)}`}>
                            <span className="hidden sm:inline">{getChangeIcon(row.priceChangeUV2UV3)}</span>
                            {formatPercent(row.priceChangeUV2UV3)}
                          </div>
                        );
                      case 'marketCap':
                        return <span className="text-white">{formatCurrency(row.marketCap, 0)}</span>;
                      case 'totalValueLocked':
                        return <span className="text-slate-950 font-semibold">{formatCurrency(row.totalValueLocked, 0)}</span>;
                      case 'totalHEX':
                        return <span className="text-white">{formatHEX(row.totalHEX)}</span>;
                      case 'circulatingHEX':
                        return <span className="text-white">{formatHEX(row.circulatingHEX)}</span>;
                      case 'circulatingSupplyChange':
                        return (
                          <div className={`flex items-center gap-1 ${getChangeColor(row.circulatingSupplyChange)}`}>
                            <span className="hidden sm:inline">{getChangeIcon(row.circulatingSupplyChange)}</span>
                            {formatHEX(row.circulatingSupplyChange)}
                          </div>
                        );
                      case 'stakedHEX':
                        return <span className="text-slate-950">{formatHEX(row.stakedHEX)}</span>;
                      case 'stakedSupplyChange':
                        return (
                          <div className={`flex items-center gap-1 ${getChangeColor(row.stakedSupplyChange)}`}>
                            <span className="hidden sm:inline">{getChangeIcon(row.stakedSupplyChange)}</span>
                            {formatHEX(row.stakedSupplyChange)}
                          </div>
                        );
                      case 'stakedHEXPercent':
                        return <span className="text-slate-950">{formatPercent(row.stakedHEXPercent)}</span>;
                      case 'totalTshares':
                        return <span className="text-slate-950">{formatTShares(row.totalTshares)}</span>;
                      case 'totalTsharesChange':
                        return (
                          <div className={`flex items-center gap-1 ${getChangeColor(row.totalTsharesChange)}`}>
                            <span className="hidden sm:inline">{getChangeIcon(row.totalTsharesChange)}</span>
                            {formatTShares(row.totalTsharesChange)}
                          </div>
                        );
                      case 'tshareRateHEX':
                        return <span className="text-orange-600">{formatNumber(row.tshareRateHEX, 1)} HEX</span>;
                      case 'tshareMarketCap':
                        return <span className="text-slate-950">{formatCurrency(row.tshareMarketCap, 0)}</span>;
                      case 'payoutPerTshareHEX':
                        return <span className="text-yellow-600">{formatNumber(row.payoutPerTshareHEX, 6)} HEX</span>;
                      case 'dailyPayoutHEX':
                        return <span className="text-green-700">{formatHEX(row.dailyPayoutHEX)}</span>;
                      case 'dailyMintedInflationTotal':
                        return <span className="text-green-600">{formatHEX(row.dailyMintedInflationTotal)}</span>;
                      case 'actualAPYRate':
                        return <span className="text-yellow-700 font-semibold">{formatPercent(row.actualAPYRate)}</span>;
                      case 'currentStakerCount':
                        return <span className="text-slate-950">{formatNumber(row.currentStakerCount, 0, true)}</span>;
                      case 'currentStakerCountChange':
                        return (
                          <div className={`flex items-center gap-1 ${getChangeColor(row.currentStakerCountChange)}`}>
                            <span className="hidden sm:inline">{getChangeIcon(row.currentStakerCountChange)}</span>
                            {formatNumber(row.currentStakerCountChange, 0, true)}
                          </div>
                        );
                      case 'currentHolders':
                        return <span className="text-orange-700">{formatNumber(row.currentHolders, 0, true)}</span>;
                      case 'currentHoldersChange':
                        return (
                          <div className={`flex items-center gap-1 ${getChangeColor(row.currentHoldersChange)}`}>
                            <span className="hidden sm:inline">{getChangeIcon(row.currentHoldersChange)}</span>
                            {formatNumber(row.currentHoldersChange, 0, true)}
                          </div>
                        );
                      case 'numberOfHolders':
                        return <span className="text-red-600">{formatNumber(row.numberOfHolders, 0, true)}</span>;
                      case 'averageStakeLength':
                        return <span className="text-yellow-700">{formatNumber(row.averageStakeLength, 2)} years</span>;
                      case 'penaltiesHEX':
                        return <span className="text-red-700">{formatHEX(row.penaltiesHEX)}</span>;
                      case 'roiMultiplierFromATL':
                        return <span className="text-emerald-700 font-semibold">{formatNumber(row.roiMultiplierFromATL, 0)}x</span>;
                      case 'priceBTC':
                        return <span className="text-orange-700">{formatCurrency(row.priceBTC, 2)}</span>;
                      case 'priceETH':
                        return <span className="text-slate-950">{formatCurrency(row.priceETH, 2)}</span>;
                      case 'pricePulseX':
                        return <span className="text-pink-700">{formatPrice(row.pricePulseX, 8)}</span>;
                      case 'pricePulseX_PLS':
                        return <span className="text-pink-600">{formatPrice(row.pricePulseX_PLS, 8)}</span>;
                      default:
                        return <span className="text-white">{formatNumber(row[column.key as keyof HexRow])}</span>;
                    }
                  };

                  return (
                    <td key={column.key} className={cellClass}>
                      {getCellContent()}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="bg-slate-800/30 px-2 sm:px-4 py-2 sm:py-3 flex flex-col sm:flex-row items-center justify-between border-t border-slate-700 gap-2 sm:gap-0">
          <div className="flex-1 flex justify-between sm:hidden w-full">
            <button
              type="button"
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="relative inline-flex items-center px-3 py-1.5 border border-slate-600 text-xs font-medium rounded-md text-white bg-slate-800 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Prev
            </button>
            <span className="text-xs text-slate-400 self-center">
              {currentPage} / {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="relative inline-flex items-center px-3 py-1.5 border border-slate-600 text-xs font-medium rounded-md text-white bg-slate-800 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
          <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-slate-400">
                Showing <span className="font-medium">{startIndex + 1}</span> to{' '}
                <span className="font-medium">{Math.min(startIndex + itemsPerPage, data.length)}</span> of{' '}
                <span className="font-medium">{data.length}</span> results
              </p>
            </div>
            <div>
              <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                <button
                  type="button"
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  title="Previous page"
                  className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-slate-600 bg-slate-800 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="h-4 w-4 sm:h-5 sm:w-5" />
                </button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const pageNum = i + 1;
                  return (
                    <button
                      type="button"
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      className={`relative inline-flex items-center px-3 sm:px-4 py-2 border text-sm font-medium ${
                        currentPage === pageNum
                          ? 'z-10 bg-slate-950 border-slate-800 text-white'
                          : 'bg-slate-800 border-slate-600 text-white hover:bg-slate-700'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  title="Next page"
                  className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-slate-600 bg-slate-800 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="h-4 w-4 sm:h-5 sm:w-5" />
                </button>
              </nav>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DataTable;
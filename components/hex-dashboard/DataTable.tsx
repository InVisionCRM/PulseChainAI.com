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

  const columns = [
    { key: 'date', label: 'Date', width: 'w-32' },
    { key: 'currentDay', label: 'Day', width: 'w-20' },
    { key: 'priceUV2UV3', label: 'HEX Price (USD)', width: 'w-28' },
    { key: 'priceChangeUV2UV3', label: 'Price Change (%)', width: 'w-24' },
    { key: 'marketCap', label: 'Market Cap', width: 'w-32' },
    { key: 'totalValueLocked', label: 'Total Value Locked', width: 'w-32' },
    { key: 'totalHEX', label: 'Total Supply', width: 'w-32' },
    { key: 'circulatingHEX', label: 'Circulating Supply', width: 'w-32' },
    { key: 'circulatingSupplyChange', label: 'Circulation Change', width: 'w-32' },
    { key: 'stakedHEX', label: 'Staked Supply', width: 'w-32' },
    { key: 'stakedSupplyChange', label: 'Staked Change', width: 'w-32' },
    { key: 'stakedHEXPercent', label: 'Staked %', width: 'w-24' },
    { key: 'totalTshares', label: 'Total T-Shares', width: 'w-32' },
    { key: 'totalTsharesChange', label: 'T-Shares Change', width: 'w-32' },
    { key: 'tshareRateHEX', label: 'T-Share Rate (HEX)', width: 'w-32' },
    { key: 'tshareMarketCap', label: 'T-Share Market Cap', width: 'w-32' },
    { key: 'payoutPerTshareHEX', label: 'Payout/T-Share', width: 'w-28' },
    { key: 'dailyPayoutHEX', label: 'Daily Payout', width: 'w-32' },
    { key: 'dailyMintedInflationTotal', label: 'Daily Inflation', width: 'w-32' },
    { key: 'actualAPYRate', label: 'APY Rate (%)', width: 'w-24' },
    { key: 'currentStakerCount', label: 'Active Stakers', width: 'w-28' },
    { key: 'currentStakerCountChange', label: 'Staker Change', width: 'w-28' },
    { key: 'currentHolders', label: 'Current Holders', width: 'w-28' },
    { key: 'currentHoldersChange', label: 'Holder Change', width: 'w-28' },
    { key: 'numberOfHolders', label: 'Total Holders', width: 'w-28' },
    { key: 'averageStakeLength', label: 'Avg Stake Length', width: 'w-28' },
    { key: 'penaltiesHEX', label: 'Penalties (HEX)', width: 'w-32' },
    { key: 'roiMultiplierFromATL', label: 'ROI from ATL', width: 'w-28' },
    ...(activeTab === 'ethereum' ? [
      { key: 'priceBTC', label: 'BTC Price', width: 'w-28' },
      { key: 'priceETH', label: 'ETH Price', width: 'w-28' },
    ] : []),
    ...(activeTab === 'pulsechain' ? [
      { key: 'pricePulseX', label: 'PulseX Price', width: 'w-28' },
      { key: 'pricePulseX_PLS', label: 'PLS Price', width: 'w-28' },
    ] : [])
  ];

  if (activeTab === 'staking') {
    return null;
  }

  return (
    <div className="bg-black/5 backdrop-blur-xl border border-white/10 rounded-2xl shadow-[0_8px_30px_-12px_rgba(0,0,0,0.6)] overflow-hidden">
      <div className="overflow-auto max-h-[70vh]">
        <table className="min-w-full divide-y divide-white/10">
          <thead className="bg-slate-900 text-white">
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  onClick={() => handleSort(column.key as keyof HexRow)}
                  className="sticky top-0 z-10 bg-black/80 backdrop-blur px-3 py-3 text-left text-xs font-medium uppercase tracking-wider cursor-pointer hover:bg-white/20 select-none"
                >
                  <div className="flex items-center gap-1">
                    <span>{column.label}</span>
                    <span className="text-slate-300">{getSortIcon(column.key as keyof HexRow)}</span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-transparent divide-y divide-white/10">
            {paginatedData.map((row, index) => (
              <tr key={row._id || index} className="hover:bg-white/5">
                {/* Date */}
                <td className="px-3 py-4 whitespace-nowrap text-sm font-medium text-white">
                  {formatDate(row.date)}
                </td>
                {/* Current Day */}
                <td className="px-3 py-4 whitespace-nowrap text-sm text-white">
                  {formatNumber(row.currentDay, 0, true)}
                </td>
                {/* HEX Price */}
                <td className="px-3 py-4 whitespace-nowrap text-sm text-green-400 font-semibold">
                  {formatPrice(row.priceUV2UV3, 8)}
                </td>
                {/* Price Change */}
                <td className={`px-3 py-4 whitespace-nowrap text-sm ${getChangeColor(row.priceChangeUV2UV3)}`}>
                  <div className="flex items-center gap-1">
                    {getChangeIcon(row.priceChangeUV2UV3)}
                    {formatPercent(row.priceChangeUV2UV3)}
                  </div>
                </td>
                {/* Market Cap */}
                <td className="px-3 py-4 whitespace-nowrap text-sm text-white">
                  {formatCurrency(row.marketCap, 0)}
                </td>
                {/* Total Value Locked */}
                <td className="px-3 py-4 whitespace-nowrap text-sm text-purple-400 font-semibold">
                  {formatCurrency(row.totalValueLocked, 0)}
                </td>
                {/* Total Supply */}
                <td className="px-3 py-4 whitespace-nowrap text-sm text-white">
                  {formatHEX(row.totalHEX)}
                </td>
                {/* Circulating Supply */}
                <td className="px-3 py-4 whitespace-nowrap text-sm text-white">
                  {formatHEX(row.circulatingHEX)}
                </td>
                {/* Circulation Change */}
                <td className={`px-3 py-4 whitespace-nowrap text-sm ${getChangeColor(row.circulatingSupplyChange)}`}>
                  <div className="flex items-center gap-1">
                    {getChangeIcon(row.circulatingSupplyChange)}
                    {formatHEX(row.circulatingSupplyChange)}
                  </div>
                </td>
                {/* Staked Supply */}
                <td className="px-3 py-4 whitespace-nowrap text-sm text-blue-400">
                  {formatHEX(row.stakedHEX)}
                </td>
                {/* Staked Change */}
                <td className={`px-3 py-4 whitespace-nowrap text-sm ${getChangeColor(row.stakedSupplyChange)}`}>
                  <div className="flex items-center gap-1">
                    {getChangeIcon(row.stakedSupplyChange)}
                    {formatHEX(row.stakedSupplyChange)}
                  </div>
                </td>
                {/* Staked Percentage */}
                <td className="px-3 py-4 whitespace-nowrap text-sm text-blue-300">
                  {formatPercent(row.stakedHEXPercent)}
                </td>
                {/* Total T-Shares */}
                <td className="px-3 py-4 whitespace-nowrap text-sm text-purple-300">
                  {formatTShares(row.totalTshares)}
                </td>
                {/* T-Shares Change */}
                <td className={`px-3 py-4 whitespace-nowrap text-sm ${getChangeColor(row.totalTsharesChange)}`}>
                  <div className="flex items-center gap-1">
                    {getChangeIcon(row.totalTsharesChange)}
                    {formatTShares(row.totalTsharesChange)}
                  </div>
                </td>
                {/* T-Share Rate */}
                <td className="px-3 py-4 whitespace-nowrap text-sm text-orange-400">
                  {formatNumber(row.tshareRateHEX, 1)} HEX
                </td>
                {/* T-Share Market Cap */}
                <td className="px-3 py-4 whitespace-nowrap text-sm text-purple-400">
                  {formatCurrency(row.tshareMarketCap, 0)}
                </td>
                {/* Payout Per T-Share */}
                <td className="px-3 py-4 whitespace-nowrap text-sm text-yellow-400">
                  {formatNumber(row.payoutPerTshareHEX, 6)} HEX
                </td>
                {/* Daily Payout */}
                <td className="px-3 py-4 whitespace-nowrap text-sm text-green-300">
                  {formatHEX(row.dailyPayoutHEX)}
                </td>
                {/* Daily Inflation */}
                <td className="px-3 py-4 whitespace-nowrap text-sm text-green-400">
                  {formatHEX(row.dailyMintedInflationTotal)}
                </td>
                {/* APY Rate */}
                <td className="px-3 py-4 whitespace-nowrap text-sm text-orange-400 font-semibold">
                  {formatPercent(row.actualAPYRate, 2)}
                </td>
                {/* Active Stakers */}
                <td className="px-3 py-4 whitespace-nowrap text-sm text-cyan-400">
                  {formatNumber(row.currentStakerCount, 0, true)}
                </td>
                {/* Staker Change */}
                <td className={`px-3 py-4 whitespace-nowrap text-sm ${getChangeColor(row.currentStakerCountChange)}`}>
                  <div className="flex items-center gap-1">
                    {getChangeIcon(row.currentStakerCountChange)}
                    {formatNumber(row.currentStakerCountChange, 0, true)}
                  </div>
                </td>
                {/* Current Holders */}
                <td className="px-3 py-4 whitespace-nowrap text-sm text-cyan-300">
                  {formatNumber(row.currentHolders, 0, true)}
                </td>
                {/* Holder Change */}
                <td className={`px-3 py-4 whitespace-nowrap text-sm ${getChangeColor(row.currentHoldersChange)}`}>
                  <div className="flex items-center gap-1">
                    {getChangeIcon(row.currentHoldersChange)}
                    {formatNumber(row.currentHoldersChange, 0, true)}
                  </div>
                </td>
                {/* Total Holders */}
                <td className="px-3 py-4 whitespace-nowrap text-sm text-cyan-200">
                  {formatNumber(row.numberOfHolders, 0, true)}
                </td>
                {/* Average Stake Length */}
                <td className="px-3 py-4 whitespace-nowrap text-sm text-yellow-300">
                  {formatNumber(row.averageStakeLength, 2)} years
                </td>
                {/* Penalties */}
                <td className="px-3 py-4 whitespace-nowrap text-sm text-red-400">
                  {formatHEX(row.penaltiesHEX)}
                </td>
                {/* ROI from ATL */}
                <td className="px-3 py-4 whitespace-nowrap text-sm text-emerald-400 font-semibold">
                  {formatNumber(row.roiMultiplierFromATL, 0)}x
                </td>
                {/* Network-specific columns */}
                {activeTab === 'ethereum' && (
                  <>
                    <td className="px-3 py-4 whitespace-nowrap text-sm text-orange-400">
                      {formatCurrency(row.priceBTC, 2)}
                    </td>
                    <td className="px-3 py-4 whitespace-nowrap text-sm text-blue-400">
                      {formatCurrency(row.priceETH, 2)}
                    </td>
                  </>
                )}
                {activeTab === 'pulsechain' && (
                  <>
                    <td className="px-3 py-4 whitespace-nowrap text-sm text-pink-400">
                      {formatPrice(row.pricePulseX, 8)}
                    </td>
                    <td className="px-3 py-4 whitespace-nowrap text-sm text-pink-300">
                      {formatPrice(row.pricePulseX_PLS, 8)}
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="bg-slate-800/30 px-4 py-3 flex items-center justify-between border-t border-slate-700">
          <div className="flex-1 flex justify-between sm:hidden">
            <button
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="relative inline-flex items-center px-4 py-2 border border-slate-600 text-sm font-medium rounded-md text-white bg-slate-800 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <button
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="ml-3 relative inline-flex items-center px-4 py-2 border border-slate-600 text-sm font-medium rounded-md text-white bg-slate-800 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
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
              <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-slate-600 bg-slate-800 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="h-5 w-5" aria-hidden="true" />
                </button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const pageNum = i + 1;
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                        currentPage === pageNum
                          ? 'z-10 bg-purple-600 border-purple-600 text-white'
                          : 'bg-slate-800 border-slate-600 text-white hover:bg-slate-700'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
                <button
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-slate-600 bg-slate-800 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="h-5 w-5" aria-hidden="true" />
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
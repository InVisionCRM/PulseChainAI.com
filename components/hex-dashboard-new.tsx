"use client";
import React, { useMemo } from 'react';
import { RefreshCw } from 'lucide-react';
import HexGeminiAnalysis from './HexGeminiAnalysis';
import TabNavigation from './hex-dashboard/TabNavigation';
import DashboardActions from './hex-dashboard/DashboardActions';
import FilterControls from './hex-dashboard/FilterControls';
import LiveStats from './hex-dashboard/LiveStats';
import DataTable from './hex-dashboard/DataTable';
import StakingOverview from './hex-dashboard/StakingOverview';
import DexPairsModal from './hex-dashboard/DexPairsModal';
import { useHexDashboard } from './hex-dashboard/useHexDashboard';
import type { HexRow } from './hex-dashboard/types';

const HEXDataDashboard = () => {
  const {
    // State
    ethereumData,
    pulsechainData,
    liveData,
    activeTab,
    isLoading,
    error,
    sortConfig,
    filterDate,
    currentPage,
    showGeminiAnalysis,
    showDexPairs,
    isLoadingDexPairs,
    dexPairs,
    dexPairsError,
    stakingData,
    isLoadingStaking,
    stakingError,
    allStakeStarts,
    isLoadingAllStakes,
    stakingSubTab,
    activeStakes,
    isLoadingActiveStakes,
    
    // Actions
    fetchData,
    loadStakingData,
    loadDexPairs,
    loadAllStakeStarts,
    loadActiveStakes,
    setActiveTab,
    setCurrentPage,
    setSortConfig,
    setFilterDate,
    setShowGeminiAnalysis,
    setShowDexPairs,
    setStakingSubTab,
    getCurrentHexPrice,
  } = useHexDashboard();

  // Calculate sorted and filtered data
  const { sortedData, paginatedData } = useMemo(() => {
    const currentData = activeTab === 'ethereum' ? ethereumData : pulsechainData;
    
    // Apply date filter
    let filteredData = currentData;
    if (filterDate) {
      filteredData = currentData.filter(row => {
        const rowDate = new Date(row.date).toISOString().split('T')[0];
        return rowDate >= filterDate;
      });
    }

    // Apply sorting
    const sorted = [...filteredData].sort((a, b) => {
      const aValue = a[sortConfig.key];
      const bValue = b[sortConfig.key];
      
      if (aValue === null || aValue === undefined) return 1;
      if (bValue === null || bValue === undefined) return -1;
      
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortConfig.direction === 'asc' 
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }
      
      const numA = Number(aValue);
      const numB = Number(bValue);
      
      if (isNaN(numA) || isNaN(numB)) return 0;
      
      return sortConfig.direction === 'asc' ? numA - numB : numB - numA;
    });

    // Apply pagination
    const itemsPerPage = 50;
    const startIndex = (currentPage - 1) * itemsPerPage;
    const paginated = sorted.slice(startIndex, startIndex + itemsPerPage);

    return { sortedData: sorted, paginatedData: paginated };
  }, [activeTab, ethereumData, pulsechainData, filterDate, sortConfig, currentPage]);

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-12">
            <div className="bg-red-900/20 border border-red-500/50 text-red-300 px-4 py-3 rounded mb-4">
              <h2 className="font-bold text-lg mb-2">Error Loading HEX Data</h2>
              <p className="mb-4">{error}</p>
              <button
                onClick={fetchData}
                className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded"
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-3 sm:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-4 sm:mb-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-4 sm:mb-6">
            <h1 className="text-xl sm:text-3xl font-bold text-white mb-3 sm:mb-4 md:mb-0">
              <span className="hidden sm:inline">HEX Analytics Dashboard</span>
              <span className="sm:hidden">HEX Analytics</span>
            </h1>
            
            <DashboardActions
              fetchData={fetchData}
              isLoading={isLoading}
              showGeminiAnalysis={showGeminiAnalysis}
              setShowGeminiAnalysis={setShowGeminiAnalysis}
              setShowDexPairs={setShowDexPairs}
              loadDexPairs={loadDexPairs}
            />
          </div>

          <TabNavigation
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            setCurrentPage={setCurrentPage}
            ethereumDataLength={ethereumData.length}
            pulsechainDataLength={pulsechainData.length}
            stakingData={stakingData}
            loadStakingData={loadStakingData}
          />

          <FilterControls
            filterDate={filterDate}
            setFilterDate={setFilterDate}
            paginatedDataLength={paginatedData.length}
            sortedDataLength={sortedData.length}
            activeTab={activeTab}
          />
        </div>

        {/* Live Stats Section */}
        <LiveStats
          liveData={liveData}
          activeTab={activeTab}
          isLoading={isLoading}
        />

        {/* Gemini Analysis */}
        {showGeminiAnalysis && (
          <div className="mb-6">
            <HexGeminiAnalysis
              dataEth={ethereumData}
              dataPls={pulsechainData}
              defaultNetwork={activeTab === 'ethereum' ? 'ethereum' : 'pulsechain'}
              defaultTimeframe="30d"
              concise={false}
            />
          </div>
        )}

        {/* Staking Data Display */}
        {activeTab === 'staking' && (
          <StakingOverview
            stakingData={stakingData}
            isLoadingStaking={isLoadingStaking}
            stakingError={stakingError}
            loadStakingData={loadStakingData}
            stakingSubTab={stakingSubTab}
            setStakingSubTab={setStakingSubTab}
            allStakeStarts={allStakeStarts}
            isLoadingAllStakes={isLoadingAllStakes}
            loadAllStakeStarts={loadAllStakeStarts}
            activeStakes={activeStakes}
            isLoadingActiveStakes={isLoadingActiveStakes}
            loadActiveStakes={loadActiveStakes}
            pulsechainStakeStarts={pulsechainStakeStarts}
            pulsechainActiveStakes={pulsechainActiveStakes}
            isLoadingPulsechainStakes={isLoadingPulsechainStakes}
            loadPulsechainStakeStarts={loadPulsechainStakeStarts}
            loadPulsechainActiveStakes={loadPulsechainActiveStakes}
            getSortedPulsechainData={getSortedPulsechainData}
            getPulsechainCacheStatus={getPulsechainCacheStatus}
            getCurrentHexPrice={getCurrentHexPrice}
          />
        )}

        {/* Data Table */}
        <DataTable
          data={paginatedData}
          sortConfig={sortConfig}
          setSortConfig={setSortConfig}
          currentPage={currentPage}
          itemsPerPage={50}
          setCurrentPage={setCurrentPage}
          activeTab={activeTab}
        />

        {/* DEX Pairs Modal */}
        <DexPairsModal
          isOpen={showDexPairs}
          onClose={() => setShowDexPairs(false)}
          isLoading={isLoadingDexPairs}
          error={dexPairsError}
          pairs={dexPairs}
        />
      </div>
    </div>
  );
};

export default HEXDataDashboard;
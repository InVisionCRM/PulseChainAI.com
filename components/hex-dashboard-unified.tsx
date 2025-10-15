"use client";
import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Database, Clock, TrendingUp, Users, Lock, AlertTriangle, CheckCircle } from 'lucide-react';
import { unifiedHexStakingService, type HexStakingMetrics, type HexStake } from '@/services/unifiedHexStakingService';
import { HexLoader } from '@/components/ui/hex-loader';
import { NumberTicker } from './magicui/number-ticker';

type NetworkType = 'ethereum' | 'pulsechain';

interface DatabaseStatus {
  tablesExist: boolean;
  networks: {
    network: NetworkType;
    stakeStarts: number;
    stakeEnds: number;
    globalInfo: number;
    lastSync: string | null;
  }[];
}

const UnifiedHEXDashboard = () => {
  const [activeTab, setActiveTab] = useState<NetworkType>('pulsechain');
  const [stakingData, setStakingData] = useState<{
    ethereum: HexStakingMetrics | null;
    pulsechain: HexStakingMetrics | null;
  }>({
    ethereum: null,
    pulsechain: null
  });
  
  const [loading, setLoading] = useState<{
    ethereum: boolean;
    pulsechain: boolean;
  }>({
    ethereum: false,
    pulsechain: false
  });
  
  const [error, setError] = useState<{
    ethereum: string | null;
    pulsechain: string | null;
  }>({
    ethereum: null,
    pulsechain: null
  });

  const [databaseStatus, setDatabaseStatus] = useState<DatabaseStatus | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Load staking data for a specific network
  const loadStakingData = useCallback(async (network: NetworkType) => {
    setLoading(prev => ({ ...prev, [network]: true }));
    setError(prev => ({ ...prev, [network]: null }));
    
    try {
      console.log(`📡 Loading ${network} staking data...`);
      const data = await unifiedHexStakingService.getStakingMetrics(network);
      
      setStakingData(prev => ({
        ...prev,
        [network]: data
      }));
      
      console.log(`✅ ${network} data loaded:`, {
        totalActiveStakes: data.totalActiveStakes,
        isDataAvailable: data.isDataAvailable,
        lastSync: data.lastSyncTime
      });
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : `Failed to load ${network} data`;
      console.error(`❌ Failed to load ${network} data:`, err);
      setError(prev => ({ ...prev, [network]: errorMessage }));
    } finally {
      setLoading(prev => ({ ...prev, [network]: false }));
    }
  }, []);

  // Load database status
  const loadDatabaseStatus = useCallback(async () => {
    try {
      const status = await unifiedHexStakingService.getDatabaseStatus();
      setDatabaseStatus(status);
    } catch (err) {
      console.error('❌ Failed to load database status:', err);
    }
  }, []);

  // Initial load
  useEffect(() => {
    const init = async () => {
      await Promise.all([
        loadDatabaseStatus(),
        loadStakingData('ethereum'),
        loadStakingData('pulsechain')
      ]);
    };
    init();
  }, [loadDatabaseStatus, loadStakingData]);

  // Refresh all data
  const refreshAllData = useCallback(async () => {
    setIsRefreshing(true);
    await Promise.all([
      loadDatabaseStatus(),
      loadStakingData('ethereum'),
      loadStakingData('pulsechain')
    ]);
    setIsRefreshing(false);
  }, [loadDatabaseStatus, loadStakingData]);

  // Get current network data
  const currentData = stakingData[activeTab];
  const currentLoading = loading[activeTab];
  const currentError = error[activeTab];

  // Format helpers
  const formatHexAmount = (amount: string) => 
    unifiedHexStakingService.formatHexAmount(amount);
    
  const formatStakeLength = (days: number) => 
    unifiedHexStakingService.formatStakeLength(days);

  const formatNumber = (num: number) => 
    num.toLocaleString();

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleString();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-purple-50 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              HEX Staking Dashboard
            </h1>
            <p className="text-gray-600">
              Unified database-powered staking analytics for Ethereum and PulseChain
            </p>
          </div>
          
          <button
            onClick={refreshAllData}
            disabled={isRefreshing}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            {isRefreshing ? 'Refreshing...' : 'Refresh Data'}
          </button>
        </div>

        {/* Database Status Card */}
        {databaseStatus && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <div className="flex items-center gap-3 mb-4">
              <Database className="w-5 h-5 text-blue-600" />
              <h2 className="text-xl font-semibold">Database Status</h2>
              {databaseStatus.tablesExist ? (
                <CheckCircle className="w-5 h-5 text-green-500" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-red-500" />
              )}
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {databaseStatus.networks.map((network) => (
                <div key={network.network} className="bg-gray-50 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold capitalize">{network.network}</h3>
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      network.stakeStarts > 0 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {network.stakeStarts > 0 ? 'Has Data' : 'No Data'}
                    </span>
                  </div>
                  <div className="space-y-1 text-sm text-gray-600">
                    <div>Stakes: {formatNumber(network.stakeStarts)}</div>
                    <div>Endings: {formatNumber(network.stakeEnds)}</div>
                    <div>Global Info: {formatNumber(network.globalInfo)} records</div>
                    <div>Last Sync: {formatDate(network.lastSync)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Network Tabs */}
        <div className="flex space-x-1 mb-6">
          <button
            onClick={() => setActiveTab('pulsechain')}
            className={`px-6 py-3 rounded-lg font-medium transition-colors ${
              activeTab === 'pulsechain'
                ? 'bg-purple-600 text-white shadow-lg'
                : 'bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            PulseChain HEX
          </button>
          <button
            onClick={() => setActiveTab('ethereum')}
            className={`px-6 py-3 rounded-lg font-medium transition-colors ${
              activeTab === 'ethereum'
                ? 'bg-blue-600 text-white shadow-lg'
                : 'bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            Ethereum HEX
          </button>
        </div>

        {/* Loading State */}
        {currentLoading && (
          <div className="flex flex-col items-center justify-center py-12">
            <HexLoader />
            <p className="mt-4 text-gray-600">Loading {activeTab} staking data...</p>
          </div>
        )}

        {/* Error State */}
        {currentError && !currentLoading && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              <h3 className="font-semibold text-red-800">Error Loading Data</h3>
            </div>
            <p className="text-red-700 mb-4">{currentError}</p>
            <button
              onClick={() => loadStakingData(activeTab)}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              Retry
            </button>
          </div>
        )}

        {/* Main Content */}
        {currentData && !currentLoading && !currentError && (
          <>
            {/* No Data State */}
            {!currentData.isDataAvailable && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mb-6">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-5 h-5 text-yellow-500" />
                  <h3 className="font-semibold text-yellow-800">No Data Available</h3>
                </div>
                <p className="text-yellow-700 mb-4">
                  No staking data is available for {activeTab}. This could mean:
                </p>
                <ul className="list-disc list-inside text-yellow-700 space-y-1">
                  <li>Data sync hasn't run yet for this network</li>
                  <li>Database tables are empty</li>
                  <li>Sync process encountered errors</li>
                </ul>
              </div>
            )}

            {/* Overview Stats */}
            {currentData.isDataAvailable && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                  {/* Total Active Stakes */}
                  <div className="bg-white rounded-lg shadow-md p-6">
                    <div className="flex items-center gap-3 mb-2">
                      <Lock className="w-5 h-5 text-blue-600" />
                      <h3 className="font-semibold text-gray-700">Active Stakes</h3>
                    </div>
                    <div className="text-2xl font-bold text-gray-900">
                      <NumberTicker value={currentData.totalActiveStakes} />
                    </div>
                    <p className="text-sm text-gray-500 mt-1">Currently active</p>
                  </div>

                  {/* Total Staked HEX */}
                  <div className="bg-white rounded-lg shadow-md p-6">
                    <div className="flex items-center gap-3 mb-2">
                      <TrendingUp className="w-5 h-5 text-green-600" />
                      <h3 className="font-semibold text-gray-700">Total Staked</h3>
                    </div>
                    <div className="text-2xl font-bold text-gray-900">
                      {formatHexAmount(currentData.totalStakedHearts)}
                    </div>
                    <p className="text-sm text-gray-500 mt-1">HEX locked</p>
                  </div>

                  {/* Average Stake Length */}
                  <div className="bg-white rounded-lg shadow-md p-6">
                    <div className="flex items-center gap-3 mb-2">
                      <Clock className="w-5 h-5 text-purple-600" />
                      <h3 className="font-semibold text-gray-700">Avg Length</h3>
                    </div>
                    <div className="text-2xl font-bold text-gray-900">
                      {Math.round(currentData.averageStakeLength)}
                    </div>
                    <p className="text-sm text-gray-500 mt-1">days average</p>
                  </div>

                  {/* Current HEX Day */}
                  <div className="bg-white rounded-lg shadow-md p-6">
                    <div className="flex items-center gap-3 mb-2">
                      <Users className="w-5 h-5 text-orange-600" />
                      <h3 className="font-semibold text-gray-700">HEX Day</h3>
                    </div>
                    <div className="text-2xl font-bold text-gray-900">
                      {currentData.globalInfo?.hexDay || '---'}
                    </div>
                    <p className="text-sm text-gray-500 mt-1">Current day</p>
                  </div>
                </div>

                {/* Top Stakes Table */}
                {currentData.topStakes.length > 0 && (
                  <div className="bg-white rounded-lg shadow-md overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-200">
                      <h3 className="text-lg font-semibold text-gray-900">
                        Top Stakes ({currentData.topStakes.length})
                      </h3>
                      <p className="text-sm text-gray-500">
                        Largest active stakes by HEX amount
                      </p>
                    </div>
                    
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Stake ID
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Staker
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Amount
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Length
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Progress
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Status
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {currentData.topStakes.slice(0, 20).map((stake) => {
                            const progress = stake.daysServed && parseInt(stake.stakedDays) 
                              ? (stake.daysServed / parseInt(stake.stakedDays)) * 100 
                              : 0;
                            
                            return (
                              <tr key={stake.stakeId} className="hover:bg-gray-50">
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">
                                  {stake.stakeId.slice(0, 8)}...
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">
                                  {stake.stakerAddr.slice(0, 6)}...{stake.stakerAddr.slice(-4)}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                                  {formatHexAmount(stake.stakedHearts)} HEX
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                  {formatStakeLength(parseInt(stake.stakedDays))}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                  <div className="flex items-center gap-2">
                                    <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                                      <div 
                                        className="h-full bg-blue-500 transition-all duration-300"
                                        style={{ width: `${Math.min(progress, 100)}%` }}
                                      />
                                    </div>
                                    <span className="text-xs">{Math.round(progress)}%</span>
                                  </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                    stake.isActive 
                                      ? 'bg-green-100 text-green-800' 
                                      : 'bg-red-100 text-red-800'
                                  }`}>
                                    {stake.isActive ? 'Active' : 'Ended'}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* Footer */}
        <div className="mt-8 text-center text-gray-500 text-sm">
          <p>
            Unified HEX Dashboard • Database-powered analytics • 
            Last updated: {currentData?.lastSyncTime ? formatDate(currentData.lastSyncTime) : 'Never'}
          </p>
        </div>
      </div>
    </div>
  );
};

export default UnifiedHEXDashboard;
import React, { useState, useEffect, useMemo } from 'react';
import { Brain, Calendar, TrendingUp, TrendingDown, AlertTriangle, CheckCircle, Clock, Zap, Target, BarChart3, Info, Calculator, ArrowRight, ArrowLeft } from 'lucide-react';
import { hexStakingService } from '@/services/hexStakingService';
import { pulsechainHexStakingService } from '@/services/pulsechainHexStakingService';
import StakerHistoryModal from './StakerHistoryModal';

interface EndstakeTimingInput {
  hexAmount: number;
  targetDays: number;
  strategy: 'lump-sum' | 'ladder';
  varianceDays: number;
  network: 'ethereum' | 'pulsechain' | 'both';
}

interface StakeEndAnalysis {
  endDay: number;
  totalHexEnding: number;
  stakeCount: number;
  stakes: any[];
  averageStakeSize: number;
  largestStake: number;
  riskLevel: 'low' | 'medium' | 'high';
  riskFactors: string[];
}

interface EndstakeRecommendation {
  recommendedDay: number;
  reasoning: string[];
  riskAssessment: string;
  alternativeDays: number[];
  marketImpact: string;
  confidence: 'high' | 'medium' | 'low';
}

const EndstakeTimingAI: React.FC = () => {
  const [inputs, setInputs] = useState<EndstakeTimingInput>({
    hexAmount: 1000000,
    targetDays: 365,
    strategy: 'lump-sum',
    varianceDays: 10,
    network: 'both'
  });

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<StakeEndAnalysis[]>([]);
  const [recommendation, setRecommendation] = useState<EndstakeRecommendation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'input' | 'analysis' | 'recommendation'>('input');
  const [selectedStakerAddress, setSelectedStakerAddress] = useState<string | null>(null);
  const [isStakerHistoryModalOpen, setIsStakerHistoryModalOpen] = useState(false);
  const [selectedNetwork, setSelectedNetwork] = useState<'ethereum' | 'pulsechain'>('ethereum');

  // Calculate the target end date range
  const targetDateRange = useMemo(() => {
    const today = Math.floor(Date.now() / 1000);
    const targetEndTime = today + (inputs.targetDays * 24 * 60 * 60);
    const varianceSeconds = inputs.varianceDays * 24 * 60 * 60;
    
    return {
      start: targetEndTime - varianceSeconds,
      end: targetEndTime + varianceSeconds,
      target: targetEndTime
    };
  }, [inputs.targetDays, inputs.varianceDays]);

  // Helper function to calculate end date from end day
  const getEndDate = (endDay: number): string => {
    const today = Math.floor(Date.now() / 1000);
    const endTimestamp = today + (endDay * 24 * 60 * 60);
    return new Date(endTimestamp * 1000).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const analyzeEndstakeTiming = async () => {
    setIsAnalyzing(true);
    setError(null);
    setAnalysis([]);
    setRecommendation(null);

    try {
      const analysisResults: StakeEndAnalysis[] = [];
      
      // Analyze both networks if selected
      const networks = inputs.network === 'both' 
        ? ['ethereum', 'pulsechain'] 
        : [inputs.network];

      for (const network of networks) {
        const service = network === 'ethereum' ? hexStakingService : pulsechainHexStakingService;
        
        // Get all active stakes
        const activeStakes = await service.getAllActiveStakes();
        
        // Filter stakes ending within our target range
        const relevantStakes = activeStakes.filter(stake => {
          const stakeEndTime = parseInt(stake.timestamp) + (parseInt(stake.stakedDays) * 24 * 60 * 60);
          return stakeEndTime >= targetDateRange.start && stakeEndTime <= targetDateRange.end;
        });

        // Group stakes by end day
        const stakesByDay = new Map<number, any[]>();
        relevantStakes.forEach(stake => {
          const stakeEndTime = parseInt(stake.timestamp) + (parseInt(stake.stakedDays) * 24 * 60 * 60);
          const endDay = Math.floor((stakeEndTime - Math.floor(Date.now() / 1000)) / (24 * 60 * 60));
          
          if (!stakesByDay.has(endDay)) {
            stakesByDay.set(endDay, []);
          }
          stakesByDay.get(endDay)!.push(stake);
        });

        // Analyze each day
        for (const [endDay, stakes] of stakesByDay) {
          const totalHex = stakes.reduce((sum, stake) => sum + parseFloat(stake.stakedHearts), 0);
          const averageStake = totalHex / stakes.length;
          const largestStake = Math.max(...stakes.map(stake => parseFloat(stake.stakedHearts)));

          // Calculate risk level
          let riskLevel: 'low' | 'medium' | 'high' = 'low';
          const riskFactors: string[] = [];

          if (totalHex > inputs.hexAmount * 0.5) {
            riskLevel = 'high';
            riskFactors.push(`High selling pressure: ${(totalHex / Math.pow(10, 8)).toLocaleString()} HEX ending`);
          } else if (totalHex > inputs.hexAmount * 0.2) {
            riskLevel = 'medium';
            riskFactors.push(`Moderate selling pressure: ${(totalHex / Math.pow(10, 8)).toLocaleString()} HEX ending`);
          }

          if (largestStake > inputs.hexAmount * 0.3) {
            riskLevel = riskLevel === 'low' ? 'medium' : 'high';
            riskFactors.push(`Large individual stake: ${(largestStake / Math.pow(10, 8)).toLocaleString()} HEX`);
          }

          if (stakes.length > 50) {
            riskLevel = riskLevel === 'low' ? 'medium' : 'high';
            riskFactors.push(`High stake count: ${stakes.length} stakes ending`);
          }

          analysisResults.push({
            endDay,
            totalHexEnding: totalHex,
            stakeCount: stakes.length,
            stakes,
            averageStakeSize: averageStake,
            largestStake,
            riskLevel,
            riskFactors
          });
        }
      }

      // Sort by end day
      analysisResults.sort((a, b) => a.endDay - b.endDay);
      setAnalysis(analysisResults);

      // Generate recommendation
      const recommendation = generateRecommendation(analysisResults, inputs);
      setRecommendation(recommendation);

      setActiveTab('recommendation');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to analyze endstake timing');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const generateRecommendation = (analysis: StakeEndAnalysis[], inputs: EndstakeTimingInput): EndstakeRecommendation => {
    // Find the lowest risk day
    const lowRiskDays = analysis.filter(day => day.riskLevel === 'low');
    const mediumRiskDays = analysis.filter(day => day.riskLevel === 'medium');
    
    let recommendedDay: number;
    let reasoning: string[] = [];
    let confidence: 'high' | 'medium' | 'low' = 'high';

    if (lowRiskDays.length > 0) {
      // Find the day closest to target with lowest risk
      const targetDay = inputs.targetDays;
      const closestLowRisk = lowRiskDays.reduce((closest, day) => 
        Math.abs(day.endDay - targetDay) < Math.abs(closest.endDay - targetDay) ? day : closest
      );
      
      recommendedDay = closestLowRisk.endDay;
      reasoning.push(`Day ${recommendedDay} (${getEndDate(recommendedDay)}) has the lowest risk (${closestLowRisk.riskLevel})`);
      reasoning.push(`Only ${(closestLowRisk.totalHexEnding / Math.pow(10, 8)).toFixed(2)} HEX ending on this day`);
      reasoning.push(`Close to your target of ${inputs.targetDays} days`);
      confidence = 'high';
    } else if (mediumRiskDays.length > 0) {
      // Find the best medium risk day
      const targetDay = inputs.targetDays;
      const bestMediumRisk = mediumRiskDays.reduce((best, day) => 
        Math.abs(day.endDay - targetDay) < Math.abs(best.endDay - targetDay) ? day : best
      );
      
      recommendedDay = bestMediumRisk.endDay;
      reasoning.push(`Day ${recommendedDay} (${getEndDate(recommendedDay)}) has moderate risk (${bestMediumRisk.riskLevel})`);
      reasoning.push(`${(bestMediumRisk.totalHexEnding / Math.pow(10, 8)).toFixed(2)} HEX ending on this day`);
      reasoning.push(`Best available option within your variance range`);
      confidence = 'medium';
    } else {
      // All days are high risk, find the least bad option
      const targetDay = inputs.targetDays;
      const leastBadDay = analysis.reduce((least, day) => 
        Math.abs(day.endDay - targetDay) < Math.abs(least.endDay - targetDay) ? day : least
      );
      
      recommendedDay = leastBadDay.endDay;
      reasoning.push(`Day ${recommendedDay} (${getEndDate(recommendedDay)}) is the least risky option available`);
      reasoning.push(`All days in your range have high selling pressure`);
      reasoning.push(`Consider extending your variance range or adjusting your target`);
      confidence = 'low';
    }

    // Find alternative days
    const alternativeDays = analysis
      .filter(day => day.endDay !== recommendedDay && day.riskLevel === 'low')
      .slice(0, 3)
      .map(day => day.endDay);

    // Generate risk assessment
    const riskAssessment = generateRiskAssessment(analysis, recommendedDay);

    // Generate market impact
    const marketImpact = generateMarketImpact(analysis, recommendedDay, inputs);

    return {
      recommendedDay,
      reasoning,
      riskAssessment,
      alternativeDays,
      marketImpact,
      confidence
    };
  };

  const generateRiskAssessment = (analysis: StakeEndAnalysis[], recommendedDay: number): string => {
    const day = analysis.find(d => d.endDay === recommendedDay);
    if (!day) return 'Unable to assess risk for recommended day.';

    if (day.riskLevel === 'low') {
      return `Low risk: Minimal selling pressure with only ${(day.totalHexEnding / Math.pow(10, 8)).toFixed(2)} HEX ending. This day provides a safe exit with minimal market impact.`;
    } else if (day.riskLevel === 'medium') {
      return `Medium risk: Moderate selling pressure with ${(day.totalHexEnding / Math.pow(10, 8)).toFixed(2)} HEX ending. While not ideal, this day offers a reasonable balance of timing and risk.`;
    } else {
      return `High risk: Significant selling pressure with ${(day.totalHexEnding / Math.pow(10, 8)).toFixed(2)} HEX ending. This day should be avoided if possible.`;
    }
  };

  const generateMarketImpact = (analysis: StakeEndAnalysis[], recommendedDay: number, inputs: EndstakeTimingInput): string => {
    const day = analysis.find(d => d.endDay === recommendedDay);
    if (!day) return 'Unable to assess market impact.';

    const userHexInMillions = inputs.hexAmount / Math.pow(10, 6);
    const marketHexInMillions = day.totalHexEnding / Math.pow(10, 6);
    const userPercentage = (userHexInMillions / (userHexInMillions + marketHexInMillions)) * 100;

    if (userPercentage > 50) {
      return `Your stake represents ${userPercentage.toFixed(1)}% of the total HEX ending on this day. You'll have significant influence on the market.`;
    } else if (userPercentage > 20) {
      return `Your stake represents ${userPercentage.toFixed(1)}% of the total HEX ending on this day. Moderate market influence expected.`;
    } else {
      return `Your stake represents ${userPercentage.toFixed(1)}% of the total HEX ending on this day. Minimal market influence.`;
    }
  };

  const formatHexAmount = (hearts: number): string => {
    return (hearts / Math.pow(10, 8)).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  const getRiskColor = (riskLevel: string): string => {
    switch (riskLevel) {
      case 'low': return 'text-green-400';
      case 'medium': return 'text-yellow-400';
      case 'high': return 'text-red-400';
      default: return 'text-slate-400';
    }
  };

  const handleStakerClick = (address: string, network: 'ethereum' | 'pulsechain' | 'both') => {
    setSelectedStakerAddress(address);
    setSelectedNetwork(network === 'both' ? 'ethereum' : network);
    setIsStakerHistoryModalOpen(true);
  };

  const handleStakerHistoryModalClose = () => {
    setIsStakerHistoryModalOpen(false);
    setSelectedStakerAddress(null);
  };

  const getRiskBgColor = (riskLevel: string): string => {
    switch (riskLevel) {
      case 'low': return 'bg-green-500/20 border-green-500/30';
      case 'medium': return 'bg-yellow-500/20 border-yellow-500/30';
      case 'high': return 'bg-red-500/20 border-red-500/30';
      default: return 'bg-slate-500/20 border-slate-500/30';
    }
  };

  return (
    <div className="bg-gradient-to-br from-slate-900/95 to-purple-900/95 backdrop-blur-xl border border-white/20 rounded-3xl shadow-[0_20px_50px_-12px_rgba(0,0,0,0.8)] p-8">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="flex items-center justify-center gap-3 mb-4">
          <div className="p-3 bg-purple-500/20 rounded-xl">
            <Brain className="w-8 h-8 text-purple-400" />
          </div>
          <div>
            <h2 className="text-3xl font-bold text-white">Endstake Timing AI</h2>
            <p className="text-slate-400 text-lg">AI-powered analysis for optimal endstake timing</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-white/10 mb-6">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('input')}
            className={`py-3 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
              activeTab === 'input'
                ? 'border-purple-500 text-purple-400'
                : 'border-transparent text-slate-400 hover:text-slate-300'
            }`}
          >
            <Calculator className="w-4 h-4" />
            Input Parameters
          </button>
          <button
            onClick={() => setActiveTab('analysis')}
            className={`py-3 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
              activeTab === 'analysis'
                ? 'border-purple-500 text-purple-400'
                : 'border-transparent text-slate-400 hover:text-slate-300'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            Market Analysis
          </button>
          <button
            onClick={() => setActiveTab('recommendation')}
            className={`py-3 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
              activeTab === 'recommendation'
                ? 'border-purple-500 text-purple-400'
                : 'border-transparent text-slate-400 hover:text-slate-300'
            }`}
          >
            <Target className="w-4 h-4" />
            AI Recommendation
          </button>
        </nav>
      </div>

      {/* Input Tab */}
      {activeTab === 'input' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* HEX Amount */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
              <img src="/HEXagon (1).svg" alt="HEX" className="w-4 h-4" />
              HEX Amount to Stake
            </label>
              <div className="relative">
                <input
                  type="number"
                  value={inputs.hexAmount}
                  onChange={(e) => setInputs(prev => ({ ...prev, hexAmount: parseFloat(e.target.value) || 0 }))}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="1000000"
                />
                <div className="absolute right-3 top-3 text-slate-400 text-sm flex items-center gap-1">
                  <img src="/HEXagon (1).svg" alt="HEX" className="w-4 h-4" />
                  HEX
                </div>
              </div>
            </div>

            {/* Target Days */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Target Stake Length (Days)</label>
              <input
                type="number"
                value={inputs.targetDays}
                onChange={(e) => setInputs(prev => ({ ...prev, targetDays: parseInt(e.target.value) || 0 }))}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="365"
              />
            </div>

            {/* Strategy */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Staking Strategy</label>
              <select
                value={inputs.strategy}
                onChange={(e) => setInputs(prev => ({ ...prev, strategy: e.target.value as 'lump-sum' | 'ladder' }))}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="lump-sum">Lump Sum Stake</option>
                <option value="ladder">Ladder Staking</option>
              </select>
            </div>

            {/* Variance Days */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Variance Days (±)</label>
              <input
                type="number"
                value={inputs.varianceDays}
                onChange={(e) => setInputs(prev => ({ ...prev, varianceDays: parseInt(e.target.value) || 0 }))}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="10"
              />
            </div>

            {/* Network */}
            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-medium text-slate-300">Network Analysis</label>
              <select
                value={inputs.network}
                onChange={(e) => setInputs(prev => ({ ...prev, network: e.target.value as 'ethereum' | 'pulsechain' | 'both' }))}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="both">Both Ethereum & PulseChain</option>
                <option value="ethereum">
                  <img src="/ethlogo.svg" alt="Ethereum" className="w-4 h-4" />
                  Ethereum Only
                </option>
                <option value="pulsechain">
                  <img src="/LogoVector.svg" alt="PulseChain" className="w-4 h-4" />
                  PulseChain Only
                </option>
              </select>
            </div>
          </div>

          {/* Analysis Button */}
          <div className="text-center">
            <button
              onClick={analyzeEndstakeTiming}
              disabled={isAnalyzing || inputs.hexAmount <= 0 || inputs.targetDays <= 0 || inputs.varianceDays <= 0}
              className="bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 text-white font-bold py-4 px-8 rounded-xl flex items-center gap-3 mx-auto transition-colors"
            >
              {isAnalyzing ? (
                <>
                  <div className="flex items-center gap-3">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
                    <span>Analyzing Market...</span>
                  </div>
                </>
              ) : (
                <>
                  <Brain className="w-6 h-6" />
                  Analyze Endstake Timing
                </>
              )}
            </button>
          </div>

          {/* Info Box */}
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-blue-400 mt-0.5" />
              <div className="text-sm text-slate-300">
                <p className="font-medium text-blue-400 mb-2">How it works:</p>
                <ul className="space-y-1">
                  <li>• AI scans all stakes ending within your variance window</li>
                  <li>• Identifies large endstakes that could create selling pressure</li>
                  <li>• Recommends optimal timing to avoid market impact</li>
                  <li>• Provides detailed reasoning and risk assessment</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Analysis Tab */}
      {activeTab === 'analysis' && analysis.length > 0 && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-semibold text-white">Market Analysis Results</h3>
            <div className="text-sm text-slate-400">
              Analyzing {inputs.varianceDays * 2 + 1} days around day {inputs.targetDays}
            </div>
          </div>

          {/* Analysis Table */}
          <div className="bg-white/5 backdrop-blur border border-white/10 rounded-xl overflow-hidden">
            <div className="overflow-auto">
              <table className="min-w-full divide-y divide-white/10">
                <thead className="bg-slate-900 text-white">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">End Day</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">End Date</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider flex items-center gap-1">
                      <img src="/HEXagon (1).svg" alt="HEX" className="w-4 h-4" />
                      Total HEX Ending
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">Stake Count</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">Staker Addresses</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider flex items-center gap-1">
                      <img src="/HEXagon (1).svg" alt="HEX" className="w-4 h-4" />
                      Avg Stake Size
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider flex items-center gap-1">
                      <img src="/HEXagon (1).svg" alt="HEX" className="w-4 h-4" />
                      Largest Stake
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">Risk Level</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">Risk Factors</th>
                  </tr>
                </thead>
                <tbody className="bg-transparent divide-y divide-white/10">
                  {analysis.map((day, index) => (
                    <tr key={index} className="hover:bg-white/5">
                      <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-white">
                        Day {day.endDay}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-blue-400">
                        {getEndDate(day.endDay)}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-green-400 flex items-center gap-1">
                        <img src="/HEXagon (1).svg" alt="HEX" className="w-4 h-4" />
                        {formatHexAmount(day.totalHexEnding)} HEX
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-slate-300">
                        {day.stakeCount}
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-300">
                        <div className="space-y-1 max-w-xs">
                          {day.stakes?.slice(0, 3).map((stake, idx) => (
                            <div key={idx} className="flex items-center gap-2">
                              <span className="font-mono text-xs text-cyan-400 hover:text-cyan-300 cursor-pointer" 
                                    title={stake.stakerAddr}
                                    onClick={() => handleStakerClick(stake.stakerAddr, inputs.network)}>
                                {stake.stakerAddr.slice(0, 8)}...{stake.stakerAddr.slice(-6)}
                              </span>
                              <span className="text-xs text-slate-500 flex items-center gap-1">
                                <img src="/HEXagon (1).svg" alt="HEX" className="w-3 h-3" />
                                ({formatHexAmount(parseFloat(stake.stakedHearts))} HEX)
                              </span>
                            </div>
                          ))}
                          {day.stakes && day.stakes.length > 3 && (
                            <div className="text-xs text-slate-500 italic">
                              +{day.stakes.length - 3} more stakes
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-blue-400 flex items-center gap-1">
                        <img src="/HEXagon (1).svg" alt="HEX" className="w-4 h-4" />
                        {formatHexAmount(day.averageStakeSize)} HEX
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-purple-400 flex items-center gap-1">
                        <img src="/HEXagon (1).svg" alt="HEX" className="w-4 h-4" />
                        {formatHexAmount(day.largestStake)} HEX
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getRiskBgColor(day.riskLevel)} ${getRiskColor(day.riskLevel)}`}>
                          {day.riskLevel.charAt(0).toUpperCase() + day.riskLevel.slice(1)}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-300">
                        <div className="space-y-1">
                          {day.riskFactors.map((factor, idx) => (
                            <div key={idx} className="text-xs">• {factor}</div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Navigation */}
          <div className="flex justify-between">
            <button
              onClick={() => setActiveTab('input')}
              className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Input
            </button>
            <button
              onClick={() => setActiveTab('recommendation')}
              className="flex items-center gap-2 text-purple-400 hover:text-purple-300 transition-colors"
            >
              View AI Recommendation
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Recommendation Tab */}
      {activeTab === 'recommendation' && recommendation && (
        <div className="space-y-6">
          <div className="text-center">
            <h3 className="text-2xl font-bold text-white mb-2">AI Recommendation</h3>
            <p className="text-slate-400">Based on market analysis, here's your optimal endstake timing</p>
          </div>

          {/* Main Recommendation */}
          <div className="bg-gradient-to-br from-purple-500/10 to-blue-500/10 border border-purple-500/20 rounded-xl p-6">
            <div className="text-center">
              <div className="flex items-center justify-center gap-3 mb-4">
                <Target className="w-8 h-8 text-purple-400" />
                <div className="text-center">
                  <span className="text-3xl font-bold text-white">Day {recommendation.recommendedDay}</span>
                  <div className="text-lg text-slate-300 mt-1">
                    {getEndDate(recommendation.recommendedDay)}
                  </div>
                </div>
              </div>
              
              <div className="flex items-center justify-center gap-2 mb-4">
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                  recommendation.confidence === 'high' ? 'bg-green-500/20 text-green-400' :
                  recommendation.confidence === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                  'bg-red-500/20 text-red-400'
                }`}>
                  {recommendation.confidence.charAt(0).toUpperCase() + recommendation.confidence.slice(1)} Confidence
                </span>
              </div>

              <div className="text-lg text-slate-300 mb-6">
                {recommendation.marketImpact}
              </div>
            </div>

            {/* Reasoning */}
            <div className="space-y-3">
              <h4 className="text-lg font-semibold text-white text-center">Why This Day?</h4>
              <div className="space-y-2">
                {recommendation.reasoning.map((reason, index) => (
                  <div key={index} className="flex items-start gap-3 bg-white/5 rounded-lg p-3">
                    <CheckCircle className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
                    <span className="text-slate-300">{reason}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Risk Assessment */}
          <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 border border-slate-700/50 rounded-xl p-6">
            <h4 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-yellow-400" />
              Risk Assessment
            </h4>
            <p className="text-slate-300 leading-relaxed">{recommendation.riskAssessment}</p>
          </div>

          {/* Alternative Options */}
          {recommendation.alternativeDays.length > 0 && (
            <div className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border border-blue-500/20 rounded-xl p-6">
              <h4 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                <Clock className="w-5 h-5 text-blue-400" />
                Alternative Options
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {recommendation.alternativeDays.map((day, index) => (
                  <div key={index} className="bg-white/5 rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-blue-400">Day {day}</div>
                    <div className="text-sm text-slate-300">{getEndDate(day)}</div>
                    <div className="text-xs text-slate-400">Low Risk Alternative</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="flex justify-between">
            <button
              onClick={() => setActiveTab('analysis')}
              className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              View Analysis
            </button>
            <button
              onClick={() => setActiveTab('input')}
              className="flex items-center gap-2 text-purple-400 hover:text-purple-300 transition-colors"
            >
              New Analysis
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="bg-red-900/20 border border-red-500/50 text-red-300 px-6 py-4 rounded-xl">
          <h3 className="font-bold text-lg mb-2">Analysis Error</h3>
          <p>{error}</p>
        </div>
      )}

      {/* Staker History Modal */}
      <StakerHistoryModal
        stakerAddress={selectedStakerAddress}
        isOpen={isStakerHistoryModalOpen}
        onClose={handleStakerHistoryModalClose}
        network={selectedNetwork}
      />
    </div>
  );
};

export default EndstakeTimingAI;

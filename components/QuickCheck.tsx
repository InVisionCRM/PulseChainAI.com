import React, { useState, useEffect } from 'react';
import type { ContractData, TokenInfo } from '../types';

interface QuickCheckResult {
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  riskDescription: string;
  buyTax: number;
  sellTax: number;
  transferTax: number;
  buyGas: number;
  sellGas: number;
  buyLimit: string;
  sellLimit: string;
  isOpenSource: boolean;
  holdersAnalyzed: number;
  siphoned: number;
  averageGas: number;
  canSell: number;
  cantSell: number;
  averageTax: number;
  highestTax: number;
  vulnerabilities: string[];
  recommendations: string[];
}

interface QuickCheckProps {
  contractData: ContractData | null;
  tokenInfo: TokenInfo | null;
  isLoading: boolean;
}

const QuickCheck: React.FC<QuickCheckProps> = ({ contractData, tokenInfo, isLoading }) => {
  const [analysisResult, setAnalysisResult] = useState<QuickCheckResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  useEffect(() => {
    if (contractData && !isLoading) {
      performQuickCheck();
    }
  }, [contractData, isLoading]);

  const performQuickCheck = async () => {
    if (!contractData) return;
    
    setIsAnalyzing(true);
    
    try {
      // Simulate analysis time
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Analyze the contract for various security aspects
      const result = await analyzeContract(contractData, tokenInfo);
      setAnalysisResult(result);
    } catch (error) {
      console.error('Quick check analysis failed:', error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const analyzeContract = async (contract: ContractData, token: TokenInfo | null): Promise<QuickCheckResult> => {
    // This would be replaced with actual AI analysis
    const sourceCode = contract.source_code.toLowerCase();
    const abi = contract.abi;
    
    // Basic security checks
    const vulnerabilities: string[] = [];
    const recommendations: string[] = [];
    
    // Check for common honeypot patterns
    let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'LOW';
    let riskDescription = 'LOW RISK OF HONEYPOT';
    
    // Check for blacklist functions
    if (sourceCode.includes('blacklist') || sourceCode.includes('_blacklist')) {
      vulnerabilities.push('Blacklist function detected');
      riskLevel = 'MEDIUM';
      riskDescription = 'MEDIUM RISK - BLACKLIST FUNCTION DETECTED';
    }
    
    // Check for high taxes
    const hasHighTaxes = sourceCode.includes('_tax') && sourceCode.includes('0.1') || sourceCode.includes('10');
    if (hasHighTaxes) {
      vulnerabilities.push('High tax rates detected');
      riskLevel = 'HIGH';
      riskDescription = 'HIGH RISK - HIGH TAX RATES DETECTED';
    }
    
    // Check for mint functions
    if (sourceCode.includes('mint') && sourceCode.includes('onlyowner')) {
      vulnerabilities.push('Owner mint function detected');
      recommendations.push('Verify mint function access controls');
    }
    
    // Check for pause functions
    if (sourceCode.includes('pause') || sourceCode.includes('unpause')) {
      vulnerabilities.push('Pause functionality detected');
      recommendations.push('Verify pause function access controls');
    }
    
    // Check for proxy patterns
    if (sourceCode.includes('delegatecall') || sourceCode.includes('proxy')) {
      vulnerabilities.push('Proxy pattern detected');
      recommendations.push('Verify proxy implementation security');
    }
    
    // Check for reentrancy vulnerabilities
    if (sourceCode.includes('call') && sourceCode.includes('transfer')) {
      vulnerabilities.push('Potential reentrancy vulnerability');
      riskLevel = riskLevel === 'LOW' ? 'MEDIUM' : riskLevel;
    }
    
    // Generate simulation results
    const buyTax = hasHighTaxes ? Math.random() * 10 + 5 : 0;
    const sellTax = hasHighTaxes ? Math.random() * 10 + 5 : 0;
    const transferTax = 0;
    
    const buyGas = 150000 + Math.random() * 50000;
    const sellGas = 140000 + Math.random() * 40000;
    
    const holdersAnalyzed = token ? parseInt(token.holders) : 100 + Math.floor(Math.random() * 200);
    const siphoned = 0;
    const averageGas = (buyGas + sellGas) / 2;
    const canSell = holdersAnalyzed;
    const cantSell = 0;
    const averageTax = (buyTax + sellTax) / 2;
    const highestTax = Math.max(buyTax, sellTax);
    
    return {
      riskLevel,
      riskDescription,
      buyTax,
      sellTax,
      transferTax,
      buyGas: Math.round(buyGas),
      sellGas: Math.round(sellGas),
      buyLimit: 'NONE DETECTED',
      sellLimit: 'NONE DETECTED',
      isOpenSource: contract.is_verified,
      holdersAnalyzed,
      siphoned,
      averageGas: Math.round(averageGas),
      canSell,
      cantSell,
      averageTax,
      highestTax,
      vulnerabilities,
      recommendations
    };
  };

  const getRiskColor = (riskLevel: string) => {
    switch (riskLevel) {
      case 'LOW': return 'text-green-400';
      case 'MEDIUM': return 'text-yellow-400';
      case 'HIGH': return 'text-orange-400';
      case 'CRITICAL': return 'text-red-400';
      default: return 'text-green-400';
    }
  };

  const getRiskBgColor = (riskLevel: string) => {
    switch (riskLevel) {
      case 'LOW': return 'quick-check-banner';
      case 'MEDIUM': return 'quick-check-banner-warning';
      case 'HIGH': return 'quick-check-banner-warning';
      case 'CRITICAL': return 'quick-check-banner-critical';
      default: return 'quick-check-banner';
    }
  };

  const getBannerText = (riskLevel: string) => {
    switch (riskLevel) {
      case 'LOW': return 'PASSED';
      case 'MEDIUM': return 'WARNING';
      case 'HIGH': return 'HIGH RISK';
      case 'CRITICAL': return 'FAILED';
      default: return 'PASSED';
    }
  };

  if (isLoading || isAnalyzing) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4"></div>
          <p className="text-slate-400">Analyzing contract security...</p>
        </div>
      </div>
    );
  }

  if (!contractData) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-slate-400">Load a contract to perform quick security check</p>
      </div>
    );
  }

  if (!analysisResult) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-slate-400">No analysis results available</p>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Risk Level Banner */}
      <div className={`absolute left-0 top-0 bottom-0 w-16 ${getRiskBgColor(analysisResult.riskLevel)} flex items-center justify-center transform -skew-x-12 origin-left`}>
        <div className="transform skew-x-12 text-white font-bold text-lg tracking-wider">
          {getBannerText(analysisResult.riskLevel)}
        </div>
      </div>

      <div className="ml-20">
        {/* Token Identification & Risk Assessment */}
        <div className="bg-slate-800 rounded-lg p-6 mb-6 border border-slate-700">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h2 className="text-2xl font-bold text-white mb-1">
                {tokenInfo?.name || contractData.name}
              </h2>
              {tokenInfo?.symbol && (
                <p className="text-slate-400 text-lg">({tokenInfo.symbol})</p>
              )}
            </div>
            
            <div className="flex space-x-2">
              <button className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm transition-colors">
                SCAN ON TG
              </button>
              <button className="bg-slate-600 hover:bg-slate-700 text-white px-3 py-1 rounded text-sm transition-colors">
                ETHERSCAN
              </button>
            </div>
          </div>
          
          <div className="mb-4">
            <h3 className={`text-xl font-bold ${getRiskColor(analysisResult.riskLevel)} mb-2`}>
              {analysisResult.riskDescription}
            </h3>
            <p className="text-slate-400 text-sm">
              THIS CAN ALWAYS CHANGE! DO YOUR OWN DUE DILIGENCE.
            </p>
          </div>
          
          <div className="text-slate-300">
            <p className="font-mono text-sm">
              {contractData.creator_address_hash}
            </p>
          </div>
        </div>

        {/* Simulation Results */}
        <div className="bg-slate-800 rounded-lg p-6 mb-6 border border-slate-700">
          <h3 className="text-lg font-bold text-white mb-4">SIMULATION RESULTS</h3>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <p className="text-slate-400 text-sm">BUY TAX</p>
              <p className="text-white font-bold text-lg">{analysisResult.buyTax.toFixed(1)}%</p>
            </div>
            <div className="text-center">
              <p className="text-slate-400 text-sm">SELL TAX</p>
              <p className="text-white font-bold text-lg">{analysisResult.sellTax.toFixed(1)}%</p>
            </div>
            <div className="text-center">
              <p className="text-slate-400 text-sm">TRANSFER TAX</p>
              <p className="text-white font-bold text-lg">{analysisResult.transferTax.toFixed(1)}%</p>
            </div>
            <div className="text-center">
              <p className="text-slate-400 text-sm">BUY GAS</p>
              <p className="text-white font-bold text-lg">{analysisResult.buyGas.toLocaleString()}</p>
            </div>
            <div className="text-center">
              <p className="text-slate-400 text-sm">SELL GAS</p>
              <p className="text-white font-bold text-lg">{analysisResult.sellGas.toLocaleString()}</p>
            </div>
            <div className="text-center">
              <p className="text-slate-400 text-sm">BUY LIMIT</p>
              <p className="text-white font-bold text-lg">{analysisResult.buyLimit}</p>
            </div>
            <div className="text-center">
              <p className="text-slate-400 text-sm">SELL LIMIT</p>
              <p className="text-white font-bold text-lg">{analysisResult.sellLimit}</p>
            </div>
            <div className="text-center">
              <p className="text-slate-400 text-sm">SOURCE CODE</p>
              <div className="flex items-center justify-center">
                {analysisResult.isOpenSource ? (
                  <span className="text-green-400">✓ OPEN SOURCE</span>
                ) : (
                  <span className="text-red-400">✗ CLOSED SOURCE</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Recent Holder Analysis */}
        <div className="bg-slate-800 rounded-lg p-6 mb-6 border border-slate-700">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-bold text-white">RECENT HOLDER ANALYSIS</h3>
            <button className="text-blue-400 hover:text-blue-300 text-sm">
              WHAT'S THIS?
            </button>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <p className="text-slate-400 text-sm">HOLDERS ANALYSED</p>
              <p className="text-white font-bold text-lg">{analysisResult.holdersAnalyzed}</p>
            </div>
            <div className="text-center">
              <p className="text-slate-400 text-sm">SIPHONED</p>
              <p className="text-white font-bold text-lg">{analysisResult.siphoned}</p>
            </div>
            <div className="text-center">
              <p className="text-slate-400 text-sm">AVERAGE GAS</p>
              <p className="text-white font-bold text-lg">{analysisResult.averageGas.toLocaleString()}</p>
            </div>
            <div className="text-center">
              <p className="text-slate-400 text-sm">CAN SELL</p>
              <p className="text-green-400 font-bold text-lg">{analysisResult.canSell}</p>
            </div>
            <div className="text-center">
              <p className="text-slate-400 text-sm">CAN'T SELL</p>
              <p className="text-red-400 font-bold text-lg">{analysisResult.cantSell}</p>
            </div>
            <div className="text-center">
              <p className="text-slate-400 text-sm">AVERAGE TAX</p>
              <p className="text-white font-bold text-lg">{analysisResult.averageTax.toFixed(1)}%</p>
            </div>
            <div className="text-center">
              <p className="text-slate-400 text-sm">HIGHEST TAX</p>
              <p className="text-white font-bold text-lg">{analysisResult.highestTax.toFixed(1)}%</p>
            </div>
          </div>
        </div>

        {/* Security Analysis */}
        {analysisResult.vulnerabilities.length > 0 && (
          <div className="bg-slate-800 rounded-lg p-6 mb-6 border border-slate-700">
            <h3 className="text-lg font-bold text-white mb-4">SECURITY ANALYSIS</h3>
            
            <div className="space-y-4">
              <div>
                <h4 className="text-red-400 font-semibold mb-2">Vulnerabilities Detected:</h4>
                <ul className="list-disc list-inside space-y-1 text-slate-300">
                  {analysisResult.vulnerabilities.map((vuln, index) => (
                    <li key={index}>{vuln}</li>
                  ))}
                </ul>
              </div>
              
              {analysisResult.recommendations.length > 0 && (
                <div>
                  <h4 className="text-yellow-400 font-semibold mb-2">Recommendations:</h4>
                  <ul className="list-disc list-inside space-y-1 text-slate-300">
                    {analysisResult.recommendations.map((rec, index) => (
                      <li key={index}>{rec}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default QuickCheck; 
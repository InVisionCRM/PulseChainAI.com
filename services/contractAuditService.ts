import type { ContractData, AbiItem, ContractAuditResult } from '@/types';
import { fetchAddressInfo } from './pulsechainService';

const PUMP_TIRES_CREATOR = '0x6538A83a81d855B965983161AF6a83e616D16fD5';

interface OwnershipData {
  creatorAddress: string | null;
  ownerAddress: string | null;
  isRenounced: boolean;
  renounceTxHash: string | null;
}

/**
 * Checks if ABI contains functions matching given patterns
 */
function hasFunction(abi: AbiItem[], patterns: string[]): boolean {
  if (!abi || !Array.isArray(abi)) return false;
  return abi.some(item => 
    item.type === 'function' && 
    item.name &&
    patterns.some(pattern => 
      item.name!.toLowerCase().includes(pattern.toLowerCase())
    )
  );
}

/**
 * Detects patterns in source code using regex
 */
function detectPatternInSource(sourceCode: string, patterns: RegExp[]): boolean {
  if (!sourceCode) return false;
  return patterns.some(pattern => pattern.test(sourceCode));
}

/**
 * Detects if contract has proxy patterns
 */
function detectProxyContract(contractData: ContractData, creatorAddress: string | null): boolean {
  // Pump.Tires contracts are not proxies
  if (creatorAddress?.toLowerCase() === PUMP_TIRES_CREATOR.toLowerCase()) {
    return false;
  }

  const abi = contractData.abi || [];
  const sourceCode = contractData.source_code || '';

  // Check ABI for proxy-related functions
  const proxyFunctionPatterns = [
    'upgradeTo',
    'upgradeToAndCall',
    'implementation',
    'proxy',
    'delegatecall'
  ];
  
  if (hasFunction(abi, proxyFunctionPatterns)) {
    return true;
  }

  // Check source code for proxy patterns
  const proxySourcePatterns = [
    /delegatecall/gi,
    /implementation\s*=/gi,
    /upgradeTo/gi,
    /TransparentUpgradeableProxy/gi,
    /UUPSUpgradeable/gi,
    /ERC1967Proxy/gi
  ];

  return detectPatternInSource(sourceCode, proxySourcePatterns);
}

/**
 * Detects suspicious functions in contract and returns list of found functions
 */
function detectSuspiciousFunctions(contractData: ContractData, creatorAddress: string | null): { has: boolean; functions: string[] } {
  // Pump.Tires contracts are trusted and should not be flagged for suspicious functions
  if (creatorAddress?.toLowerCase() === PUMP_TIRES_CREATOR.toLowerCase()) {
    return {
      has: false,
      functions: []
    };
  }

  const abi = contractData.abi || [];
  const sourceCode = contractData.source_code || '';
  const foundFunctions: string[] = [];

  // Check ABI for suspicious function names
  const suspiciousFunctionPatterns = [
    'selfdestruct',
    'suicide',
    'delegatecall',
    'callcode',
    'assembly',
    'unchecked'
  ];

  abi.forEach(item => {
    if (item.type === 'function' && item.name) {
      const funcName = item.name.toLowerCase();
      suspiciousFunctionPatterns.forEach(pattern => {
        if (funcName.includes(pattern.toLowerCase()) && !foundFunctions.includes(item.name!)) {
          foundFunctions.push(item.name!);
        }
      });
    }
  });

  // Check source code for suspicious patterns
  const suspiciousSourcePatterns = [
    { pattern: /selfdestruct/gi, name: 'selfdestruct' },
    { pattern: /suicide/gi, name: 'suicide' },
    { pattern: /assembly\s*\{/gi, name: 'assembly' },
    { pattern: /unchecked\s*\{/gi, name: 'unchecked' }
  ];

  suspiciousSourcePatterns.forEach(({ pattern, name }) => {
    if (pattern.test(sourceCode) && !foundFunctions.includes(name)) {
      foundFunctions.push(name);
    }
  });

  return {
    has: foundFunctions.length > 0,
    functions: foundFunctions
  };
}

/**
 * Detects if contract has mint functionality
 */
function detectMintable(contractData: ContractData): boolean {
  const abi = contractData.abi || [];
  
  const mintPatterns = [
    'mint',
    '_mint'
  ];

  return hasFunction(abi, mintPatterns);
}

/**
 * Detects if contract has pause/unpause functionality
 */
function detectTransferPausable(contractData: ContractData): boolean {
  const abi = contractData.abi || [];
  
  const pausePatterns = [
    'pause',
    'unpause',
    'paused'
  ];

  return hasFunction(abi, pausePatterns);
}

/**
 * Detects if contract has trading cooldown functionality
 */
function detectTradingCooldown(contractData: ContractData): boolean {
  const abi = contractData.abi || [];
  const sourceCode = contractData.source_code || '';

  const cooldownPatterns = [
    'cooldown',
    'tradingEnabled',
    'enableTrading',
    'disableTrading',
    'tradingDisabled'
  ];

  if (hasFunction(abi, cooldownPatterns)) {
    return true;
  }

  // Check source code for cooldown patterns
  const cooldownSourcePatterns = [
    /cooldown/gi,
    /tradingEnabled/gi,
    /enableTrading/gi
  ];

  return detectPatternInSource(sourceCode, cooldownSourcePatterns);
}

/**
 * Detects if contract has blacklist functionality
 */
function detectBlacklist(contractData: ContractData): boolean {
  const abi = contractData.abi || [];
  
  const blacklistPatterns = [
    'blacklist',
    'addToBlacklist',
    'removeFromBlacklist',
    'isBlacklisted'
  ];

  return hasFunction(abi, blacklistPatterns);
}

/**
 * Detects if contract has whitelist functionality
 */
function detectWhitelist(contractData: ContractData): boolean {
  const abi = contractData.abi || [];
  
  const whitelistPatterns = [
    'whitelist',
    'addToWhitelist',
    'removeFromWhitelist',
    'isWhitelisted'
  ];

  return hasFunction(abi, whitelistPatterns);
}

/**
 * Detects if contract has buy tax functionality
 */
function detectBuyTax(contractData: ContractData): boolean {
  const abi = contractData.abi || [];
  const sourceCode = contractData.source_code || '';

  const buyTaxPatterns = [
    'buyTax',
    'setBuyTax',
    '_buyTax',
    'buyFee',
    'setBuyFee'
  ];

  if (hasFunction(abi, buyTaxPatterns)) {
    return true;
  }

  // Check source code for buy tax patterns
  const buyTaxSourcePatterns = [
    /buyTax/gi,
    /setBuyTax/gi,
    /buyFee/gi,
    /buy.*tax/gi
  ];

  return detectPatternInSource(sourceCode, buyTaxSourcePatterns);
}

/**
 * Detects if contract has sell tax functionality
 */
function detectSellTax(contractData: ContractData): boolean {
  const abi = contractData.abi || [];
  const sourceCode = contractData.source_code || '';

  const sellTaxPatterns = [
    'sellTax',
    'setSellTax',
    '_sellTax',
    'sellFee',
    'setSellFee'
  ];

  if (hasFunction(abi, sellTaxPatterns)) {
    return true;
  }

  // Check source code for sell tax patterns
  const sellTaxSourcePatterns = [
    /sellTax/gi,
    /setSellTax/gi,
    /sellFee/gi,
    /sell.*tax/gi
  ];

  return detectPatternInSource(sourceCode, sellTaxSourcePatterns);
}

/**
 * Detects if contract is a honeypot by checking for transfer restrictions
 */
function detectHoneypot(contractData: ContractData): boolean {
  const abi = contractData.abi || [];
  const sourceCode = contractData.source_code || '';

  // Honeypots often have transfer restrictions
  const honeypotPatterns = [
    'canTransfer',
    'transferAllowed',
    'isTransferable',
    'blockTransfer'
  ];

  if (hasFunction(abi, honeypotPatterns)) {
    return true;
  }

  // Check source code for transfer restrictions combined with blacklist
  const honeypotSourcePatterns = [
    /transfer.*revert/gi,
    /require.*transfer/gi,
    /canTransfer/gi,
    /transferAllowed/gi
  ];

  const hasTransferRestriction = detectPatternInSource(sourceCode, honeypotSourcePatterns);
  const hasBlacklistFunc = detectBlacklist(contractData);

  // If both transfer restrictions and blacklist exist, likely honeypot
  return hasTransferRestriction && hasBlacklistFunc;
}

/**
 * Detects if owner is hidden (different from creator and is a contract)
 */
async function detectHiddenOwner(
  creatorAddress: string | null,
  ownerAddress: string | null
): Promise<boolean> {
  if (!creatorAddress || !ownerAddress) return false;
  
  // If owner is same as creator, not hidden
  if (creatorAddress.toLowerCase() === ownerAddress.toLowerCase()) {
    return false;
  }

  try {
    // Check if owner is a contract address
    const ownerInfo = await fetchAddressInfo(ownerAddress);
    return ownerInfo?.data?.is_contract === true;
  } catch (error) {
    console.error('Failed to check if owner is contract:', error);
    return false;
  }
}

/**
 * Main function to analyze contract audit
 */
export async function analyzeContractAudit(
  address: string,
  contractData: ContractData,
  ownershipData: OwnershipData
): Promise<ContractAuditResult> {
  const hiddenOwner = await detectHiddenOwner(
    ownershipData.creatorAddress,
    ownershipData.ownerAddress
  );

  // Check if Pump.Tires contract (always renounced)
  const isPumpTiresContract = ownershipData.creatorAddress?.toLowerCase() === PUMP_TIRES_CREATOR.toLowerCase();
  const ownershipRenounced = isPumpTiresContract || ownershipData.isRenounced;

  const suspiciousFunctionsResult = detectSuspiciousFunctions(contractData, ownershipData.creatorAddress);

  return {
    ownershipRenounced,
    hiddenOwner,
    hasSuspiciousFunctions: suspiciousFunctionsResult.has,
    suspiciousFunctions: suspiciousFunctionsResult.functions,
    honeypot: detectHoneypot(contractData),
    proxyContract: detectProxyContract(contractData, ownershipData.creatorAddress),
    mintable: detectMintable(contractData),
    transferPausable: detectTransferPausable(contractData),
    tradingCooldown: detectTradingCooldown(contractData),
    hasBlacklist: detectBlacklist(contractData),
    hasWhitelist: detectWhitelist(contractData),
    buyTax: detectBuyTax(contractData),
    sellTax: detectSellTax(contractData),
    creatorAddress: ownershipData.creatorAddress,
    ownerAddress: ownershipData.ownerAddress,
  };
}

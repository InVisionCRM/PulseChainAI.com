export interface Message {
  id: string;
  text: string;
  sender: 'user' | 'ai';
}

// From user's image for TokenInfo
export interface TokenInfo {
    circulating_market_cap: string | null;
    icon_url: string | null;
    name: string;
    decimals: string;
    symbol: string;
    address: string;
    type: string;
    holders: string;
    exchange_rate: string | null;
    total_supply: string;
}

export interface AbiItemInput {
    name: string;
    type: string;
    internalType: string;
}

export interface AbiItem {
    name: string;
    type: 'function' | 'constructor' | 'event' | 'fallback';
    stateMutability: 'pure' | 'view' | 'nonpayable' | 'payable';
    inputs: AbiItemInput[];
    outputs: AbiItemInput[];
}

export interface ContractData {
  name: string;
  source_code: string;
  compiler_version: string;
  optimization_enabled: boolean;
  is_verified: boolean;
  abi: AbiItem[];
  creator_address_hash: string | null;
  creation_tx_hash: string | null;
}

export interface ExplainedFunction {
    name: string;
    type: 'read' | 'write';
    inputs: AbiItemInput[];
    outputs: AbiItemInput[];
    explanation: string;
}

export interface SearchResultItem {
  address: string;
  name: string;
  symbol?: string;
  icon_url?: string | null;
  type: 'token' | 'address' | 'contract' | 'block' | 'transaction';
}

export interface SearchResponse {
    items: SearchResultItem[];
    next_page_params: any;
}

// For fetching read methods with values
export interface MethodOutputWithValue {
    internalType: string;
    name: string;
    type: string;
    value: string; // The live value from the contract
}

export interface ReadMethodWithValue {
    inputs: AbiItemInput[];
    method_id: string;
    name: string;
    outputs: MethodOutputWithValue[];
    stateMutability: 'view' | 'pure';
    type: 'function';
}

// --- Types for Creator Tab ---

export interface TransactionAddress {
    hash: string;
    is_contract: boolean;
    name: string | null;
}

export interface Transaction {
    hash: string;
    timestamp: string;
    from: TransactionAddress;
    to: TransactionAddress | null;
    is_contract_creation: boolean;
    value: string;
    // We only care about a few fields for this app
}

export interface TransactionResponse {
    items: Transaction[];
    next_page_params: any;
}

export interface TokenDetails {
    address: string;
    name: string;
    symbol: string;
    decimals: string;
    type: string;
    icon_url?: string | null;
}

export interface TokenBalance {
    token: TokenDetails;
    value: string; // This is the raw value, needs to be formatted with decimals
}

export interface AddressInfo {
    creator_address_hash: string | null;
    creation_tx_hash: string | null;
}

// DEXScreener API Types
export interface DexScreenerToken {
    address: string;
    name: string;
    symbol: string;
}

export interface DexScreenerPair {
    chainId: string;
    dexId: string;
    url: string;
    pairAddress: string;
    baseToken: DexScreenerToken;
    quoteToken: DexScreenerToken;
    priceNative: string;
    priceUsd: string;
    txns: {
        h24: {
            buys: number;
            sells: number;
        };
        h6: {
            buys: number;
            sells: number;
        };
        h1: {
            buys: number;
            sells: number;
        };
    };
    volume: {
        h24: number;
        h6: number;
        h1: number;
    };
    priceChange: {
        h24: number;
        h6: number;
        h1: number;
    };
    liquidity: {
        usd: number;
        base: number;
        quote: number;
    };
    fdv: number;
    pairCreatedAt: number;
}

export interface DexScreenerData {
    pairs: DexScreenerPair[];
    totalPairs: number;
    wplsPairs: number;
    tokenInfo?: {
        address: string;
        name: string;
        symbol: string;
    } | null;
    info?: {
        imageUrl?: string;
        header?: string;
        openGraph?: string;
        websites?: Array<{
            label: string;
            url: string;
        }>;
        socials?: Array<{
            type: string;
            url: string;
        }>;
    } | null;
}
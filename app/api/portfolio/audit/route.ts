import { NextRequest, NextResponse } from 'next/server';
import { fetchContract, fetchAddressInfo } from '@/services';
import { analyzeContractAudit } from '@/services/contractAuditService';
import type { ContractAuditResult } from '@/types';

// Per-token contract audit for the portfolio's insights modal.
// Reuses the existing analyzeContractAudit from /geicko so the per-row
// "Audit" tab surfaces exactly the same risk flags as the full token
// analyzer (mintable / blacklist / honeypot / proxy / suspicious functions
// / etc), without the user having to leave the portfolio page.
//
// PulseChain-only for now: fetchContract/fetchAddressInfo hit PulseScan.
// Ethereum audits would need an eth.blockscout-shaped contract fetcher,
// which is a follow-up.

type ChainId = 'ethereum' | 'pulsechain' | 'robinhood';

interface AuditSummary {
  supported: boolean;
  reason?: string;
  contractName: string | null;
  isVerified: boolean | null;
  result: ContractAuditResult | null;
}

const auditCache = new Map<string, AuditSummary>();
const CACHE_TTL_MS = 10 * 60 * 1000;
const cacheKey = (chain: ChainId, address: string) =>
  `${chain}:${address.toLowerCase()}`;

const cacheEntries = new Map<string, { entry: AuditSummary; ts: number }>();

function isValidAddress(s: unknown): s is string {
  return typeof s === 'string' && /^0x[a-f0-9]{40}$/i.test(s);
}

async function runPulseChainAudit(address: string): Promise<AuditSummary> {
  const [contractResult, addrInfo] = await Promise.allSettled([
    fetchContract(address),
    fetchAddressInfo(address),
  ]);

  // fetchContract returns { data, raw } via the facade; fetchAddressInfo
  // similarly. Be permissive about shape because the facade has been in
  // flux during the recent refactor.
  const contractRaw =
    contractResult.status === 'fulfilled'
      ? (contractResult.value as any)
      : null;
  const contractData =
    contractRaw?.data ?? contractRaw?.contract ?? contractRaw ?? null;

  if (!contractData || !contractData.source_code) {
    return {
      supported: true,
      reason: 'Contract source not verified on PulseScan',
      contractName: contractData?.name ?? null,
      isVerified: false,
      result: null,
    };
  }

  const infoRaw =
    addrInfo.status === 'fulfilled' ? (addrInfo.value as any) : null;
  const infoData = infoRaw?.data ?? infoRaw ?? null;
  const creatorAddress =
    infoData?.creator_address_hash ||
    infoData?.creator_address ||
    contractData?.creator_address_hash ||
    null;

  const ownershipData = {
    creatorAddress: creatorAddress ? String(creatorAddress).toLowerCase() : null,
    ownerAddress: null,
    isRenounced: false,
    renounceTxHash: null,
  };

  const result = await analyzeContractAudit(
    address,
    contractData,
    ownershipData,
  );

  return {
    supported: true,
    contractName: contractData.name ?? null,
    isVerified:
      contractData.is_verified ?? !!contractData.source_code,
    result,
  };
}

export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  const address = body?.address;
  const chain: ChainId =
    body?.chain === 'ethereum' ? 'ethereum' : body?.chain === 'robinhood' ? 'robinhood' : 'pulsechain';

  if (!isValidAddress(address)) {
    return NextResponse.json({ error: 'invalid address' }, { status: 400 });
  }

  // Ethereum tokens fall through to a "not supported" payload — the modal
  // shows a CTA to /geicko for the existing manual flow.
  if (chain === 'ethereum') {
    return NextResponse.json({
      audit: {
        supported: false,
        reason: 'Audit not yet supported for Ethereum tokens',
        contractName: null,
        isVerified: null,
        result: null,
      } satisfies AuditSummary,
    });
  }

  const key = cacheKey(chain, address);
  const cached = cacheEntries.get(key);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    return NextResponse.json({ audit: cached.entry });
  }

  let summary: AuditSummary;
  try {
    summary = await runPulseChainAudit(address.toLowerCase());
  } catch (err) {
    summary = {
      supported: true,
      reason:
        err instanceof Error
          ? `Audit failed: ${err.message}`
          : 'Audit failed',
      contractName: null,
      isVerified: null,
      result: null,
    };
  }

  cacheEntries.set(key, { entry: summary, ts: Date.now() });
  return NextResponse.json({ audit: summary });
}

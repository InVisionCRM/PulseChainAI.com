/**
 * Verifies the Robinhood Chain config + launchpad registry against live
 * infrastructure. Run with:  npm run verify:robinhood
 *
 * Checks, using only native fetch (no external deps):
 *   1. The public RPC answers and reports chain id 4663.
 *   2. The Blockscout v2 API responds.
 *   3. DexScreener indexes the chain under the expected slug.
 *   4. Every `verified: true` launchpad/token address has deployed bytecode.
 *
 * Exits non-zero if any check fails, so it doubles as a CI smoke test.
 */

import { CHAINS } from '@/lib/chains/registry';
import {
  ROBINHOOD_LAUNCHPADS,
  ROBINHOOD_MULTICALL3,
  ROBINHOOD_TOKENS,
  ROBINHOOD_UNISWAP_V3,
} from '@/lib/launchpads/robinhood';

const chain = CHAINS.robinhood;
const RPC = chain.rpcUrls[0];

let failures = 0;
const pass = (msg: string) => console.log(`  ✅ ${msg}`);
const fail = (msg: string) => {
  failures += 1;
  console.error(`  ❌ ${msg}`);
};

async function rpc(method: string, params: unknown[]): Promise<string | null> {
  try {
    const res = await fetch(RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', method, params, id: 1 }),
      signal: AbortSignal.timeout(15_000),
    });
    const json = (await res.json()) as { result?: string };
    return json.result ?? null;
  } catch (e) {
    console.error(`     rpc ${method} error:`, (e as Error).message);
    return null;
  }
}

async function hasCode(address: string): Promise<boolean> {
  const code = await rpc('eth_getCode', [address, 'latest']);
  return !!code && code !== '0x';
}

async function main() {
  console.log(`\nRobinhood Chain verification (${chain.name}, id ${chain.chainId})\n`);

  console.log('RPC:');
  const chainIdHex = await rpc('eth_chainId', []);
  if (chainIdHex && parseInt(chainIdHex, 16) === chain.chainId) {
    pass(`eth_chainId = ${parseInt(chainIdHex, 16)}`);
  } else {
    fail(`eth_chainId returned ${chainIdHex}, expected ${chain.chainId}`);
  }

  console.log('\nBlockscout v2 API:');
  try {
    const res = await fetch(`${chain.blockscoutApiBase}/stats`, {
      signal: AbortSignal.timeout(15_000),
    });
    const stats = (await res.json()) as { total_blocks?: string };
    if (res.ok && stats.total_blocks) pass(`/stats ok (${stats.total_blocks} blocks)`);
    else fail('/stats did not return expected shape');
  } catch (e) {
    fail(`/stats error: ${(e as Error).message}`);
  }

  console.log('\nDexScreener indexing:');
  try {
    const res = await fetch(
      `https://api.dexscreener.com/latest/dex/tokens/${ROBINHOOD_TOKENS.WETH}`,
      { signal: AbortSignal.timeout(15_000) },
    );
    const data = (await res.json()) as { pairs?: Array<{ chainId?: string }> };
    const onChain = (data.pairs ?? []).filter(
      (p) => p.chainId === chain.dexscreenerSlug,
    );
    if (onChain.length > 0) pass(`slug '${chain.dexscreenerSlug}' → ${onChain.length} pairs`);
    else fail(`no pairs under slug '${chain.dexscreenerSlug}'`);
  } catch (e) {
    fail(`DexScreener error: ${(e as Error).message}`);
  }

  console.log('\nShared DEX infra + Multicall:');
  const infra: Record<string, string> = {
    'UniswapV3 SwapRouter02': ROBINHOOD_UNISWAP_V3.swapRouter02,
    'UniswapV3 Factory': ROBINHOOD_UNISWAP_V3.factory,
    'UniswapV3 PositionManager': ROBINHOOD_UNISWAP_V3.positionManager,
    Multicall3: ROBINHOOD_MULTICALL3,
    WETH: ROBINHOOD_TOKENS.WETH,
  };
  for (const [label, address] of Object.entries(infra)) {
    if (await hasCode(address)) pass(`${label} has code`);
    else fail(`${label} (${address}) has NO code`);
  }

  console.log('\nLaunchpad contracts (verified: true):');
  for (const pad of ROBINHOOD_LAUNCHPADS) {
    for (const c of pad.contracts.filter((x) => x.verified)) {
      if (await hasCode(c.address)) pass(`${pad.name} · ${c.label}`);
      else fail(`${pad.name} · ${c.label} (${c.address}) has NO code`);
    }
  }

  const pending = ROBINHOOD_LAUNCHPADS.filter((p) => p.status === 'pending');
  if (pending.length) {
    console.log(
      `\nℹ️  ${pending.length} pending pad(s) skipped (no verified addresses): ` +
        pending.map((p) => p.name).join(', '),
    );
  }

  console.log(`\n${failures === 0 ? '✅ ALL CHECKS PASSED' : `❌ ${failures} CHECK(S) FAILED`}\n`);
  process.exit(failures === 0 ? 0 : 1);
}

main();

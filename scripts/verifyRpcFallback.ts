/**
 * Verifies the PulseChain RPC fallback against live infrastructure.
 *
 * The point is not "does it return something" but "does it return the SAME
 * thing the explorer does". Every RPC-derived value is cross-checked against
 * Blockscout, because a fallback that silently disagrees with the primary is
 * worse than no fallback at all.
 *
 * Run: npm run verify:rpc-fallback
 */

import {
  rpcTokenMeta,
  rpcTokenBalance,
  rpcTokenTransfers,
  fetchTokenMetaResilient,
  fetchTokenTransfersResilient,
} from '../lib/pulsechainRpcFallback';
import { blockscoutJson } from '../lib/blockscout';

// Maximus DECI — a real, active PulseChain ERC-20 (verified on-chain).
const TOKEN = '0x6b32022693210cd2cfc466b9ac0085de8fc34ea6';

let pass = 0;
let fail = 0;

function check(label: string, ok: boolean, detail = '') {
  if (ok) {
    pass++;
    console.log(`  PASS  ${label}${detail ? `  (${detail})` : ''}`);
  } else {
    fail++;
    console.log(`  FAIL  ${label}${detail ? `  (${detail})` : ''}`);
  }
}

async function main() {
  console.log('\n=== 1. Token metadata: RPC vs Blockscout ===');
  const rpcMeta = await rpcTokenMeta(TOKEN);
  const bsMeta = await blockscoutJson(`/tokens/${TOKEN}`);

  if (!rpcMeta) {
    check('rpcTokenMeta returned data', false, 'got null');
  } else {
    console.log(
      `  RPC  -> name=${rpcMeta.name} symbol=${rpcMeta.symbol} ` +
        `decimals=${rpcMeta.decimals} supply=${rpcMeta.total_supply}`,
    );
    if (bsMeta) {
      console.log(
        `  BS   -> name=${bsMeta.name} symbol=${bsMeta.symbol} ` +
          `decimals=${bsMeta.decimals} supply=${bsMeta.total_supply}`,
      );
      check('symbol matches Blockscout', rpcMeta.symbol === bsMeta.symbol);
      check('name matches Blockscout', rpcMeta.name === bsMeta.name);
      check(
        'decimals matches Blockscout',
        String(rpcMeta.decimals) === String(bsMeta.decimals),
      );
      check(
        'total_supply matches Blockscout',
        String(rpcMeta.total_supply) === String(bsMeta.total_supply),
      );
    } else {
      console.log('  BS   -> unavailable (explorer down) — cross-check skipped');
      check('rpcTokenMeta returned usable data', rpcMeta.symbol != null);
    }
    check(
      'unknowable fields are null, not invented',
      rpcMeta.holders === null && rpcMeta.icon_url === null,
    );
  }

  console.log('\n=== 2. Transfers: RPC vs Blockscout ===');
  const rpcT = await rpcTokenTransfers(TOKEN, { cap: 10 });
  if (!rpcT) {
    check('rpcTokenTransfers returned data', false, 'got null');
  } else {
    console.log(
      `  RPC  -> ${rpcT.items.length} transfers, blocks ` +
        `${rpcT.scannedFromBlock}..${rpcT.headBlock}`,
    );
    check('returned transfers', rpcT.items.length > 0, `${rpcT.items.length} items`);

    const first = rpcT.items[0];
    if (first) {
      console.log(
        `  newest -> ${first.tx_hash.slice(0, 12)}… ` +
          `from=${first.from.hash.slice(0, 10)}… to=${first.to.hash.slice(0, 10)}… ` +
          `value=${first.total.value} ts=${first.timestamp}`,
      );
      check('from is a valid address', /^0x[0-9a-f]{40}$/.test(first.from.hash));
      check('to is a valid address', /^0x[0-9a-f]{40}$/.test(first.to.hash));
      check('tx_hash is a valid hash', /^0x[0-9a-f]{64}$/.test(first.tx_hash));
      check('value decoded', /^\d+$/.test(first.total.value));
      check('timestamp resolved to ISO', !!first.timestamp && !isNaN(Date.parse(first.timestamp)));
      check('newest-first ordering', rpcT.items.every((it, i, a) =>
        i === 0 || a[i - 1].block_number >= it.block_number));
    }

    // The decisive check: does a transfer the RPC found also exist on the
    // explorer, with the same participants and amount?
    const bsT = await blockscoutJson(`/tokens/${TOKEN}/transfers`);
    if (bsT?.items?.length) {
      const bsByHash = new Map<string, any>();
      for (const it of bsT.items) {
        bsByHash.set(`${it.tx_hash}:${it.log_index}`, it);
      }
      const overlap = rpcT.items.filter((it) =>
        bsByHash.has(`${it.tx_hash}:${it.log_index}`),
      );
      console.log(`  overlap with Blockscout page: ${overlap.length} transfers`);
      if (overlap.length === 0) {
        console.log('  (no overlap — explorer page covers a different window)');
      }
      let agree = 0;
      for (const it of overlap) {
        const b = bsByHash.get(`${it.tx_hash}:${it.log_index}`)!;
        if (
          b.from.hash.toLowerCase() === it.from.hash &&
          b.to.hash.toLowerCase() === it.to.hash &&
          String(b.total.value) === it.total.value
        ) {
          agree++;
        }
      }
      if (overlap.length > 0) {
        check(
          'overlapping transfers agree exactly with Blockscout',
          agree === overlap.length,
          `${agree}/${overlap.length}`,
        );
      }
    } else {
      console.log('  BS   -> transfers unavailable — cross-check skipped');
    }
  }

  console.log('\n=== 3. balanceOf via RPC ===');
  if (rpcT?.items?.length) {
    const holder = rpcT.items[0].to.hash;
    const bal = await rpcTokenBalance(TOKEN, holder);
    console.log(`  balanceOf(${holder.slice(0, 10)}…) = ${bal}`);
    check('balance decoded as digits', bal != null && /^\d+$/.test(bal));
  } else {
    console.log('  skipped — no transfer to source a holder address from');
  }

  console.log('\n=== 4. Resilient wrappers pick the right source ===');
  const meta = await fetchTokenMetaResilient(TOKEN);
  console.log(`  fetchTokenMetaResilient -> source=${meta.source}`);
  check('meta wrapper produced data', meta.data != null);
  check(
    'meta source is labelled',
    meta.source === 'blockscout' || meta.source === 'rpc-fallback',
  );

  const tr = await fetchTokenTransfersResilient(TOKEN, { cap: 5 });
  console.log(
    `  fetchTokenTransfersResilient -> source=${tr.source} ` +
      `items=${tr.items.length} partial=${tr.partial}`,
  );
  check('transfers wrapper produced data', tr.items.length > 0);
  check(
    'fallback path is flagged partial',
    tr.source === 'blockscout' ? tr.partial === false : tr.partial === true,
  );

  console.log(`\n=== ${pass} passed, ${fail} failed ===\n`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error('verifier threw:', e);
  process.exit(1);
});

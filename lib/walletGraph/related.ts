// Related-wallet clustering — find wallets likely controlled by the same entity
// as a target, from decoded history (/api/portfolio/history). A port of
// Gumshoe's related-wallets heuristics, fed by our Otterscan/Blockscout history
// instead of raw getLogs, and tightened to ignore shared *infrastructure*
// (exchanges, routers, etc.) which fund/interact with everyone and would
// otherwise create false links.
//
// Signals (summed, capped at 100):
//   • Transfer peer (+10) — the wallet deliberately *sent* to this address
//     (unsolicited airdrop senders, which only ever *receive*, are excluded).
//   • Two-way transfers (+25) — both sent to and received from this address.
//   • Frequent interaction (+20) — 3+ transactions with this address.
//   • Shared funding source (+30) — co-funded by one of the target's personal
//     (non-infrastructure) native-coin funders — a same-operator hint.
//
// Infrastructure (exchanges, routers, factories, lockers, …) and scam-flagged
// transactions are excluded throughout. These are probabilistic signals, not
// proof of common control.

import type { WalletTransaction } from '@/services';
import { getKnownAddress, type AddressCategory } from '@/lib/gumshoe/address-labels';

export interface RelatedCandidate {
  address: string;
  /** 0-100 — sum of matched signal weights, capped. */
  confidence: number;
  signals: string[];
  label: string | null;
  category: AddressCategory | null;
  sharedFunder: string | null;
}

// Categories that fund/interact with huge numbers of wallets — sharing one says
// nothing about common control, so they're excluded as funders and candidates.
const INFRA: ReadonlySet<AddressCategory> = new Set([
  'exchange',
  'router',
  'factory',
  'locker',
  'burn',
  'wrapped',
]);

function isInfra(address: string): boolean {
  const k = getKnownAddress(address);
  return !!k && INFRA.has(k.category);
}

/**
 * Personal native-coin funders of the target, from its history. Excludes
 * infrastructure addresses. Most frequent first, capped at `limit`.
 */
export function deriveFunders(
  targetHistory: WalletTransaction[],
  targetAddress: string,
  limit = 6,
): string[] {
  const self = targetAddress.toLowerCase();
  const counts = new Map<string, number>();
  for (const t of targetHistory) {
    const cp = t.counterparty?.toLowerCase();
    if (!cp || cp === self || isInfra(cp)) continue;
    const fundedIn = t.flows.some((f) => f.direction === 'in' && f.isNative);
    if (!fundedIn) continue;
    counts.set(cp, (counts.get(cp) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([a]) => a);
}

/**
 * Score wallets likely controlled by the same entity as the target.
 * `funderHistories` maps each personal funder (from deriveFunders) to its own
 * decoded history. Returns up to 15 candidates, highest confidence first.
 */
export function scoreRelated(
  targetAddress: string,
  targetHistory: WalletTransaction[],
  funderHistories: Map<string, WalletTransaction[]>,
): RelatedCandidate[] {
  const self = targetAddress.toLowerCase();
  interface Acc {
    signals: Set<string>;
    funder: string | null;
    in: number;
    out: number;
    sentTo: boolean;
    sharedFunder: boolean;
  }
  const cand = new Map<string, Acc>();
  const get = (a: string): Acc => {
    let e = cand.get(a);
    if (!e) {
      e = { signals: new Set(), funder: null, in: 0, out: 0, sentTo: false, sharedFunder: false };
      cand.set(a, e);
    }
    return e;
  };

  // (1) Direct relationships from the target's own history. `sentTo` marks a
  // deliberate transfer (so airdrop senders, which only ever appear inbound,
  // don't count as peers). Infra and scam-flagged txs are skipped.
  for (const t of targetHistory) {
    if (t.isScam) continue;
    const cp = t.counterparty?.toLowerCase();
    if (!cp || cp === self || isInfra(cp)) continue;
    const e = get(cp);
    if (t.flows.some((f) => f.direction === 'in')) e.in++;
    if (t.flows.some((f) => f.direction === 'out')) e.out++;
    if (t.action === 'send') e.sentTo = true;
  }

  // (2) Shared funding source — other wallets the target's personal funders
  // also topped up with the native coin.
  for (const [funder, hist] of funderHistories) {
    const funderLc = funder.toLowerCase();
    const recipients = new Set<string>();
    for (const t of hist) {
      if (t.isScam) continue;
      const cp = t.counterparty?.toLowerCase();
      if (!cp || cp === self || cp === funderLc || isInfra(cp)) continue;
      if (t.flows.some((f) => f.direction === 'out' && f.isNative)) recipients.add(cp);
    }
    for (const r of recipients) {
      const e = get(r);
      e.sharedFunder = true;
      e.funder = funder;
    }
  }

  const out: RelatedCandidate[] = [];
  for (const [addr, e] of cand) {
    let score = 0;
    if (e.sentTo) {
      score += 10;
      e.signals.add('Transfer peer');
    }
    if (e.in > 0 && e.out > 0) {
      score += 25;
      e.signals.add('Two-way transfers');
    }
    if (e.in + e.out >= 3) {
      score += 20;
      e.signals.add(`Frequent (${e.in + e.out} txs)`);
    }
    if (e.sharedFunder) {
      score += 30;
      e.signals.add('Shared funding source');
    }
    if (score < 10) continue;
    const known = getKnownAddress(addr);
    out.push({
      address: addr,
      confidence: Math.min(score, 100),
      signals: [...e.signals],
      label: known?.label ?? null,
      category: known?.category ?? null,
      sharedFunder: e.funder,
    });
  }
  out.sort((a, b) => b.confidence - a.confidence);
  return out.slice(0, 15);
}

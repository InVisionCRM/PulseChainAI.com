# Portfolio Tracker — Refactor Plan

> Goal: clean the codebase enough to build a real ERC-20 (Ethereum) + PRC-20 (PulseChain) portfolio tracker on a sane foundation. We don't need a total rewrite — we need to consolidate three competing service layers, kill obvious dead weight, and stand up the shared primitives (state, types, fetchers) the tracker will need.

---

## 1. What we actually have right now

### Pages (`app/`)
| Route | State | Action |
| --- | --- | --- |
| `/` | Live (Hero + TokenTable) | **Keep** |
| `/geicko` | Live, 3,222-line single file, main token analyzer | **Keep, decompose later** |
| `/hex-dashboard` | Live, loads 4,158-line `hex-dashboard.tsx` | **Keep, split later** |
| `/ai-agent` | Live | **Keep** |
| `/admin-stats`, `/admin/gold-badges` | Live (admin tooling) | **Keep** |
| `/learn-ai`, `/stat-counter-builder`, `/stat-docs`, `/stacker-game` | Live but tangential to portfolio | **Keep, don't touch** |
| `/pulsechain-stats` | Stale, no live entry point | **Delete** |
| `/happy-pulse` | Stub, no live entry point | **Delete** |
| `/richard-heart` | Stub, no live entry point | **Delete** |

### Services — the biggest single source of mess
We have **three parallel "get token info" implementations**, all simultaneously used:

```
services/pulsechainService.ts        ← legacy (21KB), used by geicko/page.tsx, AdminStatsPanel, etc.
services/pulsechainApiService.ts     ← interim (24KB), also used by geicko/page.tsx
services/blockchain/pulsechainApi.ts ← canonical (29KB), used by GeickoPortfolioModal + services/index.ts facade
```

Same problem for Moralis (`moralisService.ts` vs `blockchain/moralisApi.ts`).

`services/index.ts` is a facade that re-exports the *canonical* path and adds compatibility wrappers — it's the right pattern, it's just not adopted yet.

**HEX staking** has four overlapping services that need to collapse into one:
- `hexStakingService.ts` (31KB) — Ethereum
- `pulsechainHexStakingService.ts` (33KB) — PulseChain
- `multiNetworkHexStakingService.ts` (16KB) — unification attempt #1
- `unifiedHexStakingService.ts` (12KB) — unification attempt #2

### API routes (`app/api/`) — 70 routes, ~45 are dead
**Live** (referenced by frontend): `gold-badges`, `token-metrics/[address]`, `hex-dashboard-ai`, `hex-dashboard/*`, `address/[address]/swap-transactions`, `pulsechain-proxy`, `sourcify-proxy`, `chat`, `blob/*`, `token-profile`, `gemini`, `mentions`, `twitter*`, `dexscreener-v4`, `holders-metrics`, `address-transactions`, `address-transfers`.

**Dead** (no callers found): the entire `fix-*`, `debug-*`, `check-*`, `clear-*`, `rebuild-phase*`, `migrate-tables`, `copy-data`, `force-drop-constraint`, `force-fix-constraints`, `simple-pulsechain-sync`, `sync-now`, `sync-database`, `ethereum-full-sync`, `pulsechain-full-sync` (verify cron usage first), `system-analysis`, `test-api-key`, `test-quick-audit`, `tokenomics-analysis`, `create-hex-tables` families — leftover one-shot migration/debug tooling.

### Components — the bloat hotspots
| File | Lines | Verdict |
| --- | --- | --- |
| `hex-dashboard.tsx` | 4,158 | Genuine complexity, but several distinct panels in one file. Splittable. |
| `app/geicko/page.tsx` | 3,222 | Main analyzer. Pulls from 3 service layers. Split + service-consolidate. |
| `AdminStatsPanel.tsx` | 2,992 | Real feature, with debug/fetch-logging UI mixed in. Trim, don't rewrite. |
| `lookintorh-clone.tsx` | 1,844 | Only `TransactionModal.tsx` imports it. Investigate whether modal even uses it meaningfully. |
| `TreasuryTracker.tsx` | 1,424 | Size justified for what it does. Leave it. |
| `TokenTable.tsx` | 936 | Reasonable. CSV-parsing logic could move to `lib/csvParser.ts` (file already exists). |
| `hex-dashboard.tsx.backup`, `hex-dashboard-new.tsx`, `hex-dashboard-unified.tsx` | — | **Zero importers. Delete all three.** |

### Portfolio-relevant building blocks (good news: ~70% is already there)
- `pulsechainApi.getAddressTokenBalances(address)` — PRC-20 balances. **Reuse.**
- `moralisApi.getWalletTokenBalances(address)` — ERC-20 balances + cross-chain fallback. **Reuse.**
- `dexscreenerApi.getTokenProfile/getTokenData` — prices + metadata. **Reuse.**
- `services/aggregators/tokenService.ts` — unified token info. **Reuse.**
- `services/core/errors.ts` — address validation. **Reuse.**
- `GeickoPortfolioModal.tsx` — already implements the per-address portfolio view (balances → price enrichment → sorted table) **on the canonical service path.** This is the reference pattern. **Reuse, generalize.**
- `core/types.ts` — token/holder/balance types. **Promote to canonical.**

### State management
- Only one Zustand store today: `lib/stores/canvasStore.ts` (for the stat builder).
- Everything else fetches ad-hoc inline. No centralized cache.
- This is fine — we just need to add **one** new store for portfolio state.

### Types
- Two parallel type homes: `types.ts` (root, 8KB) and `services/core/types.ts`. `services/core/types.ts` is the newer, more complete one. Migrate to it and re-export from root for back-compat during the transition.

### Conventions
- No `CLAUDE.md`. No documented conventions. This is why the same thing has been built three times.

---

## 2. Phased refactor — what to do, in what order

The order is chosen to **front-load low-risk deletions** and **defer big rewrites** until after we've reduced the surface area.

### Phase 0 — Safety net (30 min)
- Make a `refactor/` branch off `main`.
- Commit current uncommitted changes to a `wip/` branch first so nothing is lost.
- Add `.DS_Store`, `*.tsbuildinfo`, `tsconfig.tsbuildinfo`, `.next/` to `.gitignore` (some are tracked, e.g. `tsconfig.tsbuildinfo` is 388KB checked in).

### Phase 1 — Pure deletions (1–2 hours, very low risk)
No behavior change. Just removing files nothing imports.

1. Delete `components/hex-dashboard.tsx.backup`, `components/hex-dashboard-new.tsx`, `components/hex-dashboard-unified.tsx`. Confirmed zero importers.
2. Delete `app/happy-pulse/`, `app/richard-heart/`, `app/pulsechain-stats/`. Confirmed no live entry points.
3. Delete dead API routes (grep each route name in `app/`+`components/` before deleting):
   - `app/api/fix-*` (~10 routes)
   - `app/api/debug-*` (~7 routes)
   - `app/api/check-*` (~6 routes)
   - `app/api/clear-ethereum-data`, `copy-data`, `force-*`, `rebuild-phase*`, `migrate-tables`, `create-hex-tables`, `simple-pulsechain-sync`, `sync-now`, `sync-database`, `test-api-key`, `test-quick-audit`, `system-analysis`, `tokenomics-analysis`
   - **Verify before deleting**: `ethereum-full-sync`, `pulsechain-full-sync` (could be cron-invoked) — check `vercel.json` and any cron config.
4. Delete root-level one-off scripts: `check_stakes.js`, `test_multinetwork.js`, `test-hex-ai-api.js` (or move them to `scripts/`).
5. Delete the empty `lib/db/pulsechain_staking.db` file (0 bytes, committed by accident).
6. Delete `components/api-schema.csv`, `components/api-schema.pdf`, `components/scan.csv` — assets that shouldn't live under `components/`.

**Result: ~50 files gone, ~600KB removed, zero behavior change.**

### Phase 2 — Type triage (30 min) — *scoped down from original plan*
Original plan said "make root types.ts a re-export shim". Verification revealed the two type homes have **overlapping names with conflicting shapes** (root `TokenInfo` uses `holders: string`, core uses `holders: number`; same for `ContractData`, `Transaction`, `SearchResultItem`). A naïve re-export would break every legacy caller. Real unification has to happen in Phase 3 alongside service migration, file by file.

Realistic Phase 2:
1. Fix the typo bug in `types.ts:224`: `canslate-950list` / `canMultislate-950list` are clearly the result of a global Tailwind find-replace gone wrong on `blacklist`. Restored to `canBlacklist` / `canMultiBlacklist`. (Callers in `app/geicko/page.tsx` and `app/ai-agent/page.tsx` already reference `canBlacklist`, so the interface was silently lying.)
2. Add a header comment to `types.ts` noting that `services/core/types.ts` is the canonical home for new types and that the overlap is intentional during the migration.

**Result: bug fixed, future direction documented; no behavior change.**

### Phase 3 — Service consolidation (4–6 hours, the most important phase)
The portfolio tracker depends entirely on having one clean way to fetch balances + prices. Get this right and Phase 5 becomes easy.

1. Pick canonical: `services/blockchain/{pulsechainApi,moralisApi,dexscreenerApi}.ts` + `services/aggregators/tokenService.ts`. The `services/index.ts` facade already re-exports these and adds back-compat wrappers (`fetchTokenInfo`, `fetchContract`, etc.). **Adopt the facade as the only import path.**
2. Migrate every caller of legacy services to import from `@/services`:
   - `app/geicko/page.tsx` — currently imports from `pulsechainService` *and* `pulsechainApiService` *and* `blockchain/dexscreenerApi`. Collapse all three to `@/services`.
   - `app/stat-counter-builder/page.tsx`, `app/admin-stats/page.tsx`, `components/AddressDetailsModal.tsx`, `components/TokenAIChat.tsx`, `components/LiquidityTab.tsx`, `components/AdminStatsPanel.tsx`, `components/Home/HeroTokenAiChat.tsx` — all currently on legacy paths.
3. Once nothing imports them, delete `services/pulsechainService.ts`, `services/pulsechainApiService.ts`, `services/moralisService.ts`.
4. **HEX staking consolidation** — pick `multiNetworkHexStakingService.ts` as the public face (it already abstracts both chains), make `hexStakingService.ts` and `pulsechainHexStakingService.ts` *internal* (chain-specific implementations it delegates to), delete `unifiedHexStakingService.ts` (duplicate attempt). Only touch this if HEX staking is in scope for portfolio v1.
5. Add a one-page `services/README.md` documenting: "Always import from `@/services`. The canonical clients live in `services/blockchain/`. The aggregator in `services/aggregators/tokenService.ts` is where multi-source fallbacks live." This is what `CLAUDE.md` will eventually reference.

**Result: one import path; no more duplicate "get token info" calls; new portfolio code has obvious primitives to reach for.**

### Phase 4 — Portfolio foundations (4–6 hours)
Now we add the *new* infrastructure the tracker needs, before writing any UI.

1. **`lib/stores/portfolioStore.ts`** (Zustand) with persistent localStorage middleware:
   ```ts
   {
     wallets: { address: string; label?: string; chains: ('ethereum'|'pulsechain')[] }[],
     balancesByAddress: Record<address, { tokens: PortfolioToken[]; fetchedAt: number }>,
     pricesByToken: Record<address, { priceUsd: number; change24h: number; fetchedAt: number }>,
     addWallet, removeWallet, refreshWallet, refreshAll
   }
   ```
2. **`services/aggregators/portfolioService.ts`** — multi-chain orchestrator that:
   - Takes a wallet address.
   - Calls `pulsechainApi.getAddressTokenBalances` (PRC-20) **and** `moralisApi.getWalletTokenBalances` for Ethereum (ERC-20) in parallel.
   - Enriches with prices from `dexscreenerApi.getTokenProfile` (with cache).
   - Returns a unified `PortfolioToken[]` regardless of chain.
   - This is essentially `GeickoPortfolioModal.fetchPortfolio` extracted, generalized to multi-chain, and made cache-aware.
3. **`lib/services/token-icon-resolver.ts`** — single function that takes a token address + chain and returns a logo URL, trying (in order) DexScreener, PulseChain explorer, Moralis. Both `GeickoPortfolioModal` and `TokenTable` already re-implement variants of this; extract once.
4. **`hooks/usePortfolio.ts`** — convenience hook wrapping the store + service for components: `usePortfolio(walletAddress) → { tokens, totalUsd, isLoading, refresh }`.

**Result: portfolio tracker is now a UI exercise, not an architecture exercise.**

### Phase 5 — Build the portfolio tracker (separate engagement)
With Phases 0–4 done:
- New route `app/portfolio/page.tsx` — wallet list + aggregate view across chains.
- Reuse `GeickoPortfolioModal`'s table for the per-wallet view (or extract its table into a shared component first).
- Add sidebar nav entry.

### Phase 6 — Deferred refactors (do later, not blocking portfolio)
These are valuable but **not required** for portfolio v1. Don't let them block us.
- Split `hex-dashboard.tsx` (4,158 lines) into `HexStakingPanel` / `HexChartPanel` / `HexMetricsPanel` / `HexAIAgent`.
- Decompose `app/geicko/page.tsx` (3,222 lines) — it's already partially decomposed into `components/geicko/*`, finish the job.
- Strip the FetchLogEvent debugging UI out of `AdminStatsPanel.tsx`.
- Investigate whether `lookintorh-clone.tsx`'s single importer (`TransactionModal.tsx`) actually needs it; if not, delete 90KB.
- Author `CLAUDE.md` with the service rules, where state lives, naming conventions.

---

## 3. Effort & risk summary

| Phase | Effort | Risk | Blocks portfolio? |
| --- | --- | --- | --- |
| 0 — Safety net | 30 min | None | No |
| 1 — Deletions | 1–2 h | Very low | No |
| 2 — Types | 2 h | Low | Yes (mild) |
| 3 — Service consolidation | 4–6 h | Medium (touches main pages) | **Yes** |
| 4 — Portfolio foundations | 4–6 h | Low | **Yes** |
| 5 — Portfolio UI | separate | — | — |
| 6 — Deferred | many hours | — | No |

**Minimum critical path to "ready to build portfolio": Phases 0 → 1 → 2 → 3 → 4 ≈ 12–17 hours.**

---

## 4. What I'd recommend doing first

Start with **Phase 1 deletions** in a single PR. It's zero risk, it shrinks the surface area dramatically, and it makes everything downstream easier to reason about. Then Phase 2 + 3 together, then Phase 4. Each phase ends in a state where the app still works — no big-bang refactors.

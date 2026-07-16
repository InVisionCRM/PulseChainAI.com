# CLAUDE.md

## ⛔ RULE #1 — DO NOT EVER GUESS

**Never guess.** Not endpoints, not addresses, not file locations, not config
values, not API shapes, not "the canonical way this project does X."

When you don't know something for certain:

1. **SEARCH THE PROJECT'S FILES FIRST** — `git grep`, read the actual source,
   find the existing helper/registry/constant that already encodes the answer.
2. **If it isn't in the repo, ASK THE USER DIRECTLY.** A one-line question is
   always cheaper than a wrong guess that ships.

A plausible-looking guess (an RPC URL, an explorer domain, a contract address,
a "probably this endpoint") is worse than saying "I don't know — where is this
defined?" Guessed values have shipped to this repo before and had to be ripped
out. Don't add to that.

This applies to diagnostics too: don't probe invented hostnames as if they were
real. Test only endpoints that actually exist in the codebase or that the user
named.

---

## Sources of truth (use these; do not hand-roll or guess alternatives)

- **PulseChain explorer links** → `lib/pulsechainExplorer.ts`
  (`pulsechainTxUrl` / `pulsechainAddressUrl` / `pulsechainTokenUrl`,
  label `PULSECHAIN_EXPLORER_NAME`). Canonical explorer is **Otterscan**.
  Never hardcode an explorer domain in a component or service.
- **Chain config** (chain id, RPC, Blockscout API base, DexScreener slug,
  wrapped-native, native symbol) → `lib/chains/registry.ts` (`CHAINS`, `getChain`).
- **RPC pools** → `lib/portfolio/evmRpc.ts` (`RPC_URLS`) and the per-route pools
  in `app/api/portfolio/*`. Curated + ordered by the project owner; first that
  answers wins.
- **Launchpad registry** → `lib/launchpads/` (`launchpadsForChain`,
  `activeLaunchpads`, `ROBINHOOD_TOKENS`).
- **Supported chains** → `ChainId` in `services/core/types.ts`
  (`'ethereum' | 'pulsechain' | 'robinhood'`). HEX-staking code is
  intentionally `ethereum | pulsechain` only (no HEX on Robinhood).

## Banned endpoints / anti-patterns

- **Never use `midgard.wtf`** as a PulseChain explorer. Use
  `lib/pulsechainExplorer.ts` (Otterscan).
- **Never use testnet RPCs or explorers** for production/mainnet code.
- Don't invent RPC hosts. The real pools live in the files listed above; if a
  new RPC is needed, ask the user which one.

## Build / verify

- `next build` runs with `typescript.ignoreBuildErrors` and
  `eslint.ignoreDuringBuilds` (see `next.config.js`) — the build will NOT catch
  type/lint errors for you. Run `npx tsc --noEmit` yourself and check that your
  change adds no NEW errors (the repo has pre-existing TS debt).
- Robinhood Chain wiring has a live smoke test: `npm run verify:robinhood`.

# CLAUDE.md — how to work in this repo

The owner is a **non-developer ("vibe coder")** who is trusting you completely.
Act like the senior engineer whose job is to protect their codebase, their
time, and their credits. That means: small, correct, well-tested changes;
no surprises; no scope creep; and asking instead of guessing. Read the rules
below before touching anything.

---

## 🔟 THE RULES (in priority order)

### 1. DO NOT EVER GUESS — but DO research and verify
Never invent an endpoint, address, RPC, subgraph, file path, type, config value,
or "the way this project does X." Work through this order, and don't stop early:
1. **Search the repo** — `git grep`, read the real source, find the existing
   constant/helper/registry that already holds the answer.
2. **Search online, then VERIFY it yourself.** You have web search + fetch —
   use them. Find the official value (RPC URL, explorer API base, contract
   address, chain id) in docs/official sources, then **prove it works before
   using it**: `curl` the endpoint, `eth_getCode` the address, hit the API and
   check the JSON shape. A value you researched AND verified is NOT a guess;
   an unverified copy-paste IS. Do this yourself — don't make the owner look
   things up you can find.
3. **Only ask the owner** when you genuinely can't find or verify it, it's
   down/ambiguous, or it's truly their call (which paid provider to use,
   subjective preference). Then ask in one line. Don't ask for things you can
   research.
- Diagnostics: only test endpoints that exist in the code, that the owner named,
  or that you found in an authoritative source and are verifying. Never probe
  fully made-up hostnames.
- Guessed values (RPCs, explorer domains, addresses) have shipped here before
  and had to be ripped out. Research + verify instead.

### 2. REUSE — do not blindly create new files, endpoints, or types
Before writing a new file / API route / type / helper / constant, **search for
an existing one** and use or extend it. New surface area is a cost the owner
pays forever.
- New chain/explorer/RPC value? It already lives in a registry (see below).
- New util? `git grep` the function name and nearby concepts first.
- If a new file is genuinely needed, say why the existing ones don't fit.

### 3. ALWAYS TEST after any backend change or addition
`next build` runs with `typescript.ignoreBuildErrors` **and**
`eslint.ignoreDuringBuilds` (see `next.config.js`) — **the build will NOT catch
your bugs.** You are the test harness. After any change to backend/data code:
- `npx tsc --noEmit` and confirm you added **zero new** errors (the repo has
  pre-existing TS debt; compare against the baseline, don't just count).
- Exercise the actual path: hit the API route (`curl` the local `next dev`
  server), or run the relevant script. For Robinhood: `npm run verify:robinhood`.
- For anything user-visible, drive it in a browser and confirm it renders.
- Never claim something works because it "should." Show the passing check.

### 4. NO subagents. NO corner-cutting.
- **Do not spawn subagents / the Workflow tool / parallel agents** unless the
  owner explicitly asks for it. Do the work yourself, in the open, step by step.
- No stubbing, no "TODO: real impl later," no mock data presented as real, no
  silently narrowing scope to make something pass. If you can't finish it
  correctly, stop and say so.

### 5. STAY IN SCOPE — protect the owner's credits and codebase
- Do **only** what was asked. Don't refactor, rename, reformat, "improve," or
  add features that weren't requested. If you spot something worth doing,
  mention it and ask — don't just do it.
- Prefer the smallest diff that solves the problem.
- Don't burn tokens on giant explorations when a targeted `git grep` answers it.
- Surface trade-offs plainly and let the owner decide; don't make big
  architectural calls silently.

### 6. Report honestly
If a test fails, say so with the output. If something is down/external, say
that (don't pretend a code change fixed it). If you're unsure, say you're
unsure. The owner cannot double-check you — accuracy is the whole job.

---

## Sources of truth (read these before hardcoding anything)

- **PulseChain explorer links (web)** → `lib/pulsechainExplorer.ts` — Otterscan
  helpers (`pulsechainTxUrl`, `pulsechainAddressUrl`, `pulsechainTokenUrl`).
  Never hardcode an explorer domain in a component/service.
- **Chain config** (chain id, RPC list, Blockscout API base, DexScreener slug,
  wrapped-native, native symbol) → `lib/chains/registry.ts` (`CHAINS`, `getChain`).
- **RPC pools** (server, failover, first-that-answers-wins) →
  `lib/portfolio/evmRpc.ts` + per-route pools under `app/api/portfolio/*`.
- **Launchpads** → `lib/launchpads/` (`launchpadsForChain`, `activeLaunchpads`,
  `ROBINHOOD_TOKENS`).
- **Supported chains type** → `ChainId` in `services/core/types.ts`
  (`'ethereum' | 'pulsechain' | 'robinhood'`). HEX-staking code is intentionally
  `ethereum | pulsechain` only (no HEX on Robinhood).

---

## Infrastructure we actually use (do not substitute without asking)

### RPC endpoints (JSON-RPC nodes — return raw chain data, NOT decoded history)
- **PulseChain (369)** — canonical list from chainlist.org. These are healthy
  public nodes; use them, don't invent others. HTTPS:
  `rpc.pulsechainstats.com` ("pulsechain stats"), `pulsechain-rpc.publicnode.com`,
  `rpc.degenprotocol.io`, `rpc.gigatheminter.com`, `rpc-pulsechain.g4mm4.io`
  ("gamma"), `rpc.pulsechainrpc.com`, `rpc.swiftnodes.io/rpc/pulsechain`,
  `rpc.hairylabs.io`, `evex.cloud/pulserpc`,
  `rpc.owlracle.info/pulse/<key>` (key-gated).
  WebSocket (WSS): `pulsechain-rpc.publicnode.com`, `rpc.hairylabs.io/ws`,
  `ws.pulsechainrpc.com`, `evex.cloud/pulsews`.
  In-app server pool (`lib/portfolio/evmRpc.ts` + portfolio routes):
  `rpc.pulsechainstats.com`, `rpc.pulsechainrpc.com`,
  `pulsechain-rpc.publicnode.com`, `rpc.gigatheminter.com`,
  `rpc-pulsechain.g4mm4.io`, `rpc.degenprotocol.io`.
  Override: `PULSECHAIN_RPC_URL` / `NEXT_PUBLIC_PULSECHAIN_RPC_URL`.
- **Ethereum (1):** `ethereum-rpc.publicnode.com`, `rpc.ankr.com/eth`,
  `eth.drpc.org`. Override: `ETHEREUM_RPC_URL`.
- **Robinhood (4663):** `rpc.mainnet.chain.robinhood.com`.

### Block-explorer APIs (Blockscout v2 — these return decoded transactions,
token-transfers, balances, token metadata; an RPC CANNOT replace these)
- **PulseChain:** `api.scan.pulsechain.com/api/v2`
- **Ethereum:** `eth.blockscout.com/api/v2`
- **Robinhood:** `robinhoodchain.blockscout.com/api/v2`

### Other data APIs
- **DexScreener:** `api.dexscreener.com/latest/dex` (prices, pairs, token search).
- **GeckoTerminal:** `api.geckoterminal.com/api/v2` (OHLCV candles).
- **Moralis:** `deep-index.moralis.io/api/v2.2` — OPTIONAL, key-gated
  (`MORALIS_API_KEY`), currently PulseChain-hardcoded; skipped without a key.
- **CoinGecko:** key `COINGECKO_API_KEY`.

### Subgraphs / GraphQL
- **PulseChain HEX:** `graph.pulsechain.com/subgraphs/name/Codeakk/Hex`
  (fallbacks: `.../hex/hex-staking`, `api.thegraph.com/subgraphs/name/pulsechain/hex-staking`).
- **PulseX:** `graph.pulsechain.com/subgraphs/name/Codeakk/PulseX` and
  `.../pulsechain/pulsex`, `.../pulsechain/pulsexv2`.
- **Ethereum HEX / hosted subgraphs:** `gateway.thegraph.com/api` (key `THEGRAPH_API_KEY`).
- **Internal proxy** (client calls route through this to dodge CORS):
  `app/api/pulsechain-graphql-proxy`.

### ⛔ Banned / never use
- **`midgard.wtf`** as an explorer — use `lib/pulsechainExplorer.ts` (Otterscan).
- **Any testnet RPC or explorer** in production/mainnet code.
- Any RPC/explorer/subgraph host not already in this repo — ask first.

---

## Build / run / test commands
- Dev server: `npm run dev` (Next.js on :3000).
- Type check: `npx tsc --noEmit`.
- Robinhood chain/launchpad smoke test: `npm run verify:robinhood`.
- Screener backfill: `npm run screener:backfill`. DB scripts: `npm run db:*`.

## Git / PR conventions
- Work on the branch the task specifies; branch off latest `main` for new work.
- Small, focused commits with clear messages.
- Open PRs ready-for-review; keep unrelated concerns in separate PRs when you can.

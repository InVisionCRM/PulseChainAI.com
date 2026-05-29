# Portfolio page — fetch graph

How every piece of data the `/portfolio` page renders gets loaded, with the
fallback chain for each external dependency.

## Legend

- 🟦 **Browser** — client-side React component or service
- 🟪 **Server** — Next.js API route running on Vercel Functions
- 🟧 **RPC** — public chain RPC endpoint (no API key)
- 🟢 **DEX** — DexScreener REST API
- ⬜ **Cache** — in-memory cache on the API route
- ➡️ solid = primary call
- ⤳ dashed = fallback on failure

## The big picture

```mermaid
flowchart LR
    classDef browser fill:#1e40af,stroke:#60a5fa,color:#fff
    classDef route fill:#7e22ce,stroke:#c084fc,color:#fff
    classDef rpc fill:#c2410c,stroke:#fb923c,color:#fff
    classDef dex fill:#0f766e,stroke:#5eead4,color:#fff
    classDef explorer fill:#525252,stroke:#a3a3a3,color:#fff

    Page["/portfolio page"]:::browser

    subgraph WalletFlow["Per-wallet refresh — portfolioService.getPortfolio()"]
      direction TB
      S1["1. fetch balances"]:::browser
      S2["2. enrichWithPrices pass 1<br/>fills names / symbols / logos / prices"]:::browser
      S3["3. flag LPs via isLpToken(symbol, name)"]:::browser
      S4["4. enrichLpTokens<br/>only runs if any LPs found"]:::browser
      S5["5. enrichWithPrices pass 2<br/>LP underlying sides, mostly cache hit"]:::browser
      S6["6. resolveMissingIcons<br/>logo fallback"]:::browser
      S1 --> S2 --> S3 --> S4 --> S5 --> S6
    end

    Page --> WalletFlow

    subgraph Routes["API routes"]
      direction TB
      RBal["POST /api/portfolio/balances<br/>cache: 30s"]:::route
      RPri["POST /api/portfolio/prices<br/>cache: 60s"]:::route
      RLp["POST /api/portfolio/lp<br/>cache: 60s"]:::route
      RIns["POST /api/portfolio/insights<br/>cache: 5min"]:::route
      RAud["POST /api/portfolio/audit<br/>cache: 10min"]:::route
      RApp["POST /api/portfolio/approvals"]:::route
    end

    subgraph PulseRPC["PulseChain RPC pool — first responder wins"]
      direction TB
      P1["rpc.pulsechainrpc.com"]:::rpc
      P2["pulsechain-rpc.publicnode.com"]:::rpc
      P3["rpc.gigatheminter.com"]:::rpc
      P4["rpc-pulsechain.g4mm4.io"]:::rpc
      P1 -.->|fail| P2 -.->|fail| P3 -.->|fail| P4
    end

    subgraph EthRPC["Ethereum RPC pool — first responder wins"]
      direction TB
      E1["eth.llamarpc.com"]:::rpc
      E2["ethereum-rpc.publicnode.com"]:::rpc
      E3["rpc.ankr.com/eth"]:::rpc
      E1 -.->|fail| E2 -.->|fail| E3
    end

    DS["DexScreener API<br/>(Cloudflare-safe UA)"]:::dex
    PScan["PulseScan / eth.blockscout<br/>contract source + tx history<br/>(NOT used for balances)"]:::explorer

    S1 --> RBal
    S2 --> RPri
    S4 --> RLp
    S5 --> RPri
    S6 -.->|when logo missing| DS

    RBal -->|"batched balanceOf<br/>+ decimals + eth_getBalance"| PulseRPC
    RBal --> EthRPC

    RPri -->|"DexScreener tokens/{addr}"| DS

    RLp -->|"DexScreener pairs/{chain}/{lps}"| DS
    RLp -->|"getReserves + token0/1<br/>+ decimals + totalSupply"| PulseRPC
    RLp -->|"on Ethereum LPs"| EthRPC
    RLp -.->|"only if every RPC fails<br/>for totalSupply"| PScan

    subgraph Sidebar["Sidebar / lazy panels"]
      direction TB
      Watch["WatchlistPanel"]:::browser
      Chart["PortfolioChart<br/>(localStorage only)"]:::browser
      Approvals["ApprovalsPanel<br/>(lazy on expand)"]:::browser
      Modal["TokenInsightsCard<br/>(lazy on row click)"]:::browser
    end

    Page --> Sidebar
    Watch --> RPri
    Approvals --> RApp
    Modal --> RIns
    Modal -.->|"on Audit tab"| RAud
    Modal -.->|"on AI Chat tab"| RIns

    RIns -->|"tokens/{addr}"| DS
    RIns -.->|"creator + token metadata"| PScan
    RAud -->|"fetchContract + analyzeContractAudit"| PScan
    RApp -->|"address tx history,<br/>paginate + filter approve()"| PScan
```

## Detail: the wallet-refresh path

For each tracked wallet, in parallel for the chains the wallet enabled.

```mermaid
sequenceDiagram
    participant UI as Portfolio page
    participant PS as portfolioService
    participant Bal as /api/portfolio/balances
    participant Pri as /api/portfolio/prices
    participant Lp as /api/portfolio/lp
    participant RPC as PulseChain RPC pool
    participant DEX as DexScreener

    UI->>PS: getPortfolio(addr, chains)
    PS->>Bal: POST { address, chain }
    Bal->>RPC: batched balanceOf + decimals (~40 contracts)
    Bal->>RPC: eth_getBalance (native)
    RPC-->>Bal: results
    Bal-->>PS: { tokens, nativeBalanceRaw }

    Note over PS: tokens still have<br/>placeholder symbols
    PS->>Pri: POST { addresses: [main token list] }
    Pri->>DEX: tokens/{addr} per address
    DEX-->>Pri: name / symbol / logo / price
    Pri-->>PS: priceMap

    Note over PS: now have real symbols<br/>→ isLpToken() flags LPs

    alt at least one LP
        PS->>Lp: POST { addresses: [LP contracts] }
        Lp->>DEX: pairs/{chain}/{lps}
        Lp->>RPC: getReserves + token0/1 + decimals + totalSupply
        RPC-->>Lp: pair state
        DEX-->>Lp: pair metadata
        Lp-->>PS: LP breakdowns w/ token0/1 reserves

        PS->>Pri: POST { addresses: [LP side tokens] }
        Note right of Pri: usually a cache hit
        Pri-->>PS: side prices/logos
    end

    PS-->>UI: PortfolioSnapshot { tokens, totalValueUsd }
```

## Detail: LP breakdown fallback chain

The most complex piece, because it combines DexScreener pair data with
on-chain reserve reads, with two fallback paths.

```mermaid
flowchart TB
    classDef route fill:#7e22ce,stroke:#c084fc,color:#fff
    classDef rpc fill:#c2410c,stroke:#fb923c,color:#fff
    classDef dex fill:#0f766e,stroke:#5eead4,color:#fff
    classDef explorer fill:#525252,stroke:#a3a3a3,color:#fff
    classDef decision fill:#0c2340,stroke:#fff,color:#fff

    Start(["POST /api/portfolio/lp<br/>for each LP address"]):::route

    Pairs["DexScreener pairs/{chain}/{lps}"]:::dex
    HasPair{"DexScreener<br/>has the pair?"}:::decision
    UseDexReserves["Use DexScreener<br/>reserves + token0/1"]
    OnChainState["Read on-chain:<br/>token0(), token1(),<br/>getReserves(), decimals()"]:::rpc
    TotalSupply["Read totalSupply()<br/>on the LP contract"]:::rpc
    TSFallback["fetch /tokens/X.total_supply<br/>from PulseScan"]:::explorer
    Build["Build LpInfo {<br/>  token0, token1,<br/>  reserves, TVL,<br/>  totalSupply<br/>}"]

    Start --> Pairs --> HasPair
    HasPair -->|yes| UseDexReserves --> TotalSupply
    HasPair -->|no| OnChainState --> TotalSupply
    TotalSupply -.->|every RPC failed| TSFallback
    UseDexReserves --> Build
    OnChainState --> Build
    TotalSupply --> Build
    TSFallback -.-> Build

    subgraph RpcPool["PulseChain RPC pool (per call)"]
      direction LR
      Try1["rpc.pulsechainrpc.com"]:::rpc
      Try2["publicnode"]:::rpc
      Try3["gigatheminter"]:::rpc
      Try4["g4mm4"]:::rpc
      Try1 -.-> Try2 -.-> Try3 -.-> Try4
    end

    OnChainState --- RpcPool
    TotalSupply --- RpcPool
```

## Detail: insights modal (lazy, on row click)

```mermaid
flowchart LR
    classDef browser fill:#1e40af,stroke:#60a5fa,color:#fff
    classDef route fill:#7e22ce,stroke:#c084fc,color:#fff
    classDef dex fill:#0f766e,stroke:#5eead4,color:#fff
    classDef explorer fill:#525252,stroke:#a3a3a3,color:#fff

    Click["click 🔍 trigger on a row"]:::browser
    Open["modal opens with header from PortfolioToken"]:::browser
    Tab1["Overview tab (default)"]:::browser
    Tab2["Liquidity tab"]:::browser
    Tab3["Audit tab"]:::browser
    Tab4["AI Chat tab"]:::browser

    Ins["POST /api/portfolio/insights"]:::route
    Aud["POST /api/portfolio/audit"]:::route
    Chat["TokenAIChat<br/>(dynamic import, ssr:false)"]:::browser

    DS["DexScreener<br/>tokens/X + pair details"]:::dex
    Exp["PulseScan / eth.blockscout<br/>tokens + addresses"]:::explorer
    Contract["fetchContract<br/>(source code, ABI)"]:::explorer
    AuditFn["analyzeContractAudit<br/>(pattern-match)"]:::browser

    Click --> Open
    Open --> Tab1 -->|on mount| Ins
    Open --> Tab2 --> Ins
    Open --> Tab3 -->|lazy on click| Aud
    Open --> Tab4 -->|lazy on click| Chat

    Ins -->|description, socials, market cap| DS
    Ins -->|creator, supply| Exp
    Aud --> Contract
    Aud --> AuditFn
    AuditFn -.->|reuses| Contract
    Chat -.->|fetchContract / fetchTokenInfo / fetchDexScreenerData| Contract
    Chat -.-> DS
```

## Where Blockscout-shaped explorers still get used (post-Phase 11)

After dropping Blockscout for the balance path, three callers still hit
`api.scan.pulsechain.com` / `eth.blockscout.com`. None of them block the
main wallet load:

| Route | What it reads | Why explorer, not RPC |
| --- | --- | --- |
| `/api/portfolio/approvals` | Wallet's outbound tx history, filtered for `approve()` | RPC can't enumerate tx history; explorers index it |
| `/api/portfolio/audit` | Contract source code + ABI for `analyzeContractAudit` | Source code isn't on-chain; explorers verify and serve it |
| `/api/portfolio/insights` | Creator address + total supply | Convenience; we could replace `total_supply` with an RPC `totalSupply()` call |
| `/api/portfolio/lp` (totalSupply fallback only) | `tokens/<addr>.total_supply` | Last-resort if every RPC times out |

Everything else — every balance read, every price/logo/symbol, every LP
reserve — flows through DexScreener + the curated RPC pool.

## Caches at a glance

| Cache | Where | TTL | Why |
| --- | --- | --- | --- |
| portfolio history points | browser localStorage (`morbius-portfolio-v1`) | 1 year, throttled to 1 entry/hour | drives the chart |
| watchlist | browser localStorage (`morbius-watchlist-v1`) | forever | user-owned data |
| balances proxy | server in-memory | 30s | smooths double-refresh |
| prices proxy | server in-memory | 60s, positive only | failed lookups retry next time |
| lp proxy | server in-memory | 60s | reserves move slowly |
| insights proxy | server in-memory | 5min | metadata moves rarely |
| audit proxy | server in-memory | 10min | source code is immutable |
| Next.js fetch cache | server, framework-managed | per-route `revalidate` | underlying `fetch()` cache |

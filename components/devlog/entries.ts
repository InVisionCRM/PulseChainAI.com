// The devlog: what actually shipped, ranked biggest-first.
//
// Every entry here corresponds to work merged to `main` — the date ranges and
// PR counts come from the merge history, not from memory. The screenshots in
// /public/devlog are captures of the real running app against live PulseChain
// data, so a picture here is the feature, not a mockup of it.
//
// Ordering is by size of the upgrade, not by date, because "what's the biggest
// thing that changed" is the question a returning visitor is actually asking.
// Keep that ordering when you add to it: a new entry goes where its weight puts
// it, and `DEVLOG_VERSION` bumps so the "new" dot comes back.

/** Bump when entries change so the unseen indicator re-arms for everyone. */
export const DEVLOG_VERSION = '2026-08-05';

/** The window these entries cover, for the modal's subtitle. */
export const DEVLOG_PERIOD = 'July 5 – August 5, 2026';

/** Totals from the merge history for the same window. */
export const DEVLOG_TOTALS = { prs: 73, commits: 244 };

export type DevlogKind = 'new' | 'upgrade' | 'fix';

export type DevlogEntry = {
  id: string;
  title: string;
  /** One-line hook shown next to the title. */
  kicker: string;
  body: string;
  kind: DevlogKind;
  /** 1–5, drives the impact meter and the running order. */
  impact: number;
  when: string;
  /** Merged pull requests behind it, where it was a multi-PR effort. */
  prs?: number;
  /** Lives in /public/devlog. Majors get a picture; minors are text-only. */
  image?: string;
  /** Alt text — describes what the capture actually shows. */
  imageAlt?: string;
  /** Where to go try it. */
  href?: string;
};

export const DEVLOG_ENTRIES: DevlogEntry[] = [
  {
    id: 'superstake',
    title: 'SuperStake',
    kicker: 'a whole page for the stake that restakes itself',
    body:
      'The pSSH machine explained as five questions you can actually answer: what happens on every buy and every 60-day cycle, what you own, whether it has worked, what $100 on day one would have done, and what keeps it alive. Live stat banner with the cycle countdown, a projection you can drive, cycle-by-cycle tables with expandable rows, an on-chain burn tab, and 24 share cards.',
    kind: 'new',
    impact: 5,
    when: 'Jul 28 – 31',
    prs: 18,
    image: '/devlog/superstake.webp',
    imageAlt: 'The SuperStake page: cycle countdown, live pSSH price, and the "what happens" breakdown',
    href: '/superstake',
  },
  {
    id: 'robinhood',
    title: 'Robinhood Chain, end to end',
    kicker: 'a second chain, wired through everything',
    body:
      'Chain registry, RPC and explorer config, then every surface taught to speak it: portfolio tracking, multi-chain token search, the home screener, and the geicko analyzer. Pick a chain and the whole app follows — Ethereum, PulseChain, Robinhood.',
    kind: 'new',
    impact: 5,
    when: 'Jul 15 – 24',
    prs: 9,
    image: '/devlog/portfolio.webp',
    imageAlt: 'The portfolio page tracking two wallets, with Ethereum, PulseChain and Robinhood chain toggles',
    href: '/portfolio',
  },
  {
    id: 'sleuth',
    title: 'Sleuth, the on-chain analyst',
    kicker: 'ask a token page a question in plain English',
    body:
      'An AI analyst that lives on every token page and answers from the chain rather than from vibes — it calls real tools: wallet linking by funding trail, holder overlap between tokens, first-funder lookups, per-wallet trade records. Bring your own Gemini key; it stays in your browser.',
    kind: 'new',
    impact: 4,
    when: 'Jul 23',
    prs: 4,
    image: '/devlog/sleuth.webp',
    imageAlt: 'The Sleuth panel open on a token page with suggested on-chain questions',
  },
  {
    id: 'portfolio-drawer',
    title: 'Your portfolio, inside the token page',
    kicker: 'investigate wallets without losing your place',
    body:
      'A dock chip that follows you around the analyzer and opens a drawer: how much of this token each of your wallets holds, its league tier, your net P&L, and 24h movement. Pin any holder to an Investigating tray that survives tab and token switches, check whether your suspects share a funder, and hand the whole set to Sleuth in one click.',
    kind: 'new',
    impact: 4,
    when: 'Aug 3 – 5',
    image: '/devlog/drawer.webp',
    imageAlt: 'The portfolio drawer showing per-wallet holdings, Whale league tiers, net P&L and the Investigating tray',
  },
  {
    id: 'holders',
    title: 'The holder list, rebuilt',
    kicker: 'real balances, and what each wallet did with them',
    body:
      'Actual on-chain balances instead of estimates, an estimated wallet value beside them, and every row expandable into that wallet\'s trade record. Plus a buy/sell split, a 24h position-change column reconstructed from Transfer logs, and a held-through-the-crash grade from Diamond to Exited.',
    kind: 'upgrade',
    impact: 4,
    when: 'Jul 31 – Aug 3',
    prs: 4,
    image: '/devlog/holders.webp',
    imageAlt: 'The holders table with balance, wallet value, share, 24h change and buy/sell columns',
  },
  {
    id: 'forensics',
    title: 'Creator forensics',
    kicker: 'who made it, who funded them, and whether they left',
    body:
      'The launch, reconstructed: how much the creator still holds, whether they sold to the DEX and how often, who funded them in the first place, which wallets they seeded and what those wallets hold now, how many of the first 30 buyers are still in, and how many snipers landed in the launch block.',
    kind: 'upgrade',
    impact: 3,
    when: 'Jul 31',
    image: '/devlog/forensics.webp',
    imageAlt: 'The forensics tab: creator marked EXITED, sells to DEX, and the wallets it seeded',
  },
  {
    id: 'bubbles',
    title: 'Bubbles lead the homepage',
    kicker: 'the market as a field, shareable in one tap',
    body:
      'The bubble field is the first thing you see now instead of the table. A share button renders the field to an image watermarked scan.Morbius.io, tokens your own wallets hold wear a gold ring, and the glitch that drew a second ghosted logo over the big bubbles is gone.',
    kind: 'upgrade',
    impact: 3,
    when: 'Aug 4',
    prs: 2,
    image: '/devlog/bubbles.webp',
    imageAlt: 'The homepage bubble field with live PulseChain tokens sized and coloured by 24h move',
    href: '/',
  },
  {
    id: 'depth',
    title: 'Trade depth, simulated on chain',
    kicker: 'what a real ticket actually executes at',
    body:
      'Not the quoted price — the filled one. $100, $1,000 and $10,000 tickets simulated live through the PulseX router across v1, v2, direct and two-hop routes, with LibertySwap quoted through its own QuoterV2 alongside. Best route wins, and the routes that lost are shown too.',
    kind: 'new',
    impact: 3,
    when: 'Jul 31',
    image: '/devlog/liberty.webp',
    imageAlt: 'The depth tab showing buy and sell slippage at three ticket sizes, and the routes that lost',
  },
  {
    id: 'leagues',
    title: 'Token Leagues',
    kicker: 'Tsunami down to Crab',
    body:
      'Holder ranks by share of supply, each tier showing the balance it takes to get in and what that is worth right now — with populations, rarity, and a box to paste your address and find your own rank.',
    kind: 'new',
    impact: 2,
    when: 'Jul 7 – 11',
    prs: 4,
    image: '/devlog/leagues.webp',
    imageAlt: 'The Token Leagues ladder from Tsunami to Crab with the balance each tier requires',
  },
  {
    id: 'volume',
    title: 'A Volume tab',
    kicker: 'the whole trading life of a token',
    body:
      'Lifetime volume and trade count since launch, average day and average ticket, best and quietest day, 7-day change, momentum against the 30-day average, turnover against liquidity, longest active streak, and a cumulative curve for the life of the token.',
    kind: 'new',
    impact: 2,
    when: 'Jul 23',
    image: '/devlog/volume.webp',
    imageAlt: 'The volume tab: $1.71M since launch over 149,746 trades, with the cumulative curve',
  },
  {
    id: 'loaders',
    title: 'Loaders where there were none',
    kicker: 'no more staring at a static line of text',
    body:
      'Skeletons and spinners across forensics, holders, supply cards and everywhere else that used to sit on a bare "loading…" while a chain walk ran underneath. Slow things now look like they are working, because some of them genuinely take 30 seconds.',
    kind: 'upgrade',
    impact: 2,
    when: 'Aug 4',
    image: '/devlog/skeletons.webp',
    imageAlt: 'The forensics tab mid-trace, showing skeleton placeholders while it reads the chain',
  },
  {
    id: 'lp-pnl',
    title: 'LP fees and net P&L per position',
    kicker: 'what the pool actually paid you',
    body:
      'Every liquidity position in the portfolio now shows the fees it has earned and its net profit and loss, derived from the PulseX subgraph rather than guessed from the current balance.',
    kind: 'new',
    impact: 2,
    when: 'Jul 23',
    href: '/portfolio',
  },
  {
    id: 'resilience',
    title: 'The explorer can go down now',
    kicker: 'and the app keeps answering',
    body:
      'PulseChain\'s block explorer is the flaky dependency, so holder and transfer data now falls back to the RPC pool and reconstructs what it needs from Transfer logs and balanceOf calls. Degraded responses say so rather than quietly showing you less.',
    kind: 'upgrade',
    impact: 2,
    when: 'Jul 31',
  },
  {
    id: 'ratings',
    title: 'Comments and ratings on token pages',
    kicker: 'a thumbs up, a thumbs down, and a review',
    body:
      'Leave a review on any token page, and see the running 👍 / 👎 count next to the header.',
    kind: 'new',
    impact: 1,
    when: 'Jul 22',
  },
  {
    id: 'marketcap',
    title: 'Market cap computed from the chain',
    kicker: 'on-chain supply × live price',
    body:
      'The market cap stat is now derived from on-chain supply and the live pair price instead of a third-party figure that went stale, and total liquidity reads from the same pair source as the Liquidity tab.',
    kind: 'fix',
    impact: 1,
    when: 'Jul 21',
  },
  {
    id: 'bridge',
    title: 'Bridge flows, per wallet',
    kicker: 'and a pricing bug that read $11B',
    body:
      'Bridge inflows and outflows moved into per-wallet tabs with a redesigned flow view, and the cross-chain pricing bug that valued a WETH position at eleven billion dollars is fixed. The bridge address now points at the PulseChain-side mediator instead of the Ethereum omnibridge.',
    kind: 'fix',
    impact: 1,
    when: 'Jul 7 – 8',
    prs: 4,
  },
  {
    id: 'bubblemap',
    title: 'Bubble map cleanup',
    kicker: 'clusters first, and right-click to remove',
    body:
      'The holder bubble map shows only clustered wallets by default so the connections are visible instead of buried, with size caps, Robinhood support, and right-click to drop a node.',
    kind: 'upgrade',
    impact: 1,
    when: 'Jul 21 – 26',
    prs: 3,
  },
  {
    id: 'fixes',
    title: 'And a pile of smaller fixes',
    kicker: 'the unglamorous half of 73 pull requests',
    body:
      'Watchlist entries open in the analyzer again. The ticker bar stopped vanishing and its chain dropdown sits above the search bar. Nav utility tiles, a compact nav header, and the sidebar no longer overlaps the watchlist. Holder data restored for bubble maps, LP dropdowns and Token Leagues. The retired gemini-2.5-flash model swapped out for new API keys. Centred, non-colliding holder columns on narrow screens.',
    kind: 'fix',
    impact: 1,
    when: 'all month',
  },
];

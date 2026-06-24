// Centralized HEX subgraph configuration, shared by the Strategist API routes
// (whale-unlocks, leaderboards, stake-bubbles, radar-backtest) and the Ethereum
// staking service.
//
// The Graph's decentralized gateway requires an API key. It's read from
// THEGRAPH_API_KEY when set — so an expired or rate-limited key can be rotated
// in the Vercel dashboard without a code change — and falls back to the
// historical hardcoded key so existing deploys keep working unchanged.

export type HexNet = 'ethereum' | 'pulsechain';

const GRAPH_API_KEY = process.env.THEGRAPH_API_KEY || 'a08fcab20e333b38bb75daf3d97a0bb5';
const ETH_HEX_SUBGRAPH_ID = 'A6JyHRn6CUvvgBZwni9JyrgovKWK6FoSQ8TVt6JJGhcp';

export const HEX_SUBGRAPH: Record<HexNet, { url: string; headers: Record<string, string> }> = {
  pulsechain: {
    url: 'https://graph.pulsechain.com/subgraphs/name/Codeakk/Hex',
    headers: { 'Content-Type': 'application/json' },
  },
  ethereum: {
    url: `https://gateway.thegraph.com/api/subgraphs/id/${ETH_HEX_SUBGRAPH_ID}`,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${GRAPH_API_KEY}` },
  },
};

/**
 * POST a GraphQL query to the HEX subgraph for a network. On a non-OK response
 * or GraphQL error, throws an Error whose message carries the real upstream
 * reason (status + body snippet) so callers can surface *why* a request failed
 * instead of a blank "no data" state.
 */
export async function hexSubgraphQuery<T>(net: HexNet, query: string): Promise<T> {
  const cfg = HEX_SUBGRAPH[net];
  const res = await fetch(cfg.url, {
    method: 'POST',
    headers: cfg.headers,
    body: JSON.stringify({ query }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    const snippet = body.slice(0, 200).replace(/\s+/g, ' ').trim();
    throw new Error(`${net} subgraph HTTP ${res.status}${snippet ? `: ${snippet}` : ''}`);
  }
  const j = await res.json();
  if (j.errors?.length) {
    throw new Error(`${net} subgraph: ${j.errors[0]?.message || 'GraphQL error'}`);
  }
  return j.data as T;
}

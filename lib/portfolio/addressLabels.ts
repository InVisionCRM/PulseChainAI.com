// Auto-naming for addresses added to portfolio groups. Each "source" is a
// place in the app an address can be grabbed from (a holders list, a contract
// creator, a tx counterparty, …); the label is generated from that context so
// a saved address reads like "PLSX holder #3" or "PulseX creator wallet"
// instead of a bare 0x string. Users can always override the suggestion.

export type AddressSource =
  | 'manual'
  | 'holder'
  | 'lp'
  | 'creator'
  | 'owner'
  | 'tx'
  | 'approval'
  | 'search'
  | 'token';

export interface LabelContext {
  /** Token the address relates to (full name, e.g. "PulseX"). */
  tokenName?: string;
  /** Token ticker (e.g. "PLSX") — preferred for compact labels. */
  tokenSymbol?: string;
  /** 1-based position in a holders / LP list. */
  rank?: number;
  /** For tx counterparties — how the address related to the user's wallet. */
  direction?: 'buyer' | 'seller' | 'sender' | 'receiver' | 'counterparty';
  /** A human spender name, when known (approvals). */
  spenderName?: string;
}

export const SOURCE_LABEL: Record<AddressSource, string> = {
  manual: 'Manual',
  holder: 'Holder',
  lp: 'LP',
  creator: 'Creator',
  owner: 'Owner',
  tx: 'Transaction',
  approval: 'Approval',
  search: 'Search',
  token: 'Token',
};

export const shortAddr = (a: string) =>
  a && a.length > 10 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a || 'address';

/**
 * Build a default label for an address from where it was grabbed. Falls back
 * to a truncated address when there isn't enough context to say more.
 */
export function suggestGroupLabel(
  source: AddressSource,
  address: string,
  ctx: LabelContext = {},
): string {
  const tok = ctx.tokenSymbol || ctx.tokenName;
  const tokFull = ctx.tokenName || ctx.tokenSymbol;

  switch (source) {
    case 'holder':
      return tok
        ? `${tok} holder${ctx.rank ? ` #${ctx.rank}` : ''}`
        : `Holder ${shortAddr(address)}`;
    case 'lp':
      return tok
        ? `${tok} LP${ctx.rank ? ` #${ctx.rank}` : ''}`
        : `LP ${shortAddr(address)}`;
    case 'creator':
      return tokFull ? `${tokFull} creator wallet` : `Creator ${shortAddr(address)}`;
    case 'owner':
      return tokFull ? `${tokFull} owner wallet` : `Owner ${shortAddr(address)}`;
    case 'approval':
      return ctx.spenderName
        ? `${ctx.spenderName} (spender)`
        : tok
          ? `${tok} spender ${shortAddr(address)}`
          : `Spender ${shortAddr(address)}`;
    case 'tx': {
      const dir = ctx.direction && ctx.direction !== 'counterparty' ? ctx.direction : null;
      if (tok && dir) return `${tok} ${dir} ${shortAddr(address)}`;
      if (tok) return `${tok} counterparty ${shortAddr(address)}`;
      return `${dir ? `${dir[0].toUpperCase()}${dir.slice(1)} ` : ''}${shortAddr(address)}`;
    }
    case 'search':
    case 'token':
    case 'manual':
    default:
      return tokFull ? `${tokFull} ${shortAddr(address)}` : shortAddr(address);
  }
}

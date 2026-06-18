// Cross-store orchestration for adding an address to a group. Lives outside the
// stores because it coordinates two of them (portfolioStore for tracked wallets,
// groupsStore for group defs + bookmark members). Components call these instead
// of poking both stores by hand.

import { usePortfolioStore } from '@/lib/stores/portfolioStore';
import { useGroupsStore, type GroupMember } from '@/lib/stores/groupsStore';
import type { AddressSource } from '@/lib/portfolio/addressLabels';
import type { ChainId } from '@/services';

export interface AddToGroupArgs {
  address: string;
  chain?: ChainId;
  groupId: string;
  label: string;
  source: AddressSource;
  /** When true the address becomes a balance-scanned portfolio wallet. */
  track: boolean;
}

/**
 * Add an address to a group. An address that's already a tracked wallet is just
 * reassigned/relabelled. Otherwise `track` decides: a full portfolio wallet
 * (scanned) or a lightweight bookmark member.
 */
export function addAddressToGroup(args: AddToGroupArgs) {
  const portfolio = usePortfolioStore.getState();
  const groups = useGroupsStore.getState();
  const addr = args.address.trim().toLowerCase();
  const label = args.label.trim();

  const alreadyWallet = portfolio.wallets.some((w) => w.address === addr);

  if (alreadyWallet) {
    if (label) portfolio.setWalletLabel(addr, label);
    groups.assignAddress(addr, args.groupId);
    groups.removeMember(addr);
    return;
  }

  if (args.track) {
    portfolio.addWallet(addr, label || undefined, args.chain ? [args.chain] : undefined);
    groups.assignAddress(addr, args.groupId);
    groups.removeMember(addr);
    void portfolio.refreshWallet(addr);
  } else {
    groups.addMember({
      address: addr,
      chain: args.chain,
      groupId: args.groupId,
      label: label || addr,
      source: args.source,
    });
  }
}

/** Promote a saved bookmark to a fully tracked portfolio wallet. */
export function promoteMemberToWallet(member: GroupMember) {
  const portfolio = usePortfolioStore.getState();
  const groups = useGroupsStore.getState();
  portfolio.addWallet(
    member.address,
    member.label || undefined,
    member.chain ? [member.chain] : undefined,
  );
  groups.assignAddress(member.address, member.groupId);
  groups.removeMember(member.address);
  void portfolio.refreshWallet(member.address);
}

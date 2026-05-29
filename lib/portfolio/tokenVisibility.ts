// Shared visibility logic for the portfolio's token rows.
//
// Decision flow (first match wins):
//   1. Native tokens are always visible.
//   2. User explicitly forced-show → visible.
//   3. User explicitly hid → hidden.
//   4. Auto-rules:
//        a. Spam heuristic (no price, no logo, promotional name) → hidden.
//        b. Dust under threshold (only when hideDust on) → hidden.
//        c. Default → visible.
//
// The render path calls `applyTokenVisibility()` with the wallet's tokens
// and the settings from the store; the Manage Tokens modal calls
// `tokenAutoState()` per row to show whether each token would be
// automatically hidden if the user hasn't overridden it.

import type { PortfolioToken } from '@/services';
import type { WalletTokenSettings } from '@/lib/stores/portfolioStore';

export type TokenVisibility = 'visible' | 'hidden';

export interface TokenVisibilityResult {
  visible: PortfolioToken[];
  hidden: PortfolioToken[];
}

// Promo / spam name patterns. Conservative — we don't want to hide real
// tokens with cute names. Triggers only when ALSO missing price + logo.
const PROMOTIONAL_RX =
  /\b(visit|claim|reward|airdrop|bonus|free|gift|winners?|prize)\b/i;
const URL_LIKE_RX = /https?:|www\.|\.com|\.io|\.org|\.net|\.xyz|\.app/i;

export function looksLikeSpam(token: PortfolioToken): boolean {
  if (token.isNative) return false;
  const hasPrice = token.priceUsd != null;
  const hasLogo = !!token.logoURI;
  if (hasPrice || hasLogo) return false;
  const name = token.name || '';
  const symbol = token.symbol || '';
  return (
    PROMOTIONAL_RX.test(name) ||
    URL_LIKE_RX.test(name) ||
    URL_LIKE_RX.test(symbol)
  );
}

export function isDust(
  token: PortfolioToken,
  threshold: number,
): boolean {
  if (token.isNative) return false;
  if (token.valueUsd == null) return false;
  return token.valueUsd < threshold;
}

export interface AutoState {
  autoHidden: boolean;
  reason: 'spam' | 'dust' | null;
}

// Whether this token *would* be auto-hidden if the user hadn't explicitly
// forced it visible. Used by the modal to label each row.
export function tokenAutoState(
  token: PortfolioToken,
  settings: WalletTokenSettings,
): AutoState {
  if (token.isNative) return { autoHidden: false, reason: null };
  if (looksLikeSpam(token)) return { autoHidden: true, reason: 'spam' };
  if (settings.hideDust && isDust(token, settings.dustThresholdUsd)) {
    return { autoHidden: true, reason: 'dust' };
  }
  return { autoHidden: false, reason: null };
}

export function isTokenVisible(
  token: PortfolioToken,
  settings: WalletTokenSettings,
): boolean {
  if (token.isNative) return true;
  const addr = token.address.toLowerCase();
  if (settings.forced.includes(addr)) return true;
  if (settings.hidden.includes(addr)) return false;
  const auto = tokenAutoState(token, settings);
  return !auto.autoHidden;
}

export function applyTokenVisibility(
  tokens: PortfolioToken[],
  settings: WalletTokenSettings,
): TokenVisibilityResult {
  const visible: PortfolioToken[] = [];
  const hidden: PortfolioToken[] = [];
  for (const t of tokens) {
    if (isTokenVisible(t, settings)) visible.push(t);
    else hidden.push(t);
  }
  return { visible, hidden };
}

// "Token I haven't reviewed yet" — anything in the auto-hidden set that
// the user hasn't explicitly forced/hidden. Used to surface "X tokens
// hidden by default — review?" on first wallet load.
export function autoHiddenForReview(
  tokens: PortfolioToken[],
  settings: WalletTokenSettings,
): PortfolioToken[] {
  return tokens.filter((t) => {
    if (t.isNative) return false;
    const addr = t.address.toLowerCase();
    if (settings.hidden.includes(addr) || settings.forced.includes(addr)) {
      return false; // user already made a call
    }
    const auto = tokenAutoState(t, settings);
    return auto.autoHidden;
  });
}

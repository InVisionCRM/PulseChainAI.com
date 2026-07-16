import type { Metadata } from 'next';
import RobinhoodLaunchpads from '@/components/launchpads/RobinhoodLaunchpads';

export const metadata: Metadata = {
  title: 'Robinhood Chain Launchpads',
  description:
    'Token-launch protocols on Robinhood Chain (Arbitrum Orbit L2, chain id 4663) — bow.fun, LaunchHood and NOXA with on-chain-verified factory, locker and fee-vault addresses, plus the chain’s key tokens.',
};

export default function RobinhoodLaunchpadsPage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-[var(--panel)] via-[var(--surface-2)] to-[var(--panel)] text-[var(--text)]">
      <RobinhoodLaunchpads />
    </main>
  );
}

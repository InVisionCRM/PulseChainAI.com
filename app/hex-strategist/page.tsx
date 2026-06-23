import type { Metadata } from 'next';
import HexStrategistTabs from '@/components/hex-strategist/HexStrategistTabs';

export const metadata: Metadata = {
  title: 'HEX Stake Strategist',
  description:
    'Design a HEX stake and diagnose your existing ones — projected T-Shares, ROI and APY across every length, plus per-stake end-timing and penalty estimates, grounded in HEX contract math.',
};

export default function HexStrategistPage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-[var(--panel)] via-[var(--surface-2)] to-[var(--panel)] text-[var(--text)]">
      <HexStrategistTabs />
    </main>
  );
}

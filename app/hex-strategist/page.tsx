import type { Metadata } from 'next';
import HexStrategistTabs from '@/components/hex-strategist/HexStrategistTabs';
import AdBanner from '@/components/ads/AdBanner';

export const metadata: Metadata = {
  title: 'HEX Stake Strategist',
  description:
    'Design a HEX stake and diagnose your existing ones — projected T-Shares, ROI and APY across every length, plus per-stake end-timing and penalty estimates, grounded in HEX contract math.',
};

export default function HexStrategistPage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-[var(--panel)] via-[var(--surface-2)] to-[var(--panel)] text-[var(--text)]">
      <div className="mx-auto w-full max-w-6xl px-3 pt-4 md:px-6">
        <AdBanner />
      </div>
      <HexStrategistTabs />
    </main>
  );
}

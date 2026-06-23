import type { Metadata } from 'next';
import HexStrategist from '@/components/hex-strategist/HexStrategist';

export const metadata: Metadata = {
  title: 'HEX Stake Strategist',
  description:
    'Design a HEX stake the smart way — projected T-Shares, yield, ROI and APY across every length, with an opinionated recommendation grounded in HEX contract math.',
};

export default function HexStrategistPage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-[var(--panel)] via-[var(--surface-2)] to-[var(--panel)] text-[var(--text)]">
      <HexStrategist />
    </main>
  );
}

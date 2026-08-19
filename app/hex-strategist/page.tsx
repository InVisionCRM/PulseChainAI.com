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
    <main className="relative isolate min-h-screen bg-gradient-to-br from-[var(--panel)] via-[var(--surface-2)] to-[var(--panel)] text-[var(--text)]">
      {/* The loading screen's molten artwork, ghosted behind the page. The
          mask fades the image itself to nothing, so the page's own gradient
          takes over — no hard seam in either theme. */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[85vh] overflow-hidden">
        <div
          className="absolute inset-0 bg-[url('/hex-strategist-loading-portrait.jpg')] bg-cover bg-top opacity-[0.14] md:bg-[url('/hex-strategist-loading.jpg')] [mask-image:linear-gradient(to_bottom,black_30%,transparent)]"
        />
      </div>
      <div className="mx-auto w-full max-w-6xl px-3 pt-4 md:px-6">
        <AdBanner />
      </div>
      <HexStrategistTabs />
    </main>
  );
}

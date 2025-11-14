import HEXDataDashboard from '@/components/hex-dashboard';

// Force dynamic rendering to avoid long build times with large data fetching
export const dynamic = 'force-dynamic';

export default function HexDashboardPage() {
  return <HEXDataDashboard />;
}

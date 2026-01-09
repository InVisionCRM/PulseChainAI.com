import HEXDataDashboard from '@/components/hex-dashboard';

// Revalidate every 24 hours (86400 seconds)
export const revalidate = 86400;

export default function HexDashboardPage() {
  return <HEXDataDashboard />;
}

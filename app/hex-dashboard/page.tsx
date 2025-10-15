import UnifiedHEXDashboard from '@/components/hex-dashboard-unified';

// Force dynamic rendering to avoid long build times with large data fetching
export const dynamic = 'force-dynamic';

export default function HexDashboardPage() {
  return <UnifiedHEXDashboard />;
}
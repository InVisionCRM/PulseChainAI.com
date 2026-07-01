/**
 * Barrel exports for Geicko components
 * Import components like: import { MetricCard, Toast } from '@/components/geicko'
 */

// Export utilities
export * from './utils';

// Export types
export * from './types';

// Export components - Phase 2 (Generic UI)
export { default as GeickoMetricCard } from './GeickoMetricCard';
export { default as GeickoToast } from './GeickoToast';
export { default as GeickoCopyAddressButton } from './GeickoCopyAddressButton';

// Export components - Phase 3 (Header & Navigation)
export { default as GeickoClassicHeader } from './GeickoClassicHeader';
export { default as GeickoSearchBar } from './GeickoSearchBar';
export { default as GeickoTabNavigation } from './GeickoTabNavigation';
export { default as GeickoMobileTokenHeader } from './GeickoMobileTokenHeader';

// Export components - Phase 5 (Metrics Panels)
export { default as GeickoOwnershipPanel } from './GeickoOwnershipPanel';
export { default as GeickoMetricsGrid } from './GeickoMetricsGrid';
export { default as GeickoMarketStatsPanel } from './GeickoMarketStatsPanel';
export { default as GeickoPerformancePanel } from './GeickoPerformancePanel';
export { default as GeickoLiquidityPanel } from './GeickoLiquidityPanel';
export { default as GeickoPressurePanel } from './GeickoPressurePanel';
export { default as GeickoTradesTab } from './GeickoTradesTab';

// Export components - Phase 6 (Tab Content)
export { default as GeickoHoldersTab } from './GeickoHoldersTab';
export { default as GeickoSwapTab } from './GeickoSwapTab';
export { default as GeickoWebsiteTab } from './GeickoWebsiteTab';

// Export components - Phase 7 (Modal Components)
export { default as GeickoHolderModal } from './GeickoHolderModal';

// Re-export component prop types for convenience
export type { GeickoMetricCardProps } from './GeickoMetricCard';
export type { GeickoToastProps } from './GeickoToast';
export type { GeickoCopyAddressButtonProps } from './GeickoCopyAddressButton';
export type { GeickoClassicHeaderProps } from './GeickoClassicHeader';
export type { GeickoSearchBarProps } from './GeickoSearchBar';
export type { GeickoTabNavigationProps } from './GeickoTabNavigation';
export type { GeickoMobileTokenHeaderProps } from './GeickoMobileTokenHeader';
export type { GeickoOwnershipPanelProps } from './GeickoOwnershipPanel';
export type { GeickoMetricsGridProps } from './GeickoMetricsGrid';
export type { GeickoMarketStatsPanelProps } from './GeickoMarketStatsPanel';
export type { GeickoHoldersTabProps } from './GeickoHoldersTab';
export type { GeickoSwapTabProps } from './GeickoSwapTab';
export type { GeickoWebsiteTabProps } from './GeickoWebsiteTab';
export type { GeickoHolderModalProps } from './GeickoHolderModal';

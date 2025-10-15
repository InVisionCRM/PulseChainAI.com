"use client";
import { useMobileOptimization } from "@/lib/hooks/useMobileOptimization";

export default function MobileDebugInfo() {
  const config = useMobileOptimization();
  
  // Only show in development
  if (process.env.NODE_ENV !== 'development') {
    return null;
  }
  
  return (
    <div className="fixed top-4 right-4 bg-black/80 text-white p-4 rounded-lg text-xs z-50 max-w-xs">
      <h3 className="font-bold mb-2">Mobile Debug Info</h3>
      <div className="space-y-1">
        <div>Screen: {config.screenWidth} × {config.screenHeight}</div>
        <div>Device: {config.isMobile ? 'Mobile' : config.isTablet ? 'Tablet' : 'Desktop'}</div>
        <div>Pixel Ratio: {config.devicePixelRatio}</div>
        <div>CPU Cores: {navigator.hardwareConcurrency || 'Unknown'}</div>
        <div>Memory: {(navigator as any).deviceMemory || 'Unknown'} GB</div>
        <div className="border-t border-gray-600 pt-1 mt-2">
          <div className={config.shouldDisableHeavyAnimations ? 'text-red-400' : 'text-green-400'}>
            Heavy Animations: {config.shouldDisableHeavyAnimations ? 'Disabled' : 'Enabled'}
          </div>
          <div className={config.shouldDisableBackgroundEffects ? 'text-red-400' : 'text-green-400'}>
            Background Effects: {config.shouldDisableBackgroundEffects ? 'Disabled' : 'Enabled'}
          </div>
          <div className={config.shouldReduceMotion ? 'text-red-400' : 'text-green-400'}>
            Reduced Motion: {config.shouldReduceMotion ? 'Yes' : 'No'}
          </div>
        </div>
      </div>
    </div>
  );
} 
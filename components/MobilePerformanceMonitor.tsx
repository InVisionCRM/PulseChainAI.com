import React, { useEffect, useState } from 'react';

interface MobilePerformanceMetrics {
  memoryUsage: number;
  frameRate: number;
  loadTime: number;
  deviceType: string;
  batteryLevel?: number;
  networkType?: string;
  isLowPowerMode?: boolean;
}

const MobilePerformanceMonitor: React.FC = () => {
  const [metrics, setMetrics] = useState<MobilePerformanceMetrics | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [frameCount, setFrameCount] = useState(0);
  const [lastTime, setLastTime] = useState(performance.now());

  useEffect(() => {
    // Only show in development
    if (process.env.NODE_ENV !== 'development') {
      return;
    }

    const measurePerformance = () => {
      const now = performance.now();
      const loadTime = now - performance.timing.navigationStart;
      
      // Measure frame rate
      setFrameCount(prev => prev + 1);
      const frameRate = Math.round(1000 / (now - lastTime));
      setLastTime(now);

      // Get memory usage if available
      const memoryUsage = (performance as any).memory 
        ? Math.round((performance as any).memory.usedJSHeapSize / 1024 / 1024)
        : 0;

      // Detect device type
      const userAgent = navigator.userAgent;
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
      const deviceType = isMobile ? 'Mobile' : 'Desktop';

      // Get battery info if available
      let batteryLevel: number | undefined;
      let isLowPowerMode: boolean | undefined;
      
      if ('getBattery' in navigator) {
        (navigator as any).getBattery().then((battery: any) => {
          batteryLevel = Math.round(battery.level * 100);
          isLowPowerMode = battery.level < 0.2;
        });
      }

      // Get network info if available
      let networkType: string | undefined;
      if ('connection' in navigator) {
        const connection = (navigator as any).connection;
        networkType = connection.effectiveType || connection.type;
      }

      setMetrics({
        memoryUsage,
        frameRate,
        loadTime: Math.round(loadTime),
        deviceType,
        batteryLevel,
        networkType,
        isLowPowerMode
      });
    };

    // Initial measurement
    measurePerformance();

    // Measure every second
    const interval = setInterval(measurePerformance, 1000);

    // Toggle visibility with keyboard shortcut (Ctrl/Cmd + Shift + P)
    const handleKeyPress = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key === 'P') {
        setIsVisible(prev => !prev);
      }
    };

    document.addEventListener('keydown', handleKeyPress);

    return () => {
      clearInterval(interval);
      document.removeEventListener('keydown', handleKeyPress);
    };
  }, [lastTime]);

  if (!metrics || process.env.NODE_ENV !== 'development') {
    return null;
  }

  if (!isVisible) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <button
          onClick={() => setIsVisible(true)}
          className="bg-purple-600 text-white px-3 py-1 rounded text-xs opacity-50 hover:opacity-100 transition-opacity"
        >
          Show Perf
        </button>
      </div>
    );
  }

  const getPerformanceColor = (value: number, thresholds: { good: number; warning: number }) => {
    if (value <= thresholds.good) return 'text-green-400';
    if (value <= thresholds.warning) return 'text-yellow-400';
    return 'text-red-400';
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 bg-slate-900 border border-slate-700 rounded-lg p-3 text-xs font-mono max-w-48">
      <div className="flex justify-between items-center mb-2">
        <span className="text-purple-400 font-bold">Mobile Perf</span>
        <button
          onClick={() => setIsVisible(false)}
          className="text-slate-400 hover:text-white"
        >
          ×
        </button>
      </div>
      
      <div className="space-y-1">
        <div className="flex justify-between">
          <span>Memory:</span>
          <span className={getPerformanceColor(metrics.memoryUsage, { good: 50, warning: 100 })}>
            {metrics.memoryUsage}MB
          </span>
        </div>
        
        <div className="flex justify-between">
          <span>FPS:</span>
          <span className={getPerformanceColor(metrics.frameRate, { good: 30, warning: 20 })}>
            {metrics.frameRate}
          </span>
        </div>
        
        <div className="flex justify-between">
          <span>Load:</span>
          <span className={getPerformanceColor(metrics.loadTime, { good: 2000, warning: 5000 })}>
            {metrics.loadTime}ms
          </span>
        </div>
        
        <div className="flex justify-between">
          <span>Device:</span>
          <span className="text-blue-400">{metrics.deviceType}</span>
        </div>
        
        {metrics.batteryLevel !== undefined && (
          <div className="flex justify-between">
            <span>Battery:</span>
            <span className={getPerformanceColor(metrics.batteryLevel, { good: 50, warning: 20 })}>
              {metrics.batteryLevel}%
            </span>
          </div>
        )}
        
        {metrics.networkType && (
          <div className="flex justify-between">
            <span>Network:</span>
            <span className="text-cyan-400">{metrics.networkType}</span>
          </div>
        )}
        
        {metrics.isLowPowerMode && (
          <div className="text-red-400 text-center">⚠️ Low Power Mode</div>
        )}
      </div>
      
      <div className="mt-2 text-xs text-slate-500">
        Press Ctrl+Shift+P to toggle
      </div>
    </div>
  );
};

export default MobilePerformanceMonitor; 
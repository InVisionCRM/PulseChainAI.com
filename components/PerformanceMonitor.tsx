import React, { useEffect, useState } from 'react';

interface PerformanceMetrics {
  loadTime: number;
  renderTime: number;
  memoryUsage?: number;
  isMobile: boolean;
}

const PerformanceMonitor: React.FC = () => {
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Only show in development
    if (process.env.NODE_ENV !== 'development') {
      return;
    }

    const startTime = performance.now();
    
    // Check if mobile
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    // Monitor memory usage if available
    let memoryUsage: number | undefined;
    if ('memory' in performance) {
      memoryUsage = (performance as any).memory.usedJSHeapSize / 1024 / 1024; // MB
    }

    const measurePerformance = () => {
      const loadTime = performance.now() - startTime;
      const renderTime = performance.now() - startTime;
      
      setMetrics({
        loadTime: Math.round(loadTime),
        renderTime: Math.round(renderTime),
        memoryUsage: memoryUsage ? Math.round(memoryUsage * 100) / 100 : undefined,
        isMobile
      });
    };

    // Measure after initial render
    const timer = setTimeout(measurePerformance, 100);
    
    return () => clearTimeout(timer);
  }, []);

  if (!metrics || process.env.NODE_ENV !== 'development') {
    return null;
  }

  const getPerformanceColor = (time: number) => {
    if (time < 1000) return 'text-green-400';
    if (time < 2000) return 'text-yellow-400';
    return 'text-red-400';
  };

  return (
    <div className="fixed bottom-4 right-4 bg-slate-800 border border-slate-600 rounded-lg p-3 text-xs font-mono z-50">
      <div className="flex items-center justify-between mb-2">
        <span className="text-slate-300">Performance</span>
        <button
          onClick={() => setIsVisible(!isVisible)}
          className="text-slate-400 hover:text-white"
        >
          {isVisible ? '−' : '+'}
        </button>
      </div>
      
      {isVisible && (
        <div className="space-y-1">
          <div className="flex justify-between">
            <span className="text-slate-400">Load:</span>
            <span className={getPerformanceColor(metrics.loadTime)}>
              {metrics.loadTime}ms
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Render:</span>
            <span className={getPerformanceColor(metrics.renderTime)}>
              {metrics.renderTime}ms
            </span>
          </div>
          {metrics.memoryUsage && (
            <div className="flex justify-between">
              <span className="text-slate-400">Memory:</span>
              <span className="text-cyan-400">
                {metrics.memoryUsage}MB
              </span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-slate-400">Device:</span>
            <span className={metrics.isMobile ? 'text-orange-400' : 'text-blue-400'}>
              {metrics.isMobile ? 'Mobile' : 'Desktop'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default PerformanceMonitor; 
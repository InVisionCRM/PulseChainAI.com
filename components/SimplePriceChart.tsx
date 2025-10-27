'use client';

import { useState, useMemo, useRef, useCallback, useEffect } from 'react';

interface PricePoint {
  timestamp: number;
  value: number;
  volume?: number;
}

interface SimplePriceChartProps {
  currentPrice: number;
  priceChange24h: number;
  priceChange?: {
    m5?: number;
    h1?: number;
    h6?: number;
    h24?: number;
  };
  volume24h?: number;
  pairAddress?: string; // DEX pair address for fetching real data
  chain?: string; // Chain ID (defaults to PulseChain 0x171)
  className?: string;
}

type TimeRange = '1H' | '1D' | '1W' | '1M' | '1Y' | 'ALL';

export default function SimplePriceChart({
  currentPrice,
  priceChange24h,
  priceChange,
  volume24h,
  pairAddress,
  chain = '0x171',
  className = ''
}: SimplePriceChartProps) {
  const [selectedRange, setSelectedRange] = useState<TimeRange>('1D');
  const [hoveredPoint, setHoveredPoint] = useState<PricePoint | null>(null);
  const [mousePosition, setMousePosition] = useState<{ x: number; y: number } | null>(null);
  const [realData, setRealData] = useState<PricePoint[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dataSource, setDataSource] = useState<string | null>(null);
  const chartRef = useRef<HTMLDivElement>(null);

  const timeRanges: TimeRange[] = ['1H', '1D', '1W', '1M', '1Y', 'ALL'];

  // Fetch real historical data from Moralis API
  useEffect(() => {
    if (!pairAddress) {
      setRealData(null);
      return;
    }

    const fetchPriceHistory = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams({
          pairAddress,
          chain,
          timeRange: selectedRange,
        });

        const response = await fetch(`/api/price-history?${params.toString()}`);
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to fetch price history');
        }

        if (data.data && data.data.length > 0) {
          setRealData(data.data);
          setDataSource(data.source || 'unknown');
          setError(null);
        } else {
          console.warn('No price data available, falling back to synthetic data');
          setRealData(null);
          setDataSource(null);
        }
      } catch (err) {
        console.error('Error fetching price history:', err);
        setError((err as Error).message);
        setRealData(null); // Fall back to synthetic data
      } finally {
        setIsLoading(false);
      }
    };

    fetchPriceHistory();
  }, [pairAddress, chain, selectedRange]);

  // Generate data based on selected time range using actual price change data
  const filteredData = useMemo(() => {
    // Use real data if available
    if (realData && realData.length > 0) {
      return realData;
    }
    const now = Date.now();

    // Use actual price changes if available
    if (selectedRange === '1H' && priceChange?.h1 !== undefined) {
      const h1Change = priceChange.h1 / 100;
      const m5Change = priceChange.m5 !== undefined ? priceChange.m5 / 100 : null;
      const priceStart = currentPrice / (1 + h1Change);

      // Generate 60 data points (1 minute intervals)
      return Array.from({ length: 60 }, (_, i) => {
        const progress = i / 59;
        const minutesAgo = 59 - i;

        // Last point should be exactly current price
        if (i === 59) {
          return {
            timestamp: now,
            value: currentPrice,
            volume: volume24h ? (volume24h / 60) * (0.8 + Math.random() * 0.4) : undefined
          };
        }

        // Use m5 data for last 5 minutes for more accuracy
        let changeAtPoint = h1Change * progress;
        if (m5Change !== null && minutesAgo <= 5) {
          // Blend m5 and h1 data for smooth transition
          const m5Weight = (5 - minutesAgo) / 5; // Weight decreases as we go back in time
          const h1Weight = 1 - m5Weight;
          changeAtPoint = (m5Change * m5Weight) + ((h1Change * progress) * h1Weight);
        }

        const volatility = (Math.random() * 0.05 - 0.025); // 5% range (±2.5%)
        const trendValue = priceStart * (1 + changeAtPoint + volatility);

        return {
          timestamp: now - (minutesAgo * 60 * 1000), // 1 minute = 60,000ms
          value: Math.max(0, trendValue),
          volume: volume24h ? (volume24h / 60) * (0.8 + Math.random() * 0.4) : undefined
        };
      });
    }
    
    if (selectedRange === '1D' && priceChange?.h24 !== undefined) {
      const h24Change = priceChange.h24 / 100;
      const m5Change = priceChange.m5 !== undefined ? priceChange.m5 / 100 : null;
      const priceStart = currentPrice / (1 + h24Change);

      // Generate 288 data points (5 minute intervals)
      return Array.from({ length: 288 }, (_, i) => {
        const minutesAgo = (287 - i) * 5;
        const hoursAgo = minutesAgo / 60;
        const progress = i / 287;

        // Last point should be exactly current price
        if (i === 287) {
          return {
            timestamp: now,
            value: currentPrice,
            volume: volume24h ? (volume24h / 288) * (0.7 + Math.random() * 0.6) : undefined
          };
        }

        // Find the surrounding key points and use m5 for most recent data
        let changeAtPoint = h24Change * progress;

        // Use m5 data for the very last data point (5 minutes ago)
        if (i === 286 && m5Change !== null) {
          changeAtPoint = m5Change;
        } else if (hoursAgo <= 1 && priceChange.h1 !== undefined) {
          changeAtPoint = (priceChange.h1 / 100) * (1 - hoursAgo);
        } else if (hoursAgo <= 6 && priceChange.h6 !== undefined) {
          const h6Start = priceChange.h6 / 100;
          const h1End = priceChange.h1 ? priceChange.h1 / 100 : 0;
          changeAtPoint = h6Start + ((h1End - h6Start) * ((6 - hoursAgo) / 5));
        }

        const volatility = Math.sin(i * 0.5) * 0.02 + (Math.random() * 0.015 - 0.0075); // ~2-3.5% range
        const trendValue = priceStart * (1 + changeAtPoint + volatility);

        return {
          timestamp: now - (minutesAgo * 60 * 1000), // 5 minutes in milliseconds
          value: Math.max(0, trendValue),
          volume: volume24h ? (volume24h / 288) * (0.7 + Math.random() * 0.6) : undefined
        };
      });
    }
    
    // For other ranges, generate realistic data that ends at current price
    const ranges: Record<TimeRange, { points: number; hours: number }> = {
      '1H': { points: 60, hours: 1 },        // 1 minute intervals
      '1D': { points: 288, hours: 24 },      // 5 minute intervals (24 * 12)
      '1W': { points: 336, hours: 24 * 7 },  // 30 minute intervals (7 * 48)
      '1M': { points: 1440, hours: 24 * 30 }, // 30 minute intervals (30 * 48)
      '1Y': { points: 52, hours: 24 * 365 },  // Weekly data points
      'ALL': { points: 24, hours: 24 * 730 }, // Monthly data points (2 years default)
    };

    const config = ranges[selectedRange];
    const h24Change = priceChange24h / 100;
    
    // Calculate a reasonable starting price - cap the variation based on timeframe
    // Longer timeframes get smaller relative changes to prevent extreme values
    let maxVariation = 0.3; // Default 30% variation
    if (selectedRange === '1Y') maxVariation = 0.4; // 40% for 1 year
    if (selectedRange === 'ALL') maxVariation = 0.5; // 50% for all time
    
    // Random start price within the capped range
    const variationRange = Math.min(Math.abs(h24Change) * 10, maxVariation);
    const startPriceMultiplier = 1 + (Math.random() * variationRange * 2 - variationRange);
    const priceStart = currentPrice * Math.max(startPriceMultiplier, 0.3); // Never go below 30% of current
    
    return Array.from({ length: config.points }, (_, i) => {
      const progress = i / (config.points - 1);
      const timePerPoint = (config.hours * 60 * 60 * 1000) / config.points;
      
      // Last point should be exactly current price
      if (i === config.points - 1) {
        return {
          timestamp: now,
          value: currentPrice,
          volume: volume24h ? (volume24h / config.points) * (0.5 + Math.random()) : undefined
        };
      }
      
      // Smoothly interpolate from start price to current price
      const baseValue = priceStart + (currentPrice - priceStart) * progress;
      
      // Add volatility for realistic movement with good definition (but not on last point)
      const volatilityPercent = 0.05; // 5% volatility
      const volatility = Math.sin(i * 0.3) * currentPrice * volatilityPercent + 
                        (Math.random() * currentPrice * volatilityPercent - currentPrice * (volatilityPercent / 2));
      const trendValue = baseValue + volatility;
      
      return {
        timestamp: now - ((config.points - 1 - i) * timePerPoint),
        value: Math.max(currentPrice * 0.1, trendValue), // Never go below 10% of current price
        volume: volume24h ? (volume24h / config.points) * (0.5 + Math.random()) : undefined
      };
    });
  }, [realData, currentPrice, priceChange24h, priceChange, selectedRange, volume24h]);

  // Create smooth curve path using cubic bezier curves (Catmull-Rom style)
  const smoothCurvePath = useMemo(() => {
    if (filteredData.length === 0) return '';

    const width = 100;
    const height = 100;
    const padding = 1; // Minimal padding for borderless look

    const values = filteredData.map(d => d.value);
    const minValue = Math.min(...values); // Use actual minimum from data
    const maxValue = Math.max(...values);
    const valueRange = maxValue - minValue || 1; // Range between min and max

    const points = filteredData.map((point, index) => {
      const x = padding + (index / (filteredData.length - 1 || 1)) * (width - 2 * padding);
      const y = height - padding - ((point.value - minValue) / valueRange) * (height - 2 * padding);
      return { x, y };
    });

    if (points.length < 2) return '';

    // Create very smooth curve using cubic bezier with calculated control points
    let path = `M ${points[0].x},${points[0].y}`;

    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[Math.max(i - 1, 0)];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = points[Math.min(i + 2, points.length - 1)];

      // Calculate control points for smooth cubic bezier
      const tension = 0.2; // Lower = smoother, more fluid curve
      const cp1x = p1.x + (p2.x - p0.x) * tension;
      const cp1y = p1.y + (p2.y - p0.y) * tension;
      const cp2x = p2.x - (p3.x - p1.x) * tension;
      const cp2y = p2.y - (p3.y - p1.y) * tension;

      path += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`;
    }

    return path;
  }, [filteredData]);

  const fillPath = useMemo(() => {
    if (!smoothCurvePath) return '';

    const width = 100;
    const height = 100;
    const padding = 1; // Minimal padding for borderless look

    const values = filteredData.map(d => d.value);
    const minValue = Math.min(...values); // Use actual minimum from data
    const maxValue = Math.max(...values);
    const valueRange = maxValue - minValue || 1; // Range between min and max

    const firstX = padding;
    const lastX = padding + (width - 2 * padding);
    // Calculate Y position for minimum value (bottom of data range)
    const bottomY = height - padding;

    // Start from bottom left, follow the smooth curve, then close at bottom right
    return `M ${firstX},${bottomY} ${smoothCurvePath.substring(2)} L ${lastX},${bottomY} Z`;
  }, [smoothCurvePath, filteredData]);

  // Calculate the SVG coordinates for the hovered point
  const hoveredPointCoords = useMemo(() => {
    if (!hoveredPoint || filteredData.length === 0) return null;

    const width = 100;
    const height = 100;
    const padding = 1; // Minimal padding for borderless look

    const values = filteredData.map(d => d.value);
    const minValue = Math.min(...values); // Use actual minimum from data
    const maxValue = Math.max(...values);
    const valueRange = maxValue - minValue || 1; // Range between min and max

    const index = filteredData.findIndex(d => d.timestamp === hoveredPoint.timestamp);
    if (index === -1) return null;

    const x = padding + (index / (filteredData.length - 1 || 1)) * (width - 2 * padding);
    const y = height - padding - ((hoveredPoint.value - minValue) / valueRange) * (height - 2 * padding);

    return { x, y };
  }, [hoveredPoint, filteredData]);

  // Handle mouse move for hover effect
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!chartRef.current || filteredData.length === 0) return;

    const chartRect = chartRef.current.getBoundingClientRect();
    const mouseX = e.clientX - chartRect.left; // Mouse X relative to chart container
    const percentage = mouseX / chartRect.width;
    const index = Math.round(percentage * (filteredData.length - 1));
    const clampedIndex = Math.max(0, Math.min(index, filteredData.length - 1));
    const point = filteredData[clampedIndex];

    setHoveredPoint(point);

    // Calculate the pixel Y position of the point on the line
    const svgWidth = 100;
    const svgHeight = 100;
    const padding = 1; // Minimal padding for borderless look

    const values = filteredData.map(d => d.value);
    const minValue = Math.min(...values); // Use actual minimum from data
    const maxValue = Math.max(...values);
    const valueRange = maxValue - minValue || 1; // Range between min and max

    // SVG coordinates of the point
    const svgX = padding + (clampedIndex / (filteredData.length - 1 || 1)) * (svgWidth - 2 * padding);
    const svgY = svgHeight - padding - ((point.value - minValue) / valueRange) * (svgHeight - 2 * padding);

    // Convert SVG coordinates to pixel coordinates relative to container
    const pixelX = (svgX / svgWidth) * chartRect.width;
    const pixelY = (svgY / svgHeight) * chartRect.height;

    // Position popover 5px above the line point
    const popoverWidth = 120;
    const popoverHeight = 60; // Approximate height
    let finalX = pixelX - (popoverWidth / 2); // Center horizontally on point
    let finalY = pixelY - popoverHeight - 5; // 5px above the line

    // Keep within container bounds
    if (finalX < 5) finalX = 5; // Min 5px from left
    if (finalX + popoverWidth > chartRect.width - 5) {
      finalX = chartRect.width - popoverWidth - 5; // Max 5px from right
    }
    if (finalY < 5) {
      finalY = pixelY + 10; // If overflow top, position below the point
    }

    setMousePosition({ x: finalX, y: finalY });
  }, [filteredData]);

  const handleMouseLeave = useCallback(() => {
    setHoveredPoint(null);
    setMousePosition(null);
  }, []);

  // Format date based on time range
  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    
    if (selectedRange === '1H') {
      return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    } else if (selectedRange === '1D') {
      return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    } else if (selectedRange === '1W') {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit' });
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }
  };

  if (!currentPrice || currentPrice <= 0) {
    return (
      <div className={`flex items-center justify-center h-64 bg-slate-900/50 rounded ${className}`}>
        <p className="text-slate-400 text-sm">No price data available</p>
      </div>
    );
  }

  return (
    <div className={`flex flex-col ${className}`}>
      {/* Loading/Error Indicator */}
      {isLoading && (
        <div className="absolute top-2 right-2 z-10">
          <div className="bg-blue-500/20 text-blue-400 text-xs px-2 py-1 rounded">
            Loading...
          </div>
        </div>
      )}
      {error && pairAddress && (
        <div className="absolute top-2 right-2 z-10">
          <div className="bg-yellow-500/20 text-yellow-400 text-xs px-2 py-1 rounded">
            Using estimated data
          </div>
        </div>
      )}
      {!error && dataSource && (
        <div className="absolute top-2 right-2 z-10">
          <div className="bg-green-500/20 text-green-400 text-xs px-2 py-1 rounded">
            {dataSource === 'pulsex-subgraph' ? 'PulseX Data' :
             dataSource === 'on-chain' ? 'On-chain Data' :
             dataSource === 'moralis' ? 'Moralis Data' :
             'Real Data'}
          </div>
        </div>
      )}

      {/* Chart Area */}
      <div 
        ref={chartRef}
        className="relative w-full cursor-crosshair" 
        style={{ height: '300px' }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="w-full h-full"
        >
          {/* Subtle gradient for fill area */}
          <defs>
            <linearGradient id="lineGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="rgba(102, 153, 255, 0.3)" />
              <stop offset="100%" stopColor="rgba(102, 153, 255, 0)" />
            </linearGradient>
          </defs>

          {/* Fill area with subtle gradient */}
          <path
            d={fillPath}
            fill="url(#lineGradient)"
          />

          {/* Smooth Line */}
          <path
            d={smoothCurvePath}
            fill="none"
            stroke="#6699FF"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />

          {/* Hover Dot Indicator */}
          {hoveredPointCoords && (
            <>
              {/* Outer glow circle */}
              <circle
                cx={hoveredPointCoords.x}
                cy={hoveredPointCoords.y}
                r="2"
                fill="rgba(102, 153, 255, 0.3)"
                vectorEffect="non-scaling-stroke"
              />
              {/* Inner dot */}
              <circle
                cx={hoveredPointCoords.x}
                cy={hoveredPointCoords.y}
                r="1"
                fill="#6699FF"
                stroke="white"
                strokeWidth="0.3"
                vectorEffect="non-scaling-stroke"
              />
            </>
          )}
        </svg>

        {/* Hover Popover */}
        {hoveredPoint && mousePosition && (
          <div
            className="absolute z-50 pointer-events-none"
            style={{
              left: `${mousePosition.x}px`,
              top: `${mousePosition.y}px`,
            }}
          >
            <div className="bg-white/10 backdrop-blur-lg border-2 border-orange-500 rounded-lg shadow-xl p-2 w-[120px]">
              <div className="text-xs text-white/70 mb-0.5">{formatDate(hoveredPoint.timestamp)}</div>
              <div className="text-sm font-bold text-white">
                ${hoveredPoint.value.toFixed(6)}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Time Range Selectors */}
      <div className="flex items-center justify-center gap-3 py-4">
        {timeRanges.map((range) => (
          <button
            key={range}
            onClick={() => setSelectedRange(range)}
            className={`px-4 py-1.5 text-xs font-medium transition-all ${
              selectedRange === range
                ? 'bg-slate-950 text-white rounded-full'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            {range}
          </button>
        ))}
      </div>
    </div>
  );
}


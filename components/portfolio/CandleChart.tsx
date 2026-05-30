'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  createChart,
  ColorType,
  CrosshairMode,
  LineStyle,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from 'lightweight-charts';
import { IconChartCandle, IconChartLine } from '@tabler/icons-react';
import type { PortfolioToken } from '@/services';

// Native candlestick chart (GeckoTerminal OHLCV) with a custom "aurora"
// theme, falling back to the DexScreener embed when no native candles exist.
// Deliberately no data-source footer line.

const UP = '#2EE6A6'; // mint
const DOWN = '#FB6F92'; // rose
const ACTIVE_PILL = {
  background: 'linear-gradient(135deg, rgba(167,139,250,0.30), rgba(34,211,238,0.20))',
  color: '#fff',
  boxShadow: 'inset 0 0 0 1px rgba(167,139,250,0.55)',
} as const;

const TIMEFRAMES = ['5m', '15m', '1h', '4h', '1d'] as const;
type Timeframe = (typeof TIMEFRAMES)[number];
const TF_LABEL: Record<Timeframe, string> = {
  '5m': '5m',
  '15m': '15m',
  '1h': '1H',
  '4h': '4H',
  '1d': '1D',
};

interface Candle { time: number; open: number; high: number; low: number; close: number; }
interface VolumePoint { time: number; value: number; }
interface OhlcvResponse {
  candles: Candle[];
  volume: VolumePoint[];
  pool?: string | null;
  error?: string;
}

type Status = 'loading' | 'ready' | 'fallback' | 'empty';

function fmtPrice(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return '—';
  const dp = v >= 1000 ? 2 : v >= 1 ? 4 : v >= 0.01 ? 6 : 8;
  return '$' + v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: dp });
}

// Pick price-scale precision / tick step from the token's magnitude so a
// $3,000 token and a $0.0000007 token both read sensibly.
function priceFormatFor(price: number) {
  if (price >= 1000) return { precision: 2, minMove: 0.01 };
  if (price >= 1) return { precision: 4, minMove: 0.0001 };
  if (price >= 0.01) return { precision: 6, minMove: 0.000001 };
  return { precision: 8, minMove: 0.00000001 };
}

export default function CandleChart({
  token,
  pairAddress,
}: {
  token: PortfolioToken;
  pairAddress?: string | null;
}) {
  const [timeframe, setTimeframe] = useState<Timeframe>('15m');
  const [chartType, setChartType] = useState<'candle' | 'line'>('candle');
  const [status, setStatus] = useState<Status>('loading');
  const [data, setData] = useState<OhlcvResponse | null>(null);
  const [legend, setLegend] = useState<Candle | null>(null);

  const boxRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const areaRef = useRef<ISeriesApi<'Area'> | null>(null);
  const volRef = useRef<ISeriesApi<'Histogram'> | null>(null);

  // Latest fallback pair, kept in a ref so the fetch effect doesn't depend on
  // it — otherwise insights resolving after the native candles already loaded
  // would trigger a pointless refetch.
  const pairRef = useRef<string | null | undefined>(pairAddress);
  pairRef.current = pairAddress;

  // Fetch native OHLCV whenever the token or timeframe changes.
  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    const params = new URLSearchParams({
      chain: token.chain,
      address: token.address,
      timeframe,
    });
    fetch(`/api/portfolio/ohlcv?${params.toString()}`)
      .then((r) => r.json())
      .then((d: OhlcvResponse) => {
        if (cancelled) return;
        if (d?.candles?.length) {
          setData(d);
          setStatus('ready');
        } else {
          setData(null);
          setStatus(pairRef.current ? 'fallback' : 'empty');
        }
      })
      .catch(() => {
        if (cancelled) return;
        setData(null);
        setStatus(pairRef.current ? 'fallback' : 'empty');
      });
    return () => {
      cancelled = true;
    };
  }, [token.chain, token.address, timeframe]);

  // If native data was unavailable before the fallback pair was known, upgrade
  // the empty state to the DexScreener embed once it arrives.
  useEffect(() => {
    if (pairAddress) setStatus((s) => (s === 'empty' ? 'fallback' : s));
  }, [pairAddress]);

  // Create the chart + series once.
  useEffect(() => {
    if (!boxRef.current) return;
    const chart = createChart(boxRef.current, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: 'rgba(255,255,255,0.45)',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: 11,
        attributionLogo: false,
      },
      localization: { priceFormatter: fmtPrice },
      grid: { vertLines: { visible: false }, horzLines: { color: 'rgba(255,255,255,0.035)' } },
      rightPriceScale: {
        borderVisible: false,
        scaleMargins: { top: 0.1, bottom: 0.28 },
        entireTextOnly: true,
      },
      timeScale: { borderVisible: false, timeVisible: true, secondsVisible: false },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: 'rgba(167,139,250,0.55)', width: 1, style: LineStyle.Solid, labelBackgroundColor: '#6d28d9' },
        horzLine: { color: 'rgba(167,139,250,0.55)', width: 1, style: LineStyle.Solid, labelBackgroundColor: '#6d28d9' },
      },
    });

    const candle = chart.addCandlestickSeries({
      upColor: UP,
      downColor: DOWN,
      borderUpColor: UP,
      borderDownColor: DOWN,
      wickUpColor: 'rgba(46,230,166,0.85)',
      wickDownColor: 'rgba(251,111,146,0.85)',
      priceLineColor: 'rgba(167,139,250,0.7)',
      priceLineWidth: 1,
      priceLineStyle: LineStyle.Dashed,
    });

    // Line mode = a lush violet→cyan glow area.
    const area = chart.addAreaSeries({
      lineColor: '#a78bfa',
      lineWidth: 2,
      topColor: 'rgba(167,139,250,0.45)',
      bottomColor: 'rgba(34,211,238,0.02)',
      crosshairMarkerRadius: 5,
      crosshairMarkerBorderColor: '#c4b5fd',
      crosshairMarkerBackgroundColor: '#0b1020',
      priceLineColor: 'rgba(167,139,250,0.7)',
      priceLineWidth: 1,
      priceLineStyle: LineStyle.Dashed,
      visible: false,
    });

    const vol = chart.addHistogramSeries({ priceFormat: { type: 'volume' }, priceScaleId: '' });
    vol.priceScale().applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });

    chart.subscribeCrosshairMove((param) => {
      const cd = param.seriesData.get(candle) as Candle | undefined;
      if (cd) setLegend(cd);
    });

    chartRef.current = chart;
    candleRef.current = candle;
    areaRef.current = area;
    volRef.current = vol;
    return () => {
      chart.remove();
      chartRef.current = null;
      candleRef.current = null;
      areaRef.current = null;
      volRef.current = null;
    };
  }, []);

  // Push fetched data into the series.
  useEffect(() => {
    if (!data || !candleRef.current || !areaRef.current || !volRef.current) return;
    const last = data.candles[data.candles.length - 1]?.close ?? 0;
    const pf = { type: 'price' as const, ...priceFormatFor(last) };
    candleRef.current.applyOptions({ priceFormat: pf });
    areaRef.current.applyOptions({ priceFormat: pf });

    candleRef.current.setData(
      data.candles.map((c) => ({
        time: c.time as UTCTimestamp,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      })),
    );
    areaRef.current.setData(
      data.candles.map((c) => ({ time: c.time as UTCTimestamp, value: c.close })),
    );
    volRef.current.setData(
      data.volume.map((v, i) => {
        const c = data.candles[i];
        const up = c ? c.close >= c.open : true;
        return {
          time: v.time as UTCTimestamp,
          value: v.value,
          color: up ? 'rgba(46,230,166,0.22)' : 'rgba(251,111,146,0.22)',
        };
      }),
    );
    chartRef.current?.timeScale().fitContent();
    setLegend(data.candles[data.candles.length - 1] ?? null);
  }, [data]);

  // Toggle candle / line visibility.
  useEffect(() => {
    candleRef.current?.applyOptions({ visible: chartType === 'candle' });
    areaRef.current?.applyOptions({ visible: chartType === 'line' });
  }, [chartType]);

  const dsSrc = useMemo(() => {
    if (!pairAddress) return null;
    // token.chain ('ethereum' | 'pulsechain') is already DexScreener's slug.
    return (
      `https://dexscreener.com/${token.chain}/${pairAddress}` +
      `?embed=1&loadChartSettings=0&trades=0&tabs=0&info=0&theme=dark&chartStyle=0&chartType=usd&interval=15`
    );
  }, [pairAddress, token.chain]);

  const showNativeChrome = status === 'loading' || status === 'ready';

  return (
    <div>
      {/* Toolbar — only for the native chart; the embed has its own. */}
      {showNativeChrome && (
        <div className="flex items-center gap-2 px-1 pb-2">
          <div className="inline-flex rounded-lg bg-white/5 border border-white/10 p-0.5">
            {TIMEFRAMES.map((tf) => (
              <button
                key={tf}
                type="button"
                onClick={() => setTimeframe(tf)}
                className="text-xs font-semibold px-2.5 py-1 rounded-md transition-colors hover:text-white"
                style={timeframe === tf ? ACTIVE_PILL : { color: 'rgba(255,255,255,0.55)' }}
              >
                {TF_LABEL[tf]}
              </button>
            ))}
          </div>
          <div className="inline-flex rounded-lg bg-white/5 border border-white/10 p-0.5">
            {(['candle', 'line'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setChartType(t)}
                title={t === 'candle' ? 'Candlestick' : 'Line'}
                className="inline-grid place-items-center h-7 w-8 rounded-md transition-colors hover:text-white"
                style={chartType === t ? ACTIVE_PILL : { color: 'rgba(255,255,255,0.55)' }}
              >
                {t === 'candle' ? <IconChartCandle className="h-4 w-4" /> : <IconChartLine className="h-4 w-4" />}
              </button>
            ))}
          </div>
        </div>
      )}

      <div
        className="relative h-[420px] rounded-xl overflow-hidden"
        style={{
          border: '1px solid rgba(167,139,250,0.20)',
          background:
            'radial-gradient(135% 95% at 50% -12%, rgba(124,58,237,0.22), transparent 55%),' +
            'radial-gradient(120% 80% at 112% 118%, rgba(34,211,238,0.12), transparent 55%),' +
            'linear-gradient(180deg, #0e1830 0%, #0a1020 100%)',
          boxShadow: 'inset 0 0 70px rgba(124,58,237,0.08)',
        }}
      >
        {/* The chart canvas is always mounted so the instance stays stable;
            non-native states cover it with an overlay. */}
        <div ref={boxRef} className="absolute inset-0" />

        {status === 'ready' && legend && (
          <div
            className="absolute top-3 left-3 z-[4] pointer-events-none inline-flex items-center gap-2 flex-wrap rounded-[11px] px-2.5 py-1.5 text-[11.5px] tabular-nums"
            style={{ background: 'rgba(15,24,46,0.55)', border: '1px solid rgba(255,255,255,0.09)', backdropFilter: 'blur(10px)' }}
          >
            <span className="font-extrabold text-white">{token.symbol}</span>
            <OHLC label="O" v={legend.open} />
            <OHLC label="H" v={legend.high} />
            <OHLC label="L" v={legend.low} />
            {(() => {
              const up = legend.close >= legend.open;
              const col = up ? UP : DOWN;
              const chg = legend.open ? ((legend.close - legend.open) / legend.open) * 100 : 0;
              return (
                <>
                  <span style={{ color: col }}>
                    <span className="text-white/40 mr-0.5 text-[10px]">C</span>
                    {fmtPrice(legend.close)}
                  </span>
                  <span
                    className="font-bold px-1.5 py-px rounded-full text-[10.5px]"
                    style={{ color: col, background: up ? 'rgba(46,230,166,0.14)' : 'rgba(251,111,146,0.14)' }}
                  >
                    {chg >= 0 ? '▲ ' : '▼ '}
                    {Math.abs(chg).toFixed(2)}%
                  </span>
                </>
              );
            })()}
          </div>
        )}

        {showNativeChrome && (
          <div
            className="absolute right-3.5 bottom-7 z-[1] pointer-events-none text-2xl font-extrabold tracking-wider"
            style={{ color: 'rgba(255,255,255,0.05)' }}
          >
            {token.symbol}
          </div>
        )}

        {status === 'loading' && (
          <div className="absolute inset-0 z-[5] grid place-items-center" style={{ background: 'rgba(11,19,34,0.55)' }}>
            <div className="text-xs text-white/50">Loading candles…</div>
          </div>
        )}

        {status === 'fallback' && dsSrc && (
          <iframe
            src={dsSrc}
            title={`DexScreener chart for ${token.symbol}`}
            className="absolute inset-0 z-[5] w-full h-full"
            style={{ border: 0 }}
            loading="lazy"
          />
        )}

        {/* Empty when there's no native data AND no DexScreener pair to embed. */}
        {(status === 'empty' || (status === 'fallback' && !dsSrc)) && (
          <div className="absolute inset-0 z-[5] grid place-items-center px-6 text-center" style={{ background: '#0b1322' }}>
            <div className="text-sm text-white/50">No chart data available for this token yet.</div>
          </div>
        )}
      </div>
    </div>
  );
}

function OHLC({ label, v }: { label: string; v: number }) {
  return (
    <span className="text-white/80">
      <span className="text-white/40 mr-0.5 text-[10px]">{label}</span>
      {fmtPrice(v)}
    </span>
  );
}

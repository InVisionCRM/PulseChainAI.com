'use client';

import { useEffect, useRef, useState } from 'react';

/** Eases a number from 0 to its real value on mount; honors reduced-motion. */
export default function CountUp({ value, format }: { value: number; format: (n: number) => string }) {
  const [shown, setShown] = useState(0);
  const target = useRef(value);
  target.current = value;
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setShown(target.current);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const dur = 900;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / dur);
      setShown(target.current * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <>{format(shown)}</>;
}

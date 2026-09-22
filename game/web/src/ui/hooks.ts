import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';

/** Reduced motion: the OS preference or the in-game setting (<html data-motion="reduced">). */
export function reducedMotion(): boolean {
  if (typeof window === 'undefined') return true;
  return document.documentElement.dataset.motion === 'reduced' || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Tweened number for counters (МОЩЬ etc.). */
export function useAnimatedNumber(value: number, ms = 450): number {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    if (reducedMotion() || from.current === value) { from.current = value; setShown(value); return; }
    const start = performance.now();
    const a = from.current;
    let raf = 0;
    const tick = (t: number) => {
      const k = Math.min(1, (t - start) / ms);
      const e = 1 - Math.pow(1 - k, 3);
      setShown(Math.round(a + (value - a) * e));
      if (k < 1) raf = requestAnimationFrame(tick);
      else from.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); from.current = value; };
  }, [value, ms]);
  return shown;
}

/** Width of an element, kept up to date with ResizeObserver. */
export function useWidth(ref: RefObject<HTMLElement | null>): number {
  const [w, setW] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setW(el.getBoundingClientRect().width);
    const ro = new ResizeObserver((es) => setW(es[0].contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return w;
}

/** Multiset difference: what appeared and what disappeared between two lists. */
export function multisetDiff<T>(prev: readonly T[], next: readonly T[]): { added: T[]; removed: T[] } {
  const left = new Map<T, number>();
  for (const x of prev) left.set(x, (left.get(x) ?? 0) + 1);
  const added: T[] = [];
  for (const x of next) {
    const n = left.get(x) ?? 0;
    if (n > 0) left.set(x, n - 1);
    else added.push(x);
  }
  const removed: T[] = [];
  for (const [x, n] of left) for (let i = 0; i < n; i++) removed.push(x);
  return { added, removed };
}

/** Transient visual effects that clear themselves: `fire(key, value)` shows for `ms`. */
export function useTransient<V>(ms: number): [Map<string, V>, (key: string, v: V) => void] {
  const [m, setM] = useState<Map<string, V>>(() => new Map());
  const timers = useRef(new Map<string, number>());
  useEffect(() => () => { for (const t of timers.current.values()) clearTimeout(t); }, []);
  const fire = (key: string, v: V) => {
    setM((cur) => new Map(cur).set(key, v));
    const old = timers.current.get(key);
    if (old) clearTimeout(old);
    timers.current.set(key, window.setTimeout(() => {
      timers.current.delete(key);
      setM((cur) => { const n = new Map(cur); n.delete(key); return n; });
    }, ms));
  };
  return [m, fire];
}

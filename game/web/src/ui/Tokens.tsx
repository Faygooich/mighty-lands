// Power tokens as physical chips. A token is both power (its number) and a life (its slot).
import { useLayoutEffect, useRef, useState } from 'react';
import { multisetDiff, reducedMotion, useAnimatedNumber } from './hooks.ts';

export function Chip({ value, size = 'md', fx, onClick, title }: { value: number; size?: 'xs' | 'sm' | 'md' | 'lg'; fx?: 'in' | 'out'; onClick?: () => void; title?: string }) {
  const cls = `chip chip-${size} c${value} ${fx ? `chip-${fx}` : ''}`;
  const label = value >= 1000 ? `${value / 1000}K` : String(value);
  if (onClick) return <button type="button" className={`${cls} chip-btn`} onClick={onClick} title={title}><span>{label}</span></button>;
  return <span className={cls} title={title ?? `Жетон ${value}`}><span>{label}</span></span>;
}

interface Ghost { id: number; value: number }

/** A row of token slots. New tokens pop in, lost tokens fall out of the row. */
export function TokenRow({ tokens, slots, size = 'md' }: { tokens: readonly number[]; slots: number; size?: 'xs' | 'sm' | 'md' | 'lg' }) {
  const prev = useRef<readonly number[]>(tokens);
  const [fresh, setFresh] = useState<number[]>([]);
  const [ghosts, setGhosts] = useState<Ghost[]>([]);
  const gid = useRef(0);
  const key = tokens.join(',');
  useLayoutEffect(() => {
    const { added, removed } = multisetDiff(prev.current, tokens);
    prev.current = tokens;
    if (reducedMotion()) return;
    if (added.length) {
      setFresh(added);
      const t = setTimeout(() => setFresh([]), 700);
      if (!removed.length) return () => clearTimeout(t);
    }
    if (removed.length) {
      const gs = removed.map((value) => ({ id: ++gid.current, value }));
      setGhosts((cur) => [...cur, ...gs]);
      setTimeout(() => setGhosts((cur) => cur.filter((x) => !gs.includes(x))), 900);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const left = [...fresh];
  const cells = Array.from({ length: slots }, (_, i) => {
    const v = tokens[i];
    if (v === undefined) return <span key={`e${i}`} className={`chip chip-${size} chip-empty`} aria-hidden />;
    const k = left.indexOf(v);
    const isNew = k >= 0;
    if (isNew) left.splice(k, 1);
    return <Chip key={`t${i}-${v}`} value={v} size={size} fx={isNew ? 'in' : undefined} />;
  });
  return (
    <span className="token-row" aria-label={`Жетоны: ${tokens.join(', ') || 'нет'}`}>
      {cells}
      <span className="token-ghosts" aria-hidden>
        {ghosts.map((gh) => <Chip key={gh.id} value={gh.value} size={size} fx="out" />)}
      </span>
    </span>
  );
}

/** Big power number with a count-up and a floating «+300 / −500». */
export function PowerValue({ value, className = '' }: { value: number; className?: string }) {
  const shown = useAnimatedNumber(value);
  const prev = useRef(value);
  const [delta, setDelta] = useState<{ v: number; id: number } | null>(null);
  useLayoutEffect(() => {
    const dv = value - prev.current;
    prev.current = value;
    if (!dv || reducedMotion()) return;
    const id = Date.now();
    setDelta({ v: dv, id });
    const t = setTimeout(() => setDelta((d) => (d && d.id === id ? null : d)), 1300);
    return () => clearTimeout(t);
  }, [value]);
  return (
    <span className={`power-value ${delta ? (delta.v > 0 ? 'up' : 'down') : ''} ${className}`}>
      <span className="pv-num">{shown}</span>
      {delta && <span key={delta.id} className={`floater ${delta.v > 0 ? 'good' : 'bad'}`}>{delta.v > 0 ? `+${delta.v}` : `−${-delta.v}`}</span>}
    </span>
  );
}

/** Lives: filled hearts for tokens, hollow for empty slots. Shakes when a life is lost. */
export function Lives({ n, max }: { n: number; max: number }) {
  const prev = useRef(n);
  const [hit, setHit] = useState(0);
  useLayoutEffect(() => {
    if (n < prev.current && !reducedMotion()) setHit((h) => h + 1);
    prev.current = n;
  }, [n]);
  return (
    <span key={hit} className={`lives ${hit ? 'lives-hit' : ''} ${n <= 1 ? 'lives-low' : ''}`} title={`Жизни: ${n} из ${max} (жизнь = жетон; мужики не считают, но вы считайте)`}>
      {Array.from({ length: max }, (_, i) => (
        <svg key={i} viewBox="0 0 24 24" className={i < n ? 'heart on' : 'heart'} aria-hidden>
          <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" />
        </svg>
      ))}
      <span className="sr-only">{n} из {max}</span>
    </span>
  );
}

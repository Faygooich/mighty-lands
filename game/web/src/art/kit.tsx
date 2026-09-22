// Shared drawing kit for the built-in cartoon illustrations (viewBox 0 0 160 120).
// Style: flat colours, thick warm-black outline, big sardonic eyes.
import type { ReactNode } from 'react';

export const INK = '#2b2117';
export const S = { stroke: INK, strokeWidth: 2.5, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const };
export const Thin = { stroke: INK, strokeWidth: 1.6, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const };

/** An eye: white, outline, pupil offset by (dx, dy); `lid` draws a heavy upper eyelid (0..1). */
export function Eye({ x, y, r = 5, dx = 0, dy = 0, lid = 0, fill = '#fff', pupil = INK }: { x: number; y: number; r?: number; dx?: number; dy?: number; lid?: number; fill?: string; pupil?: string }) {
  return (
    <g>
      <circle cx={x} cy={y} r={r} fill={fill} {...Thin} />
      <circle cx={x + dx} cy={y + dy} r={r * 0.45} fill={pupil} />
      {lid > 0 && <Lid x={x} y={y} r={r} lid={lid} />}
    </g>
  );
}

/** Upper eyelid cap covering `lid` (0..1) of the eye height — for tired / bored looks. */
function Lid({ x, y, r, lid }: { x: number; y: number; r: number; lid: number }) {
  const y0 = y - r + 2 * r * Math.min(lid, 0.95);
  const w = Math.sqrt(Math.max(0, r * r - (y0 - y) * (y0 - y)));
  const large = y0 > y ? 1 : 0;
  return <path d={`M${x - w} ${y0} A${r} ${r} 0 ${large} 1 ${x + w} ${y0} Z`} fill="#8a6f5a" {...Thin} />;
}

/** Angled brows: `mood` > 0 angry, < 0 worried. */
export function Brows({ x1, x2, y, mood = 1, w = 7 }: { x1: number; x2: number; y: number; mood?: number; w?: number }) {
  const t = 3 * mood;
  return (
    <g {...S} fill="none" strokeWidth={2.8}>
      <path d={`M${x1 - w / 2} ${y - t} L${x1 + w / 2} ${y + t}`} />
      <path d={`M${x2 - w / 2} ${y + t} L${x2 + w / 2} ${y - t}`} />
    </g>
  );
}

export function Shadow({ x = 80, y = 104, rx = 34 }: { x?: number; y?: number; rx?: number }) {
  return <ellipse cx={x} cy={y} rx={rx} ry={5} fill="#000" opacity={0.22} />;
}

export type Scene = 'valley' | 'forest' | 'mountains' | 'abyss' | 'gate' | 'road' | 'arcane' | 'bronze' | 'green' | 'crimson';

const SCENE_SKY: Record<Scene, [string, string]> = {
  valley: ['#bfe3ef', '#f6ecc9'],
  forest: ['#5f8f86', '#c9d8a8'],
  mountains: ['#9fb4c9', '#e9eef2'],
  abyss: ['#1c0f2b', '#5a2a3a'],
  gate: ['#f3c56b', '#fbeac2'],
  road: ['#d9c9a0', '#f1e6c8'],
  arcane: ['#2f2a6b', '#7b5fb8'],
  bronze: ['#6e3b22', '#d69a5b'],
  green: ['#2f6b47', '#9fcf8f'],
  crimson: ['#4d1623', '#b8475a'],
};

/** Scene background. `uid` keeps gradient ids unique when several cards are on screen. */
export function Backdrop({ scene, uid }: { scene: Scene; uid: string }) {
  const [a, b] = SCENE_SKY[scene];
  const g = `sky-${uid}`;
  return (
    <g>
      <defs>
        <linearGradient id={g} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={a} />
          <stop offset="1" stopColor={b} />
        </linearGradient>
        <radialGradient id={`glow-${uid}`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#fff" stopOpacity="0.55" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="160" height="120" fill={`url(#${g})`} />
      {scene === 'valley' && (
        <>
          <circle cx="130" cy="22" r="11" fill="#ffe08a" />
          <path d="M0 84 Q40 62 80 80 T160 74 V120 H0Z" fill="#9cc56a" />
          <path d="M0 96 Q50 80 100 94 T160 92 V120 H0Z" fill="#7aa84c" />
        </>
      )}
      {scene === 'forest' && (
        <>
          {[8, 30, 128, 150].map((x, i) => (
            <path key={i} d={`M${x} ${40 + (i % 2) * 8} L${x + 14} ${92} L${x - 14} ${92}Z`} fill="#2e5a3f" opacity={0.85} />
          ))}
          <path d="M0 92 Q80 84 160 92 V120 H0Z" fill="#4f7d3f" />
        </>
      )}
      {scene === 'mountains' && (
        <>
          <path d="M-5 96 L35 34 L62 70 L92 22 L130 72 L165 44 V120 H-5Z" fill="#7d8ea2" />
          <path d="M35 34 L44 48 L38 46 L30 42Z M92 22 L104 40 L96 37 L86 32Z" fill="#fff" />
          <path d="M0 98 Q80 90 160 98 V120 H0Z" fill="#c9d3dc" />
        </>
      )}
      {scene === 'abyss' && (
        <>
          <ellipse cx="80" cy="120" rx="95" ry="30" fill="#e0582a" opacity={0.55} />
          <path d="M0 98 Q80 90 160 98 V120 H0Z" fill="#2a1420" />
          <path d="M20 108 l8 -4 l6 5 M110 110 l7 -6 l9 4" stroke="#ff8a3d" strokeWidth={1.5} fill="none" />
          {[[18, 20], [140, 30], [60, 12], [110, 16]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r={0.9} fill="#f5d0ff" />)}
        </>
      )}
      {scene === 'gate' && (
        <>
          <circle cx="80" cy="70" r="46" fill={`url(#glow-${uid})`} />
          <path d="M0 98 Q80 92 160 98 V120 H0Z" fill="#c79a4a" />
        </>
      )}
      {scene === 'road' && <path d="M0 96 Q80 88 160 96 V120 H0Z" fill="#b99a62" />}
      {(scene === 'arcane' || scene === 'bronze' || scene === 'green' || scene === 'crimson') && (
        <>
          <circle cx="80" cy="62" r="52" fill={`url(#glow-${uid})`} />
          {[[20, 18], [138, 24], [30, 96], [132, 100], [80, 10]].map(([x, y], i) => (
            <path key={i} d={`M${x} ${y - 3} L${x + 1} ${y - 1} L${x + 3} ${y} L${x + 1} ${y + 1} L${x} ${y + 3} L${x - 1} ${y + 1} L${x - 3} ${y} L${x - 1} ${y - 1}Z`} fill="#fff" opacity={0.6} />
          ))}
        </>
      )}
    </g>
  );
}

export function Frame({ children, label }: { children: ReactNode; label: string }) {
  return (
    <svg viewBox="0 0 160 120" role="img" aria-label={label} preserveAspectRatio="xMidYMid slice" className="art-svg">
      {children}
    </svg>
  );
}

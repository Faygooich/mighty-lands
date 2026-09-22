// Built-in card illustrations, keyed by card id (catalog.ts). Drawn over a frame-coloured Backdrop.
import type { ReactElement } from 'react';
import { Brows, Eye, INK, S, Shadow, Thin } from './kit.tsx';

const Coin = ({ x, y, r = 7 }: { x: number; y: number; r?: number }) => (
  <g>
    <circle cx={x} cy={y} r={r} fill="#f2c14e" {...Thin} />
    <circle cx={x} cy={y} r={r * 0.62} fill="none" stroke="#b07d1c" strokeWidth={1.2} />
  </g>
);

export const CARD_ART: Record<string, () => ReactElement> = {
  // ── Артефакты ──
  tribute: () => (
    <g>
      <Shadow rx={30} />
      <path d="M52 100 Q40 72 62 58 L58 46 H102 L98 58 Q120 72 108 100Z" fill="#a8743a" {...S} />
      <path d="M58 46 Q80 54 102 46" fill="none" {...S} />
      <path d="M62 58 H98" {...S} stroke="#6b3f1f" />
      <text x="80" y="88" fontSize="18" fontWeight="900" textAnchor="middle" fill="#f2c14e" stroke={INK} strokeWidth={0.8}>М</text>
      <Coin x={118} y={96} /><Coin x={128} y={88} r={6} /><Coin x={38} y={96} r={6} />
      <path d="M112 30 q10 -6 20 0" fill="none" {...Thin} />
    </g>
  ),
  bigTribute: () => (
    <g>
      <Shadow rx={40} />
      <rect x="40" y="58" width="80" height="44" rx="4" fill="#8d5a2b" {...S} />
      <path d="M40 58 Q80 30 120 58Z" fill="#a8743a" {...S} />
      {[52, 64, 76, 88, 100, 112].map((x, i) => <Coin key={x} x={x} y={52 - (i % 2) * 4} r={6} />)}
      <rect x="74" y="66" width="12" height="14" rx="2" fill="#f2c14e" {...Thin} />
      <path d="M40 74 H120" {...Thin} />
    </g>
  ),
  trap: () => (
    <g>
      <Shadow rx={44} />
      <path d="M30 88 Q80 104 130 88" fill="none" {...S} stroke="#7d8793" strokeWidth={6} />
      <path d="M30 88 Q80 104 130 88" fill="none" {...Thin} />
      <path d="M34 86 Q40 40 80 38 Q120 40 126 86" fill="none" stroke="#9aa4ae" strokeWidth={6} />
      <path d="M34 86 Q40 40 80 38 Q120 40 126 86" fill="none" {...Thin} />
      {Array.from({ length: 9 }, (_, i) => {
        const x = 42 + i * 9.5;
        return <path key={i} d={`M${x} ${62 - Math.sin((i / 8) * Math.PI) * 18} l4 10 l4 -10`} fill="#e7ecf0" {...Thin} />;
      })}
      <circle cx="80" cy="92" r="6" fill="#6b7580" {...S} />
    </g>
  ),
  pickpocket: () => (
    <g>
      <rect x="86" y="30" width="34" height="48" rx="4" fill="#fffaf0" {...S} transform="rotate(12 103 54)" />
      <path d="M92 42 h20 M92 50 h16" stroke={INK} strokeWidth={1.2} transform="rotate(12 103 54)" />
      <path d="M20 96 Q40 70 70 70 L92 64 Q100 64 98 72 L84 76 L100 74 Q106 76 102 82 L80 88 Q60 98 20 104Z" fill="#6b5a8e" {...S} />
      <path d="M92 64 L104 50 Q108 46 110 52 L100 70" fill="#f0c9a0" {...S} />
      <path d="M26 40 q10 -8 20 0 M30 50 q6 -5 12 0" fill="none" {...Thin} />
    </g>
  ),
  shackles: () => (
    <g>
      <Shadow rx={40} />
      <circle cx="54" cy="64" r="18" fill="none" stroke="#7d8793" strokeWidth={8} />
      <circle cx="54" cy="64" r="18" fill="none" {...Thin} />
      <circle cx="106" cy="64" r="18" fill="none" stroke="#7d8793" strokeWidth={8} />
      <circle cx="106" cy="64" r="18" fill="none" {...Thin} />
      {[72, 80, 88].map((x, i) => <ellipse key={x} cx={x} cy={64} rx={5} ry={3.4} fill="none" stroke="#9aa4ae" strokeWidth={3} transform={i === 1 ? `rotate(90 ${x} 64)` : undefined} />)}
      <rect x="48" y="80" width="12" height="10" rx="2" fill="#b07d1c" {...Thin} />
      <text x="80" y="30" fontSize="12" fontWeight="900" textAnchor="middle" fill="#fff" opacity={0.85}>Z z z</text>
    </g>
  ),
  exile: () => (
    <g>
      <Shadow x={60} rx={30} />
      <path d="M36 50 L70 50 L70 84 L96 88 Q104 90 102 98 L36 98Z" fill="#6b4a2e" {...S} />
      <path d="M36 92 H102" stroke="#3b2a1e" strokeWidth={4} />
      <path d="M110 60 H146 M136 50 L148 60 L136 70" fill="none" {...S} stroke="#fffaf0" strokeWidth={5} />
      <path d="M110 60 H146 M136 50 L148 60 L136 70" fill="none" {...Thin} />
      <path d="M108 40 q6 -6 12 0 M114 80 q6 -6 12 0" fill="none" {...Thin} stroke="#fff" />
    </g>
  ),
  guardian: () => (
    <g>
      <Shadow rx={30} />
      <path d="M50 104 Q48 70 80 66 Q112 70 110 104Z" fill="#8a929b" {...S} />
      <path d="M58 64 Q56 30 80 28 Q104 30 102 64 Q80 72 58 64Z" fill="#b9c3cc" {...S} />
      <rect x="64" y="46" width="32" height="7" rx="3" fill={INK} />
      <circle cx="72" cy="49.5" r="1.8" fill="#ffd166" /><circle cx="88" cy="49.5" r="1.8" fill="#ffd166" />
      <path d="M80 28 Q84 16 96 14" fill="none" {...S} stroke="#c0392b" strokeWidth={5} />
      <path d="M100 76 L126 70 L128 96 Q114 108 102 100Z" fill="#c0392b" {...S} />
      <path d="M112 76 V100" stroke="#f2c14e" strokeWidth={3} />
    </g>
  ),
  outpost: () => (
    <g>
      <Shadow rx={28} />
      <path d="M60 104 L64 44 H96 L100 104Z" fill="#9b7b52" {...S} />
      <path d="M56 44 H104 L100 34 H60Z" fill="#7a5230" {...S} />
      <path d="M58 34 L80 14 L102 34Z" fill="#c0392b" {...S} />
      <rect x="72" y="56" width="16" height="12" fill="#2b2117" />
      <Eye x={77} y={62} r={2.5} dx={1} />
      <Eye x={84} y={62} r={2.5} dx={1} />
      <path d="M80 14 V4 L92 8 L80 12" fill="#f2c14e" {...Thin} />
    </g>
  ),
  bastion: () => (
    <g>
      <Shadow rx={50} />
      <path d="M26 104 V52 H40 V60 H52 V52 H66 V60 H78 V52 H92 V60 H104 V52 H118 V60 H130 V52 H134 V104Z" fill="#a39686" {...S} />
      {[[36, 72], [60, 82], [88, 70], [114, 84], [48, 96], [100, 96]].map(([x, y], i) => <rect key={i} x={x} y={y} width="16" height="8" fill="none" stroke="#7d7264" strokeWidth={1.5} />)}
      <path d="M68 104 V84 Q80 72 92 84 V104Z" fill="#4a3c33" {...S} />
    </g>
  ),
  toll: () => (
    <g>
      <Shadow rx={42} />
      <rect x="30" y="54" width="18" height="50" fill="#7a5230" {...S} />
      <path d="M48 62 H138" stroke="#fff" strokeWidth={8} />
      {[56, 76, 96, 116].map((x) => <path key={x} d={`M${x} 62 h10`} stroke="#c0392b" strokeWidth={8} />)}
      <rect x="48" y="58" width="90" height="8" fill="none" {...Thin} />
      <Coin x={39} y={40} r={10} />
      <text x="39" y="44" fontSize="10" fontWeight="900" textAnchor="middle" fill="#8a5a1f">×</text>
    </g>
  ),
  // ── Заклятия ──
  fireball: () => (
    <g>
      <path d="M20 96 Q50 70 72 64" fill="none" stroke="#ffb347" strokeWidth={10} strokeLinecap="round" opacity={0.6} />
      <path d="M30 100 Q58 78 76 72" fill="none" stroke="#ff7a3d" strokeWidth={6} strokeLinecap="round" opacity={0.6} />
      <circle cx="96" cy="52" r="26" fill="#ff7a3d" {...S} />
      <path d="M96 30 Q116 42 110 60 Q104 74 90 72 Q74 66 80 48 Q84 58 92 56 Q86 42 96 30Z" fill="#ffd166" />
      <Eye x={88} y={52} r={4} dx={-1.5} />
      <Eye x={102} y={52} r={4} dx={-1.5} />
      <Brows x1={88} x2={102} y={45} mood={1.4} w={7} />
      <path d="M88 62 Q95 58 102 62" fill="none" {...S} />
    </g>
  ),
  heal: () => (
    <g>
      <Shadow rx={24} />
      <path d="M68 34 H92 V48 Q112 58 110 80 Q108 104 80 104 Q52 104 50 80 Q48 58 68 48Z" fill="#dff3ff" {...S} />
      <path d="M53 76 Q80 68 107 76 Q106 102 80 102 Q54 102 53 76Z" fill="#e0525e" />
      <rect x="66" y="26" width="28" height="10" rx="2" fill="#a8743a" {...S} />
      <path d="M80 64 C74 54 60 60 68 72 L80 84 L92 72 C100 60 86 54 80 64Z" fill="#fff" {...Thin} />
      <circle cx="116" cy="40" r="3" fill="#fff" /><circle cx="44" cy="52" r="2" fill="#fff" />
    </g>
  ),
  shatter: () => (
    <g>
      <Shadow rx={36} />
      <path d="M50 74 L72 60 L80 72 L60 88Z" fill="#6fb4ff" {...S} />
      <path d="M86 58 L110 66 L102 90 L82 80Z" fill="#6fb4ff" {...S} />
      <path d="M62 92 L84 86 L90 102 L64 104Z" fill="#6fb4ff" {...S} />
      <path d="M100 20 L118 38 L110 46 L92 28Z" fill="#8d8d8d" {...S} />
      <path d="M108 42 L78 72" {...S} stroke="#7a5230" strokeWidth={6} />
      <path d="M108 42 L78 72" fill="none" {...Thin} />
      {[[40, 56], [124, 80], [74, 44]].map(([x, y], i) => <path key={i} d={`M${x} ${y} l6 -6 M${x + 2} ${y + 6} l8 0`} {...Thin} stroke="#fff" />)}
    </g>
  ),
  usurp: () => (
    <g>
      <path d="M52 76 L50 48 L64 60 L80 40 L96 60 L110 48 L108 76Z" fill="#f2c14e" {...S} />
      <circle cx="80" cy="66" r="4" fill="#c0392b" {...Thin} />
      <path d="M8 60 Q30 58 48 64 L60 60 Q66 62 62 68 L50 72" fill="#6b5a8e" {...S} />
      <path d="M152 60 Q130 58 112 64 L100 60 Q94 62 98 68 L110 72" fill="#3f7a45" {...S} />
      <path d="M40 30 l6 6 M120 30 l-6 6 M80 20 v8" {...Thin} stroke="#fff" />
    </g>
  ),
  teleport: () => (
    <g>
      {[40, 32, 24, 16, 8].map((r, i) => <ellipse key={r} cx="80" cy="62" rx={r * 1.25} ry={r} fill="none" stroke={['#b18cff', '#8f6bff', '#6e4fd8', '#5a3cb8', '#fff'][i]} strokeWidth={4} />)}
      <path d="M58 104 l6 -10 l6 10 M92 104 l6 -10 l6 10" fill="#2b2117" />
      <circle cx="120" cy="24" r="3" fill="#fff" /><circle cx="36" cy="30" r="2" fill="#fff" />
    </g>
  ),
  fury: () => (
    <g>
      <path d="M50 92 Q40 50 60 30 Q58 50 70 52 Q66 30 84 18 Q82 40 96 42 Q100 26 112 32 Q104 50 112 64 Q120 90 110 100Z" fill="#ff7a3d" {...S} />
      <path d="M62 60 H98 Q106 60 104 70 V88 Q104 98 92 98 H66 Q56 98 56 88 V70 Q54 60 62 60Z" fill="#f0c9a0" {...S} />
      {[64, 76, 88].map((x) => <path key={x} d={`M${x + 4} 60 V74`} {...Thin} />)}
      <path d="M56 76 Q66 72 70 78" fill="none" {...Thin} />
    </g>
  ),
  release: () => (
    <g>
      <Shadow rx={34} />
      <path d="M46 100 V50 Q80 26 114 50 V100Z" fill="none" stroke="#9aa4ae" strokeWidth={4} />
      {[58, 70, 90, 102].map((x) => <path key={x} d={`M${x} ${x < 80 ? 40 : 40} V100`} stroke="#9aa4ae" strokeWidth={3} />)}
      <path d="M114 100 L140 86 V48 L114 50" fill="none" stroke="#9aa4ae" strokeWidth={3} />
      <circle cx="80" cy="80" r="14" fill="#8fb572" {...S} />
      <Eye x={75} y={78} r={3.5} dx={1} />
      <Eye x={85} y={78} r={3.5} dx={1} />
      <path d="M74 88 Q80 92 86 88" fill="none" {...Thin} />
    </g>
  ),
  drain: () => (
    <g>
      <Coin x={40} y={84} r={12} />
      <path d="M50 78 Q80 30 118 48" fill="none" stroke="#fffaf0" strokeWidth={7} strokeLinecap="round" />
      <path d="M50 78 Q80 30 118 48" fill="none" stroke="#c0392b" strokeWidth={3} strokeLinecap="round" strokeDasharray="6 6" />
      <circle cx="122" cy="58" r="18" fill="#b9a3d8" {...S} />
      <Eye x={116} y={54} r={3.5} dx={-1.5} />
      <Eye x={128} y={54} r={3.5} dx={-1.5} />
      <path d="M116 66 Q122 62 128 66" fill="none" {...Thin} />
      <path d="M118 66 l2 4 l2 -4 M124 66 l2 4 l2 -4" fill="#fff" {...Thin} />
    </g>
  ),
  aid: () => (
    <g>
      <path d="M10 70 Q34 60 56 64 L78 58 Q88 58 84 68 L66 74" fill="#f0c9a0" {...S} />
      <path d="M150 70 Q126 60 104 64 L82 58 Q72 58 76 68 L94 74" fill="#d9a77a" {...S} />
      <path d="M66 74 Q80 84 94 74" fill="none" {...S} />
      <path d="M10 70 V86 H40 Z M150 70 V86 H120 Z" fill="#3f7a45" {...Thin} />
      <text x="80" y="42" fontSize="20" fontWeight="900" textAnchor="middle" fill="#fff" stroke={INK} strokeWidth={0.8}>+500</text>
    </g>
  ),
  hex: () => (
    <g>
      <Shadow rx={20} />
      <path d="M66 104 Q62 80 72 72 Q64 64 68 52 Q72 40 80 40 Q88 40 92 52 Q96 64 88 72 Q98 80 94 104Z" fill="#c8a47a" {...S} />
      <path d="M58 80 L50 70 M102 80 L110 70" {...S} />
      <path d="M74 54 l4 4 M78 54 l-4 4 M84 54 l4 4 M88 54 l-4 4" {...Thin} />
      <path d="M76 64 h8" {...Thin} strokeDasharray="2 2" />
      <path d="M96 60 L124 34" {...S} stroke="#9aa4ae" strokeWidth={3} />
      <circle cx="124" cy="34" r="4" fill="#c0392b" {...Thin} />
      <path d="M60 88 L50 96" {...S} stroke="#9aa4ae" strokeWidth={3} />
      <circle cx="50" cy="96" r="3" fill="#6b3c86" {...Thin} />
    </g>
  ),
  ward: () => (
    <g>
      <path d="M60 20 Q80 44 100 20" fill="none" {...S} stroke="#b07d1c" strokeWidth={3} />
      <path d="M80 42 L104 58 L96 90 L80 102 L64 90 L56 58Z" fill="#6fb4ff" {...S} />
      <path d="M80 50 L96 62 L90 86 L80 94 L70 86 L64 62Z" fill="#bfe6ff" />
      <Eye x={80} y={70} r={6} fill="#fff" pupil="#2e4a6b" />
      <circle cx="80" cy="70" r="30" fill="none" stroke="#fff" strokeWidth={1.5} strokeDasharray="3 5" />
    </g>
  ),
  transmute: () => (
    <g>
      <Shadow rx={28} />
      <path d="M70 26 H90 V50 L112 92 Q116 102 104 102 H56 Q44 102 48 92 L70 50Z" fill="#dff3ff" {...S} />
      <path d="M58 76 H102 L112 94 Q114 100 106 100 H54 Q46 100 48 94Z" fill="#6ee7b7" />
      <Coin x={70} y={88} r={5} /><Coin x={88} y={92} r={4} /><Coin x={96} y={82} r={3.5} />
      <circle cx="80" cy="60" r="3" fill="#fff" /><circle cx="86" cy="40" r="2" fill="#fff" />
      <path d="M40 40 A14 14 0 1 1 46 58" fill="none" {...S} stroke="#fff" />
      <path d="M46 58 l-8 -2 l6 -6" fill="none" {...Thin} stroke="#fff" />
    </g>
  ),
};

/** Card backs. */
export function CardBackArt({ kind }: { kind: 'artifact' | 'spell' }) {
  return kind === 'artifact' ? (
    <g>
      <circle cx="80" cy="60" r="30" fill="none" stroke="#f2c14e" strokeWidth={3} />
      <path d="M80 36 L100 60 L80 84 L60 60Z" fill="#f2c14e" {...Thin} />
      <circle cx="80" cy="60" r="7" fill="#8a4b2a" {...Thin} />
    </g>
  ) : (
    <g>
      <circle cx="80" cy="60" r="30" fill="none" stroke="#c9b8ff" strokeWidth={3} />
      <path d="M80 30 L86 54 L110 60 L86 66 L80 90 L74 66 L50 60 L74 54Z" fill="#c9b8ff" {...Thin} />
    </g>
  );
}

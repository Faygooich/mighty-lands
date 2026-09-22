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
  // ── v1.0.1: Артефакты ──
  envy: () => (
    <g>
      <Shadow rx={28} />
      <circle cx="80" cy="64" r="30" fill="#8bc34a" {...S} />
      <Eye x={68} y={60} r={7} dx={4} lid={0.35} />
      <Eye x={92} y={60} r={7} dx={4} lid={0.35} />
      <Brows x1={68} x2={92} y={49} mood={1.3} w={9} />
      <path d="M68 80 Q80 74 92 80" fill="none" {...S} />
      <path d="M112 34 v18 M104 42 h16" {...S} stroke="#fff" />
      <path d="M126 40 l8 -4 v10 z" fill="#f2c14e" {...Thin} />
    </g>
  ),
  quicksand: () => (
    <g>
      <ellipse cx="80" cy="88" rx="58" ry="18" fill="#d9b26a" {...S} />
      <ellipse cx="80" cy="88" rx="36" ry="10" fill="none" stroke="#a8743a" strokeWidth={2} />
      <ellipse cx="80" cy="88" rx="16" ry="4" fill="none" stroke="#a8743a" strokeWidth={2} />
      <path d="M72 88 V58 Q72 50 80 50 Q88 50 88 58 V88" fill="#f0c9a0" {...S} />
      <path d="M72 66 L56 50 M88 66 L104 50" {...S} />
      <Eye x={76} y={60} r={3} dy={-1} /><Eye x={84} y={60} r={3} dy={-1} />
      <path d="M40 40 q8 -8 16 0 M104 32 q8 -8 16 0" fill="none" {...Thin} stroke="#fff" />
      <path d="M30 70 h14 l-4 -4 M30 70 l4 4" fill="none" {...Thin} />
    </g>
  ),
  mimic: () => (
    <g>
      <Shadow rx={36} />
      <rect x="46" y="66" width="68" height="36" rx="4" fill="#a8743a" {...S} />
      <path d="M46 66 L52 40 Q80 30 108 40 L114 66" fill="#8d5a2b" {...S} />
      {[54, 64, 74, 84, 94, 104].map((x) => <path key={x} d={`M${x} 66 l5 -9 l5 9`} fill="#fff" {...Thin} />)}
      {[56, 66, 76, 86, 96].map((x) => <path key={x} d={`M${x + 4} 66 l5 8 l5 -8`} fill="#fff" {...Thin} />)}
      <Eye x={68} y={48} r={4} dx={1} /><Eye x={92} y={48} r={4} dx={-1} />
      <path d="M80 78 q14 10 4 22" fill="none" stroke="#e0525e" strokeWidth={6} strokeLinecap="round" />
      <Coin x={124} y={96} r={6} />
    </g>
  ),
  spy: () => (
    <g>
      <Shadow rx={26} />
      <path d="M50 104 Q50 64 80 60 Q110 64 110 104Z" fill="#3b3b4f" {...S} />
      <path d="M52 56 Q80 18 108 56 Q80 64 52 56Z" fill="#2b2b3a" {...S} />
      <path d="M40 58 H120" {...S} />
      <path d="M62 74 H98" stroke="#1d1d28" strokeWidth={10} strokeLinecap="round" />
      <Eye x={70} y={74} r={4} dx={2} fill="#fffbe0" /><Eye x={90} y={74} r={4} dx={2} fill="#fffbe0" />
      <rect x="108" y="78" width="18" height="24" rx="2" fill="#dff3ff" transform="rotate(12 117 90)" {...Thin} />
    </g>
  ),
  altar: () => (
    <g>
      <Shadow rx={40} />
      <path d="M44 102 V74 H116 V102Z" fill="#9aa4ae" {...S} />
      <path d="M38 74 H122 V64 H38Z" fill="#7d8793" {...S} />
      <path d="M62 64 Q60 44 70 36 Q72 48 78 50 Q76 34 86 26 Q86 44 96 46 Q100 56 96 64Z" fill="#ff7a3d" {...S} />
      <rect x="54" y="80" width="14" height="18" rx="2" fill="#dff3ff" transform="rotate(-10 61 89)" {...Thin} />
      <path d="M96 90 C92 84 84 88 88 94 L96 100 L104 94 C108 88 100 84 96 90Z" fill="#e0525e" {...Thin} />
    </g>
  ),
  vein: () => (
    <g>
      <path d="M20 104 L50 50 L80 70 L110 30 L140 104Z" fill="#78909c" {...S} />
      <path d="M44 92 Q66 74 80 82 Q96 90 118 64" fill="none" stroke="#f2c14e" strokeWidth={6} strokeLinecap="round" />
      <path d="M44 92 Q66 74 80 82 Q96 90 118 64" fill="none" {...Thin} />
      <Coin x={60} y={84} r={5} /><Coin x={98} y={82} r={6} /><Coin x={116} y={68} r={4} />
      <path d="M118 34 l4 -8 l4 8 l8 4 l-8 4 l-4 8 l-4 -8 l-8 -4z" fill="#fff" {...Thin} />
    </g>
  ),
  // ── v1.0.1: Заклятия ──
  secondWind: () => (
    <g>
      <Shadow rx={24} />
      <path d="M68 104 V70 Q68 58 80 58 Q92 58 92 70 V104" fill="#f0c9a0" {...S} />
      <circle cx="80" cy="44" r="14" fill="#f0c9a0" {...S} />
      <Eye x={75} y={42} r={2.5} /><Eye x={85} y={42} r={2.5} />
      <path d="M75 50 Q80 53 85 50" fill="none" {...Thin} />
      <path d="M68 72 L50 52 M92 72 L110 52" {...S} />
      {[30, 42, 118, 130].map((x, i) => <path key={x} d={`M${x} ${60 + i * 4} q10 -10 0 -20`} fill="none" stroke="#fff" strokeWidth={3} strokeLinecap="round" />)}
    </g>
  ),
  revolt: () => (
    <g>
      <path d="M40 104 V60 M60 104 V50 M100 104 V50 M120 104 V60" {...S} stroke="#7a5230" strokeWidth={4} />
      <path d="M34 60 l6 -16 l6 16z M54 50 l6 -18 l6 18z" fill="#9aa4ae" {...Thin} />
      <path d="M96 30 h8 v20 h-8z M92 36 h16" fill="#7a5230" {...Thin} />
      <path d="M114 44 l6 -14 l6 14 l-6 4z" fill="#ff7a3d" {...Thin} />
      <path d="M62 20 L72 34 L80 22 L88 34 L98 20 L96 38 H64Z" fill="#f2c14e" transform="rotate(-24 80 30)" {...S} />
      <path d="M56 72 h48" {...Thin} stroke="#fff" strokeDasharray="4 4" />
    </g>
  ),
  swap: () => (
    <g>
      <Coin x={46} y={62} r={16} />
      <Coin x={116} y={62} r={8} />
      <path d="M58 40 Q80 22 104 40" fill="none" {...S} />
      <path d="M104 40 l-10 -2 l4 -8" fill="none" {...S} />
      <path d="M104 86 Q80 104 58 86" fill="none" {...S} />
      <path d="M58 86 l10 2 l-4 8" fill="none" {...S} />
      <text x="46" y="68" fontSize="12" fontWeight="900" textAnchor="middle" fill="#8a5a1f">1000</text>
      <text x="116" y="66" fontSize="7" fontWeight="900" textAnchor="middle" fill="#8a5a1f">100</text>
    </g>
  ),
  tailwind: () => (
    <g>
      <path d="M20 50 Q70 30 110 50 Q130 60 120 72 Q110 80 100 70" fill="none" stroke="#fff" strokeWidth={5} strokeLinecap="round" />
      <path d="M30 76 Q80 60 118 84" fill="none" stroke="#fff" strokeWidth={4} strokeLinecap="round" opacity={0.8} />
      <rect x="50" y="78" width="22" height="22" rx="4" fill="#fffaf0" transform="rotate(-12 61 89)" {...S} />
      <rect x="86" y="80" width="22" height="22" rx="4" fill="#fffaf0" transform="rotate(14 97 91)" {...S} />
      <circle cx="61" cy="89" r="2.5" fill={INK} />
      <circle cx="92" cy="86" r="2.2" fill={INK} /><circle cx="102" cy="96" r="2.2" fill={INK} />
    </g>
  ),
  loot: () => (
    <g>
      <Shadow rx={30} />
      <path d="M48 104 Q40 70 64 60 L60 48 H100 L96 60 Q120 70 112 104Z" fill="#6b4a8e" {...S} />
      <path d="M60 48 Q80 56 100 48" fill="none" {...S} />
      <path d="M70 72 L80 62 L90 72 L80 82Z" fill="#f2c14e" {...Thin} />
      <path d="M100 30 l14 -8 l4 8 l-14 8z" fill="#9aa4ae" {...Thin} />
      <path d="M124 60 l8 -4 M126 70 h10" {...Thin} stroke="#fff" />
    </g>
  ),
  luxuryTax: () => (
    <g>
      <rect x="46" y="30" width="54" height="70" rx="3" fill="#fffaf0" {...S} />
      {[44, 54, 64, 74].map((y) => <path key={y} d={`M54 ${y} H92`} {...Thin} />)}
      <circle cx="84" cy="86" r="10" fill="none" stroke="#c0392b" strokeWidth={3} />
      <text x="84" y="90" fontSize="10" fontWeight="900" textAnchor="middle" fill="#c0392b">%</text>
      <Coin x={116} y={62} r={9} /><Coin x={124} y={80} r={8} /><Coin x={112} y={96} r={7} />
      <path d="M100 50 Q112 46 118 52" fill="none" {...Thin} />
    </g>
  ),
  quake: () => (
    <g>
      <path d="M10 80 H150 V110 H10Z" fill="#8d6e4a" {...S} />
      <path d="M70 80 L78 92 L70 100 L82 110" fill="none" {...S} strokeWidth={3} />
      <path d="M36 80 V56 H56 V80 M104 80 V50 H128 V80" fill="#c8a47a" {...S} />
      <path d="M32 58 L46 44 L60 58 M100 52 L116 38 L132 52" fill="#a0522d" {...S} />
      {[24, 136].map((x) => <path key={x} d={`M${x} 40 l-6 6 l6 6 l-6 6`} fill="none" {...Thin} stroke="#fff" />)}
    </g>
  ),
  lure: () => (
    <g>
      <path d="M30 20 Q60 40 70 64" fill="none" {...S} stroke="#7a5230" strokeWidth={4} />
      <path d="M70 64 V80" {...Thin} />
      <Coin x={70} y={88} r={9} />
      <path d="M100 104 Q96 70 118 62 Q140 70 136 104Z" fill="#6a1b9a" {...S} />
      <Eye x={112} y={78} r={4} dx={-3} fill="#fffbe0" /><Eye x={126} y={78} r={4} dx={-3} fill="#fffbe0" />
      <path d="M110 92 l4 4 l4 -4 l4 4 l4 -4" fill="none" {...Thin} stroke="#fff" />
    </g>
  ),
  forge: () => (
    <g>
      <path d="M40 86 H120 L110 100 H50Z" fill="#5f6b76" {...S} />
      <path d="M56 86 V76 H104 V86" fill="#7d8793" {...S} />
      <Coin x={80} y={70} r={10} />
      <path d="M92 26 L122 40 L116 52 L86 38Z" fill="#9aa4ae" {...S} />
      <path d="M104 44 L90 64" {...S} stroke="#7a5230" strokeWidth={5} />
      {[[60, 60], [100, 60], [66, 48]].map(([x, y], i) => <path key={i} d={`M${x} ${y} l-6 -6 M${x + 4} ${y - 2} l2 -8`} {...Thin} stroke="#ffd166" />)}
    </g>
  ),
  hunt: () => (
    <g>
      <path d="M36 70 Q60 40 110 44 L124 32 L126 64 L110 56 Q70 60 48 84Z" fill="#c8a47a" {...S} />
      <path d="M40 76 l-8 8" {...S} />
      <path d="M130 40 q10 8 0 18 M136 34 q16 14 0 30" fill="none" {...Thin} stroke="#fff" />
      <path d="M60 54 Q80 48 100 50" fill="none" {...Thin} />
    </g>
  ),
  mirror: () => (
    <g>
      <ellipse cx="80" cy="60" rx="30" ry="40" fill="#bfe6ff" {...S} />
      <ellipse cx="80" cy="60" rx="22" ry="32" fill="#e8f7ff" />
      <path d="M66 40 L78 34 M64 52 L84 40" {...Thin} stroke="#fff" strokeWidth={3} />
      <path d="M30 30 L56 52" {...S} stroke="#ff7a3d" strokeWidth={4} />
      <path d="M56 52 L28 80" {...S} stroke="#ff7a3d" strokeWidth={4} strokeDasharray="5 4" />
      <path d="M28 80 l10 -2 l-4 -8" fill="none" {...Thin} />
    </g>
  ),
  ambush: () => (
    <g>
      <path d="M20 104 Q30 60 60 70 Q70 40 100 54 Q124 44 140 70 Q150 90 140 104Z" fill="#3f7a45" {...S} />
      <Eye x={62} y={82} r={4} dx={2} fill="#fffbe0" /><Eye x={74} y={82} r={4} dx={2} fill="#fffbe0" />
      <Eye x={104} y={74} r={4} dx={-2} fill="#fffbe0" /><Eye x={116} y={74} r={4} dx={-2} fill="#fffbe0" />
      <path d="M128 60 L148 28" {...S} stroke="#9aa4ae" strokeWidth={3} />
      <path d="M144 26 l8 -6 l-2 10z" fill="#9aa4ae" {...Thin} />
    </g>
  ),
  courage: () => (
    <g>
      <Shadow rx={26} />
      <path d="M80 18 L86 76 H74Z" fill="#dfe6ec" {...S} />
      <path d="M60 76 H100" {...S} stroke="#b07d1c" strokeWidth={5} />
      <path d="M76 80 H84 V100 H76Z" fill="#7a5230" {...S} />
      <circle cx="80" cy="104" r="5" fill="#f2c14e" {...Thin} />
      <path d="M52 40 q-10 -10 0 -20 M108 40 q10 -10 0 -20" fill="none" {...Thin} stroke="#fff" />
      <text x="120" y="80" fontSize="16" fontWeight="900" fill="#fff" stroke={INK} strokeWidth={0.8}>4+</text>
    </g>
  ),
  intercept: () => (
    <g>
      <Coin x={80} y={40} r={14} />
      <path d="M20 84 Q40 70 60 72 L76 58 Q86 54 84 66 L70 80" fill="#d9a77a" {...S} />
      <path d="M140 90 Q120 80 104 80 L94 70" fill="none" {...S} />
      <path d="M100 64 l-6 8 M108 68 l-6 8" {...Thin} />
      <path d="M40 28 l8 4 M120 26 l-8 6" {...Thin} stroke="#fff" />
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

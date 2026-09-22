// Built-in monster illustrations, one per Land (keys = LAND_ART_KEY). Drawn over a region Backdrop.
import type { ReactElement } from 'react';
import { Brows, Eye, INK, S, Shadow, Thin } from './kit.tsx';

const Mouth = ({ d, fill = INK }: { d: string; fill?: string }) => <path d={d} fill={fill} {...Thin} />;

export const MONSTERS: Record<string, () => ReactElement> = {
  // ── Долина ──
  meadow: () => (
    <g>
      <Shadow rx={22} />
      <path d="M80 104 Q78 80 80 62" fill="none" {...S} stroke="#3f7a2e" strokeWidth={4} />
      <path d="M80 90 Q64 84 58 70 Q70 74 80 86Z M80 84 Q96 78 102 64 Q90 70 80 80Z" fill="#6aa84f" {...Thin} />
      {Array.from({ length: 18 }, (_, i) => {
        const a = (i / 18) * Math.PI * 2;
        return <path key={i} d={`M80 44 L${80 + Math.cos(a) * 26} ${44 + Math.sin(a) * 26}`} stroke="#fff" strokeWidth={3} strokeLinecap="round" />;
      })}
      <circle cx="80" cy="44" r="15" fill="#ffd54a" {...S} />
      <Eye x={74} y={42} r={4} dx={1} />
      <Eye x={86} y={42} r={4} dx={-1} />
      <Brows x1={74} x2={86} y={35} mood={1.2} w={6} />
      <Mouth d="M73 51 Q80 47 87 51 Q80 55 73 51Z" />
    </g>
  ),
  streams: () => (
    <g>
      <path d="M10 100 Q80 88 150 100 V120 H10Z" fill="#5fa8c9" />
      <path d="M40 86 Q40 52 80 50 Q120 52 120 86 Q80 96 40 86Z" fill="#7fb77e" {...S} />
      <path d="M58 74 Q62 100 70 92 Q74 104 80 94 Q86 104 90 92 Q98 100 102 74" fill="#3f7a4a" {...Thin} />
      <circle cx="70" cy="64" r="7" fill="#fff" {...Thin} /><circle cx="90" cy="64" r="7" fill="#fff" {...Thin} />
      <path d="M77 64 H83" {...Thin} fill="none" />
      <circle cx="70" cy="65" r="2.4" fill={INK} /><circle cx="90" cy="65" r="2.4" fill={INK} />
      <path d="M124 60 V100" {...S} stroke="#7a5230" strokeWidth={4} />
      <path d="M124 60 Q124 52 132 54" fill="none" {...S} stroke="#7a5230" strokeWidth={4} />
      <path d="M118 80 Q122 76 124 80" fill="none" {...Thin} />
      <path d="M36 102 q6 -4 12 0 M108 104 q6 -4 12 0" stroke="#e6f6ff" strokeWidth={2} fill="none" />
    </g>
  ),
  mill: () => (
    <g>
      <Shadow rx={30} />
      <g transform="rotate(12 118 30)">
        {[0, 90, 180, 270].map((r) => <rect key={r} x="116" y="4" width="5" height="26" fill="#d9c7a3" {...Thin} transform={`rotate(${r} 118 30)`} />)}
      </g>
      <rect x="48" y="44" width="64" height="58" rx="10" fill="#e8e1d3" {...S} />
      <path d="M52 56 h8 M96 60 h10 M60 90 h6" stroke="#c8bca6" strokeWidth={3} strokeLinecap="round" />
      <rect x="36" y="58" width="14" height="30" rx="6" fill="#d8cfbe" {...S} />
      <rect x="110" y="58" width="14" height="30" rx="6" fill="#d8cfbe" {...S} />
      <Eye x={70} y={64} r={5} lid={0.5} />
      <Eye x={90} y={64} r={5} lid={0.5} />
      <path d="M68 80 H92" {...S} fill="none" />
      <circle cx="44" cy="40" r="4" fill="#fff" opacity={0.8} /><circle cx="36" cy="32" r="3" fill="#fff" opacity={0.6} />
    </g>
  ),
  'sheep-hill': () => (
    <g>
      <Shadow rx={32} />
      <path d="M44 90 Q34 80 42 70 Q38 56 52 54 Q58 42 72 48 Q82 38 94 48 Q108 44 112 58 Q126 62 120 76 Q128 88 114 94 Q80 102 44 90Z" fill="#8a7a6a" {...S} />
      <path d="M52 86 Q44 78 52 70 Q50 60 62 60 Q68 52 78 58 Q88 50 96 58 Q108 58 106 70 Q114 78 106 86 Q80 94 52 86Z" fill="#fbf6ea" {...S} />
      <path d="M66 70 Q66 58 80 58 Q94 58 94 70 L90 84 Q80 90 70 84Z" fill="#8a7a6a" {...S} />
      <path d="M68 60 L64 46 L74 56Z M92 60 L96 46 L86 56Z" fill="#8a7a6a" {...Thin} />
      <Eye x={74} y={68} r={3.5} dx={1} />
      <Eye x={86} y={68} r={3.5} dx={1} />
      <path d="M76 80 L80 84 L84 80" fill="#fff" {...Thin} />
      <path d="M52 44 L56 34 L60 44Z M100 44 L104 34 L108 44Z" fill="#6f6255" {...Thin} />
    </g>
  ),
  'old-bridge': () => (
    <g>
      <path d="M0 58 H160 V66 H0Z" fill="#9b8a74" {...S} />
      <path d="M20 66 Q80 30 140 66" fill="none" stroke="#7d6e5b" strokeWidth={6} />
      <Shadow rx={30} />
      <path d="M50 104 Q46 74 64 70 L96 70 Q114 74 110 104Z" fill="#7da062" {...S} />
      <circle cx="80" cy="62" r="20" fill="#8fb572" {...S} />
      <path d="M62 54 L52 48 L60 60Z M98 54 L108 48 L100 60Z" fill="#8fb572" {...Thin} />
      <Eye x={73} y={60} r={4.5} lid={0.35} />
      <Eye x={87} y={60} r={4.5} lid={0.35} />
      <path d="M72 72 Q80 68 88 72" fill="none" {...S} />
      <path d="M76 71 V75 M84 71 V75" stroke="#fff" strokeWidth={2} />
      <path d="M78 76 L80 92 L82 76Z" fill="#c0392b" {...Thin} />
      <rect x="104" y="78" width="22" height="16" fill="#fffaf0" {...Thin} transform="rotate(-10 115 86)" />
      <circle cx="44" cy="84" r="7" fill="#c0392b" {...Thin} />
      <path d="M44 77 V70" {...S} />
    </g>
  ),
  // ── Лес ──
  'forest-edge': () => (
    <g>
      <Shadow rx={24} />
      <path d="M66 104 L70 74 H90 L94 104Z" fill="#5b4a3a" {...S} />
      <circle cx="80" cy="62" r="14" fill="#f0c9a0" {...S} />
      <path d="M58 56 Q80 30 102 56 Z" fill="#7a3b2e" {...S} />
      <path d="M52 57 H108" {...S} />
      <Eye x={74} y={62} r={3.2} dx={1.2} />
      <Eye x={86} y={62} r={3.2} dx={1.2} />
      <path d="M72 70 Q80 78 88 70" fill="#fff" {...Thin} />
      <path d="M100 82 h22 l-3 20 h-16Z" fill="#b98a4e" {...S} />
      <path d="M102 82 Q111 70 120 82" fill="none" {...S} />
      <path d="M106 80 q3 -8 6 0Z M112 80 q3 -8 6 0Z" fill="#d94b3b" {...Thin} />
    </g>
  ),
  'mushroom-thicket': () => (
    <g>
      <Shadow rx={30} />
      <path d="M68 104 Q66 80 70 70 H90 Q94 80 92 104Z" fill="#f3e9d2" {...S} />
      <path d="M40 72 Q42 34 80 32 Q118 34 120 72 Q80 80 40 72Z" fill="#d83a2e" {...S} />
      {[[58, 50, 5], [80, 42, 6], [102, 52, 5], [70, 64, 3.5], [94, 66, 3.5]].map(([x, y, r], i) => <circle key={i} cx={x} cy={y} r={r} fill="#fff" />)}
      <path d="M64 34 L68 20 L74 30 L80 16 L86 30 L92 20 L96 34Z" fill="#f2c14e" {...S} />
      <Eye x={74} y={84} r={3.5} lid={0.4} />
      <Eye x={86} y={84} r={3.5} lid={0.4} />
      <path d="M74 95 Q80 92 86 95" fill="none" {...Thin} />
    </g>
  ),
  'wolf-trail': () => (
    <g>
      <Shadow rx={30} />
      <path d="M50 104 Q48 78 80 76 Q112 78 110 104Z" fill="#6f7780" {...S} />
      <path d="M56 58 L50 30 L68 46Z M104 58 L110 30 L92 46Z" fill="#6f7780" {...S} />
      <path d="M54 62 Q56 40 80 40 Q104 40 106 62 Q104 74 92 78 L80 90 L68 78 Q56 74 54 62Z" fill="#8a929b" {...S} />
      <path d="M70 72 Q80 68 90 72 L80 90Z" fill="#e7e2d8" {...Thin} />
      <ellipse cx="80" cy="72" rx="5" ry="3.5" fill={INK} />
      <Eye x={70} y={58} r={4} dx={-1.5} dy={0.5} />
      <Eye x={90} y={58} r={4} dx={-1.5} dy={0.5} />
      <Brows x1={70} x2={90} y={51} mood={-1} />
      <rect x="64" y="94" width="32" height="10" rx="2" fill="#fff" {...Thin} />
      <text x="80" y="102" fontSize="7" textAnchor="middle" fontWeight="700" fill={INK}>СТАЖЁР</text>
    </g>
  ),
  'whisper-oak': () => (
    <g>
      <Shadow rx={30} />
      <path d="M62 104 Q66 70 64 50 H96 Q94 70 98 104Z" fill="#8a5a36" {...S} />
      <path d="M30 56 Q24 30 50 26 Q58 6 84 12 Q110 4 118 26 Q142 30 132 56 Q120 70 80 64 Q40 70 30 56Z" fill="#5e8f3e" {...S} />
      <Eye x={72} y={78} r={4.5} dx={2} />
      <Eye x={88} y={78} r={4.5} dx={2} />
      <path d="M76 92 Q80 90 84 92" fill="none" {...S} />
      <path d="M98 84 Q108 80 108 90 Q104 94 98 92" fill="#8a5a36" {...S} />
      <path d="M112 76 q14 -10 28 0 q2 10 -10 12 l-6 6 l0 -6 q-14 -2 -12 -12Z" fill="#fffaf0" {...Thin} />
      <circle cx="120" cy="80" r="1.5" fill={INK} /><circle cx="126" cy="80" r="1.5" fill={INK} /><circle cx="132" cy="80" r="1.5" fill={INK} />
    </g>
  ),
  'forest-heart': () => (
    <g>
      <Shadow rx={28} />
      <path d="M104 96 Q140 90 132 56 Q128 40 116 50 Q126 64 112 76Z" fill="#b5652d" {...S} />
      <path d="M58 104 Q50 70 80 62 Q110 70 102 104Z" fill="#c8773a" {...S} />
      <circle cx="80" cy="54" r="20" fill="#c8773a" {...S} />
      <path d="M64 40 L60 26 L72 36Z M96 40 L100 26 L88 36Z" fill="#c8773a" {...Thin} />
      <ellipse cx="80" cy="86" rx="12" ry="14" fill="#f1d3a8" {...Thin} />
      <Eye x={72} y={52} r={5} lid={0.3} pupil="#6a1b9a" />
      <Eye x={88} y={52} r={5} lid={0.3} pupil="#6a1b9a" />
      <path d="M77 64 L80 67 L83 64" fill="none" {...Thin} />
      <circle cx="80" cy="84" r="8" fill="#e3b04b" {...S} />
      <path d="M76 76 Q80 70 84 76" fill="#7a4a24" {...Thin} />
      <circle cx="80" cy="84" r="12" fill="#ffe08a" opacity={0.35} />
    </g>
  ),
  // ── Горы ──
  pass: () => (
    <g>
      <rect x="10" y="80" width="54" height="6" fill="#fff" {...Thin} />
      {[14, 26, 38, 50].map((x) => <rect key={x} x={x} y="80" width="6" height="6" fill="#d33" />)}
      <path d="M10 83 H6" {...S} />
      <Shadow x={100} rx={30} />
      <path d="M72 104 Q66 60 100 56 Q134 60 128 104Z" fill="#f4f1ea" {...S} />
      <circle cx="100" cy="50" r="18" fill="#f4f1ea" {...S} />
      <ellipse cx="100" cy="54" rx="11" ry="9" fill="#b9c3cc" {...Thin} />
      <path d="M82 38 Q100 26 118 38 L116 44 H84Z" fill="#2e4a6b" {...S} />
      <rect x="96" y="34" width="8" height="5" fill="#f2c14e" {...Thin} />
      <Eye x={95} y={52} r={3} lid={0.5} />
      <Eye x={105} y={52} r={3} lid={0.5} />
      <path d="M96 60 H104" {...Thin} />
      <path d="M72 76 L60 84" {...S} strokeWidth={5} stroke="#f4f1ea" />
      <path d="M72 76 L60 84" {...Thin} fill="none" />
    </g>
  ),
  mines: () => (
    <g>
      <path d="M20 100 Q24 50 60 44 Q70 30 90 34 Q130 40 140 100Z" fill="#4a3c33" opacity={0.6} />
      <Shadow rx={28} />
      <path d="M62 104 Q58 76 80 72 Q102 76 98 104Z" fill="#4c6a9a" {...S} />
      <circle cx="80" cy="60" r="15" fill="#f0c9a0" {...S} />
      <path d="M64 88 Q80 112 96 88 Q92 74 80 76 Q68 74 64 88Z" fill="#d9d2c4" {...S} />
      <path d="M64 54 Q64 40 80 40 Q96 40 96 54Z" fill="#f2c14e" {...S} />
      <circle cx="80" cy="46" r="4" fill="#fff8c4" {...Thin} />
      <path d="M84 42 L110 30 L110 50Z" fill="#fff8c4" opacity={0.5} />
      <Eye x={74} y={62} r={3} dx={-0.5} />
      <Eye x={86} y={62} r={3} dx={-0.5} />
      <Brows x1={74} x2={86} y={56} mood={1.3} w={6} />
      <path d="M112 104 V62" {...S} stroke="#7a5230" strokeWidth={3} />
      <rect x="96" y="44" width="36" height="20" fill="#fffaf0" {...S} />
      <text x="114" y="58" fontSize="9" textAnchor="middle" fontWeight="800" fill="#c0392b">НЕТ!</text>
    </g>
  ),
  'eagle-nest': () => (
    <g>
      <Shadow rx={32} />
      <path d="M44 100 Q40 70 70 66 L110 66 Q128 72 120 100Z" fill="#c9974a" {...S} />
      <path d="M52 72 Q20 50 22 30 Q44 40 60 66Z M108 70 Q140 48 140 28 Q118 40 100 64Z" fill="#8d5a2b" {...S} />
      <circle cx="80" cy="54" r="16" fill="#fbf6ea" {...S} />
      <path d="M78 60 L96 62 L80 70Z" fill="#f2b233" {...S} />
      <Eye x={74} y={50} r={3.8} dx={1.2} />
      <Eye x={86} y={50} r={3.8} dx={1.2} />
      <Brows x1={74} x2={86} y={44} mood={1.2} w={6} />
      <rect x="92" y="78" width="30" height="20" rx="2" fill="#3b2a1e" {...S} />
      <rect x="102" y="74" width="10" height="5" fill="none" {...Thin} />
      <path d="M40 80 h18 v14 h-18Z" fill="#fffaf0" {...Thin} transform="rotate(-8 49 87)" />
      <path d="M43 84 h12 M43 88 h9" stroke={INK} strokeWidth={1} transform="rotate(-8 49 87)" />
    </g>
  ),
  glacier: () => (
    <g>
      <path d="M58 20 Q60 8 76 12 Q86 2 98 12 Q112 10 110 22 Z" fill="#8795a3" {...Thin} />
      {[64, 76, 88, 100].map((x) => <path key={x} d={`M${x} 26 l-2 6`} stroke="#6fb4ff" strokeWidth={2} strokeLinecap="round" />)}
      <Shadow rx={26} />
      <path d="M80 34 L106 58 L96 100 L64 100 L54 58Z" fill="#bfe6ff" {...S} />
      <path d="M80 34 L84 58 L96 100 M54 58 L84 58 L106 58" fill="none" stroke="#fff" strokeWidth={2} opacity={0.8} />
      <Eye x={72} y={64} r={4} lid={0.55} />
      <Eye x={88} y={64} r={4} lid={0.55} />
      <Brows x1={72} x2={88} y={57} mood={1.4} w={7} />
      <path d="M70 82 Q80 74 90 82" fill="none" {...S} />
      <path d="M52 64 L36 54 M108 64 L124 72" {...S} stroke="#bfe6ff" strokeWidth={5} />
      <path d="M52 64 L36 54 M108 64 L124 72" {...Thin} fill="none" />
    </g>
  ),
  'thunder-peak': () => (
    <g>
      <Shadow rx={36} />
      <path d="M46 106 Q40 60 80 54 Q120 60 114 106Z" fill="#6d5aa5" {...S} />
      <circle cx="80" cy="42" r="22" fill="#d9a77a" {...S} />
      <path d="M58 34 Q60 14 80 16 Q100 14 102 34 Q94 26 80 28 Q66 26 58 34Z" fill="#5a3a24" {...S} />
      <Eye x={71} y={40} r={3.5} dx={0} />
      <Eye x={89} y={40} r={3.5} dx={0} />
      <ellipse cx="80" cy="54" rx="8" ry="6" fill="#7a1f1f" {...Thin} />
      <path d="M112 74 L124 50" {...S} strokeWidth={4} />
      <circle cx="126" cy="46" r="7" fill="#454545" {...S} />
      {[[130, 22], [142, 36], [22, 40]].map(([x, y], i) => (
        <g key={i} transform={`translate(${x} ${y})`}>
          <path d="M0 8 V-6 L8 -8 V6" fill="none" {...Thin} strokeWidth={2} />
          <circle cx="-2" cy="8" r="3" fill={INK} /><circle cx="6" cy="6" r="3" fill={INK} />
        </g>
      ))}
    </g>
  ),
  // ── Бездна ──
  'ash-land': () => (
    <g>
      <Shadow rx={26} />
      <path d="M80 18 Q98 36 96 54 Q110 44 108 30 Q126 56 112 84 Q100 104 80 104 Q60 104 48 84 Q34 56 52 30 Q50 44 64 54 Q62 36 80 18Z" fill="#ff8a3d" {...S} />
      <path d="M80 44 Q92 58 90 72 Q98 66 96 58 Q106 76 96 90 Q88 98 80 98 Q70 98 64 90 Q56 76 64 60 Q66 70 70 72 Q68 58 80 44Z" fill="#ffd166" />
      <Eye x={72} y={70} r={4} dx={1.5} />
      <Eye x={88} y={70} r={4} dx={1.5} />
      <path d="M70 82 Q80 90 90 82" fill="#fff" {...Thin} />
      <path d="M116 58 V104" {...S} stroke="#5a3a24" strokeWidth={3} />
      <rect x="112" y="46" width="44" height="22" fill="#fffaf0" {...S} />
      <text x="134" y="61" fontSize="8" textAnchor="middle" fontWeight="800" fill="#c0392b">ПРОДАЁТСЯ</text>
    </g>
  ),
  'black-pit': () => (
    <g>
      <ellipse cx="80" cy="100" rx="56" ry="12" fill="#07030b" {...S} />
      {[[44, 1], [62, -1], [98, 1], [116, -1]].map(([x, s], i) => (
        <path key={i} d={`M${x} 100 Q${x - 10 * s} 70 ${x + 6 * s} 52 Q${x + 14 * s} 44 ${x + 8 * s} 38`} fill="none" stroke="#5b2d73" strokeWidth={8} strokeLinecap="round" />
      ))}
      <path d="M52 100 Q60 60 80 56 Q100 60 108 100Z" fill="#3a1d4d" {...S} />
      {[[70, 70, 5], [90, 68, 6], [80, 82, 4], [64, 86, 3], [98, 86, 3.5], [80, 62, 3]].map(([x, y, r], i) => <Eye key={i} x={x} y={y} r={r} dx={i % 2 ? 1 : -1} fill="#fff4c2" />)}
      <text x="128" y="40" fontSize="26" fontWeight="900" fill="#f5d0ff" opacity={0.8}>?</text>
    </g>
  ),
  'bone-throne': () => (
    <g>
      <path d="M40 104 V40 Q40 28 52 30 L56 104Z M120 104 V40 Q120 28 108 30 L104 104Z" fill="#e6dcc4" {...S} />
      <Shadow rx={34} />
      <path d="M56 104 Q54 74 80 70 Q106 74 104 104Z" fill="#3a2a50" {...S} />
      <circle cx="80" cy="54" r="16" fill="#efe6d2" {...S} />
      <path d="M66 42 L68 30 L74 38 L80 26 L86 38 L92 30 L94 42Z" fill="#f2c14e" {...S} />
      <circle cx="74" cy="54" r="4" fill={INK} /><circle cx="86" cy="54" r="4" fill={INK} />
      <circle cx="74" cy="54" r="1.4" fill="#ff5a3d" /><circle cx="86" cy="54" r="1.4" fill="#ff5a3d" />
      <path d="M72 64 h16 M76 62 v4 M80 62 v4 M84 62 v4" {...Thin} fill="none" />
      <rect x="92" y="80" width="26" height="18" rx="2" fill="#8d5a2b" {...S} />
      {[0, 1, 2].map((r) => <path key={r} d={`M94 ${85 + r * 5} H116`} stroke="#fff" strokeWidth={0.8} />)}
      {[0, 1, 2].map((r) => <circle key={r} cx={98 + r * 6} cy={85 + r * 5} r={1.8} fill="#f2c14e" />)}
    </g>
  ),
  'boiling-lake': () => (
    <g>
      <path d="M28 76 Q30 108 80 108 Q130 108 132 76Z" fill="#b8b2a6" {...S} />
      <ellipse cx="80" cy="76" rx="52" ry="10" fill="#e07a3d" {...S} />
      {[[50, 1], [70, -1], [96, 1], [112, -1]].map(([x, s], i) => (
        <g key={i}>
          <path d={`M${x} 76 Q${x + 12 * s} 50 ${x} 36 Q${x - 6 * s} 30 ${x - 2 * s} 26`} fill="none" stroke="#b33b5e" strokeWidth={7} strokeLinecap="round" />
          {[0, 1, 2].map((k) => <circle key={k} cx={x + 3 * s + (k % 2) * 2 * s} cy={66 - k * 10} r={1.3} fill="#f7c2d2" />)}
        </g>
      ))}
      <path d="M126 70 L150 30" {...S} stroke="#c9c2b5" strokeWidth={6} />
      <ellipse cx="152" cy="26" rx="6" ry="4" fill="#c9c2b5" {...Thin} />
      {[60, 80, 100].map((x) => <path key={x} d={`M${x} 64 q4 -8 0 -16`} stroke="#fff" strokeWidth={2} fill="none" opacity={0.6} />)}
    </g>
  ),
  'abyss-eye': () => (
    <g>
      <ellipse cx="80" cy="60" rx="52" ry="34" fill="#fff4e6" {...S} />
      <circle cx="80" cy="62" r="20" fill="#c0392b" {...S} />
      <circle cx="80" cy="62" r="9" fill={INK} />
      <circle cx="74" cy="56" r="3" fill="#fff" />
      <path d="M28 60 Q80 10 132 60 L132 40 Q80 -8 28 40Z" fill="#7a3b6e" {...S} />
      <path d="M36 88 Q80 104 124 88" fill="none" stroke="#7a3b6e" strokeWidth={4} opacity={0.6} />
      <path d="M44 96 Q80 110 116 96" fill="none" stroke="#7a3b6e" strokeWidth={3} opacity={0.4} />
      {[36, 50, 110, 124].map((x, i) => <path key={i} d={`M${x} ${i % 3 ? 40 : 46} l-4 -10`} {...Thin} />)}
    </g>
  ),
};

/** Special (non-Land) cells. */
export const CELLS: Record<string, () => ReactElement> = {
  start: () => (
    <g>
      <path d="M40 104 V54 Q40 20 80 20 Q120 20 120 54 V104 H104 V56 Q104 36 80 36 Q56 36 56 56 V104Z" fill="#b08a55" {...S} />
      <path d="M56 104 V56 Q56 36 80 36 Q104 36 104 56 V104Z" fill="#ffe7a8" opacity={0.9} />
      {[46, 60, 74, 88, 102, 114].map((x, i) => <path key={i} d={`M${x} ${i === 0 || i === 5 ? 60 : 28} v4`} {...Thin} />)}
      <circle cx="80" cy="28" r="6" fill="#f2c14e" {...S} />
      <text x="80" y="82" fontSize="18" fontWeight="900" textAnchor="middle" fill="#8a5a1f">+100</text>
    </g>
  ),
  crossroad: () => (
    <g>
      <path d="M80 104 V30" {...S} stroke="#6b4a2e" strokeWidth={5} />
      <path d="M80 104 V30" {...Thin} fill="none" />
      <path d="M82 36 H122 L130 44 L122 52 H82Z" fill="#d9b98a" {...S} />
      <path d="M78 58 H38 L30 66 L38 74 H78Z" fill="#d9b98a" {...S} />
      <path d="M82 78 H116 L122 84 L116 90 H82Z" fill="#d9b98a" {...S} />
      <text x="104" y="47" fontSize="8" textAnchor="middle" fontWeight="700" fill={INK}>ТУДА</text>
      <text x="56" y="69" fontSize="8" textAnchor="middle" fontWeight="700" fill={INK}>ТОЖЕ</text>
      <text x="100" y="87" fontSize="7" textAnchor="middle" fontWeight="700" fill={INK}>ТУДА</text>
    </g>
  ),
};

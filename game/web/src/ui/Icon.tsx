// Small line icons (24×24, currentColor) used instead of emoji so the UI looks the same on every OS.
const PATHS: Record<string, string> = {
  heart: 'M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z',
  flag: 'M6 21V4 M6 4h11l-2 4 2 4H6',
  cards: 'M8 4h9a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z M4 7v11a2 2 0 0 0 2 2',
  crown: 'M4 17l-1-9 5 4 4-7 4 7 5-4-1 9z M4 20h16',
  dice: 'M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z M9 9h.01 M15 15h.01 M12 12h.01',
  gear: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M19 12l2-1-1-3-2 .3-1.4-1.4.3-2-3-1-1 2h-2l-1-2-3 1 .3 2L5 7.3 3 7l-1 3 2 1v2l-2 1 1 3 2-.3 1.4 1.4-.3 2 3 1 1-2h2l1 2 3-1-.3-2 1.4-1.4 2 .3 1-3-2-1z',
  scroll: 'M7 4h11a2 2 0 0 1 2 2v1h-4 M16 7v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-1h10 M7 4a2 2 0 0 0-2 2v11 M9 9h5 M9 13h5',
  skull: 'M12 3a7 7 0 0 0-7 7c0 2.4 1.2 4 3 5v3h8v-3c1.8-1 3-2.6 3-5a7 7 0 0 0-7-7z M9 11h.01 M15 11h.01 M10 18v2 M14 18v2',
  shield: 'M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z',
  chain: 'M10 14a4 4 0 0 1 0-5.6l2-2a4 4 0 0 1 5.6 5.6l-1 1 M14 10a4 4 0 0 1 0 5.6l-2 2a4 4 0 0 1-5.6-5.6l1-1',
  back: 'M15 5l-7 7 7 7',
  copy: 'M9 9h10v10H9z M5 15V5h10',
  eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  sword: 'M14 4h6v6L9 21l-3-3z M5 14l5 5 M4 20l2-2',
  run: 'M13 5a1.5 1.5 0 1 0 0-.01 M10 21l2-6-3-3 2-4 4 3h3 M8 9l-3 2 M12 15l3 2v4',
  check: 'M5 12l5 5L20 7',
  close: 'M6 6l12 12 M18 6L6 18',
  bot: 'M5 9h14v9a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1z M12 5v4 M9 13h.01 M15 13h.01 M9 16h6',
  hand: 'M8 13V6a1.5 1.5 0 0 1 3 0v5 M11 11V4.5a1.5 1.5 0 0 1 3 0V11 M14 11V6a1.5 1.5 0 0 1 3 0v7c0 4-3 7-6 7-2.5 0-4-1.5-5.5-3.5L4 14a1.5 1.5 0 0 1 2.5-1.6L8 14',
  swap: 'M4 8h13l-3-3 M20 16H7l3 3',
  info: 'M12 8h.01 M11 12h1v5h1 M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z',
  play: 'M7 5l12 7-12 7z',
  book: 'M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z M4 19V5 M8 7h7',
  chart: 'M4 20V4 M4 20h16 M8 16v-5 M12 16V8 M16 16v-3',
  users: 'M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M3 20a6 6 0 0 1 12 0 M16 11a3 3 0 1 0 0-6 M21 20a6 6 0 0 0-4-5.6',
  upload: 'M12 16V4 M7 9l5-5 5 5 M5 20h14',
};

export function Icon({ name, size = 18, className = '', title, filled = false }: { name: keyof typeof PATHS | string; size?: number; className?: string; title?: string; filled?: boolean }) {
  return (
    <svg className={`icon ${className}`} width={size} height={size} viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden={title ? undefined : true} role={title ? 'img' : undefined}>
      {title && <title>{title}</title>}
      <path d={PATHS[name] ?? ''} />
    </svg>
  );
}

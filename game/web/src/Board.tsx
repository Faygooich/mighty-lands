// The printed game board: 24 tiles around a 7×7 grid, pawns on top, the table centre inside.
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { GameState } from '../../core/types.ts';
import { cardName } from '../../cards/catalog.ts';
import { landFlavor } from '../../cards/flavor.ts';
import { COLORS, REGION_NAMES, cardText } from './labels.ts';
import { Art } from './art/index.tsx';
import { reducedMotion, useWidth } from './ui/hooks.ts';
import { Icon } from './ui/Icon.tsx';

/** 24 cells on the perimeter of a 7×7 grid, clockwise from the top-left corner. */
export function cellPos(i: number): [number, number] {
  if (i <= 6) return [0, i];
  if (i <= 12) return [i - 6, 6];
  if (i <= 18) return [6, 6 - (i - 12)];
  return [6 - (i - 18), 0];
}

export const STEP_MS = 170;

export type CellMark = { kind: 'target'; label?: string } | { kind: 'reach'; step: number };
export type CellFx = 'capture' | 'lost' | 'hit' | 'place' | 'trigger' | 'escape';

interface Props {
  g: GameState;
  marks: Map<number, CellMark>;
  fx: Map<string, CellFx>;
  onCell?: (cell: number) => void;
  /** Rendered in the middle of the board (dice tray, decks, stage…). */
  children?: React.ReactNode;
  onSize?: (w: number) => void;
}

export function Board({ g, marks, fx, onCell, children, onSize }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const w = useWidth(ref);
  useLayoutEffect(() => { onSize?.(w); }, [w, onSize]);
  const tile = w / 7;
  const size = tile >= 100 ? 'lg' : tile >= 74 ? 'md' : tile >= 56 ? 'sm' : 'xs';
  const target = g.rules.win.landsTargetBy?.[String(g.players.length)] ?? g.rules.win.landsTarget;
  return (
    <div ref={ref} className={`board size-${size}`} style={{ ['--tile' as string]: `${tile.toFixed(1)}px` }} aria-label="Игровое поле">
      {g.cells.map((c) => {
        const [r, col] = cellPos(c.index);
        const l = c.land;
        const owner = l && l.owner >= 0 ? g.players[l.owner] : null;
        const mark = marks.get(c.index);
        const f = fx.get(String(c.index));
        const corner = c.type !== 'land';
        const fl = l ? landFlavor(l.name) : undefined;
        const title = l
          ? `${l.name} · ${REGION_NAMES[l.region]}\n${owner ? `Владелец: ${owner.name}` : `${fl?.monster ?? 'Монстр'}: мощь ${l.monster}, награда ${l.reward}`}${l.artifact ? `\nАртефакт «${cardName(l.artifact)}»: ${cardText(g, l.artifact)}` : ''}`
          : c.type === 'start' ? 'Врата: прошли или встали — жетон 100' : 'Перекрёсток: ничего не происходит';
        const style = { gridRow: r + 1, gridColumn: col + 1, ['--owner' as string]: owner ? COLORS[owner.id] : undefined } as React.CSSProperties;
        return (
          <button
            key={c.index}
            type="button"
            className={[
              'tile', corner ? `corner ${c.type}` : `r${l!.region}`, owner ? 'owned' : l ? 'wild' : '',
              mark ? `mark-${mark.kind}` : '', f ? `fx-${f}` : '', l && l.monster >= 2500 && !owner ? 'boss' : '',
            ].join(' ')}
            style={style}
            onClick={() => onCell?.(c.index)}
            title={title}
            aria-label={title}
          >
            <span className="tile-art">
              <Art of={l ? { kind: 'land', name: l.name, region: l.region } : { kind: 'cell', type: c.type }} />
            </span>
            {l ? (
              <>
                <span className="tile-name">{l.name}</span>
                {owner ? (
                  <span className="tile-flag"><Icon name="flag" size={12} /> <span>{owner.name}</span></span>
                ) : (
                  <span className="tile-stats">
                    <span className="tile-monster" title="Мощь монстра">{l.monster}</span>
                    {size !== 'xs' && <span className="tile-reward" title="Награда за победу">+{l.reward}</span>}
                  </span>
                )}
                {l.artifact && <span className={`tile-artifact a-${l.artifact}`} title={`Артефакт «${cardName(l.artifact)}»`}>{cardName(l.artifact).slice(0, 1)}</span>}
              </>
            ) : (
              <span className="tile-name corner-name">{c.type === 'start' ? 'Врата' : 'Перекрёсток'}</span>
            )}
            {mark?.kind === 'reach' && <span className="reach-num">{mark.step}</span>}
            {mark?.kind === 'target' && <span className="target-ring" aria-hidden />}
          </button>
        );
      })}
      <PawnLayer g={g} />
      <div className="board-center">
        <div className="board-print" aria-hidden>
          <span className="bp-title">МОЩНЫЕ ЗЕМЛИ</span>
          <span className="bp-sub">Цель — {target} Земель</span>
        </div>
        {children}
      </div>
    </div>
  );
}

/** Pawns walk cell by cell along the track (teleports and respawns jump). */
function PawnLayer({ g }: { g: GameState }) {
  const n = g.cells.length;
  const targets = g.players.map((p) => p.pos);
  const [shown, setShown] = useState<number[]>(targets);
  const key = targets.join(',');
  useEffect(() => {
    if (reducedMotion()) { setShown(targets); return; }
    let cur = shown.length === targets.length ? shown : targets;
    const step = () => {
      let moving = false;
      cur = cur.map((s, i) => {
        const t = targets[i];
        if (s === t) return s;
        const d = (t - s + n) % n;
        if (d > 6) return t; // teleport / exile / respawn: jump
        moving = true;
        return (s + 1) % n;
      });
      setShown(cur);
      return moving;
    };
    if (!step()) return;
    const id = setInterval(() => { if (!step()) clearInterval(id); }, STEP_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const byCell = new Map<number, number[]>();
  g.players.forEach((p, i) => { if (!p.alive) return; const c = shown[i] ?? p.pos; byCell.set(c, [...(byCell.get(c) ?? []), i]); });
  return (
    <div className="pawn-layer" aria-hidden>
      {g.players.map((p, i) => {
        if (!p.alive) return null;
        const c = shown[i] ?? p.pos;
        const [r, col] = cellPos(c);
        const group = byCell.get(c) ?? [i];
        const k = group.indexOf(i);
        const m = group.length;
        const ang = m > 1 ? (k / m) * Math.PI * 2 - Math.PI / 2 : 0;
        const rad = m > 1 ? 0.2 : 0;
        const left = ((col + 0.5 + Math.cos(ang) * rad) / 7) * 100;
        const top = ((r + 0.4 + Math.sin(ang) * rad * 0.7) / 7) * 100;
        const active = g.current === i && !g.over;
        return (
          <span key={p.id} className={`pawn ${active ? 'active' : ''}`} style={{ left: `${left}%`, top: `${top}%`, ['--pc' as string]: COLORS[p.id], zIndex: active ? 5 : 2 + k }}>
            <span key={c} className="pawn-hop">
              <svg viewBox="0 0 24 30">
                <path d="M12 2a5 5 0 0 1 3.2 8.8c2.6 1.2 4.3 3.8 4.8 7.2l1 8a2 2 0 0 1-2 2.2H5a2 2 0 0 1-2-2.2l1-8c.5-3.4 2.2-6 4.8-7.2A5 5 0 0 1 12 2z" />
                <ellipse cx="9.5" cy="6" rx="1.6" ry="1.2" className="pawn-shine" />
              </svg>
            </span>
          </span>
        );
      })}
    </div>
  );
}

import type { GameState } from '../../core/types.ts';
import { cardName } from '../../cards/catalog.ts';
import { COLORS, REGION_COLORS } from './labels.ts';
import { CELL_FLAVOR, landFlavor } from '../../cards/flavor.ts';

/** 24 cells on the perimeter of a 7×7 grid, clockwise from the top-left corner. */
export function cellPos(i: number): [number, number] {
  if (i <= 6) return [0, i];
  if (i <= 12) return [i - 6, 6];
  if (i <= 18) return [6, 6 - (i - 12)];
  return [6 - (i - 18), 0];
}

interface Props {
  g: GameState;
  highlight: Set<number>;
  onCell?: (cell: number) => void;
  children?: React.ReactNode;
}

export function Board({ g, highlight, onCell, children }: Props) {
  return (
    <div className="board">
      {g.cells.map((c) => {
        const [r, col] = cellPos(c.index);
        const l = c.land;
        const pawns = g.players.filter((p) => p.pos === c.index);
        const owner = l && l.owner >= 0 ? g.players[l.owner] : null;
        const style: React.CSSProperties = {
          gridRow: r + 1,
          gridColumn: col + 1,
          borderColor: owner ? COLORS[owner.id] : undefined,
          background: l ? `linear-gradient(160deg, ${REGION_COLORS[l.region]}55, var(--cell))` : undefined,
        };
        return (
          <button
            key={c.index}
            className={`cell ${c.type} ${highlight.has(c.index) ? 'hl' : ''} ${owner ? 'owned' : ''}`}
            style={style}
            onClick={() => onCell?.(c.index)}
            title={l ? `${l.name} — ${landFlavor(l.name)?.landText ?? ''}
${landFlavor(l.name)?.monster ?? 'Монстр'} (${l.monster}): ${landFlavor(l.name)?.monsterText ?? ''}` : CELL_FLAVOR[c.type] ?? ''}
          >
            {c.type === 'start' && <div className="cell-name big">ВРАТА<br /><small>+100</small></div>}
            {c.type === 'crossroad' && <div className="cell-name">Перекрёсток</div>}
            {l && (
              <>
                <div className="cell-name">{l.name}</div>
                {owner ? (
                  <div className="flag" style={{ background: COLORS[owner.id] }}>🚩 {owner.name}</div>
                ) : (
                  <div className={`monster ${l.monster >= 4000 ? 'boss' : ''}`}>👹 {l.monster}</div>
                )}
                {!owner && landFlavor(l.name) && (
                  <div className="mname">{landFlavor(l.name)!.monster}</div>
                )}
                {!owner && <div className="reward">🏆 {l.reward}</div>}
                {l.artifact && <div className="artifact">🔮 {cardName(l.artifact)}</div>}
              </>
            )}
            <div className="pawns">
              {pawns.map((p) => (
                <span key={p.id} className="pawn" style={{ background: COLORS[p.id], outline: g.current === p.id ? '2px solid white' : undefined }} title={p.name} />
              ))}
            </div>
          </button>
        );
      })}
      <div className="board-center">{children}</div>
    </div>
  );
}

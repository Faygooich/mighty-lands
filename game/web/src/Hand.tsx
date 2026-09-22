// The hand: a fan of cards on wide screens, a scrollable row on narrow ones.
import { useLayoutEffect, useRef, useState } from 'react';
import type { GameState } from '../../core/types.ts';
import { GameCard, CardBack, type CardState } from './ui/GameCard.tsx';
import { multisetDiff, reducedMotion } from './ui/hooks.ts';

export interface HandCard { id: string; state: CardState; onClick?: () => void }

export function Hand({ g, owner, cards, hidden, count }: { g: GameState; owner: number; cards: HandCard[]; hidden?: boolean; count: number }) {
  const ids = cards.map((c) => c.id);
  const prev = useRef<{ owner: number; ids: string[] }>({ owner, ids });
  const [fresh, setFresh] = useState<string[]>([]);
  const key = `${owner}:${ids.join(',')}`;
  useLayoutEffect(() => {
    const same = prev.current.owner === owner;
    const { added } = multisetDiff(same ? prev.current.ids : ids, ids);
    prev.current = { owner, ids };
    if (!added.length || reducedMotion()) return;
    setFresh(added);
    const t = setTimeout(() => setFresh([]), 2600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  if (hidden) {
    return (
      <div className="hand hidden-hand" aria-label={`Карт на руке: ${count}`}>
        {Array.from({ length: count }, (_, i) => <CardBack key={i} deck={i % 2 ? 'spell' : 'artifact'} size="hand" />)}
        {count === 0 && <div className="hand-empty">Рука пуста</div>}
      </div>
    );
  }
  if (!cards.length) return <div className="hand"><div className="hand-empty">Рука пуста. Голыми руками тоже можно — карты придут в начале хода</div></div>;
  const n = cards.length;
  const left = [...fresh];
  return (
    <div className="hand" style={{ ['--n' as string]: n }} role="list" aria-label="Ваша рука">
      {cards.map((c, i) => {
        const k = left.indexOf(c.id);
        const isNew = k >= 0;
        if (isNew) left.splice(k, 1);
        const off = i - (n - 1) / 2;
        const style = { ['--rot' as string]: `${off * 4}deg`, ['--drop' as string]: `${Math.abs(off) * Math.abs(off) * 3}px`, ['--i' as string]: i } as React.CSSProperties;
        return (
          <div key={`${c.id}-${i}`} className="hand-slot" style={style} role="listitem">
            <GameCard g={g} id={c.id} size="hand" state={{ ...c.state, isNew }} onClick={c.onClick} />
          </div>
        );
      })}
    </div>
  );
}

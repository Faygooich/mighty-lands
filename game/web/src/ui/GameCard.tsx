// A physical card: name, illustration, type line, rules text (and flavour on large cards).
import type { GameState } from '../../../core/types.ts';
import { cardName } from '../../../cards/catalog.ts';
import { Art } from '../art/index.tsx';
import { cardBadge, cardFlavor, cardFrame, cardText, cardTypeLine } from '../labels.ts';
import { Icon } from './Icon.tsx';

export type CardSize = 'mini' | 'hand' | 'lg';

export interface CardState {
  selected?: boolean;
  /** Why the card cannot be played right now (shown on the card). */
  disabled?: string | null;
  playable?: boolean;
  isNew?: boolean;
  mode?: 'discard' | 'react' | null;
}

export function GameCard({ g, id, size = 'hand', state = {}, onClick, style, className = '' }: {
  g: GameState; id: string; size?: CardSize; state?: CardState; onClick?: () => void; style?: React.CSSProperties; className?: string;
}) {
  const frame = cardFrame(id);
  const badge = cardBadge(g, id);
  const cls = [
    'gcard', `gc-${size}`, `f-${frame}`, className,
    state.selected ? 'is-selected' : '', state.disabled ? 'is-disabled' : '', state.playable ? 'is-playable' : '',
    state.isNew ? 'is-new' : '', state.mode ? `mode-${state.mode}` : '',
  ].join(' ');
  const body = (
    <>
      <span className="gc-head">
        <span className="gc-name">{cardName(id)}</span>
        {badge && <span className="gc-badge">{badge}</span>}
      </span>
      <span className="gc-art"><Art of={{ kind: 'card', id }} /></span>
      <span className="gc-type">{cardTypeLine(id)}</span>
      {size !== 'mini' && <span className="gc-text">{cardText(g, id)}</span>}
      {size === 'lg' && <span className="gc-flavor">«{cardFlavor(id)}»</span>}
      {state.isNew && <span className="gc-ribbon">новая</span>}
      {state.disabled && size !== 'mini' && <span className="gc-lock"><Icon name="info" size={13} /> {state.disabled}</span>}
      {state.mode === 'discard' && <span className="gc-action bad">Сбросить</span>}
    </>
  );
  const title = `${cardName(id)} — ${cardTypeLine(id)}\n${cardText(g, id)}${state.disabled ? `\n\nСейчас нельзя: ${state.disabled}` : ''}`;
  if (onClick) {
    return <button type="button" className={cls} style={style} onClick={onClick} title={title} aria-pressed={state.selected || undefined}>{body}</button>;
  }
  return <div className={cls} style={style} title={title}>{body}</div>;
}

export function CardBack({ deck, size = 'mini', count }: { deck: 'artifact' | 'spell'; size?: CardSize; count?: number }) {
  return (
    <span className={`gcard gc-${size} card-back back-${deck}`}>
      <span className="gc-art"><Art of={{ kind: 'back', deck }} /></span>
      {count !== undefined && <span className="deck-count">{count}</span>}
    </span>
  );
}

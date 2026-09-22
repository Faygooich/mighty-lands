// A player's zone on the table: identity, power, tokens (= lives), Lands and hand size.
import type { GameState, PlayerState } from '../../core/types.ts';
import { cardName } from '../../cards/catalog.ts';
import { landsOf, power } from '../../core/state.ts';
import { BOT_NAMES, COLORS, rankLine, rankTitle } from './labels.ts';
import { Icon } from './ui/Icon.tsx';
import { Lives, PowerValue, TokenRow } from './ui/Tokens.tsx';

export function PawnBadge({ id, size = 22 }: { id: number; size?: number }) {
  return (
    <span className="pawn-badge" style={{ ['--pc' as string]: COLORS[id], width: size, height: size * 1.25 }} aria-hidden>
      <svg viewBox="0 0 24 30"><path d="M12 2a5 5 0 0 1 3.2 8.8c2.6 1.2 4.3 3.8 4.8 7.2l1 8a2 2 0 0 1-2 2.2H5a2 2 0 0 1-2-2.2l1-8c.5-3.4 2.2-6 4.8-7.2A5 5 0 0 1 12 2z" /></svg>
    </span>
  );
}

interface MatProps {
  g: GameState;
  p: PlayerState;
  kind: string;
  compact?: boolean;
  /** Seat currently acting (turn owner) and seat asked to decide right now. */
  active: boolean;
  deciding: boolean;
  showHand?: boolean;
  target?: { label: string; onPick: () => void } | null;
  onInfo?: () => void;
}

/** Opponent mat (secondary information, always visible in the rail). */
export function OpponentMat({ g, p, kind, compact, active, deciding, showHand, target }: MatProps) {
  const lands = landsOf(g, p.id).length;
  const goal = g.rules.win.landsTargetBy?.[String(g.players.length)] ?? g.rules.win.landsTarget;
  const cls = ['mat', 'opp', compact ? 'compact' : '', active ? 'is-active' : '', deciding && !active ? 'is-deciding' : '', !p.alive ? 'is-out' : '', target ? 'is-target' : ''].join(' ');
  const inner = (
    <>
      <span className="mat-stripe" />
      <span className="mat-id">
        <PawnBadge id={p.id} size={compact ? 16 : 20} />
        <span className="mat-name">{p.name}</span>
        {kind !== 'human' && <span className="mat-bot" title={`Бот: ${BOT_NAMES[kind] ?? kind}`}><Icon name="bot" size={13} />{!compact && (BOT_NAMES[kind] ?? kind)}</span>}
        {active && <span className="turn-tag">ходит</span>}
        {deciding && !active && <span className="turn-tag alt">решает</span>}
      </span>
      <span className="mat-power" title={rankLine(power(p))}>
        <span className="mat-label">{compact ? 'МОЩЬ' : rankTitle(power(p))}</span>
        <PowerValue value={power(p)} />
      </span>
      <span className="mat-tokens"><TokenRow tokens={p.tokens} slots={g.rules.maxSlots} size={compact ? 'xs' : 'sm'} /></span>
      <span className="mat-stats">
        <span title="Земли / цель"><Icon name="flag" size={14} /> <b>{lands}</b>/{goal}</span>
        <span title="Карт на руке"><Icon name="cards" size={14} /> <b>{p.hand.length}</b></span>
        {p.skip > 0 && <span className="status bad" title="Пропустит ход"><Icon name="chain" size={14} /> пропуск</span>}
        {p.shield > 0 && <span className="status good" title={cardName('ward')}><Icon name="shield" size={14} /></span>}
        {!p.alive && <span className="status bad"><Icon name="skull" size={14} /> пал</span>}
      </span>
      {showHand && p.hand.length > 0 && <span className="mat-peek">{p.hand.map((c) => cardName(c)).join(' · ')}</span>}
      {target && <span className="mat-target-cta">{target.label}</span>}
    </>
  );
  if (target) return <button type="button" className={cls} style={{ ['--pc' as string]: COLORS[p.id] }} onClick={target.onPick}>{inner}</button>;
  return <div className={cls} style={{ ['--pc' as string]: COLORS[p.id] }}>{inner}</div>;
}

/** The viewer's own mat in the dock: big numbers, always visible (primary information). */
export function MyMat({ g, p, kind, active, deciding, hidden }: MatProps & { hidden?: boolean }) {
  const lands = landsOf(g, p.id).length;
  const goal = g.rules.win.landsTargetBy?.[String(g.players.length)] ?? g.rules.win.landsTarget;
  return (
    <div className={`mat mine ${active ? 'is-active' : ''} ${deciding ? 'is-deciding' : ''}`} style={{ ['--pc' as string]: COLORS[p.id] }}>
      <span className="mat-stripe" />
      <div className="mine-id">
        <PawnBadge id={p.id} size={26} />
        <div>
          <div className="mat-name big">{p.name}{kind !== 'human' && <span className="mat-bot"> <Icon name="bot" size={13} />{BOT_NAMES[kind] ?? kind}</span>}</div>
          <div className="mine-sub">{hidden ? 'карты скрыты' : active ? (deciding ? 'ваш ход' : 'ходит') : deciding ? 'нужно решение' : 'ждёт хода'}</div>
        </div>
      </div>
      <div className="mine-power" title={rankLine(power(p))}>
        <span className="mat-label">МОЩЬ · {rankTitle(power(p))}</span>
        <PowerValue value={power(p)} className="huge" />
      </div>
      <div className="mine-tokens">
        <TokenRow tokens={p.tokens} slots={g.rules.maxSlots} size="md" />
        <Lives n={p.tokens.length} max={g.rules.maxSlots} />
      </div>
      <div className="mine-stats">
        <span className="lands-meter" title={`Земли: ${lands} из ${goal} для победы`}>
          <Icon name="flag" size={15} />
          <span className="lm-track">{Array.from({ length: goal }, (_, i) => <span key={i} className={i < lands ? 'on' : ''} />)}</span>
          <b>{lands}/{goal}</b>
        </span>
        {p.skip > 0 && <span className="status bad"><Icon name="chain" size={14} /> пропустит ход</span>}
        {p.shield > 0 && <span className="status good"><Icon name="shield" size={14} /> {cardName('ward')}</span>}
        {p.tempPower > 0 && <span className="status good">+{p.tempPower} до конца хода</span>}
      </div>
    </div>
  );
}

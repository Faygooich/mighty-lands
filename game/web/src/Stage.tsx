// The stage: whatever the table is waiting for right now, shown as game objects —
// a fight between a pawn and a monster card, tokens to hand over, a big card being played…
import type { Decision, GameState, Option } from '../../core/types.ts';
import { cardName } from '../../cards/catalog.ts';
import { landFlavor } from '../../cards/flavor.ts';
import { effPower, landsOf, power } from '../../core/state.ts';
import { COLORS, END_REASON, cardText, d6Chance, optionLabel, rankLine, rankTitle } from './labels.ts';
import { Art } from './art/index.tsx';
import { GameCard } from './ui/GameCard.tsx';
import { Icon } from './ui/Icon.tsx';
import { Chip } from './ui/Tokens.tsx';
import { PawnBadge } from './PlayerMat.tsx';
import { cardOptions, optionTarget, targetKind } from './play.ts';

export interface StageProps {
  g: GameState;
  d: Decision | null;
  /** The pending decision belongs to the person looking at the screen. */
  mine: boolean;
  busy: boolean;
  curtainFor: number | null;
  /** The turn owner is the person looking at the screen. */
  viewerTurn?: boolean;
  onReveal: () => void;
  selected: string | null;
  onCancelSelect: () => void;
  choose: (i: number) => void;
  onPreview: (cells: number[] | null) => void;
  onExit: () => void;
  /** Label of the button after the game (network: the host sends everybody back to the lobby). */
  exitLabel?: string;
  onCopy: () => void;
  canCopy?: boolean;
  goal: number;
  names: string[];
}

function Btn({ kind = 'secondary', icon, children, sub, onClick, onHover, disabled }: {
  kind?: 'primary' | 'secondary' | 'danger' | 'ghost'; icon?: string; children: React.ReactNode; sub?: React.ReactNode;
  onClick?: () => void; onHover?: (on: boolean) => void; disabled?: boolean;
}) {
  return (
    <button type="button" className={`plaque ${kind} ${sub ? 'has-sub' : ''}`} onClick={onClick} disabled={disabled}
      onMouseEnter={() => onHover?.(true)} onMouseLeave={() => onHover?.(false)} onFocus={() => onHover?.(true)} onBlur={() => onHover?.(false)}>
      <span className="plaque-main">{icon && <Icon name={icon} size={18} />}{children}</span>
      {sub && <span className="plaque-sub">{sub}</span>}
    </button>
  );
}

/** Parses «МОЩЬ 900 (400 + Мужское Плечо 500)» from the engine's reason text (falls back to plain numbers). */
function fightNumbers(reason: string, you: number, monster: number) {
  const p = /ваша МОЩЬ (\d+)(?: \(([^)]*)\))?/i.exec(reason);
  const m = /МОЩИ монстра (\d+)(?: \(([^)]*)\))?/i.exec(reason);
  return { you: p ? Number(p[1]) : you, youNote: p?.[2] ?? '', monster: m ? Number(m[1]) : monster, monsterNote: m?.[2] ?? '' };
}

export function Stage(props: StageProps) {
  const { g, d, mine, busy, curtainFor } = props;
  if (g.over) return <Victory {...props} />;
  if (curtainFor !== null) return <Curtain g={g} d={d} id={curtainFor} onReveal={props.onReveal} />;
  if (!d) return null;
  const who = g.players[d.player];
  if (busy) {
    return (
      <div className="stage stage-wait" aria-live="polite">
        <StageHead g={g} id={g.current} text="Герой шагает по полю. Земля дрожит…" />
      </div>
    );
  }
  if (d.kind === 'encounter' || d.kind === 'capture' || d.kind === 'react') return <Battle {...props} />;
  if (!mine) {
    return (
      <div className="stage stage-wait" aria-live="polite">
        <StageHead g={g} id={d.player} text={thinkingText(d)} />
        <div className="thinking"><span /><span /><span /></div>
      </div>
    );
  }
  if (d.kind === 'main') return <MainPhase {...props} />;
  if (d.kind === 'lose' || d.kind === 'pay') return <TokenChoice {...props} />;
  if (d.kind === 'discard') return <Discard {...props} />;
  if (d.kind === 'dilemma') return <Dilemma {...props} />;
  if (d.kind === 'trigger') return <Trigger {...props} />;
  return (
    <div className="stage">
      <StageHead g={g} id={who.id} text={d.reason} />
      <div className="stage-actions">
        {d.options.map((o, i) => <Btn key={i} onClick={() => props.choose(i)}>{optionLabel(g, d, o)}</Btn>)}
      </div>
    </div>
  );
}

function thinkingText(d: Decision): string {
  switch (d.kind) {
    case 'main': return 'сурово обдумывает ход';
    case 'lose': return 'выбирает, с каким жетоном проститься';
    case 'pay': return 'выбирает, каким жетоном заплатить';
    case 'discard': return 'сбрасывает лишнюю карту — рука не резиновая';
    case 'dilemma': return d.reason.startsWith(cardName('tailwind')) ? 'выбирает бросок' : d.reason.startsWith(cardName('altar')) ? 'выбирает, чем пожертвовать Богу Железа' : 'выбирает у Богатырской Заставы';
    case 'trigger': return 'решает, сыграть ли карту-ответ';
    default: return 'думает (это видно по бровям)';
  }
}

function StageHead({ g, id, text, big }: { g: GameState; id: number; text: string; big?: string }) {
  const p = g.players[id];
  return (
    <div className="stage-head" style={{ ['--pc' as string]: COLORS[id] }}>
      <PawnBadge id={id} size={22} />
      <div>
        <div className="sh-name">{big ?? p.name}</div>
        <div className="sh-text">{text}</div>
      </div>
    </div>
  );
}

// ---- Main phase: play cards or roll ----------------------------------------------

function MainPhase({ g, d, selected, onCancelSelect, choose, onPreview }: StageProps) {
  const p = g.players[d!.player];
  const pre = g.phase === 'pre';
  const doneIdx = d!.options.findIndex((o) => o.t === 'done');
  const cardOpts = new Set(d!.options.filter((o) => o.t === 'spell' || o.t === 'artifact').map((o) => (o as { card: string }).card));
  const extra = d!.options.map((o, i) => [i, o] as [number, Option]).filter(([, o]) => o.t === 'exchange');
  const next = nextPlayerName(g);
  const tele = p.teleportTo >= 0 ? g.cells[p.teleportTo] : null;

  if (selected) {
    const opts = cardOptions(d, selected);
    const kind = opts.length ? targetKind(opts[0][1]) : 'none';
    return (
      <div className="stage stage-select">
        <div className="select-row">
          <GameCard g={g} id={selected} size="lg" state={{ selected: true }} />
          <div className="select-side">
            <div className="stage-title">{cardName(selected)}</div>
            <p className="stage-text">{cardText(g, selected)}</p>
            <div className="stage-ask">
              {kind === 'cell' && 'Выберите цель — подсвеченную клетку на поле или в списке:'}
              {kind === 'player' && 'Выберите соперника — нажмите на его зону или на имя:'}
              {kind === 'variant' && 'Выберите вариант размена:'}
              {kind === 'none' && 'Сыграть карту сейчас? Подвиг ждёт.'}
            </div>
            <div className={`target-list ${opts.length > 8 ? 'dense' : ''}`}>
              {opts.map(([i, o]) => {
                const t = optionTarget(o);
                const label = kind === 'none' ? 'Сыграть' : kind === 'player' ? g.players[t].name : kind === 'variant' ? optionLabel(g, d!, o).replace(/^.*→ /, '') : targetName(g, t, d!.player);
                return (
                  <Btn key={i} kind={kind === 'none' ? 'primary' : 'secondary'} icon={kind === 'none' ? 'play' : undefined}
                    onClick={() => choose(i)} onHover={(on) => onPreview(on && kind === 'cell' ? [t] : null)}>
                    {label}
                  </Btn>
                );
              })}
            </div>
            <Btn kind="ghost" icon="close" onClick={onCancelSelect}>Отмена</Btn>
          </div>
        </div>
      </div>
    );
  }

  const reach = () => {
    if (tele) return [tele.index];
    const n = g.cells.length;
    return [1, 2, 3, 4, 5, 6].map((s) => (p.pos + s) % n);
  };
  return (
    <div className="stage stage-main">
      <StageHead g={g} id={p.id} big={pre ? 'Ваш ход, герой' : 'Ход сделан'} text={pre ? `${p.name}, сыграйте карты или сразу мечите кубик` : `${p.name}, можно доиграть карты или с достоинством передать ход`} />
      <div className="phase-track" aria-label="Фазы хода">
        <span className="done">Карты</span><span className={pre ? 'now' : 'done'}>До броска</span><span className={pre ? '' : 'done'}>Бросок и клетка</span><span className={pre ? '' : 'now'}>После хода</span>
      </div>
      <p className="stage-text">
        {cardOpts.size > 0
          ? <>Можно сыграть: <b>{[...cardOpts].map((c) => cardName(c)).join(', ')}</b> — нажмите на карту в руке.</>
          : 'Подходящих карт нет. Придётся голыми руками.'}
        {' '}Заклятий за ход: {p.spellsThisTurn}/{g.rules.spellsPerTurn}.
      </p>
      <div className="stage-actions">
        {doneIdx >= 0 && (pre ? (
          <Btn kind="primary" icon="dice" onClick={() => { onPreview(null); choose(doneIdx); }} onHover={(on) => onPreview(on ? reach() : null)}
            sub={tele ? `Прыжок на «${targetName(g, tele.index)}»` : 'Фишка пройдёт 1–6 клеток (подсвечены на поле)'}>
            {tele ? 'Прыгнуть' : 'Метнуть кубик'}
          </Btn>
        ) : (
          <Btn kind="primary" icon="check" onClick={() => choose(doneIdx)} sub={next ? `Следующим ходит ${next}` : undefined}>Закончить ход</Btn>
        ))}
        {extra.map(([i, o]) => <Btn key={i} icon="swap" onClick={() => choose(i)}>{optionLabel(g, d!, o)}</Btn>)}
      </div>
    </div>
  );
}

function nextPlayerName(g: GameState): string | null {
  for (let k = 1; k < g.players.length; k++) {
    const q = g.players[(g.current + k) % g.players.length];
    if (q.alive) return q.name;
  }
  return null;
}

function targetName(g: GameState, cell: number, me = -1): string {
  const c = g.cells[cell];
  if (c.land) return c.land.owner >= 0 ? `${c.land.name} (${c.land.owner === me ? 'ваша' : g.players[c.land.owner].name})` : c.land.name;
  return c.type === 'start' ? 'Врата' : 'Перекрёсток';
}

// ---- Fight: pawn vs monster card -----------------------------------------------------

function MonsterCard({ g, cell, power: shownPower, note }: { g: GameState; cell: number; power: number; note?: string }) {
  const l = g.cells[cell].land!;
  const f = landFlavor(l.name);
  return (
    <div className={`monster-card r${l.region}`}>
      <div className="mc-art">
        <Art of={{ kind: 'land', name: l.name, region: l.region }} />
        <span className="mc-power" title="МОЩЬ монстра"><span>МОЩЬ</span><b>{shownPower}</b></span>
      </div>
      <div className="mc-body">
        <div className="mc-land">{l.name}</div>
        <div className="mc-name">{f?.monster ?? 'Монстр'}</div>
        {note && <div className="mc-note">{note}</div>}
        <div className="mc-reward">Награда за победу: <Chip value={l.reward} size="xs" /></div>
      </div>
    </div>
  );
}

function Battle({ g, d, mine, choose }: StageProps) {
  const fighter = g.players[d!.kind === 'react' ? d!.amount ?? 0 : d!.player];
  const cell = fighter.pos;
  const l = g.cells[cell].land;
  if (!l) return null;
  const base = d!.kind === 'react' ? effPower(fighter) + fighter.fightMod : effPower(fighter);
  const nums = d!.kind === 'react' ? { you: base, youNote: fighter.fightMod ? 'с учётом сыгранных карт' : '', monster: l.monster, monsterNote: '' } : fightNumbers(d!.reason, base, l.monster);
  const stronger = nums.you > nums.monster;
  const asker = g.players[d!.player];
  const fleeMin = g.rules.fleeMin;
  const winOn = g.rules.params.fightWinOn ?? 6;
  const lastLife = fighter.tokens.length === 1;
  const idx = (t: Option['t']) => d!.options.findIndex((o) => o.t === t);
  return (
    <div className="stage stage-battle">
      <div className="battle-title">
        {d!.kind === 'react'
          ? <><b style={{ color: COLORS[fighter.id] }}>{fighter.name}</b> бросает вызов монстру</>
          : <><b style={{ color: COLORS[fighter.id] }}>{fighter.name}</b> против монстра: час истины</>}
      </div>
      <div className="battle">
        <div className="fighter" style={{ ['--pc' as string]: COLORS[fighter.id] }}>
          <PawnBadge id={fighter.id} size={40} />
          <div className="f-name">{fighter.name}</div>
          <div className="f-power" title={rankLine(nums.you)}><span>МОЩЬ</span><b>{nums.you}</b>{nums.youNote && <small>{nums.youNote}</small>}</div>
        </div>
        <div className={`versus ${stronger ? 'win' : 'lose'}`}>
          <span className="vs-sign">{stronger ? '>' : nums.you === nums.monster ? '=' : '<'}</span>
          <span className="vs-text">{stronger ? 'МОЩНЕЕ' : 'слабее'}</span>
        </div>
        <MonsterCard g={g} cell={cell} power={nums.monster} note={nums.monsterNote} />
      </div>
      {!mine && (
        <div className="stage-note">
          {d!.kind === 'react' ? `${asker.name} решает, вмешаться ли в бой…` : `${fighter.name} решает, собрав волю в кулак…`}
        </div>
      )}
      {mine && d!.kind === 'capture' && (
        <div className="stage-actions">
          <Btn kind="primary" icon="flag" onClick={() => choose(idx('capture'))} sub={<>флаг на Землю + жетон {l.reward}</>}>Захватить Землю</Btn>
          <Btn onClick={() => choose(idx('pass'))} sub="Земля останется дикой, монстр — живым">Гордо пройти мимо</Btn>
        </div>
      )}
      {mine && d!.kind === 'encounter' && (
        <>
          {lastLife && <div className="warn"><Icon name="skull" size={16} /> Последний жетон! Неудача — вы теряете все Земли и карты и возвращаетесь из Вальхаллы к Вратам с жетоном 300.</div>}
          <div className="stage-actions">
            <Btn icon="run" onClick={() => choose(idx('flee'))} sub={<>нужно {fleeMin}–6 · шанс {d6Chance(fleeMin)} · иначе −1 жетон</>}>Тактически отступить</Btn>
            <Btn kind="danger" icon="sword" onClick={() => choose(idx('fight'))} sub={<>нужно {winOn} · шанс {d6Chance(winOn)} · победа: Земля и +{l.reward}</>}>Драться</Btn>
            {idx('react') >= 0 && (
              <Btn kind="primary" icon="sword" onClick={() => choose(idx('react'))} sub={<>карта «{cardName('courage')}» · нужно {g.rules.params.courageWinOn || 4}–6 · шанс {d6Chance(g.rules.params.courageWinOn || 4)}</>}>Драться с Безрассудной Отвагой</Btn>
            )}
          </div>
        </>
      )}
      {mine && d!.kind === 'react' && (
        <>
          <div className="stage-ask">Вмешаетесь в чужой подвиг? Можно сыграть одну карту:</div>
          <div className="react-row">
            {d!.options.map((o, i) => o.t === 'react' ? (
              <GameCard key={i} g={g} id={o.card} size="mini" state={{ playable: true }} onClick={() => choose(i)} />
            ) : null)}
            <Btn kind="ghost" onClick={() => choose(idx('pass'))}>Не вмешиваться</Btn>
          </div>
          <div className="stage-note small">
            «{cardName('aid')}»: +{g.rules.params.aid ?? 0} бойцу, и если он победит — вам жетон {g.rules.params.aidReward ?? 0}. «{cardName('hex')}»: +{g.rules.params.hex ?? 0} монстру.
          </div>
        </>
      )}
    </div>
  );
}

// ---- Tokens to lose / hand over ---------------------------------------------------------

function TokenChoice({ g, d, choose }: StageProps) {
  const p = g.players[d!.player];
  const lose = d!.kind === 'lose';
  return (
    <div className="stage stage-tokens">
      <StageHead g={g} id={p.id} big={lose ? 'Потеря жетона' : 'Расплата жетоном'} text={d!.reason} />
      <p className="stage-text">
        {lose ? 'Жетон — это жизнь. Отдайте мелкий, чтобы сберечь МОЩЬ. Мужики не плачут — мужики теряют жетоны.' : 'Отдайте один жетон. Мелкий бережёт вашу МОЩЬ.'}
      </p>
      <div className="token-choices">
        {d!.options.map((o, i) => {
          const vals = o.t === 'token' ? [o.value] : o.t === 'pay' ? o.tokens : [];
          const after = power(p) - vals.reduce((a, b) => a + b, 0);
          return (
            <button key={i} type="button" className="token-choice" onClick={() => choose(i)}>
              <span className="tc-chips">{vals.map((v, k) => <Chip key={k} value={v} size="lg" />)}</span>
              <span className="tc-label">{lose ? 'Потерять' : 'Отдать'} {vals.join('+')}</span>
              <span className="tc-after" title={rankLine(after)}>МОЩЬ станет {after} · {rankTitle(after)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Discard({ g, d, choose }: StageProps) {
  const p = g.players[d!.player];
  return (
    <div className="stage stage-discard">
      <StageHead g={g} id={p.id} big="Рука не резиновая" text={`${d!.reason}. Выберите карту, которую сбросить:`} />
      <div className="react-row">
        {d!.options.map((o, i) => o.t === 'discard' ? (
          <GameCard key={i} g={g} id={o.card} size="mini" state={{ mode: 'discard' }} onClick={() => choose(i)} />
        ) : null)}
      </div>
    </div>
  );
}

function Dilemma({ g, d, choose }: StageProps) {
  const p = g.players[d!.player];
  const owner = d!.amount !== undefined ? g.players[d!.amount] : null;
  if (!d!.reason.startsWith(cardName('outpost'))) {
    const title = d!.reason.startsWith(cardName('tailwind')) ? cardName('tailwind') : cardName('altar');
    return (
      <div className="stage stage-dilemma">
        <StageHead g={g} id={p.id} big={title} text={d!.reason} />
        <div className="stage-actions">
          {d!.options.map((o, i) => <Btn key={i} kind="secondary" onClick={() => choose(i)}>{optionLabel(g, d!, o)}</Btn>)}
        </div>
      </div>
    );
  }
  return (
    <div className="stage stage-dilemma">
      <StageHead g={g} id={p.id} big={cardName('outpost')} text={d!.reason} />
      <div className="stage-actions">
        {d!.options.map((o, i) => o.t === 'choose' ? (
          <Btn key={i} kind={o.key === 'token' ? 'secondary' : 'secondary'} icon={o.key === 'skip' ? 'chain' : 'heart'} onClick={() => choose(i)}
            sub={o.key === 'skip' ? 'Потеря темпа, жетоны целы' : owner ? `Жетон уйдёт игроку ${owner.name}` : undefined}>
            {o.key === 'skip' ? 'Пропустить ход' : 'Отдать 1 жетон'}
          </Btn>
        ) : null)}
      </div>
    </div>
  );
}

function Trigger({ g, d, choose }: StageProps) {
  const p = g.players[d!.player];
  const i = d!.options.findIndex((o) => o.t === 'react');
  const card = i >= 0 ? (d!.options[i] as { card: string }).card : '';
  return (
    <div className="stage stage-dilemma">
      <StageHead g={g} id={p.id} big={cardName(card)} text={d!.reason} />
      <div className="react-row">
        {card && <GameCard g={g} id={card} size="mini" state={{ playable: true }} onClick={() => choose(i)} />}
        <Btn kind="ghost" onClick={() => choose(d!.options.findIndex((o) => o.t === 'pass'))}>Приберечь карту</Btn>
      </div>
      <div className="stage-note small">{cardText(g, card)}</div>
    </div>
  );
}

// ---- Hot-seat curtain and the end of the game ------------------------------------------

function Curtain({ g, d, id, onReveal }: { g: GameState; d: Decision | null; id: number; onReveal: () => void }) {
  const p = g.players[id];
  const why = !d || d.player !== id ? '' : d.kind === 'react'
    ? `${g.players[d.amount ?? 0].name} бросает вызов монстру — можно вмешаться картой.`
    : d.kind === 'lose' || d.kind === 'pay' ? 'Нужно выбрать жетон.' : d.kind === 'dilemma' ? 'Нужно принять решение.' : d.kind === 'trigger' ? 'Можно сыграть карту-ответ.' : g.current === id ? 'Ваш ход, герой.' : '';
  return (
    <div className="stage stage-curtain" style={{ ['--pc' as string]: COLORS[id] }}>
      <PawnBadge id={id} size={44} />
      <div className="stage-title">Передайте устройство: {p.name}</div>
      <p className="stage-text">{why} Карты на руке скрыты: настоящие мужики не подсматривают, но проверять не будем.</p>
      <Btn kind="primary" icon="eye" onClick={onReveal}>Я {p.name} — показать мои карты</Btn>
    </div>
  );
}

function Victory({ g, goal, onExit, onCopy, exitLabel = 'Новая партия', canCopy = true }: StageProps) {
  const w = g.winner >= 0 ? g.players[g.winner] : null;
  const ranking = [...g.players].sort((a, b) => landsOf(g, b.id).length - landsOf(g, a.id).length || power(b) - power(a));
  return (
    <div className="stage stage-victory" style={{ ['--pc' as string]: w ? COLORS[w.id] : undefined }}>
      <Icon name="crown" size={48} className="crown" />
      <div className="stage-title">{w ? `${w.name} побеждает! Слава, бицепсы, вечность.` : 'Партия окончена'}</div>
      <p className="stage-text">
        {g.endReason === 'lands-target' ? `Собрано ${goal} Земель` : g.endReason === 'round-cap' ? 'Достигнут лимит раундов — побеждает лидер' : END_REASON[g.endReason] ?? g.endReason}
        {' · '}раундов: {g.round}
      </p>
      <ol className="ranking">
        {ranking.map((p) => (
          <li key={p.id} style={{ ['--pc' as string]: COLORS[p.id] }}>
            <PawnBadge id={p.id} size={16} /> <span className="rk-name">{p.name}</span>
            <span><Icon name="flag" size={13} /> {landsOf(g, p.id).length}</span>
            <span title={rankLine(power(p))}>МОЩЬ {power(p)} · {rankTitle(power(p))}</span>
          </li>
        ))}
      </ol>
      <div className="stage-actions">
        <Btn kind="primary" onClick={onExit} disabled={exitLabel.endsWith('…')}>{exitLabel}</Btn>
        {canCopy && <Btn icon="copy" onClick={onCopy}>Код партии</Btn>}
      </div>
    </div>
  );
}

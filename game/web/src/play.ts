// Presentation helpers that map the engine's pending Decision onto the cards in a hand.
// No rules are decided here: playability comes from the options the engine offered; the
// "why not" texts only explain the absence of an option in plain words.
import type { Decision, GameState, Option, PlayerState } from '../../core/types.ts';
import { ARTIFACTS, SPELLS } from '../../cards/catalog.ts';
import { landsOf } from '../../core/state.ts';

export type TargetKind = 'cell' | 'player' | 'variant' | 'none';

export function targetKind(o: Option): TargetKind {
  if (o.t === 'artifact') return 'cell';
  if (o.t !== 'spell') return 'none';
  if (o.card === 'fireball' || o.card === 'drain' || o.card === 'swap' || o.card === 'lure') return 'player';
  if (o.card === 'transmute') return 'variant';
  return o.target >= 0 ? 'cell' : 'none';
}

export function optionTarget(o: Option): number {
  if (o.t === 'artifact') return o.land;
  if (o.t === 'spell') return o.target;
  return -1;
}

/** Option indices of the pending decision that play this card. */
export function cardOptions(d: Decision | null, card: string): Array<[number, Option]> {
  if (!d) return [];
  const out: Array<[number, Option]> = [];
  d.options.forEach((o, i) => {
    if ((o.t === 'spell' || o.t === 'artifact' || o.t === 'react' || o.t === 'discard') && o.card === card) out.push([i, o]);
  });
  return out;
}

/** Why the card cannot be played in the current decision, or null if it can. */
export function whyNot(g: GameState, p: PlayerState, card: string, d: Decision | null): string | null {
  if (d && d.player === p.id && cardOptions(d, card).length) return null;
  const sp = SPELLS[card];
  const isReaction = !!sp?.reaction;
  const trig = sp?.trigger;
  const TRIG: Record<string, string> = {
    counter: 'Играется, когда соперник сыграет Заклятие против вас',
    ambush: 'Играется, когда соперник встанет на вашу Землю',
    courage: 'Играется в вашем бою, когда вы не сильнее монстра',
    intercept: 'Играется, когда соперник победит монстра',
  };
  if (trig) return TRIG[trig];
  if (!d || d.player !== p.id) {
    return isReaction ? 'Играется, когда соперник встретит монстра' : 'Дождитесь своего хода';
  }
  if (d.kind === 'react') return ARTIFACTS[card] ? 'Артефакты — только в свой ход' : `В чужой бой — только «${SPELLS.aid.name}» и «${SPELLS.hex.name}»`;
  if (d.kind !== 'main') return 'Сначала завершите текущее решение';
  if (isReaction) return 'Только в чужой бой с монстром';
  if (ARTIFACTS[card]) return landsOf(g, p.id).length ? 'На всех ваших Землях уже есть Артефакт' : 'Нужна своя Земля — сначала захватите её';
  if (!sp) return 'Сейчас нельзя';
  if (p.spellsThisTurn >= g.rules.spellsPerTurn) return `Лимит: ${g.rules.spellsPerTurn} Заклятие за ход`;
  if (g.phase !== 'none' && !sp.phases.includes(g.phase)) return sp.phases.includes('pre') ? 'Только до броска кубика' : 'Только после хода';
  switch (card) {
    case 'heal': return 'Нет свободной ячейки для жетона';
    case 'shatter': return 'У соперников нет Артефактов';
    case 'usurp': return 'Ваша МОЩЬ должна быть больше, чем у владельца';
    case 'release': return 'У соперников нет Земель';
    case 'ward': return `${SPELLS.ward.name} уже действует`;
    case 'transmute': return 'Нечего разменять';
    case 'secondWind': return 'Только если ни у кого нет меньше Земель, чем у вас';
    case 'revolt': return 'Нет единоличного лидера по Землям (или это вы)';
    case 'swap': return 'Ни у кого нет жетона крупнее вашего самого мелкого';
    case 'loot': return 'У соперников нет Артефактов';
    case 'luxuryTax': return 'Ни у кого нет больше Земель, чем у вас';
    case 'quake': return 'Ни у кого из соперников нет 4–5 жетонов';
    case 'forge': return 'Все ваши жетоны уже максимального номинала. Куда ещё?';
    case 'tailwind': case 'hunt': return 'Движение в этот ход уже выбрано';
  }
  return 'Нет подходящей цели';
}

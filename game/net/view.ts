// What one participant may see. Hidden: other players' hands (only their size), the order of both
// decks (only their size), the RNG, which card someone drew, and the options of somebody else's
// decision (they would reveal the cards in that hand). Everything else is on the table anyway.
// When the game is over every hand is revealed.
import type { Decision, GameState } from '../core/types.ts';
import type { UiEvent } from '../web/src/controller.ts';
import type { PublicState } from './protocol.ts';

export const HIDDEN = '?';

const hide = (a: string[]): string[] => a.map(() => HIDDEN);

/** viewer = seat index, or -1 for a spectator. */
export function publicState(g: GameState, viewer: number): PublicState {
  const open = g.over;
  return {
    seed: g.seed,
    rules: g.rules.version,
    players: g.players.map((p) => ({ ...p, tokens: [...p.tokens], hand: open || p.id === viewer ? [...p.hand] : hide(p.hand) })),
    cells: g.cells.map((c) => ({ ...c, land: c.land ? { ...c.land } : null })),
    artDeck: hide(g.artDeck),
    artDiscard: [...g.artDiscard],
    spellDeck: hide(g.spellDeck),
    spellDiscard: [...g.spellDiscard],
    round: g.round,
    turn: g.turn,
    current: g.current,
    phase: g.phase,
    over: g.over,
    winner: g.winner,
    timeout: g.timeout,
    endReason: g.endReason,
  };
}

export function publicDecision(d: Decision | null, viewer: number): Decision | null {
  if (!d) return null;
  if (d.player === viewer) return { ...d, options: d.options.map((o) => ({ ...o })) };
  return { kind: d.kind, player: d.player, reason: d.reason, amount: d.amount, card: d.card, options: [] };
}

export function publicEvent(e: UiEvent, viewer: number): UiEvent {
  return e.type === 'draw' && e.player !== viewer ? { ...e, b: HIDDEN } : e;
}

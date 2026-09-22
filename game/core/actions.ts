// Primitive state transitions shared by the engine and card effects.
import type { Engine, EventType, GameState, LandState, PlayerState } from './types.ts';
import { alivePlayers, logMsg, power } from './state.ts';
import { decompose, paymentOptions, removeTokens, sortDesc, sum } from './tokens.ts';

export function ev(g: GameState, type: EventType, player: number, a = 0, b: string | number | null = null): void {
  if (g.hooks) g.hooks.ev(type, player, a, b);
}

/** Add `amount` of power as tokens into free slots. Returns value actually added. */
export function gainPower(g: GameState, p: PlayerState, amount: number, source: string): number {
  if (!p.alive || amount <= 0) return 0;
  const r = g.rules;
  const free = r.maxSlots - p.tokens.length;
  let add = decompose(amount, free, r.denominations);
  let got = sum(add);
  for (const t of add) p.tokens.push(t);
  sortDesc(p.tokens);
  if (r.upgradeWhenFull && got < amount) {
    // no room: the new token replaces your smallest one if it is larger (HP unchanged, power grows)
    const extra = decompose(amount - got, 1, r.denominations);
    const t = extra[0];
    const small = p.tokens[p.tokens.length - 1];
    if (t !== undefined && small !== undefined && t > small) {
      p.tokens[p.tokens.length - 1] = t;
      sortDesc(p.tokens);
      got += t - small;
      ev(g, 'upgrade', p.id, t - small, source);
      logMsg(g, `${p.name} меняет жетон ${small} на ${t} (апгрейд)`);
      add = add.concat([t]);
    }
  }
  if (add.length) ev(g, 'hpGain', p.id, add.length, source);
  if (got < amount) ev(g, 'burn', p.id, amount - got, source);
  ev(g, 'receive', p.id, got, source);
  if (got) logMsg(g, `${p.name} получает ${got} мощи (${add.join('+')}) — ${source}`);
  return got;
}

/** Is `p` protected by a shield? Consumes one charge. */
function shieldBlocks(g: GameState, p: PlayerState, source: string): boolean {
  if (p.shield > 0) {
    p.shield--;
    ev(g, 'shieldBlock', p.id, 1, source);
    logMsg(g, `${p.name}: щит отражает «${source}»`);
    return true;
  }
  return false;
}

/** Lose `n` tokens (HP). Choice of token per rules.lossChoice. */
export function* loseTokens(g: GameState, p: PlayerState, n: number, source: string, killer = -1, shieldable = true): Engine {
  if (!p.alive) return;
  if (shieldable && shieldBlocks(g, p, source)) return;
  for (let i = 0; i < n && p.tokens.length > 0; i++) {
    let value: number;
    const distinct = [...new Set(p.tokens)];
    switch (g.rules.lossChoice) {
      case 'smallest': value = p.tokens[p.tokens.length - 1]; break;
      case 'largest': value = p.tokens[0]; break;
      case 'random': value = p.tokens[g.rng.int(p.tokens.length)]; break;
      default:
        if (distinct.length === 1) value = distinct[0];
        else {
          const opts = distinct.map((v) => ({ t: 'token' as const, value: v }));
          const idx = yield { kind: 'lose', player: p.id, options: opts, reason: `Потеря жетона: ${source}` };
          value = opts[idx].value;
        }
    }
    removeTokens(p.tokens, [value]);
    ev(g, 'hpLoss', p.id, value, source);
    logMsg(g, `${p.name} теряет жетон ${value} — ${source}`);
  }
  if (p.tokens.length === 0) kill(g, p, killer, source);
}

/**
 * `payer` pays `amount` to `recipient` (-1 = bank). Payer picks tokens (minimal covers).
 * Change returns greedily into free slots. If payer can't afford, pays everything.
 */
export function* pay(g: GameState, payer: PlayerState, amount: number, recipient: number, source: string, shieldable = true): Engine {
  if (!payer.alive || amount <= 0) return;
  if (shieldable && recipient !== -1 && shieldBlocks(g, payer, source)) return;
  if (g.rules.payMode !== 'sum') return yield* payToken(g, payer, amount, recipient, source);
  const opts = paymentOptions(payer.tokens, amount);
  let pick = opts[0];
  if (opts.length > 1) {
    const idx = yield {
      kind: 'pay', player: payer.id, amount, reason: `Оплата ${amount}: ${source}`,
      options: opts.map((tokens) => ({ t: 'pay' as const, tokens })),
    };
    pick = opts[idx];
  }
  const given = sum(pick);
  const paid = Math.min(given, amount);
  const hpBefore = payer.tokens.length;
  removeTokens(payer.tokens, pick);
  ev(g, 'pay', payer.id, paid, source);
  const change = given - amount;
  if (change > 0 && g.rules.change) {
    const back = decompose(change, g.rules.maxSlots - payer.tokens.length, g.rules.denominations);
    for (const t of back) payer.tokens.push(t);
    sortDesc(payer.tokens);
    const lost = change - sum(back);
    if (lost > 0) ev(g, 'burn', payer.id, lost, 'change');
  } else if (change > 0) {
    ev(g, 'burn', payer.id, change, 'nochange');
  }
  // net HP delta caused by this payment (positive = payment healed the payer)
  ev(g, 'change', payer.id, payer.tokens.length - hpBefore, source);
  logMsg(g, `${payer.name} платит ${paid} (${pick.join('+') || '—'}) — ${source}`);
  if (recipient >= 0) {
    const rp = g.players[recipient];
    if (rp.alive) gainPower(g, rp, paid, source);
  } else {
    ev(g, 'burn', payer.id, paid, 'bank');
  }
  if (payer.tokens.length === 0) kill(g, payer, recipient, source);
}

/**
 * One rule for every token a player receives (final_rules): a free slot → put it there;
 * no free slot → (if upgradeWhenFull) it replaces your smallest token when larger, else it goes to the bank.
 */
export function receiveToken(g: GameState, p: PlayerState, value: number, source: string): void {
  if (p.tokens.length < g.rules.maxSlots) {
    p.tokens.push(value);
    sortDesc(p.tokens);
    ev(g, 'hpGain', p.id, 1, source);
    ev(g, 'receive', p.id, value, source);
    return;
  }
  const small = p.tokens[p.tokens.length - 1];
  if (g.rules.upgradeWhenFull && value > small) {
    p.tokens[p.tokens.length - 1] = value;
    sortDesc(p.tokens);
    ev(g, 'upgrade', p.id, value - small, source);
    ev(g, 'receive', p.id, value - small, source);
    logMsg(g, `${p.name} меняет жетон ${small} на ${value} (апгрейд)`);
  } else ev(g, 'burn', p.id, value, 'full');
}

/** Physical payment: hand over exactly one token (no change, no arithmetic). */
function* payToken(g: GameState, payer: PlayerState, amount: number, recipient: number, source: string): Engine {
  let pool = [...new Set(payer.tokens)];
  if (g.rules.payMode === 'atLeast') {
    const ok = pool.filter((t) => t >= amount);
    pool = ok.length ? ok : [payer.tokens[0]];
  }
  let value = pool[0];
  // 'taker': the receiving player chooses which of the payer's tokens to take
  const chooser = g.rules.payMode === 'taker' && recipient >= 0 && g.players[recipient].alive ? recipient : payer.id;
  if (pool.length > 1) {
    const idx = yield {
      kind: 'pay', player: chooser, amount, reason: `Отдайте 1 жетон${g.rules.payMode === 'atLeast' ? ` (не меньше ${amount})` : ''}: ${source}`,
      options: pool.map((v) => ({ t: 'pay' as const, tokens: [v] })),
    };
    value = pool[idx];
  }
  removeTokens(payer.tokens, [value]);
  ev(g, 'pay', payer.id, value, source);
  ev(g, 'hpLoss', payer.id, value, source);
  ev(g, 'change', payer.id, -1, source);
  logMsg(g, `${payer.name} отдаёт жетон ${value} — ${source}`);
  if (recipient >= 0 && g.players[recipient].alive) receiveToken(g, g.players[recipient], value, source);
  else ev(g, 'burn', payer.id, value, 'bank');
  if (payer.tokens.length === 0) kill(g, payer, recipient, source);
}

export function kill(g: GameState, p: PlayerState, killer: number, source: string): void {
  if (!p.alive) return;
  const respawn = g.rules.respawnTokens.length > 0;
  if (!respawn) {
    p.alive = false;
    p.eliminatedRound = g.round;
  }
  for (const c of g.cells) {
    const l = c.land;
    if (!l || l.owner !== p.id) continue;
    if (respawn && g.rules.respawnKeepsLands) {
      if (l.artifact) g.artDiscard.push(l.artifact);
      l.artifact = null;
      continue;
    }
    if (l.artifact) g.artDiscard.push(l.artifact);
    l.artifact = null;
    if (g.rules.deathLands === 'killer' && killer >= 0 && g.players[killer].alive) {
      l.owner = killer;
    } else {
      l.owner = -1;
      l.monster = l.baseMonster;
    }
    ev(g, 'landLost', p.id, l.cell, 'death');
  }
  for (const card of p.hand) discard(g, card);
  p.hand = [];
  if (respawn) {
    p.tokens = g.rules.respawnTokens.slice().sort((a, b) => b - a);
    p.pos = 0;
    p.skip = 0;
    for (let i = 0; i < g.rules.respawnCards; i++) draw(g, p, 'spell');
    ev(g, 'respawn', p.id, killer, source);
    logMsg(g, `☠ ${p.name} теряет всё и возвращается на Врата (${source})`);
    return;
  }
  ev(g, 'death', p.id, killer, source);
  logMsg(g, `☠ ${p.name} выбывает (${source})`);
  if (g.rules.win.firstDeathEnds && !g.over) {
    endGame(g, bestByLands(g), 'first-death');
    return;
  }
  checkEnd(g);
}

/** Winner by (lands, power, HP) among living players — all visible on the table. */
export function bestByLands(g: GameState): number {
  let best = -1;
  let key = [-1, -1, -1];
  for (const q of g.players) {
    if (!q.alive) continue;
    let lands = 0;
    for (const c of g.cells) if (c.land && c.land.owner === q.id) lands++;
    const k = [lands, power(q), q.tokens.length];
    if (k[0] > key[0] || (k[0] === key[0] && (k[1] > key[1] || (k[1] === key[1] && k[2] > key[2])))) { best = q.id; key = k; }
  }
  return best;
}

export const CARD_KIND: Record<string, 'artifact' | 'spell'> = {};

export function discard(g: GameState, card: string): void {
  if (CARD_KIND[card] === 'artifact') g.artDiscard.push(card);
  else g.spellDiscard.push(card);
}

export function draw(g: GameState, p: PlayerState, kind: 'artifact' | 'spell'): string | null {
  const deckKey = kind === 'artifact' ? 'artDeck' : 'spellDeck';
  const discKey = kind === 'artifact' ? 'artDiscard' : 'spellDiscard';
  if (g[deckKey].length === 0) {
    if (g[discKey].length === 0) return null;
    g[deckKey] = g.rng.shuffle(g[discKey]);
    g[discKey] = [];
    ev(g, 'reshuffle', p.id, 0, kind);
  }
  const card = g[deckKey].pop()!;
  p.hand.push(card);
  ev(g, 'draw', p.id, 0, card);
  return card;
}

export function setOwner(g: GameState, land: LandState, owner: number): void {
  const prev = land.owner;
  if (prev >= 0 && prev !== owner) ev(g, 'landLost', prev, land.cell, 'taken');
  land.owner = owner;
  if (owner === -1) land.monster = land.baseMonster;
}

export function checkEnd(g: GameState): boolean {
  if (g.over) return true;
  const alive = alivePlayers(g);
  if (alive.length <= 1 && g.rules.win.lastStanding) {
    endGame(g, alive.length ? alive[0].id : -1, 'last-standing');
    return true;
  }
  if (alive.length === 0) {
    endGame(g, -1, 'all-dead');
    return true;
  }
  return false;
}

export function endGame(g: GameState, winner: number, reason: string): void {
  if (g.over) return;
  g.over = true;
  g.winner = winner;
  g.endReason = reason;
  ev(g, 'end', winner, g.round, reason);
  logMsg(g, winner >= 0 ? `🏆 Победа: ${g.players[winner].name} (${reason})` : `Партия окончена без победителя (${reason})`);
}

export function powerOf(g: GameState, pid: number): number {
  return power(g.players[pid]);
}

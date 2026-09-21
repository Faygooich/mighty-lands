// Turn engine. A game is a generator that yields Decisions and receives the chosen option index.
// Simulator, tests and web UI all drive the same generator.
import type { Decision, Engine, GameState, LandState, Option, PlayerState } from './types.ts';
import { checkEnd, discard, draw, endGame, ev, gainPower, loseTokens, pay, setOwner } from './actions.ts';
import { effPower, handLimit, landsOf, logMsg, power, victoryPoints } from './state.ts';
import { ARTIFACTS, SPELLS, applyExchange } from '../cards/catalog.ts';
import { exchangeOptions } from './tokens.ts';

export function* playGame(g: GameState): Engine {
  while (!g.over) {
    ev(g, 'round', -1, g.round, null);
    for (let i = 0; i < g.players.length && !g.over; i++) {
      const p = g.players[i];
      if (!p.alive) continue;
      g.current = i;
      yield* takeTurn(g, p);
      if (!g.over) checkWin(g);
    }
    if (g.over) break;
    g.round++;
    if (g.round > g.rules.roundCap) {
      g.timeout = true;
      endGame(g, leaderOnCap(g), 'round-cap');
    }
  }
}

/** Tie-break at the round cap: VP (if used), then power, lands, HP. */
export function leaderOnCap(g: GameState): number {
  let best = -1;
  let bestKey: number[] = [];
  for (const p of g.players) {
    if (!p.alive) continue;
    const key = [g.rules.win.vpTarget ? victoryPoints(g, p) : 0, power(p), landsOf(g, p.id).length, p.tokens.length];
    let better = best < 0;
    for (let k = 0; k < key.length && !better; k++) {
      if (key[k] > bestKey[k]) better = true;
      else if (key[k] < bestKey[k]) break;
    }
    if (better) { best = p.id; bestKey = key; }
  }
  return best;
}

export function checkWin(g: GameState): void {
  if (g.over) return;
  const w = g.rules.win;
  for (const p of g.players) {
    if (!p.alive) continue;
    const lands = landsOf(g, p.id);
    if (w.landsTarget && lands.length >= w.landsTarget) return endGame(g, p.id, 'lands-target');
    if (w.powerTarget && power(p) >= w.powerTarget) return endGame(g, p.id, 'power-target');
    if (w.vpTarget && victoryPoints(g, p) >= w.vpTarget) return endGame(g, p.id, 'vp-target');
    if (w.regionWin) {
      const byRegion = new Map<number, number>();
      for (const l of lands) byRegion.set(l.region, (byRegion.get(l.region) ?? 0) + 1);
      for (const [reg, n] of byRegion) {
        const size = g.cells.filter((c) => c.land && c.land.region === reg).length;
        if (n === size) return endGame(g, p.id, 'region');
      }
    }
  }
}

function* takeTurn(g: GameState, p: PlayerState): Engine {
  const r = g.rules;
  g.turn++;
  p.spellsThisTurn = 0;
  p.tempPower = 0;
  p.teleportTo = -1;
  ev(g, 'turn', p.id, g.turn, null);
  if (p.skip > 0) {
    p.skip--;
    ev(g, 'skip', p.id, 0, null);
    logMsg(g, `${p.name} пропускает ход`);
    return;
  }
  // 1. Draw (optionally not on the very first turn of the game)
  const skipDraw = r.firstTurnNoDraw && g.turn === 1;
  for (let i = 0; i < r.drawArtifacts && !skipDraw; i++) draw(g, p, 'artifact');
  for (let i = 0; i < r.drawSpells && !skipDraw; i++) draw(g, p, 'spell');
  if (r.catchUpDraw > 0 && isWeakest(g, p)) for (let i = 0; i < r.catchUpDraw; i++) draw(g, p, 'spell');
  // 2. Main phase before movement
  yield* mainPhase(g, p, 'pre');
  if (g.over || !p.alive) return endTurn(g, p);
  // 3. Move
  move(g, p);
  // 4. Resolve cell
  yield* resolveCell(g, p);
  if (g.over || !p.alive) return endTurn(g, p);
  // 5. Main phase after movement
  yield* mainPhase(g, p, 'post');
  if (g.over || !p.alive) return endTurn(g, p);
  // 6. Discard to hand limit
  yield* discardPhase(g, p);
  endTurn(g, p);
}

function endTurn(g: GameState, p: PlayerState): void {
  p.tempPower = 0;
  g.phase = 'none';
}

function isWeakest(g: GameState, p: PlayerState): boolean {
  for (const q of g.players) if (q.alive && q.id !== p.id && q.tokens.length < p.tokens.length) return false;
  return g.players.some((q) => q.alive && q.id !== p.id && q.tokens.length > p.tokens.length);
}

/** Holds strictly more Lands than every other living player (the «Корона» holder). */
export function isLandLeader(g: GameState, p: PlayerState): boolean {
  const mine = landsOf(g, p.id).length;
  if (mine === 0) return false;
  for (const q of g.players) if (q.alive && q.id !== p.id && landsOf(g, q.id).length >= mine) return false;
  return true;
}

export function move(g: GameState, p: PlayerState): void {
  const r = g.rules;
  const n = g.cells.length;
  if (p.teleportTo >= 0) {
    p.pos = p.teleportTo;
    p.teleportTo = -1;
    ev(g, 'move', p.id, 0, p.pos);
    logMsg(g, `${p.name} телепортируется на клетку ${p.pos}`);
    return;
  }
  let steps = 0;
  for (let i = 0; i < r.moveDice; i++) steps += g.rng.d6();
  const passed = p.pos + steps >= n;
  p.pos = (p.pos + steps) % n;
  ev(g, 'move', p.id, steps, p.pos);
  logMsg(g, `${p.name} бросает ${steps} → клетка ${p.pos}`);
  if (passed) {
    p.laps++;
    const income = r.startIncome + r.incomePerLand * landsOf(g, p.id).length;
    const got = gainPower(g, p, income, 'Врата');
    ev(g, 'income', p.id, got, null);
  }
}

export function* resolveCell(g: GameState, p: PlayerState): Engine {
  const cell = g.cells[p.pos];
  if (cell.type !== 'land' || !cell.land) return;
  const land = cell.land;
  if (land.owner === -1) yield* monsterEncounter(g, p, land);
  else if (land.owner !== p.id) yield* enemyLand(g, p, land);
}

/**
 * Munchkin window: every other player (in seat order) may play ONE reaction card
 * (Подмога → +X to the fighter, Помеха → +X to the monster). Returns [fighterBonus, monsterBonus, helpers].
 */
function* reactionWindow(g: GameState, p: PlayerState, land: LandState): Generator<Decision, [number, number, number[]], number> {
  let plus = 0;
  let minus = 0;
  const helpers: number[] = [];
  for (let k = 1; k < g.players.length; k++) {
    const q = g.players[(p.id + k) % g.players.length];
    if (!q.alive) continue;
    const opts: Option[] = [{ t: 'pass' }];
    const seen = new Set<string>();
    for (const c of q.hand) if (SPELLS[c]?.reaction && !seen.has(c)) { seen.add(c); opts.push({ t: 'react', card: c }); }
    if (opts.length === 1) continue;
    p.fightMod = plus - minus;
    const idx = yield ask(g, { kind: 'react', player: q.id, options: opts, reason: `${p.name} встречает монстра ${land.name} (${land.monster}). Вмешаться?`, amount: p.id });
    const o = opts[idx];
    if (o.t !== 'react') continue;
    q.hand.splice(q.hand.indexOf(o.card), 1);
    g.spellDiscard.push(o.card);
    const sp = SPELLS[o.card];
    if (sp.reaction === 'help') { plus += g.rules.params[o.card] ?? 0; helpers.push(q.id); }
    else minus += g.rules.params[o.card] ?? 0;
    ev(g, 'react', q.id, p.id, sp.reaction ?? null);
    ev(g, 'spell', q.id, p.id, o.card);
    logMsg(g, `${q.name} играет «${sp.name}» в бою ${p.name}`);
  }
  p.fightMod = 0;
  return [plus, minus, helpers];
}

function* monsterEncounter(g: GameState, p: PlayerState, land: LandState): Engine {
  const r = g.rules;
  ev(g, 'encounter', p.id, land.monster, land.cell);
  const [plus, minus, helpers] = yield* reactionWindow(g, p, land);
  const eff = effPower(p) + plus;
  // «Корона»: the strict leader in Lands fights every monster at +crown (params.crown)
  const crown = r.params.crown && isLandLeader(g, p) ? r.params.crown : 0;
  const m = land.monster + minus + crown;
  const stronger = eff > m || (r.tieWins && eff === m);
  if (stronger) {
    const cost = Math.ceil((m * r.captureCostFrac) / 100) * 100;
    const canCapture = cost === 0 || power(p) > cost;
    if (!canCapture) { ev(g, 'pass', p.id, 0, land.cell); return; }
    const opts: Option[] = [{ t: 'capture' }, { t: 'pass' }];
    p.fightMod = plus - minus;
    const idx = yield ask(g, { kind: 'capture', player: p.id, options: opts, reason: `${land.name}: монстр ${m}, ваша мощь ${eff}${cost ? `, цена захвата ${cost}` : ''}`, amount: cost });
    p.fightMod = 0;
    if (opts[idx].t === 'capture') {
      if (cost > 0) yield* pay(g, p, cost, -1, `Захват ${land.name}`, false);
      if (!p.alive) return;
      setOwner(g, land, p.id);
      ev(g, 'capture', p.id, land.cell, 'monster');
      logMsg(g, `${p.name} захватывает ${land.name} (монстр ${m})`);
      if (land.reward) gainPower(g, p, land.reward, `Награда: ${land.name}`);
      for (const h of helpers) gainPower(g, g.players[h], r.params.aidReward ?? 0, 'Подмога');
    } else {
      ev(g, 'pass', p.id, 0, land.cell);
    }
    return;
  }
  // weaker (or equal)
  let fight = false;
  if (r.encounterChoice) {
    const opts: Option[] = [{ t: 'flee' }, { t: 'fight' }];
    const idx = yield ask(g, { kind: 'encounter', player: p.id, options: opts, reason: `${land.name}: монстр ${m} сильнее (${eff}). Бежать или сражаться?` });
    fight = opts[idx].t === 'fight';
  }
  const roll = g.rng.d6();
  if (fight) {
    const total = eff + roll * r.fightRollStep;
    const sixWins = (r.params.fightWinOn ?? 0) > 0 && roll >= r.params.fightWinOn;
    if (sixWins || total > m || (r.tieWins && total === m)) {
      ev(g, 'fightWin', p.id, roll, land.cell);
      setOwner(g, land, p.id);
      ev(g, 'capture', p.id, land.cell, 'fight');
      logMsg(g, `${p.name} бросает ${roll} и побеждает монстра ${land.name}`);
      if (land.reward) gainPower(g, p, land.reward, `Награда: ${land.name}`);
    } else {
      ev(g, 'fightLose', p.id, roll, land.cell);
      logMsg(g, `${p.name} бросает ${roll} и проигрывает бой`);
      yield* loseTokens(g, p, r.params.fightLossHp || 1, `Монстр ${land.name}`, -1, false);
    }
    return;
  }
  if (roll >= r.fleeMin) {
    ev(g, 'fleeOk', p.id, roll, land.cell);
    logMsg(g, `${p.name} бросает ${roll} и сбегает от монстра ${land.name}`);
  } else {
    ev(g, 'fleeFail', p.id, roll, land.cell);
    logMsg(g, `${p.name} бросает ${roll} — побег не удался`);
    yield* loseTokens(g, p, 1, `Монстр ${land.name}`, -1, false);
  }
}

function* enemyLand(g: GameState, p: PlayerState, land: LandState): Engine {
  const r = g.rules;
  const owner = g.players[land.owner];
  if (r.landChallenge) {
    const def = land.baseMonster * r.ownedDefenceFrac + (land.artifact === 'bastion' ? r.params.bastion ?? 0 : 0);
    if (effPower(p) > def) {
      const opts: Option[] = [{ t: 'capture' }, { t: 'pass' }];
      const cost = Math.ceil((land.baseMonster * r.captureCostFrac) / 100) * 100;
      if (cost === 0 || power(p) > cost) {
        const idx = yield ask(g, { kind: 'capture', player: p.id, options: opts, reason: `${land.name} (владелец ${owner.name}, защита ${def}): отвоевать?`, amount: cost });
        if (opts[idx].t === 'capture') {
          if (cost > 0) yield* pay(g, p, cost, -1, `Захват ${land.name}`, false);
          if (!p.alive) return;
          if (land.artifact) discard(g, land.artifact);
          land.artifact = null;
          setOwner(g, land, p.id);
          ev(g, 'capture', p.id, land.cell, 'challenge');
          logMsg(g, `${p.name} отвоёвывает ${land.name} у ${owner.name}`);
          return;
        }
      }
    }
  }
  const art = land.artifact;
  if (!art) return;
  const canFlee =
    r.artifactFlee === 'always' ||
    (r.artifactFlee === 'stronger' && effPower(p) > power(owner)) ||
    (r.artifactFlee === 'weaker' && effPower(p) < power(owner));
  if (canFlee) {
    const roll = g.rng.d6();
    if (roll >= r.fleeMin) {
      ev(g, 'artifactFleeOk', p.id, roll, art);
      logMsg(g, `${p.name} уклоняется от Артефакта «${ARTIFACTS[art].name}» (бросок ${roll})`);
      return;
    }
    ev(g, 'artifactFleeFail', p.id, roll, art);
  }
  ev(g, 'artifactTrigger', owner.id, p.id, art);
  logMsg(g, `Срабатывает «${ARTIFACTS[art].name}» ${owner.name} против ${p.name}`);
  yield* ARTIFACTS[art].onVisit(g, p, owner, land);
  if (r.artifactsSingleUse && land.artifact === art) {
    discard(g, art);
    land.artifact = null;
  }
}

/** Legal main-phase options. Exported for UI/bots. */
export function mainOptions(g: GameState, p: PlayerState, phase: 'pre' | 'post'): Option[] {
  const r = g.rules;
  const opts: Option[] = [{ t: 'done' }];
  const seen = new Set<string>();
  const free = landsOf(g, p.id).filter((l) => !l.artifact);
  for (const card of p.hand) {
    if (seen.has(card)) continue;
    seen.add(card);
    const sp = SPELLS[card];
    if (sp) {
      if (p.spellsThisTurn >= r.spellsPerTurn || !sp.phases.includes(phase)) continue;
      for (const t of sp.targets(g, p)) opts.push({ t: 'spell', card, target: t });
    } else if (ARTIFACTS[card]) {
      for (const l of free) opts.push({ t: 'artifact', card, land: l.cell });
    }
  }
  if (r.exchange) for (const o of exchangeOptions(p.tokens, r)) opts.push({ t: 'exchange', give: o.give, take: o.take });
  return opts;
}

function* mainPhase(g: GameState, p: PlayerState, phase: 'pre' | 'post'): Engine {
  g.phase = phase;
  for (let guard = 0; guard < 40 && !g.over && p.alive; guard++) {
    const opts = mainOptions(g, p, phase);
    if (opts.length === 1) break;
    const idx = yield ask(g, { kind: 'main', player: p.id, options: opts, reason: phase === 'pre' ? 'Фаза действий (до броска)' : 'Фаза действий (после хода)' });
    const o = opts[idx];
    if (o.t === 'done') break;
    yield* applyMain(g, p, o);
    checkWin(g);
  }
}

function* applyMain(g: GameState, p: PlayerState, o: Option): Engine {
  if (o.t === 'spell') {
    p.hand.splice(p.hand.indexOf(o.card), 1);
    p.spellsThisTurn++;
    ev(g, 'spell', p.id, o.target, o.card);
    logMsg(g, `${p.name} применяет «${SPELLS[o.card].name}»${o.target >= 0 ? ` → ${targetName(g, o.card, o.target)}` : ''}`);
    yield* SPELLS[o.card].apply(g, p, o.target);
    g.spellDiscard.push(o.card);
  } else if (o.t === 'artifact') {
    p.hand.splice(p.hand.indexOf(o.card), 1);
    g.cells[o.land].land!.artifact = o.card;
    ev(g, 'artifactPlace', p.id, o.land, o.card);
    logMsg(g, `${p.name} кладёт «${ARTIFACTS[o.card].name}» на ${g.cells[o.land].land!.name}`);
  } else if (o.t === 'exchange') {
    applyExchange(g, p, o);
  }
}

function targetName(g: GameState, card: string, t: number): string {
  if (card === 'fireball' || card === 'drain') return g.players[t].name;
  if (card === 'transmute') return 'размен';
  const c = g.cells[t];
  return c.land ? c.land.name : `клетка ${t}`;
}

export function* discardPhase(g: GameState, p: PlayerState): Engine {
  const limit = handLimit(g, p);
  while (p.hand.length > limit) {
    const distinct = [...new Set(p.hand)];
    let card = distinct[0];
    if (distinct.length > 1) {
      const opts: Option[] = distinct.map((c) => ({ t: 'discard', card: c }));
      const idx = yield ask(g, { kind: 'discard', player: p.id, options: opts, reason: `Сбросьте карту до лимита ${limit}` });
      card = (opts[idx] as { card: string }).card;
    }
    p.hand.splice(p.hand.indexOf(card), 1);
    discard(g, card);
    ev(g, 'discard', p.id, 0, card);
  }
}

function ask(g: GameState, d: Decision): Decision {
  ev(g, 'decision', d.player, d.options.length, d.kind);
  return d;
}

// ---- Drivers -----------------------------------------------------------------

export type Chooser = (g: GameState, d: Decision) => number;

/** Run a game to completion with a chooser per player. Returns number of decisions made. */
export function runGame(g: GameState, choosers: Chooser[], record?: number[]): number {
  const it = playGame(g);
  let res = it.next();
  let n = 0;
  while (!res.done) {
    const d = res.value;
    let idx = choosers[d.player](g, d);
    if (!(idx >= 0 && idx < d.options.length)) idx = 0;
    if (record) record.push(idx);
    n++;
    res = it.next(idx);
  }
  checkEnd(g);
  return n;
}

/** Replay from a recorded list of choices. */
export function replayGame(g: GameState, choices: number[]): void {
  const it = playGame(g);
  let res = it.next();
  let i = 0;
  while (!res.done) res = it.next(choices[i++] ?? 0);
}

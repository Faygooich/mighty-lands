// Turn engine. A game is a generator that yields Decisions and receives the chosen option index.
// Simulator, tests and web UI all drive the same generator.
import type { Decision, Engine, GameState, LandState, Option, PlayerState } from './types.ts';
import { checkEnd, discard, draw, endGame, ev, gainPower, loseTokens, pay, setOwner } from './actions.ts';
import { effPower, handLimit, inSet, landsOf, logMsg, power, victoryPoints } from './state.ts';
import { ARTIFACTS, ENGINE_HOOKS, SPELLS, applyExchange, spellVictim } from '../cards/catalog.ts';
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

/** Tie-break at the round cap: VP (if used), then Lands, power, HP (final_rules). */
export function leaderOnCap(g: GameState): number {
  let best = -1;
  let bestKey: number[] = [];
  for (const p of g.players) {
    if (!p.alive) continue;
    const key = [g.rules.win.vpTarget ? victoryPoints(g, p) : 0, landsOf(g, p.id).length, power(p), p.tokens.length];
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
    const target = w.landsTargetBy?.[String(g.players.length)] ?? w.landsTarget;
    if (target && lands.length >= target) return endGame(g, p.id, 'lands-target');
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
  p.rollTwice = false;
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
  // v1.0.1 candidate «Отстающий»: fewest Lands (and someone has more) draws +N Spells
  if (!skipDraw && (r.params.catchUpLands ?? 0) > 0 && hasFewestLands(g, p)) for (let i = 0; i < r.params.catchUpLands; i++) draw(g, p, 'spell');
  // 2. Main phase before movement
  yield* mainPhase(g, p, 'pre');
  if (g.over || !p.alive) return endTurn(g, p);
  // 3. Move
  yield* moveStep(g, p);
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

/**
 * «Отстающий»: nobody has fewer Lands than `p`, and at least one player has more
 * (with params.catchUpGap = k: at least k more than `p`).
 */
export function hasFewestLands(g: GameState, p: PlayerState): boolean {
  const mine = landsOf(g, p.id).length;
  const gap = Math.max(1, g.rules.params.catchUpGap ?? 1);
  let more = false;
  for (const q of g.players) {
    if (!q.alive || q.id === p.id) continue;
    const n = landsOf(g, q.id).length;
    if (n < mine) return false;
    if (n >= mine + gap) more = true;
  }
  return more;
}

/** Holds strictly more Lands than every other living player (the «Корона» holder). */
export function isLandLeader(g: GameState, p: PlayerState): boolean {
  const mine = landsOf(g, p.id).length;
  if (mine === 0) return false;
  for (const q of g.players) if (q.alive && q.id !== p.id && landsOf(g, q.id).length >= mine) return false;
  return true;
}

/** Movement with a possible choice of roll («Попутный Ветер»). */
function* moveStep(g: GameState, p: PlayerState): Engine {
  if (!p.rollTwice || p.teleportTo >= 0) return move(g, p);
  p.rollTwice = false;
  const a = g.rng.d6();
  const b = g.rng.d6();
  if (a === b) return move(g, p, a);
  const opts: Option[] = [{ t: 'choose', key: `roll:${a}` }, { t: 'choose', key: `roll:${b}` }];
  const idx = yield ask(g, { kind: 'dilemma', player: p.id, options: opts, reason: `Попутный Ветер: выпало ${a} и ${b}. Какой результат взять?` });
  move(g, p, idx === 0 ? a : b);
}

/** True if `p` has a «Золотая Жила» on one of their Lands. */
export function hasVein(g: GameState, p: PlayerState): boolean {
  for (const c of g.cells) if (c.land && c.land.owner === p.id && c.land.artifact === 'vein') return true;
  return false;
}

export function move(g: GameState, p: PlayerState, forcedSteps = 0): void {
  const r = g.rules;
  const n = g.cells.length;
  if (p.teleportTo >= 0) {
    p.pos = p.teleportTo;
    p.teleportTo = -1;
    ev(g, 'move', p.id, 0, p.pos);
    logMsg(g, `${p.name} телепортируется на клетку ${p.pos}`);
    return;
  }
  let steps = forcedSteps;
  for (let i = 0; i < r.moveDice && !forcedSteps; i++) steps += g.rng.d6();
  const passed = p.pos + steps >= n;
  p.pos = (p.pos + steps) % n;
  ev(g, 'move', p.id, steps, p.pos);
  logMsg(g, `${p.name} бросает ${steps} → клетка ${p.pos}`);
  if (passed) {
    p.laps++;
    const base = hasVein(g, p) ? r.params.veinIncome || 300 : r.startIncome;
    const income = base + r.incomePerLand * landsOf(g, p.id).length;
    const got = gainPower(g, p, income, 'Врата');
    ev(g, 'income', p.id, got, null);
    // «Отстающий у Врат»: the player with the fewest Lands draws a Spell when passing the Gates
    if ((r.params.catchUpGate ?? 0) > 0 && hasFewestLands(g, p)) for (let i = 0; i < r.params.catchUpGate; i++) draw(g, p, 'spell');
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

/**
 * «Перехват»: other players (in seat order from the capturer's left) may take the reward token.
 * Returns the player who receives the reward.
 */
function* interceptWindow(g: GameState, p: PlayerState, land: LandState): Generator<Decision, PlayerState, number> {
  if (!land.reward) return p;
  for (let k = 1; k < g.players.length; k++) {
    const q = g.players[(p.id + k) % g.players.length];
    if (!q.alive || !q.hand.includes('intercept')) continue;
    const opts: Option[] = [{ t: 'pass' }, { t: 'react', card: 'intercept' }];
    const idx = yield ask(g, { kind: 'trigger', player: q.id, options: opts, card: 'intercept', amount: p.id, reason: `${p.name} побеждает монстра ${land.name} — награда жетон ${land.reward}. Перехватить?` });
    if (opts[idx].t !== 'react') continue;
    playTrigger(g, q, 'intercept', p.id);
    logMsg(g, `${q.name} перехватывает награду ${p.name}!`);
    return q;
  }
  return p;
}

/** Spend an answer card from hand and record it as a card played outside one's own turn. */
function playTrigger(g: GameState, q: PlayerState, card: string, victim: number): void {
  q.hand.splice(q.hand.indexOf(card), 1);
  g.spellDiscard.push(card);
  if (victim !== q.id) ev(g, 'react', q.id, victim, 'trigger');
  ev(g, 'spell', q.id, victim, card);
}

function* grantCapture(g: GameState, p: PlayerState, land: LandState, helpers: number[]): Engine {
  const taker = yield* interceptWindow(g, p, land);
  if (land.reward && taker.alive) gainPower(g, taker, land.reward, `Награда: ${land.name}`);
  for (const h of helpers) gainPower(g, g.players[h], g.rules.params.aidReward ?? 0, 'Подмога');
}

function* monsterEncounter(g: GameState, p: PlayerState, land: LandState): Engine {
  const r = g.rules;
  ev(g, 'encounter', p.id, land.monster, land.cell);
  const [plus, minus, helpers] = yield* reactionWindow(g, p, land);
  const eff = effPower(p) + plus;
  // «Корона»: the strict leader in Lands fights every monster at +crown (params.crown)
  const crown = r.params.crown && isLandLeader(g, p) ? r.params.crown : 0;
  const m = land.monster + minus + crown;
  const mText = minus || crown ? `${m} (${land.monster}${minus ? ` + Помеха ${minus}` : ''}${crown ? ` + Корона ${crown}` : ''})` : `${m}`;
  const pText = plus ? `${eff} (${effPower(p)} + Подмога ${plus})` : `${eff}`;
  const stronger = eff > m || (r.tieWins && eff === m);
  if (stronger) {
    const cost = Math.ceil((m * r.captureCostFrac) / 100) * 100;
    const canCapture = cost === 0 || power(p) > cost;
    if (!canCapture) { ev(g, 'pass', p.id, 0, land.cell); return; }
    const opts: Option[] = [{ t: 'capture' }, { t: 'pass' }];
    p.fightMod = plus - minus;
    const idx = yield ask(g, { kind: 'capture', player: p.id, options: opts, reason: `${land.name}: ваша мощь ${pText} больше мощи монстра ${mText}${cost ? `, цена захвата ${cost}` : ''}. Захватить?`, amount: cost });
    p.fightMod = 0;
    if (opts[idx].t === 'capture') {
      if (cost > 0) yield* pay(g, p, cost, -1, `Захват ${land.name}`, false);
      if (!p.alive) return;
      setOwner(g, land, p.id);
      ev(g, 'capture', p.id, land.cell, 'monster');
      logMsg(g, `${p.name} захватывает ${land.name} (монстр ${m})`);
      yield* grantCapture(g, p, land, helpers);
    } else {
      ev(g, 'pass', p.id, 0, land.cell);
    }
    return;
  }
  // weaker (or equal)
  let fight = false;
  let winOn = r.params.fightWinOn ?? 0;
  if (r.encounterChoice) {
    const opts: Option[] = [{ t: 'flee' }, { t: 'fight' }];
    if (p.hand.includes('courage')) opts.push({ t: 'react', card: 'courage' });
    const idx = yield ask(g, { kind: 'encounter', player: p.id, options: opts, reason: `${land.name}: ваша мощь ${pText} ${eff === m ? 'равна' : 'меньше'} мощи монстра ${mText} — этого мало. Бежать или драться?` });
    const o = opts[idx];
    fight = o.t === 'fight' || o.t === 'react';
    if (o.t === 'react') {
      playTrigger(g, p, 'courage', p.id);
      winOn = r.params.courageWinOn || 4;
      logMsg(g, `${p.name} играет «Отвагу»: победа на ${winOn}–6`);
    }
  }
  const roll = g.rng.d6();
  if (fight) {
    const total = eff + roll * r.fightRollStep;
    const sixWins = winOn > 0 && roll >= winOn;
    if (sixWins || total > m || (r.tieWins && total === m)) {
      ev(g, 'fightWin', p.id, roll, land.cell);
      setOwner(g, land, p.id);
      ev(g, 'capture', p.id, land.cell, 'fight');
      logMsg(g, `${p.name} бросает ${roll} и побеждает монстра ${land.name}`);
      yield* grantCapture(g, p, land, helpers);
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
  const ownerId = land.owner;
  yield* enemyLandEffect(g, p, land);
  // «Засада»: the owner may make the visitor lose a token (works with or without an Artifact)
  const owner = g.players[ownerId];
  if (g.over || !p.alive || !owner?.alive || land.owner !== ownerId || p.pos !== land.cell || !owner.hand.includes('ambush')) return;
  const opts: Option[] = [{ t: 'pass' }, { t: 'react', card: 'ambush' }];
  const idx = yield ask(g, { kind: 'trigger', player: owner.id, options: opts, card: 'ambush', amount: p.id, reason: `${p.name} остановился на вашей Земле ${land.name}. Засада?` });
  if (opts[idx].t !== 'react') return;
  playTrigger(g, owner, 'ambush', p.id);
  logMsg(g, `${owner.name} устраивает Засаду на ${land.name}!`);
  yield* loseTokens(g, p, 1, 'Засада', owner.id);
}

function* enemyLandEffect(g: GameState, p: PlayerState, land: LandState): Engine {
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
  if (!art) {
    // «Набор цвета»: a Land in an owner's set takes Дань even without an Artifact
    if (r.params.setTribute && inSet(g, land)) {
      ev(g, 'artifactTrigger', owner.id, p.id, 'set');
      logMsg(g, `${land.name}: набор цвета ${owner.name} — Дань`);
      yield* pay(g, p, r.params.tribute ?? 0, owner.id, 'Набор цвета');
    }
    return;
  }
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
    // «Зеркало»: the victim of a targeted Spell may cancel it
    const vid = spellVictim(g, o.card, o.target);
    const v = vid >= 0 && vid !== p.id ? g.players[vid] : null;
    if (v && v.alive && v.hand.includes('mirror')) {
      const opts: Option[] = [{ t: 'pass' }, { t: 'react', card: 'mirror' }];
      const idx = yield ask(g, { kind: 'trigger', player: v.id, options: opts, card: o.card, amount: p.id, reason: `${p.name} играет «${SPELLS[o.card].name}» против вас. Отразить Зеркалом?` });
      if (opts[idx].t === 'react') {
        playTrigger(g, v, 'mirror', p.id);
        logMsg(g, `${v.name} отражает «${SPELLS[o.card].name}» Зеркалом`);
        g.spellDiscard.push(o.card);
        return;
      }
    }
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
  if (card === 'fireball' || card === 'drain' || card === 'swap' || card === 'lure') return g.players[t].name;
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

ENGINE_HOOKS.resolveCell = resolveCell;
ENGINE_HOOKS.encounter = monsterEncounter;

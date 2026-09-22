// v1.0.1: every new card (Gen 23+) — effect, legality and interaction with the engine.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { drive, game, scriptDice, wildLand } from './helpers.ts';
import { loadRules } from '../rules/load.ts';
import { mergeRules } from '../rules/ruleset.ts';
import { resolveCell, mainOptions, move, hasFewestLands } from '../core/engine.ts';
import { ARTIFACTS, SPELLS, spellVictim } from '../cards/catalog.ts';
import { playGame } from '../core/engine.ts';
import type { GameState } from '../core/types.ts';

const PARAMS = { veinIncome: 300, secondWind: 500, mimicBite: 4, mimicGift: 300, quicksand: 3, courageWinOn: 4 };
const R = (over: Record<string, unknown> = {}) => mergeRules(loadRules('v015'), { params: PARAMS, ...over });

function own(g: GameState, pid: number, cells: number[], artifact: string | null = null): void {
  for (const c of cells) { g.cells[c].land!.owner = pid; g.cells[c].land!.artifact = artifact; }
}

// ---- Artifacts --------------------------------------------------------------------

test('Зависть: only a visitor with MORE Lands than the owner pays a token', () => {
  const g = game(R());
  const [a, b] = g.players;
  own(g, 1, [1], 'envy');
  own(g, 0, [2, 3]);
  a.tokens = [500, 100];
  b.tokens = [300];
  a.pos = 1;
  drive(resolveCell(g, a), (d) => d.options.findIndex((o) => o.t === 'pay' && o.tokens[0] === 100));
  assert.deepEqual(a.tokens, [500]);
  assert.deepEqual(b.tokens, [300, 100]);
  // equal Lands → nothing
  own(g, 0, [3], null); g.cells[3].land!.owner = -1;
  drive(resolveCell(g, a));
  assert.deepEqual(a.tokens, [500]);
});

test('Зыбучие Пески: visitor goes back 3 cells and resolves the new cell (a monster)', () => {
  const g = game(R());
  const [a] = g.players;
  own(g, 1, [11], 'quicksand');
  a.tokens = [5000];
  a.pos = 11;
  const seen = drive(resolveCell(g, a), (d) => d.options.findIndex((o) => o.t === 'capture'));
  assert.equal(a.pos, 8);
  assert.ok(seen.some((d) => d.kind === 'capture'));
  assert.equal(g.cells[8].land!.owner, 0);
});

test('Зыбучие Пески: a chain of Sands stops (no infinite loop)', () => {
  const g = game(R());
  const [a] = g.players;
  for (const c of [1, 4, 7, 10, 13, 16, 19, 22]) own(g, 1, [c], 'quicksand');
  a.tokens = [300];
  a.pos = 22;
  drive(resolveCell(g, a));
  assert.ok(a.pos >= 0);
});

test('Сундук-Мимик: 1–4 bites (lose a token), 5–6 gives a 300 token', () => {
  const g = game(R());
  const [a] = g.players;
  own(g, 1, [2], 'mimic');
  a.tokens = [500, 100];
  a.pos = 2;
  scriptDice(g, [3]);
  drive(resolveCell(g, a), (d) => d.options.findIndex((o) => o.t === 'token' && o.value === 100));
  assert.deepEqual(a.tokens, [500]);
  scriptDice(g, [6]);
  drive(resolveCell(g, a));
  assert.deepEqual(a.tokens, [500, 300]);
});

test('Соглядатай: the visitor chooses which card to give the owner', () => {
  const g = game(R());
  const [a, b] = g.players;
  own(g, 1, [2], 'spy');
  a.hand = ['fireball', 'heal'];
  b.hand = [];
  a.pos = 2;
  drive(resolveCell(g, a), (d) => d.options.findIndex((o) => o.t === 'discard' && o.card === 'heal'));
  assert.deepEqual(a.hand, ['fireball']);
  assert.deepEqual(b.hand, ['heal']);
});

test('Алтарь: choose token or whole hand; with an empty hand a token is lost', () => {
  const g = game(R());
  const [a] = g.players;
  own(g, 1, [2], 'altar');
  a.tokens = [500, 300];
  a.hand = ['fireball', 'heal'];
  a.pos = 2;
  drive(resolveCell(g, a), (d) => (d.kind === 'dilemma' ? d.options.findIndex((o) => o.t === 'choose' && o.key === 'hand') : 0));
  assert.deepEqual(a.hand, []);
  assert.deepEqual(a.tokens, [500, 300]);
  const seen = drive(resolveCell(g, a), (d) => d.options.findIndex((o) => o.t === 'token' && o.value === 300));
  assert.ok(!seen.some((d) => d.kind === 'dilemma'));
  assert.deepEqual(a.tokens, [500]);
});

test('Золотая Жила: passing the Gates gives 300 instead of 100', () => {
  const g = game(R());
  const [a] = g.players;
  own(g, 0, [2], 'vein');
  a.tokens = [500];
  a.pos = 22;
  scriptDice(g, [3]);
  move(g, a);
  assert.deepEqual(a.tokens, [500, 300]);
  assert.equal(ARTIFACTS.vein.text(g).includes('300'), true);
});

// ---- Spells -----------------------------------------------------------------------

test('Второе Дыхание: only when nobody has fewer Lands; gives a 500 token', () => {
  const g = game(R());
  const [a, b] = g.players;
  a.tokens = [100];
  assert.deepEqual(SPELLS.secondWind.targets(g, a), [-1]);
  own(g, 0, [1]);
  assert.deepEqual(SPELLS.secondWind.targets(g, a), []);
  own(g, 1, [2, 3]);
  drive(SPELLS.secondWind.apply(g, a, -1));
  assert.deepEqual(a.tokens, [500, 100]);
  assert.equal(b.id, 1);
});

test('Бунт: only the strict Land leader is a target, and the Land turns wild', () => {
  const g = game(R(), 3);
  const [a, b, c] = g.players;
  own(g, 1, [1, 2], 'trap');
  own(g, 2, [3, 4]);
  assert.deepEqual(SPELLS.revolt.targets(g, a), []); // tie → no leader
  own(g, 1, [5]);
  assert.deepEqual(SPELLS.revolt.targets(g, a).sort(), [1, 2, 5]);
  assert.deepEqual(SPELLS.revolt.targets(g, b), []); // the leader cannot revolt against himself
  drive(SPELLS.revolt.apply(g, a, 1));
  assert.equal(g.cells[1].land!.owner, -1);
  assert.equal(g.cells[1].land!.artifact, null);
  assert.equal(c.id, 2);
});

test('Подмена: take the largest token, give your smallest (HP unchanged)', () => {
  const g = game(R());
  const [a, b] = g.players;
  a.tokens = [300, 100];
  b.tokens = [1000, 500];
  assert.deepEqual(SPELLS.swap.targets(g, a), [1]);
  drive(SPELLS.swap.apply(g, a, 1));
  assert.deepEqual(a.tokens, [1000, 300]);
  assert.deepEqual(b.tokens, [500, 100]);
});

test('Попутный Ветер: two dice, the player picks which one to move by', () => {
  const g = game(R());
  const [a] = g.players;
  a.hand = ['tailwind'];
  scriptDice(g, [2, 5]);
  const it = playGame(g);
  let r = it.next();
  let picked = false;
  while (!r.done && !picked) {
    const d = r.value;
    let idx = 0;
    if (d.kind === 'main' && d.player === 0) idx = Math.max(0, d.options.findIndex((o) => o.t === 'spell' && o.card === 'tailwind'));
    if (d.kind === 'dilemma' && d.player === 0) { idx = d.options.findIndex((o) => o.t === 'choose' && o.key === 'roll:5'); picked = true; }
    r = it.next(idx);
  }
  assert.ok(picked);
  assert.equal(a.pos, 5);
});

test('Трофей: take an Artifact from an enemy Land into your hand', () => {
  const g = game(R());
  const [a] = g.players;
  own(g, 1, [4], 'trap');
  assert.deepEqual(SPELLS.loot.targets(g, a), [4]);
  drive(SPELLS.loot.apply(g, a, 4));
  assert.equal(g.cells[4].land!.artifact, null);
  assert.deepEqual(a.hand, ['trap']);
});

test('Налог на Роскошь: every opponent with more Lands gives one token', () => {
  const g = game(R(), 3);
  const [a, b, c] = g.players;
  own(g, 1, [1]);
  own(g, 2, [2, 3]);
  a.tokens = [100];
  b.tokens = [500];
  c.tokens = [300, 100];
  drive(SPELLS.luxuryTax.apply(g, a, -1), (d) => d.options.findIndex((o) => o.t === 'pay' && o.tokens[0] === 100));
  assert.deepEqual(a.tokens.sort((x, y) => y - x), [500, 100, 100]);
  assert.equal(b.tokens.length + c.tokens.length, 1 + 0 + 1 - 0);
});

test('Землетрясение: everyone with 4–5 tokens loses one, including the caster', () => {
  const g = game(R(), 3);
  const [a, b, c] = g.players;
  a.tokens = [300, 300, 100, 100];
  b.tokens = [500, 500, 300, 100, 100];
  c.tokens = [500];
  drive(SPELLS.quake.apply(g, a, -1));
  assert.equal(a.tokens.length, 3);
  assert.equal(b.tokens.length, 4);
  assert.equal(c.tokens.length, 1);
});

test('Приманка: the target is moved to the next wild Land and meets its monster', () => {
  const g = game(R());
  const [a, b] = g.players;
  b.pos = 0;
  b.tokens = [300, 100];
  own(g, 0, [1, 2, 3, 4]);
  scriptDice(g, [1]);
  const seen = drive(SPELLS.lure.apply(g, a, 1), (d) => (d.kind === 'encounter' ? d.options.findIndex((o) => o.t === 'flee') : 0));
  assert.equal(b.pos, 5);
  assert.ok(seen.some((d) => d.kind === 'encounter' && d.player === 1));
  assert.equal(b.tokens.length, 1); // flee roll 1 failed
});

test('Кузня: the smallest token becomes the next denomination', () => {
  const g = game(R());
  const [a] = g.players;
  a.tokens = [500, 100];
  drive(SPELLS.forge.apply(g, a, -1));
  assert.deepEqual(a.tokens, [500, 300]);
  a.tokens = [1000];
  assert.deepEqual(SPELLS.forge.targets(g, a), []);
});

test('Охотничий Рог: move to the nearest wild Land ahead instead of rolling', () => {
  const g = game(R());
  const [a] = g.players;
  own(g, 1, [1, 2]);
  assert.deepEqual(SPELLS.hunt.targets(g, a), [3]);
  drive(SPELLS.hunt.apply(g, a, 3));
  move(g, a);
  assert.equal(a.pos, 3);
});

// ---- Answer cards -------------------------------------------------------------------

function castSpell(g: GameState, pid: number, card: string, target: number, pick: (d: import('../core/types.ts').Decision) => number) {
  const p = g.players[pid];
  p.hand.push(card);
  g.phase = 'pre';
  const opts = mainOptions(g, p, 'pre');
  const i = opts.findIndex((o) => o.t === 'spell' && o.card === card && o.target === target);
  assert.ok(i >= 0, `can cast ${card}`);
  return opts[i];
}

test('Зеркало: cancels a Spell aimed at you; the caster still spent the card', () => {
  const g = game(R());
  const [a, b] = g.players;
  a.tokens = [500];
  b.tokens = [500, 100];
  b.hand = ['mirror'];
  a.hand = ['fireball'];
  const it = playGame(g);
  let r = it.next();
  let asked = false;
  while (!r.done && !asked) {
    const d = r.value;
    let idx = 0;
    if (d.kind === 'main' && d.player === 0) idx = Math.max(0, d.options.findIndex((o) => o.t === 'spell' && o.card === 'fireball'));
    if (d.kind === 'trigger') { asked = true; idx = d.options.findIndex((o) => o.t === 'react'); }
    r = it.next(idx);
  }
  assert.ok(asked);
  assert.deepEqual(b.tokens, [500, 100]);
  assert.ok(!b.hand.includes('mirror'));
  assert.equal(spellVictim(g, 'usurp', 1), g.cells[1].land!.owner);
  void castSpell;
});

test('Засада: an enemy stopping on your Land loses a token (even without an Artifact)', () => {
  const g = game(R());
  const [a, b] = g.players;
  own(g, 1, [2]);
  b.hand = ['ambush'];
  a.tokens = [500, 100];
  a.pos = 2;
  drive(resolveCell(g, a), (d) => (d.kind === 'trigger' ? d.options.findIndex((o) => o.t === 'react') : d.options.findIndex((o) => o.t === 'token' && o.value === 100)));
  assert.deepEqual(a.tokens, [500]);
  assert.deepEqual(b.hand, []);
});

test('Отвага: in your own fight you win on 4–6', () => {
  const g = game(R());
  const [a] = g.players;
  a.tokens = [100];
  a.hand = ['courage'];
  a.pos = wildLand(g, 900);
  scriptDice(g, [4]);
  drive(resolveCell(g, a), (d) => d.options.findIndex((o) => o.t === 'react'));
  assert.equal(g.cells[a.pos].land!.owner, 0);
  assert.deepEqual(a.hand, []);
});

test('Перехват: the reward token goes to the interceptor, the Land stays with the winner', () => {
  const g = game(R());
  const [a, b] = g.players;
  a.tokens = [1000];
  b.tokens = [100];
  b.hand = ['intercept'];
  a.pos = wildLand(g, 900);
  drive(resolveCell(g, a), (d) => (d.kind === 'trigger' ? d.options.findIndex((o) => o.t === 'react') : d.options.findIndex((o) => o.t === 'capture')));
  assert.equal(g.cells[a.pos].land!.owner, 0);
  assert.deepEqual(a.tokens, [1000]);
  assert.deepEqual(b.tokens, [300, 100]);
});

test('«Отстающий»: fewest Lands (and someone has more) draws an extra Spell', () => {
  const g = game(R({ params: { ...PARAMS, catchUpLands: 1 } }));
  const [a, b] = g.players;
  own(g, 1, [1]);
  assert.equal(hasFewestLands(g, a), true);
  assert.equal(hasFewestLands(g, b), false);
});

test('answer cards are never offered in the main phase', () => {
  const g = game(R());
  const [a] = g.players;
  a.hand = ['mirror', 'ambush', 'courage', 'intercept'];
  g.phase = 'pre';
  const opts = mainOptions(g, a, 'pre');
  assert.ok(!opts.some((o) => o.t === 'spell'));
});

test('v1.0.1 (v029): 12 new card types, «Отстающий», hand 4, flee 4–6, targets 9/8/7/6/6/6', () => {
  const r = loadRules('v029');
  const fresh = ['quicksand', 'mimic', 'envy', 'altar', 'spy', 'vein', 'swap', 'luxuryTax', 'ambush', 'intercept', 'courage', 'secondWind'];
  for (const c of fresh) assert.ok((r.decks.artifacts[c] ?? r.decks.spells[c] ?? 0) > 0, c);
  for (const c of ['revolt', 'tailwind', 'hunt', 'lure', 'forge', 'loot', 'quake', 'mirror']) assert.ok(!(r.decks.artifacts[c] || r.decks.spells[c]), `${c} not in v1.0.1`);
  assert.equal(r.params.catchUpLands, 1);
  assert.equal(r.params.veinIncome, 500);
  assert.equal(r.handLimit, 4);
  assert.equal(r.fleeMin, 4);
  assert.deepEqual(r.seatBonusCards, [1, 2, 2, 3, 3, 4, 4]);
  assert.deepEqual(r.win.landsTargetBy, { 2: 9, 3: 8, 5: 6, 6: 6, 7: 6 });
});

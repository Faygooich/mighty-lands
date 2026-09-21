import { test } from 'node:test';
import assert from 'node:assert/strict';
import { drive, game, rules, scriptDice, wildLand } from './helpers.ts';
import { move, resolveCell, runGame, mainOptions, discardPhase } from '../core/engine.ts';
import { loseTokens, pay, gainPower, kill, draw } from '../core/actions.ts';
import { decompose, paymentOptions, afterPayment } from '../core/tokens.ts';
import { power, createGame } from '../core/state.ts';
import { Rng } from '../core/rng.ts';
import { ARTIFACTS, SPELLS } from '../cards/catalog.ts';
import { runOne } from '../simulation/runner.ts';

test('dice: deterministic by seed and in range', () => {
  const a = new Rng(42), b = new Rng(42);
  for (let i = 0; i < 1000; i++) {
    const x = a.d6();
    assert.equal(x, b.d6());
    assert.ok(x >= 1 && x <= 6);
  }
  const counts = [0, 0, 0, 0, 0, 0];
  const r = new Rng(7);
  for (let i = 0; i < 60000; i++) counts[r.d6() - 1]++;
  for (const c of counts) assert.ok(Math.abs(c - 10000) < 500, `uniform d6 ${counts}`);
});

test('movement: wraps the board and pays Start income on passing', () => {
  const g = game();
  const p = g.players[0];
  p.pos = 22;
  p.tokens = [500, 300];
  scriptDice(g, [4]);
  move(g, p);
  assert.equal(p.pos, 2);
  assert.deepEqual(p.tokens, [500, 300, 100]);
});

test('movement: no income without a free slot', () => {
  const g = game();
  const p = g.players[0];
  p.pos = 23;
  p.tokens = [100, 100, 100, 100, 100];
  scriptDice(g, [1]);
  move(g, p);
  assert.equal(p.pos, 0);
  assert.equal(p.tokens.length, 5);
});

test('monster: stronger player may capture', () => {
  const g = game();
  const p = g.players[0];
  p.pos = wildLand(g, 200);
  const ds = drive(resolveCell(g, p), (d) => d.options.findIndex((o) => o.t === 'capture'));
  assert.equal(ds[0].kind, 'capture');
  assert.equal(g.cells[p.pos].land!.owner, 0);
});

test('monster: stronger player may pass', () => {
  const g = game();
  const p = g.players[0];
  p.pos = wildLand(g, 200);
  drive(resolveCell(g, p), (d) => d.options.findIndex((o) => o.t === 'pass'));
  assert.equal(g.cells[p.pos].land!.owner, -1);
});

test('monster: equal power is not enough (A-06) and flee 5-6 succeeds', () => {
  const g = game();
  const p = g.players[0];
  p.tokens = [500];
  p.pos = wildLand(g, 500);
  scriptDice(g, [5]);
  drive(resolveCell(g, p));
  assert.deepEqual(p.tokens, [500]);
  assert.equal(g.cells[p.pos].land!.owner, -1);
});

test('monster: failed flee costs one token of player choice', () => {
  const g = game();
  const p = g.players[0];
  p.pos = wildLand(g, 3000);
  scriptDice(g, [4]);
  const ds = drive(resolveCell(g, p), (d) => d.options.findIndex((o) => o.t === 'token' && o.value === 300));
  assert.equal(ds[0].kind, 'lose');
  assert.deepEqual(p.tokens, [500, 100]);
});

test('tie rule variant: equal power wins when tieWins', () => {
  const g = game(rules({ tieWins: true }));
  const p = g.players[0];
  p.tokens = [500];
  p.pos = wildLand(g, 500);
  drive(resolveCell(g, p));
  assert.equal(g.cells[p.pos].land!.owner, 0);
});

test('fight option: weaker player can fight with dice bonus', () => {
  const g = game(rules({ encounterChoice: true, fightRollStep: 100 }));
  const p = g.players[0];
  p.tokens = [500];
  p.pos = wildLand(g, 900);
  scriptDice(g, [5]);
  drive(resolveCell(g, p), (d) => d.options.findIndex((o) => o.t === 'fight'));
  assert.equal(g.cells[p.pos].land!.owner, 0);
});

test('death: last token lost eliminates player, lands return to monsters', () => {
  const g = game(rules(), 3);
  const p = g.players[0];
  const land = g.cells[wildLand(g, 200)].land!;
  land.owner = 0;
  land.artifact = 'trap';
  land.monster = 0;
  p.tokens = [100];
  drive(loseTokens(g, p, 1, 'test'));
  assert.equal(p.alive, false);
  assert.equal(land.owner, -1);
  assert.equal(land.artifact, null);
  assert.equal(land.monster, 200);
  assert.ok(g.artDiscard.includes('trap'));
});

test('victory: last standing wins', () => {
  const g = game();
  g.players[1].tokens = [100];
  drive(loseTokens(g, g.players[1], 1, 'test'));
  assert.equal(g.over, true);
  assert.equal(g.winner, 0);
});

test('tokens: decompose greedy and slot-limited', () => {
  const d = [1000, 500, 300, 100];
  assert.deepEqual(decompose(900, 5, d), [500, 300, 100]);
  assert.deepEqual(decompose(1100, 1, d), [1000]);
  assert.deepEqual(decompose(200, 5, d), [100, 100]);
});

test('payment: minimal covers only', () => {
  const opts = paymentOptions([1000, 500, 300, 100], 300);
  const keys = opts.map((o) => o.join('+')).sort();
  assert.deepEqual(keys, ['1000', '300', '500'].sort());
});

test('payment: change heals (the HP/money exploit, BUG-003 baseline)', () => {
  const r = rules();
  assert.deepEqual(afterPayment([1000], [1000], 100, r), [500, 300, 100]);
  const noChange = rules({ change: false });
  assert.deepEqual(afterPayment([1000], [1000], 100, noChange), []);
});

test('payment: cannot afford -> pays everything and dies', () => {
  const g = game();
  const [a, b] = g.players;
  a.tokens = [100, 100];
  drive(pay(g, a, 300, b.id, 'test'));
  assert.equal(a.alive, false);
  assert.equal(power(b), 900 + 200);
});

test('artifact: tribute on visit, flee only if stronger than owner', () => {
  const g = game();
  const [a, b] = g.players;
  const cell = wildLand(g, 200);
  g.cells[cell].land!.owner = 1;
  g.cells[cell].land!.artifact = 'tribute';
  a.pos = cell;
  a.tokens = [500];
  b.tokens = [1000];
  drive(resolveCell(g, a));
  assert.deepEqual(a.tokens, [100, 100]);
  assert.deepEqual(b.tokens, [1000, 300]);
});

test('artifact: stronger visitor flees with 5-6', () => {
  const g = game();
  const [a, b] = g.players;
  const cell = wildLand(g, 200);
  g.cells[cell].land!.owner = 1;
  g.cells[cell].land!.artifact = 'trap';
  a.pos = cell;
  a.tokens = [1000, 1000];
  b.tokens = [100];
  scriptDice(g, [6]);
  drive(resolveCell(g, a));
  assert.equal(a.tokens.length, 2);
});

test('artifact: shackles skip next turn; exile to start; guardian blocks spells', () => {
  const g = game();
  const [a] = g.players;
  drive(ARTIFACTS.shackles.onVisit(g, a, g.players[1], g.cells[1].land!));
  assert.equal(a.skip, 1);
  a.pos = 5;
  drive(ARTIFACTS.exile.onVisit(g, a, g.players[1], g.cells[1].land!));
  assert.equal(a.pos, 0);
  const l = g.cells[wildLand(g, 300)].land!;
  l.owner = 1;
  l.artifact = 'guardian';
  a.hand = ['release'];
  const opts = mainOptions(g, a, 'pre');
  assert.ok(!opts.some((o) => o.t === 'spell' && o.target === l.cell));
});

test('spells: one per turn; fireball; heal; usurp needs more power than owner', () => {
  const g = game();
  const [a, b] = g.players;
  a.hand = ['fireball', 'heal'];
  a.spellsThisTurn = 1;
  assert.equal(mainOptions(g, a, 'pre').length, 1);
  a.spellsThisTurn = 0;
  drive(SPELLS.fireball.apply(g, a, b.id));
  assert.equal(b.tokens.length, 2);
  a.tokens = [500];
  drive(SPELLS.heal.apply(g, a, -1));
  assert.deepEqual(a.tokens, [500, 100]);
  const l = g.cells[wildLand(g, 300)].land!;
  l.owner = b.id;
  b.tokens = [1000];
  assert.ok(!SPELLS.usurp.targets(g, a).includes(l.cell));
  a.tokens = [1000, 500];
  assert.ok(SPELLS.usurp.targets(g, a).includes(l.cell));
});

test('spells: teleport replaces the roll (no Start income)', () => {
  const g = game();
  const a = g.players[0];
  a.pos = 20;
  a.teleportTo = 2;
  a.tokens = [500];
  move(g, a);
  assert.equal(a.pos, 2);
  assert.deepEqual(a.tokens, [500]);
});

test('hand limit: discard down to HP, player chooses', () => {
  const g = game();
  const a = g.players[0];
  a.tokens = [300];
  a.hand = ['heal', 'heal', 'trap'];
  const ds = drive(discardPhase(g, a), (d) => d.options.findIndex((o) => o.t === 'discard' && o.card === 'heal'));
  assert.equal(ds.length, 2);
  assert.deepEqual(a.hand, ['trap']);
});

test('decks: reshuffle discard when empty', () => {
  const g = game();
  const a = g.players[0];
  g.artDiscard.push(...g.artDeck);
  g.artDeck = [];
  const n = g.artDiscard.length;
  draw(g, a, 'artifact');
  assert.equal(g.artDeck.length, n - 1);
});

test('invariants: random full games never break state', () => {
  for (let s = 1; s <= 150; s++) {
    const r = rules();
    const g = createGame(r, [0, 1, 2, 3].map((i) => ({ name: `R${i}`, bot: 'random' })), s);
    const rng = new Rng(s);
    runGame(g, g.players.map(() => (gs, d) => {
      for (const p of gs.players) {
        assert.ok(p.tokens.length <= r.maxSlots, 'slots');
        assert.ok(p.tokens.every((t) => r.denominations.includes(t)), 'denoms');
      }
      assert.ok(gs.players[d.player].alive || d.kind === 'lose' || d.kind === 'pay', 'dead player decides');
      return rng.int(d.options.length);
    }));
    assert.ok(g.over);
    assert.ok(g.round <= r.roundCap + 1);
  }
});

test('determinism: same seed + bots => identical record', () => {
  const r = rules();
  const a = runOne(r, ['tactical', 'aggressive', 'economic', 'random'], 123).rec;
  const b = runOne(r, ['tactical', 'aggressive', 'economic', 'random'], 123).rec;
  assert.deepEqual(a, b);
});

test('gainPower / kill are no-ops on dead players', () => {
  const g = game(rules(), 3);
  const a = g.players[0];
  kill(g, a, -1, 'test');
  assert.equal(gainPower(g, a, 500, 'x'), 0);
});

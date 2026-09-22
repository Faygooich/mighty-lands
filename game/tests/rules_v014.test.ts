// Tests for mechanics introduced by the evolution (v002–v014) + regression tests for audit findings.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { drive, game, scriptDice, wildLand } from './helpers.ts';
import { loadRules } from '../rules/load.ts';
import { resolveCell, mainOptions, checkWin, leaderOnCap } from '../core/engine.ts';
import { loseTokens, pay, gainPower } from '../core/actions.ts';
import { createGame } from '../core/state.ts';
import { runOne } from '../simulation/runner.ts';

const R = () => loadRules('v014');

test('v002 payment: hand over ONE token of your choice, no change', () => {
  const g = game(R());
  const [a, b] = g.players;
  a.tokens = [1000, 300];
  b.tokens = [500];
  drive(pay(g, a, 300, b.id, 'Дань'), (d) => d.options.findIndex((o) => o.t === 'pay' && o.tokens[0] === 300));
  assert.deepEqual(a.tokens, [1000]);
  assert.deepEqual(b.tokens, [500, 300]);
});

test('v003 reward: defeating a monster gives the reward printed on the Land', () => {
  const g = game(R());
  const p = g.players[0];
  p.tokens = [1000];
  p.pos = wildLand(g, 900); // Лес → reward 300
  drive(resolveCell(g, p), (d) => d.options.findIndex((o) => o.t === 'capture'));
  assert.deepEqual(p.tokens, [1000, 300]);
});

test('v003 upgrade: with full slots a received token replaces your smallest if larger', () => {
  const g = game(R());
  const p = g.players[0];
  p.tokens = [500, 300, 300, 100, 100];
  gainPower(g, p, 1000, 'test');
  assert.deepEqual(p.tokens, [1000, 500, 300, 300, 100]);
});

test('AUDIT-2 regression: a received Дань token with full slots follows the same upgrade rule', () => {
  const g = game(R());
  const [a, b] = g.players;
  a.tokens = [1000];
  b.tokens = [300, 300, 100, 100, 100];
  drive(pay(g, a, 300, b.id, 'Дань'));
  assert.deepEqual(b.tokens, [1000, 300, 300, 100, 100]);
});

test('v003 Abyss boss has 5000 power', () => {
  const g = game(R());
  assert.equal(g.cells[23].land!.monster, 5000);
});

test('v004 reactions: other players may play Подмога / Помеха in another player fight', () => {
  const g = game(R(), 3);
  const [a, b, c] = g.players;
  a.tokens = [300];
  a.pos = wildLand(g, 700);
  b.hand = ['aid'];
  c.hand = ['hex'];
  const ds = drive(resolveCell(g, a), (d) => (d.kind === 'react' ? d.options.findIndex((o) => o.t === 'react') : 0));
  assert.equal(ds.filter((d) => d.kind === 'react').length, 2);
  // 300 + 500 = 800 vs 700 + 500 = 1200 → still weaker → fight-or-flee decision
  assert.ok(ds.some((d) => d.kind === 'encounter'));
});

test('AUDIT-1 regression: Подмога helper is rewarded when the fighter wins by a 6', () => {
  const g = game(R(), 2);
  const [a, b] = g.players;
  a.tokens = [100];
  a.pos = wildLand(g, 2000);
  b.hand = ['aid'];
  b.tokens = [300];
  scriptDice(g, [6]);
  drive(resolveCell(g, a), (d) => (d.kind === 'react' ? d.options.findIndex((o) => o.t === 'react') : d.options.findIndex((o) => o.t === 'fight')));
  assert.equal(g.cells[a.pos].land!.owner, a.id);
  assert.deepEqual(b.tokens, [500, 300]);
});

test('v007 fight: a weaker player may fight; 6 wins, otherwise lose 1 token', () => {
  const g = game(R());
  const p = g.players[0];
  p.tokens = [300, 100];
  p.pos = wildLand(g, 5000);
  scriptDice(g, [3]);
  drive(resolveCell(g, p), (d) => d.options.findIndex((o) => o.t === 'fight'));
  assert.equal(p.tokens.length, 1);
  assert.equal(g.cells[p.pos].land!.owner, -1);
});

test('v006 no fleeing from Artifacts', () => {
  const g = game(R());
  const [a, b] = g.players;
  const cell = wildLand(g, 200);
  g.cells[cell].land!.owner = b.id;
  g.cells[cell].land!.artifact = 'trap';
  a.tokens = [1000, 1000];
  b.tokens = [100];
  a.pos = cell;
  drive(resolveCell(g, a));
  assert.equal(a.tokens.length, 1);
});

test('v009 return to the game: Lands back to monsters, hand discarded, token 300 at the Gates', () => {
  const g = game(R(), 3);
  const p = g.players[0];
  const l = g.cells[wildLand(g, 200)].land!;
  l.owner = 0;
  p.hand = ['heal'];
  p.tokens = [100];
  p.pos = 9;
  drive(loseTokens(g, p, 1, 'test'));
  assert.equal(p.alive, true);
  assert.deepEqual(p.tokens, [300]);
  assert.equal(p.pos, 0);
  assert.equal(p.hand.length, 0);
  assert.equal(l.owner, -1);
  assert.equal(g.over, false);
});

test('v010 hand limit is 3', () => {
  assert.equal(R().handLimit, 3);
});

test('v005/v013 seat compensation: Spell cards at setup 0/1/1/2/2/3/3', () => {
  const g = createGame(R(), Array.from({ length: 7 }, (_, i) => ({ name: `P${i}`, bot: 't' })), 5);
  assert.deepEqual(g.players.map((p) => p.hand.length), [0, 1, 1, 2, 2, 3, 3]);
});

test('v012/v013 Lands target by player count 9/8/7/6/6/5', () => {
  for (const [n, target] of [[2, 9], [3, 8], [4, 7], [5, 6], [6, 6], [7, 5]]) {
    const g = createGame(R(), Array.from({ length: n }, (_, i) => ({ name: `P${i}`, bot: 't' })), 1);
    let k = 0;
    for (const c of g.cells) if (c.land && k < target - 1) { c.land.owner = 0; k++; }
    checkWin(g);
    assert.equal(g.over, false, `n=${n} not yet`);
    for (const c of g.cells) if (c.land && c.land.owner === -1) { c.land.owner = 0; break; }
    checkWin(g);
    assert.equal(g.over, true, `n=${n} win at ${target}`);
    assert.equal(g.winner, 0);
  }
});

test('AUDIT-3 regression: round-cap tie-break is Lands, then power', () => {
  const g = game(R(), 2);
  g.players[0].tokens = [1000, 1000];
  g.players[1].tokens = [100];
  g.cells[1].land!.owner = 1;
  assert.equal(leaderOnCap(g), 1);
});

test('removed cards are not in the decks; Teleport only before moving', () => {
  const r = R();
  for (const c of ['bigTribute', 'fury', 'exile', 'release', 'pickpocket', 'guardian']) {
    assert.ok(!(r.decks.artifacts[c] || r.decks.spells[c]), c);
  }
  const g = game(r);
  g.players[0].hand = ['teleport'];
  assert.ok(mainOptions(g, g.players[0], 'pre').some((o) => o.t === 'spell'));
  assert.ok(!mainOptions(g, g.players[0], 'post').some((o) => o.t === 'spell'));
});

test('v014 full games at 2..7 players always finish without a timeout', () => {
  const r = R();
  const styles = ['tactical', 'aggressive', 'economic', 'defensive', 'survival', 'random'];
  for (let n = 2; n <= 7; n++) {
    for (let s = 1; s <= 30; s++) {
      const rec = runOne(r, Array.from({ length: n }, (_, i) => styles[i % 6]), s * 7 + n).rec;
      assert.ok(rec.winner >= 0 && !rec.timeout, `n=${n} seed=${s}`);
    }
  }
});

// Final integration: the web UI drives the SAME engine and rules as the simulator.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadRules, RULES_DIR } from '../rules/load.ts';
import { Controller } from '../web/src/controller.ts';
import { optionLabel, decisionHint } from '../web/src/labels.ts';
import { Rng } from '../core/rng.ts';

test('web ruleset file is identical to the simulator ruleset v015', () => {
  const web = JSON.parse(readFileSync(join(RULES_DIR, 'resolved', 'v015.json'), 'utf8'));
  assert.deepEqual(web, JSON.parse(JSON.stringify(loadRules('v015'))));
});

test('web controller plays complete games at 2..7 players (humans + bots), every option has a label', () => {
  const rules = loadRules('v015');
  for (let n = 2; n <= 7; n++) {
    for (let s = 0; s < 8; s++) {
      const seats = Array.from({ length: n }, (_, i) => ({ name: `P${i}`, kind: i % 2 === 0 ? 'human' : 'tactical' }));
      const c = new Controller(seats, 1000 * n + s, rules);
      const rng = new Rng(s);
      let guard = 0;
      while (c.pending && guard++ < 20000) {
        if (c.botTurn()) { c.stepBot(); continue; }
        const d = c.pending;
        for (const o of d.options) assert.ok(!optionLabel(c.g, d, o).includes('?'), `label for ${o.t}`);
        decisionHint(c.g, d);
        c.choose(rng.int(d.options.length));
      }
      assert.ok(c.g.over, `n=${n} s=${s} finished`);
      assert.ok(c.g.winner >= 0);
    }
  }
});

test('game code replays the exact same game (foundation for online play)', () => {
  const rules = loadRules('v015');
  const seats = [{ name: 'A', kind: 'human' }, { name: 'B', kind: 'aggressive' }, { name: 'C', kind: 'human' }, { name: 'D', kind: 'economic' }];
  const c = new Controller(seats, 777, rules);
  const rng = new Rng(3);
  while (c.pending) { if (c.botTurn()) c.stepBot(); else c.choose(rng.int(c.pending.options.length)); }
  const copy = Controller.fromCode(c.exportCode(), rules);
  assert.equal(copy.g.winner, c.g.winner);
  assert.equal(copy.g.turn, c.g.turn);
  assert.deepEqual(copy.g.players.map((p) => p.tokens), c.g.players.map((p) => p.tokens));
});

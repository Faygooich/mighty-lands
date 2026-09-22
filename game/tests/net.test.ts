// v1.0.3 multiplayer: a room and its clients over in-memory links. Complete games are played by
// "people" who pick random options through the network protocol; the tests check that nobody sees
// what they must not, that choices are validated, and that reconnects and room restores keep the game.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadRules } from '../rules/load.ts';
import { Rng } from '../core/rng.ts';
import { Room } from '../net/room.ts';
import { NetClient } from '../net/client.ts';
import { loopback, type Link } from '../net/transport.ts';
import { HIDDEN } from '../net/view.ts';
import { Controller } from '../web/src/controller.ts';
import { normCode, randomCode } from '../net/protocol.ts';

const rules = loadRules('v029');
const tick = () => new Promise<void>((r) => setImmediate(r));
async function settle(n = 6) { for (let i = 0; i < n; i++) await tick(); }

/** A room whose bot timer is a queue the test drains. */
function makeRoom(code = 'TEST', admin = 'tok-admin') {
  const timers: Array<() => void> = [];
  const room = new Room({ code, rules, adminToken: admin, schedule: (fn) => { timers.push(fn); return () => { const i = timers.indexOf(fn); if (i >= 0) timers.splice(i, 1); }; }, seed: () => 777 });
  const links: Link[] = [];
  const dial = async () => { const [a, b] = loopback(); room.attach(b); links.push(a); return a; };
  return { room, timers, dial, links };
}

function client(dial: () => Promise<Link>, name: string, token: string, spectate = false) {
  return new NetClient({ dial, code: 'TEST', name, token, rules, spectate, pingMs: 0 });
}

function assertRedacted(c: NetClient) {
  const g = c.g;
  if (g.over) return;
  for (const p of g.players) {
    if (p.id === c.you) assert.ok(p.hand.every((x) => x !== HIDDEN), 'own hand visible');
    else assert.ok(p.hand.every((x) => x === HIDDEN), `hand of ${p.id} hidden from ${c.you}`);
  }
  assert.ok(g.artDeck.every((x) => x === HIDDEN) && g.spellDeck.every((x) => x === HIDDEN), 'decks hidden');
  if (c.pending && c.pending.player !== c.you) assert.equal(c.pending.options.length, 0, 'foreign options hidden');
  for (const e of c.events) if (e.type === 'draw' && e.player !== c.you) assert.equal(e.b, HIDDEN, 'foreign draw hidden');
}

/** Drive everybody until the game ends: people choose randomly, bots run from the timer queue. */
async function playOut(ctx: ReturnType<typeof makeRoom>, people: NetClient[], rng: Rng, onStep?: (i: number) => Promise<void> | void) {
  for (let step = 0; step < 30000; step++) {
    await settle();
    const c = ctx.room.ctl!;
    if (c.g.over) return step;
    if (onStep) await onStep(step);
    const who = people.find((p) => p.status === 'online' && p.pending && p.pending.player === p.you && p.pending.options.length > 0);
    if (who) {
      assertRedacted(who);
      who.choose(rng.int(who.pending!.options.length));
      continue;
    }
    const t = ctx.timers.shift();
    if (t) { t(); continue; }
    // nobody can act: a person is offline — wait for them
    await settle(20);
    if (!ctx.timers.length && !people.some((p) => p.pending?.player === p.you && p.pending.options.length)) {
      if (!people.every((p) => p.status === 'online')) continue;
      assert.fail(`stuck at step ${step}: pending ${JSON.stringify(c.pending?.kind)} for ${c.pending?.player}`);
    }
  }
  assert.fail('game did not end');
}

test('room codes: 4 unambiguous letters, input is normalised', () => {
  for (let i = 0; i < 200; i++) assert.match(randomCode(), /^[A-HJ-NP-Z]{4}$/);
  assert.equal(normCode(' ab-c d9'), 'ABCD');
});

test('lobby: joins, bots, roles, admin-only ops, start', async () => {
  const ctx = makeRoom();
  const host = client(ctx.dial, 'Хозяин', 'tok-admin');
  const bob = client(ctx.dial, 'Боб', 'tok-bob');
  const eve = client(ctx.dial, 'Ева', 'tok-eve', true);
  await Promise.all([host.start(), bob.start(), eve.start()]);
  await settle();
  assert.equal(host.admin, true);
  assert.equal(bob.admin, false);
  assert.deepEqual(host.room!.seats.map((s) => s.name), ['Хозяин', 'Боб']);
  assert.equal(eve.you, -1);
  assert.deepEqual(host.room!.spectators, ['Ева']);

  bob.adminOp({ op: 'addBot', kind: 'tactical' }); // not the admin: ignored
  await settle();
  assert.equal(host.room!.seats.length, 2);
  assert.ok(bob.notice?.includes('хозяин'));

  host.adminOp({ op: 'addBot', kind: 'aggressive' });
  eve.setRole(false);
  await settle();
  assert.deepEqual(host.room!.seats.map((s) => s.kind), ['human', 'human', 'aggressive', 'human']);
  assert.equal(eve.you, 3);
  host.adminOp({ op: 'remove', seat: 0 }); // the admin's own seat cannot be removed
  host.adminOp({ op: 'start' });
  await settle();
  assert.equal(host.room!.phase, 'game');
  assert.equal(host.g.players.length, 4);
  for (const c of [host, bob, eve]) assertRedacted(c);
  host.stop(); bob.stop(); eve.stop();
});

test('complete networked games at 2..7 seats: redacted views, identical public state, replay reproduces', async () => {
  for (let n = 2; n <= 7; n++) {
    const ctx = makeRoom();
    const people: NetClient[] = [];
    const humans = Math.max(2, Math.ceil(n / 2));
    for (let i = 0; i < humans; i++) people.push(client(ctx.dial, `P${i}`, i === 0 ? 'tok-admin' : `tok-${i}`));
    const watcher = client(ctx.dial, 'Зритель', 'tok-watch', true);
    await Promise.all([...people, watcher].map((c) => c.start()));
    await settle();
    for (let i = humans; i < n; i++) people[0].adminOp({ op: 'addBot', kind: ['tactical', 'economic', 'random'][i % 3] });
    people[0].adminOp({ op: 'botDelay', ms: 0 });
    people[0].adminOp({ op: 'start', seed: 5000 + n });
    await settle();
    await playOut(ctx, people, new Rng(n));
    await settle();
    const truth = ctx.room.ctl!;
    assert.ok(truth.g.over);
    for (const c of [...people, watcher]) {
      assert.equal(c.g.over, true);
      assert.equal(c.g.winner, truth.g.winner);
      assert.deepEqual(c.g.log, truth.g.log, 'log arrives complete and in order');
      assert.deepEqual(c.g.players.map((p) => p.tokens), truth.g.players.map((p) => p.tokens));
      assert.deepEqual(c.g.players.map((p) => p.hand), truth.g.players.map((p) => p.hand), 'hands revealed at the end');
      assert.ok(c.replay, 'replay code sent');
    }
    const again = Controller.fromCode(people[1].replay!, rules);
    assert.deepEqual(again.g.log, truth.g.log, 'replay code reproduces the game');
    for (const c of [...people, watcher]) c.stop();
  }
});

test('stale or foreign choices are rejected', async () => {
  const ctx = makeRoom();
  const a = client(ctx.dial, 'A', 'tok-admin');
  const b = client(ctx.dial, 'B', 'tok-b');
  await Promise.all([a.start(), b.start()]);
  await settle();
  a.adminOp({ op: 'start', seed: 1 });
  await settle();
  const c = ctx.room.ctl!;
  const mover = c.pending!.player === 0 ? a : b;
  const other = mover === a ? b : a;
  const before = c.choices.length;
  // the other player forges a choice for a decision that is not theirs
  (other as unknown as { send(m: unknown): void }).send({ t: 'choose', n: before, idx: 0 });
  // the mover sends a choice for a moment that has passed
  (mover as unknown as { send(m: unknown): void }).send({ t: 'choose', n: before + 5, idx: 0 });
  (mover as unknown as { send(m: unknown): void }).send({ t: 'choose', n: before, idx: 999 });
  await settle();
  assert.equal(c.choices.length, before);
  mover.choose(0);
  mover.choose(0); // double click: the second one is swallowed locally
  await settle();
  assert.equal(c.choices.length, before + 1);
  a.stop(); b.stop();
});

test('reconnect: a dropped player gets their seat back, the game waits; admin can hand the seat to a bot', async () => {
  const ctx = makeRoom();
  const a = client(ctx.dial, 'A', 'tok-admin');
  let b = client(ctx.dial, 'B', 'tok-b');
  const people = [a, b];
  await Promise.all([a.start(), b.start()]);
  await settle();
  a.adminOp({ op: 'botDelay', ms: 0 });
  a.adminOp({ op: 'start', seed: 99 });
  await settle();
  let dropped = false;
  let handed = false;
  await playOut(ctx, people, new Rng(3), async (step) => {
    if (step === 40 && !dropped) {
      dropped = true;
      // B's connection dies (not a clean stop): the client redials by itself
      const link = ctx.links[1];
      link.close();
      await settle(3);
      assert.equal(a.room!.seats[1].online, false);
      await new Promise((r) => setTimeout(r, 800));
      await settle();
      assert.equal(b.status, 'online');
      assert.equal(b.you, 1);
      assert.equal(a.room!.seats[1].online, true);
      assertRedacted(b);
      assert.deepEqual(b.g.log, ctx.room.ctl!.g.log, 'full resync after reconnect');
    }
    if (step === 120 && !handed) {
      handed = true;
      b.stop();
      await settle();
      a.adminOp({ op: 'setKind', seat: 1, kind: 'tactical' });
      await settle();
      assert.equal(a.room!.seats[1].kind, 'tactical');
      // B comes back in a fresh client with the same token and takes the seat back
      const b2 = client(ctx.dial, 'B', 'tok-b');
      await b2.start();
      await settle();
      assert.equal(a.room!.seats[1].kind, 'human');
      assert.equal(b2.you, 1);
      b = b2;
      people[1] = b2;
    }
  });
  assert.ok(dropped && handed);
  a.stop(); b.stop();
});

test('a second tab with the same token takes over; the first one is told why', async () => {
  const ctx = makeRoom();
  const a = client(ctx.dial, 'A', 'tok-admin');
  await a.start();
  const a2 = client(ctx.dial, 'A', 'tok-admin');
  await a2.start();
  await settle();
  assert.equal(a.status, 'closed');
  assert.match(a.error ?? '', /другого устройства/);
  assert.equal(a2.status, 'online');
  a2.stop();
});

test('room snapshot restores lobby and a running game (host reloads the tab)', async () => {
  const ctx = makeRoom();
  const a = client(ctx.dial, 'A', 'tok-admin');
  const b = client(ctx.dial, 'B', 'tok-b');
  await Promise.all([a.start(), b.start()]);
  await settle();
  a.adminOp({ op: 'addBot', kind: 'economic' });
  a.adminOp({ op: 'botDelay', ms: 0 });
  a.adminOp({ op: 'start', seed: 4242 });
  await settle();
  const rng = new Rng(8);
  for (let i = 0; i < 60; i++) {
    await settle();
    const who = [a, b].find((p) => p.pending?.player === p.you && p.pending.options.length);
    if (who) who.choose(rng.int(who.pending!.options.length));
    else ctx.timers.shift()?.();
  }
  await settle();
  const snap = JSON.parse(JSON.stringify(ctx.room.snapshot()));
  const logBefore = [...ctx.room.ctl!.g.log!];
  ctx.room.close();
  a.stop(); b.stop();

  const timers: Array<() => void> = [];
  const r2 = Room.restore(snap, { rules, schedule: (fn) => { timers.push(fn); return () => {}; } });
  assert.equal(r2.phase, 'game');
  assert.deepEqual(r2.ctl!.g.log, logBefore);
  assert.deepEqual(r2.seats.map((s) => s.kind), ['human', 'human', 'economic']);
  const dial = async () => { const [x, y] = loopback(); r2.attach(y); return x; };
  const b2 = new NetClient({ dial, code: 'TEST', name: 'B', token: 'tok-b', rules, pingMs: 0 });
  await b2.start();
  await settle();
  assert.equal(b2.you, 1);
  assert.deepEqual(b2.g.log, logBefore);
  b2.stop();
});

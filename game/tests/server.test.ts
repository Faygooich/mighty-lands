// The room server end to end: a real HTTP + WebSocket server, clients over real sockets, one
// complete game. This is the same code path a hosted deployment uses (docs/multiplayer.md).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadRules } from '../rules/load.ts';
import { Rng } from '../core/rng.ts';
import { NetClient } from '../net/client.ts';
import { startServer } from '../net/server.ts';
import type { Dial, Link } from '../net/transport.ts';

const rules = loadRules('v029');
const tick = () => new Promise<void>((r) => setImmediate(r));
async function settle(n = 4) { for (let i = 0; i < n; i++) await tick(); }

/** The browser transport (web/src/net/ws.ts) on Node's global WebSocket. */
function dialTo(port: number): Dial {
  return (code) => new Promise<Link>((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws/${code}`);
    let open = false;
    const link: Link = { send: (s) => ws.send(s), close: () => ws.close(), onmessage: null, onclose: null };
    ws.onopen = () => { open = true; resolve(link); };
    ws.onmessage = (e) => link.onmessage?.(String(e.data));
    ws.onclose = () => { if (open) link.onclose?.(); else reject(new Error('')); };
    ws.onerror = () => { if (!open) reject(new Error('')); };
  });
}

async function createRoom(port: number, token: string): Promise<string> {
  const r = await fetch(`http://127.0.0.1:${port}/api/rooms`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token }),
  });
  assert.equal(r.status, 200);
  return ((await r.json()) as { code: string }).code;
}

test('server: create a room over HTTP, play a full game over WebSockets', async () => {
  const srv = await startServer(0);
  try {
    const health = await (await fetch(`http://127.0.0.1:${srv.port}/api/health`)).json() as { ok: boolean; rules: string };
    assert.equal(health.ok, true);
    assert.equal(health.rules, rules.version);
    assert.equal((await fetch(`http://127.0.0.1:${srv.port}/api/rooms`, { method: 'POST', body: '{"token":"nope"}' })).status, 400);

    const dial = dialTo(srv.port);
    const code = await createRoom(srv.port, 'a'.repeat(24));
    const host = new NetClient({ dial, code, name: 'Хозяин', token: 'a'.repeat(24), rules, pingMs: 0 });
    const guest = new NetClient({ dial, code, name: 'Гость', token: 'b'.repeat(24), rules, pingMs: 0 });
    await Promise.all([host.start(), guest.start()]);
    await settle(8);
    assert.equal(host.admin, true);
    assert.deepEqual(host.room!.seats.map((s) => s.name), ['Хозяин', 'Гость']);

    host.adminOp({ op: 'addBot', kind: 'tactical' });
    host.adminOp({ op: 'botDelay', ms: 0 });
    host.adminOp({ op: 'start', seed: 20303 });
    await settle(8);
    assert.equal(host.room!.phase, 'game');

    const rng = new Rng(11);
    for (let i = 0; i < 40000 && !host.game?.over; i++) {
      const who = [host, guest].find((c) => c.pending?.player === c.you && c.pending.options.length > 0);
      if (who) who.choose(rng.int(who.pending!.options.length));
      await settle(2);
    }
    assert.equal(host.g.over, true, 'the game finished over real sockets');
    assert.deepEqual(guest.g.log, host.g.log);
    assert.equal(guest.g.winner, host.g.winner);
    host.stop();
    guest.stop();

    const bad = new NetClient({ dial, code: 'ZZZZ', name: 'Потеряшка', token: 'c'.repeat(24), rules, pingMs: 0 });
    await bad.start();
    await new Promise((r) => setTimeout(r, 12000));
    assert.match(bad.error ?? '', /комнат/i);
    assert.equal(bad.status, 'closed', 'a client stops dialling a room that does not exist');
  } finally {
    await srv.close();
  }
});

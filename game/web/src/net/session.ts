// Joining, hosting and surviving a reload, from the browser's side.
//
// P2P (default): the room lives in the host's tab; guests reach it over WebRTC by the room code.
// Server mode (VITE_ROOM_SERVER=<url>|same, or ?server=<url>): the room lives in net/server.ts and
// everybody, the host included, is just a client — nothing else in the app changes.
import { NetClient } from '../../../net/client.ts';
import { Room, type RoomSnapshot } from '../../../net/room.ts';
import { loopback, type Dial } from '../../../net/transport.ts';
import { randomCode, randomToken } from '../../../net/protocol.ts';
import { RULES } from '../rules.ts';
import { dialPeer, listenPeer, type PeerHost } from './peer.ts';
import { createServerRoom, wsDial } from './ws.ts';

const HOST_KEY = 'mz.net.host';
const GUEST_KEY = 'mz.net.guest';
const NAME_KEY = 'mz.net.name';
const TOKEN_KEY = 'mz.net.token';
/** A saved room is offered back for this long. */
const KEEP_MS = 12 * 3600_000;

function read<T>(key: string): T | null {
  try { const s = localStorage.getItem(key); return s ? (JSON.parse(s) as T) : null; } catch { return null; }
}
function write(key: string, value: unknown): void {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* private mode */ }
}
function drop(key: string): void {
  try { localStorage.removeItem(key); } catch { /* private mode */ }
}

export function savedName(): string {
  return read<string>(NAME_KEY) ?? '';
}
export function rememberName(name: string): void {
  write(NAME_KEY, name);
}

/** One token per browser: it is what brings a player back to their seat. */
export function myToken(): string {
  let t = read<string>(TOKEN_KEY);
  if (!t || !/^[0-9a-f]{16,64}$/.test(t)) { t = randomToken(); write(TOKEN_KEY, t); }
  return t;
}

export interface ServerMode { url: string }
export function serverMode(): ServerMode | null {
  const q = new URLSearchParams(location.search).get('server');
  const v = q ?? (import.meta.env.VITE_ROOM_SERVER as string | undefined) ?? '';
  if (!v || v === 'off') return null;
  return { url: v === 'same' ? '' : v };
}

export interface Session {
  client: NetClient;
  /** Only when this tab is the room (P2P host). */
  room: Room | null;
  /** P2P host only: is the code still claimed on the signalling server (can new guests join?). */
  signalling?: { ok: boolean };
  /** Close everything; a host also tells the guests why. */
  leave(reason?: string): void;
}

export function joinUrl(code: string): string {
  const u = new URL(location.href);
  u.search = '';
  u.hash = '';
  u.searchParams.set('room', code);
  const srv = new URLSearchParams(location.search).get('server');
  if (srv) u.searchParams.set('server', srv);
  return u.toString();
}

// ---- guest -------------------------------------------------------------------------------

export async function joinRoom(code: string, name: string, spectate: boolean): Promise<Session> {
  rememberName(name);
  const srv = serverMode();
  const dial: Dial = srv ? wsDial(srv.url) : dialPeer;
  // returning to the room we were in: the host might be mid-reload, so be patient
  const client = new NetClient({ dial, code, name, token: myToken(), rules: RULES, spectate, rejoin: savedGuestRoom() === code });
  write(GUEST_KEY, { code, at: Date.now() });
  await client.start();
  return {
    client,
    room: null,
    leave: () => { client.stop(); drop(GUEST_KEY); },
  };
}

export function savedGuestRoom(): string | null {
  const s = read<{ code: string; at: number }>(GUEST_KEY);
  return s && Date.now() - s.at < KEEP_MS ? s.code : null;
}

// ---- host --------------------------------------------------------------------------------

function persist(room: Room): void {
  write(HOST_KEY, { snap: room.snapshot(), at: Date.now() });
}

export function savedHostRoom(): RoomSnapshot | null {
  const s = read<{ snap: RoomSnapshot; at: number }>(HOST_KEY);
  return s && Date.now() - s.at < KEEP_MS && s.snap?.v === 1 ? s.snap : null;
}
export function forgetHostRoom(): void {
  drop(HOST_KEY);
}

/** P2P: claim a code on the signalling server (retrying if it is taken) and run the room here. */
async function hostP2P(room: Room, code: string, signalling: { ok: boolean }): Promise<PeerHost> {
  return await listenPeer(code, (link) => room.attach(link), (ok) => { signalling.ok = ok; });
}

async function localSession(room: Room, peer: PeerHost | null, name: string, spectate: boolean, signalling: { ok: boolean }): Promise<Session> {
  // the host plays through the same protocol as everybody else, over an in-memory link
  const dial: Dial = async () => { const [mine, theirs] = loopback(); room.attach(theirs); return mine; };
  const client = new NetClient({ dial, code: room.code, name, token: room.adminToken, rules: RULES, spectate, pingMs: 0 });
  await client.start();
  persist(room);
  return {
    client,
    room,
    signalling,
    leave: (reason) => {
      client.stop();
      room.close(reason ?? 'Хозяин закрыл комнату');
      peer?.close();
      forgetHostRoom();
    },
  };
}

export async function hostRoom(name: string, spectate = false): Promise<Session> {
  rememberName(name);
  const token = myToken();
  const srv = serverMode();
  if (srv) {
    // the server owns the room; this tab is only its admin
    const code = await createServerRoom(srv.url, token);
    const client = new NetClient({ dial: wsDial(srv.url), code, name, token, rules: RULES, spectate });
    write(GUEST_KEY, { code, at: Date.now() });
    await client.start();
    return { client, room: null, leave: () => { client.stop(); drop(GUEST_KEY); } };
  }
  let lastErr: Error | null = null;
  const signalling = { ok: false };
  for (let i = 0; i < 6; i++) {
    const code = randomCode();
    const room = new Room({ code, rules: RULES, adminToken: token, onChange: persist });
    try {
      const peer = await hostP2P(room, code, signalling);
      return await localSession(room, peer, name, spectate, signalling);
    } catch (err) {
      lastErr = err as Error;
      room.close();
      if ((err as { type?: string }).type !== 'unavailable-id') break;
    }
  }
  throw new Error(`Не удалось создать комнату: ${lastErr?.message ?? 'сеть недоступна'}`);
}

/** Bring back the room this tab was hosting before it was closed or reloaded. */
export async function resumeHostRoom(snap: RoomSnapshot, name: string): Promise<Session> {
  const room = Room.restore(snap, { rules: RULES, onChange: persist });
  let peer: PeerHost | null = null;
  let lastErr: Error | null = null;
  const signalling = { ok: false };
  // the signalling server may still hold the old code for a few seconds
  for (let i = 0; i < 8; i++) {
    try { peer = await hostP2P(room, room.code, signalling); break; } catch (err) {
      lastErr = err as Error;
      if ((err as { type?: string }).type !== 'unavailable-id') break;
      await new Promise((r) => setTimeout(r, 1500));
    }
  }
  if (!peer) { room.close(); throw new Error(`Комната ${snap.code} не восстановилась: ${lastErr?.message ?? 'сеть недоступна'}`); }
  return await localSession(room, peer, name, false, signalling);
}

// A participant of a room, as seen by the table UI: the same TableCtl interface as a local
// Controller, fed by the room's redacted views. Reconnects on its own with the same token, so a
// dropped Wi-Fi or a reloaded tab returns the player to their seat.
import type { Decision, GameState } from '../core/types.ts';
import type { RuleSet } from '../rules/ruleset.ts';
import type { SeatSetup, TableCtl, UiEvent } from '../web/src/controller.ts';
import type { Dial, Link } from './transport.ts';
import { PROTOCOL, type AdminOp, type ClientMsg, type HostMsg, type RoomInfo, type View } from './protocol.ts';

export type Status = 'connecting' | 'online' | 'reconnecting' | 'closed';

/** Dialling a room that never answers: give up after this many tries (a wrong code, usually). */
const FIRST_TRIES = 4;
/** Coming back to a room we have played in: the host may be reloading — try much longer. */
const REJOIN_TRIES = 15;
/** A room that was alive and went silent: keep trying this long (the host may be reloading). */
const GIVE_UP_MS = 180_000;

export interface ClientOptions {
  dial: Dial;
  code: string;
  name: string;
  token: string;
  rules: RuleSet;
  spectate?: boolean;
  /** We have been in this room before: keep dialling even if the host is briefly away. */
  rejoin?: boolean;
  /** Keep-alive; 0 disables (tests). */
  pingMs?: number;
}

export class NetClient implements TableCtl {
  readonly drivesBots = false;
  readonly code: string;
  status: Status = 'connecting';
  /** Why the connection was lost for good (wrong code, newer tab, version mismatch…). */
  error: string | null = null;
  /** Non-fatal notice from the room. */
  notice: string | null = null;
  room: RoomInfo | null = null;
  you = -1;
  admin = false;
  game: GameState | null = null;
  pending: Decision | null = null;
  events: UiEvent[] = [];
  seq = 0;
  n = 0;
  replay: string | null = null;
  attempts = 0;
  private lostAt = 0;
  /** Has this connection ever been welcomed into the room? */
  private greeted = false;
  private o: ClientOptions;
  private link: Link | null = null;
  private listeners = new Set<() => void>();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private ping: ReturnType<typeof setInterval> | null = null;
  private heard = 0;
  private stopped = false;

  constructor(o: ClientOptions) {
    this.o = o;
    this.code = o.code;
  }

  // ---- TableCtl ---------------------------------------------------------------------------

  get g(): GameState {
    if (!this.game) throw new Error('game not started');
    return this.game;
  }

  get seats(): SeatSetup[] {
    return (this.room?.seats ?? []).map((s) => ({ name: s.name, kind: s.kind }));
  }

  botTurn(): boolean {
    return !!this.pending && this.seats[this.pending.player]?.kind !== 'human';
  }

  stepBot(): void { /* the room steps the bots */ }

  choose(idx: number): void {
    const d = this.pending;
    if (!d || d.player !== this.you || idx < 0 || idx >= d.options.length) return;
    this.send({ t: 'choose', n: this.n, idx });
    // until the room answers: nothing more to click
    this.pending = { ...d, options: [] };
    this.emit();
  }

  exportCode(): string | null {
    return this.replay;
  }

  // ---- lobby -------------------------------------------------------------------------------

  adminOp(op: AdminOp): void { this.send({ t: 'admin', ...op }); }
  setRole(spectate: boolean): void { this.o.spectate = spectate; this.send({ t: 'role', spectate }); }
  rename(name: string): void { this.o.name = name; this.send({ t: 'rename', name }); }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => { this.listeners.delete(fn); };
  }

  // ---- connection --------------------------------------------------------------------------

  async start(): Promise<void> {
    this.stopped = false;
    await this.connect();
    const every = this.o.pingMs ?? 8000;
    if (every > 0 && !this.ping) {
      this.ping = setInterval(() => {
        if (!this.link) return;
        if (Date.now() - this.heard > every * 3) { this.link.close(); return; } // silent: assume dead
        this.send({ t: 'ping' });
      }, every);
    }
  }

  stop(): void {
    this.stopped = true;
    this.status = 'closed';
    if (this.timer) clearTimeout(this.timer);
    if (this.ping) clearInterval(this.ping);
    this.timer = null;
    this.ping = null;
    const l = this.link;
    this.link = null;
    l?.close();
    this.emit();
  }

  private async connect(): Promise<void> {
    if (this.stopped) return;
    this.status = this.attempts === 0 && !this.room ? 'connecting' : 'reconnecting';
    this.emit();
    let link: Link;
    try {
      link = await this.o.dial(this.o.code);
    } catch (err) {
      this.failed((err as Error).message);
      return;
    }
    if (this.stopped) { link.close(); return; }
    this.link = link;
    this.greeted = false;
    this.heard = Date.now();
    // a link we have already abandoned may still deliver: ignore it, or its farewell would stop us
    link.onmessage = (raw) => { if (this.link === link) this.receive(raw); };
    link.onclose = () => {
      if (this.link !== link) return;
      this.link = null;
      if (this.stopped) return;
      this.status = 'reconnecting';
      // a channel that opened but never greeted us is a failure too (no such room, room full…)
      if (this.greeted) { this.emit(); this.retry(); } else this.failed('');
    };
    this.send({ t: 'hello', v: PROTOCOL, name: this.o.name, token: this.o.token, spectate: this.o.spectate });
  }

  /** One unsuccessful attempt: keep dialling, or give up and say why. */
  private failed(msg: string): void {
    this.attempts++;
    if (!this.greeted && !this.room && this.attempts >= (this.o.rejoin ? REJOIN_TRIES : FIRST_TRIES)) {
      this.error = msg || `Комната ${this.o.code} не отвечает. Проверьте код — или хозяин закрыл её.`;
      this.stop();
      return;
    }
    if (this.room) {
      if (!this.lostAt) this.lostAt = Date.now();
      if (Date.now() - this.lostAt > GIVE_UP_MS) {
        this.error = 'Комната молчит больше трёх минут. Похоже, хозяин закрыл её.';
        this.stop();
        return;
      }
    }
    this.retry();
  }

  private retry(): void {
    if (this.stopped || this.timer) return;
    const wait = Math.min(5000, 700 * 2 ** Math.min(this.attempts, 3));
    this.timer = setTimeout(() => { this.timer = null; void this.connect(); }, wait);
    this.emit();
  }

  private send(m: ClientMsg): void {
    try { this.link?.send(JSON.stringify(m)); } catch { /* reconnect will follow */ }
  }

  private receive(raw: string): void {
    this.heard = Date.now();
    let m: HostMsg;
    try { m = JSON.parse(raw) as HostMsg; } catch { return; }
    switch (m.t) {
      case 'welcome':
      case 'room':
        if (m.room.rules !== this.o.rules.version) {
          this.error = `У хозяина другая версия правил (${m.room.rules}, у вас ${this.o.rules.version}). Обновите страницу.`;
          this.stop();
          return;
        }
        if (m.t === 'welcome') { this.greeted = true; this.attempts = 0; this.lostAt = 0; this.error = null; this.status = 'online'; }
        this.room = m.room;
        this.you = m.you;
        this.admin = m.admin;
        if (m.room.phase === 'lobby') { this.game = null; this.pending = null; this.replay = null; }
        break;
      case 'state': this.apply(m.view, m.full); break;
      case 'replay': this.replay = m.code; break;
      case 'error':
        if (m.fatal) { this.error = m.msg; this.stop(); return; }
        this.notice = m.msg;
        break;
      case 'pong': return;
    }
    this.emit();
  }

  private apply(v: View, full: boolean): void {
    const prevLog = full || !this.game ? [] : this.game.log ?? [];
    const log = prevLog.slice(0, v.logFrom).concat(v.log);
    this.game = { ...v.g, rules: this.o.rules, rng: null as never, hooks: null, log };
    this.pending = v.pending;
    this.n = v.n;
    if (full) this.events = [];
    else {
      this.events.push(...v.events);
      if (this.events.length > 600) this.events.splice(0, 300);
    }
    this.seq = v.seq;
  }

  private emit(): void {
    for (const fn of this.listeners) fn();
  }
}

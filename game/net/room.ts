// A room: lobby, seats, spectators and the one authoritative game. Environment-neutral — it only
// needs Links (net/transport.ts) and a timer, so it runs in the host's browser (P2P) or in a Node
// server (net/server.ts) unchanged. Rules stay in game/core: the room feeds option indices to the
// same Controller the local game uses, and every participant gets a redacted view (net/view.ts).
import type { RuleSet } from '../rules/ruleset.ts';
import { Controller, type SeatSetup } from '../web/src/controller.ts';
import type { Link } from './transport.ts';
import { publicDecision, publicEvent, publicState } from './view.ts';
import {
  MAX_SEATS, MIN_SEATS, PROTOCOL, cleanName,
  type AdminOp, type ClientMsg, type HostMsg, type Phase, type RoomInfo, type View,
} from './protocol.ts';

export const BOT_KINDS = ['tactical', 'aggressive', 'defensive', 'economic', 'survival', 'random'];
const MAX_MEMBERS = 40;
/** A full resync carries at most this many log lines (a 7-player game writes ~1000). */
const FULL_LOG_LINES = 250;
const STEP_MS = 170; // Board.tsx: one pawn step

interface Seat { name: string; kind: string; token: string | null }
interface Member { token: string; name: string; link: Link | null; lastSeq: number; logSent: number }

export interface RoomSnapshot {
  v: 1;
  code: string;
  adminToken: string;
  phase: Phase;
  botDelay: number;
  seats: Seat[];
  members: Array<{ token: string; name: string }>;
  /** Controller.exportCode() of the running game. */
  game: string | null;
}

export interface RoomOptions {
  code: string;
  rules: RuleSet;
  adminToken: string;
  /** Timer (injectable for tests). Returns a cancel function. */
  schedule?: (fn: () => void, ms: number) => () => void;
  /** Called after every change worth persisting. */
  onChange?: (room: Room) => void;
  /** Seed for a new game when the admin does not give one. */
  seed?: () => number;
}

const defaultSchedule = (fn: () => void, ms: number) => { const t = setTimeout(fn, ms); return () => clearTimeout(t); };

export class Room {
  readonly code: string;
  readonly rules: RuleSet;
  readonly adminToken: string;
  phase: Phase = 'lobby';
  seats: Seat[] = [];
  botDelay = 900;
  ctl: Controller | null = null;
  private members = new Map<string, Member>();
  private links = new Map<Link, string | null>();
  private cancelBot: (() => void) | null = null;
  private animSeq = 0;
  private schedule: NonNullable<RoomOptions['schedule']>;
  private onChange: RoomOptions['onChange'];
  private seed: () => number;

  constructor(o: RoomOptions) {
    this.code = o.code;
    this.rules = o.rules;
    this.adminToken = o.adminToken;
    this.schedule = o.schedule ?? defaultSchedule;
    this.onChange = o.onChange;
    this.seed = o.seed ?? (() => Math.floor(Math.random() * 1e9));
  }

  // ---- links ---------------------------------------------------------------------------

  attach(link: Link): void {
    this.links.set(link, null);
    link.onmessage = (raw) => {
      let msg: ClientMsg;
      try { msg = JSON.parse(raw) as ClientMsg; } catch { return; }
      try { this.handle(link, msg); } catch (err) { this.send(link, { t: 'error', msg: `Ошибка комнаты: ${(err as Error).message}` }); }
    };
    link.onclose = () => this.detach(link);
  }

  private detach(link: Link): void {
    const token = this.links.get(link);
    this.links.delete(link);
    const m = token ? this.members.get(token) : undefined;
    if (m && m.link === link) {
      m.link = null;
      this.broadcastRoom();
      this.changed();
    }
  }

  /** Everybody still connected (used by a server to garbage-collect empty rooms). */
  online(): number {
    let n = 0;
    for (const m of this.members.values()) if (m.link) n++;
    return n;
  }

  close(reason?: string): void {
    this.cancelBot?.();
    this.cancelBot = null;
    for (const l of [...this.links.keys()]) {
      if (reason) this.send(l, { t: 'error', msg: reason, fatal: true });
      l.close();
    }
    this.links.clear();
  }

  // ---- messages ------------------------------------------------------------------------

  private handle(link: Link, msg: ClientMsg): void {
    if (msg.t === 'ping') return this.send(link, { t: 'pong' });
    if (msg.t === 'hello') return this.hello(link, msg);
    const token = this.links.get(link);
    const m = token ? this.members.get(token) : undefined;
    if (!m) return this.send(link, { t: 'error', msg: 'Сначала представьтесь' });
    switch (msg.t) {
      case 'choose': return this.choose(m, msg.n, msg.idx);
      case 'role': return this.role(m, msg.spectate);
      case 'rename': return this.rename(m, msg.name);
      case 'admin':
        if (m.token !== this.adminToken) return this.send(link, { t: 'error', msg: 'Это может только хозяин комнаты' });
        return this.admin(msg);
    }
  }

  private hello(link: Link, msg: Extract<ClientMsg, { t: 'hello' }>): void {
    if (msg.v !== PROTOCOL) return this.send(link, { t: 'error', msg: 'Версии игры не совпадают — обновите страницу', fatal: true });
    if (!msg.token || typeof msg.token !== 'string') return this.send(link, { t: 'error', msg: 'Нет токена', fatal: true });
    let m = this.members.get(msg.token);
    if (!m) {
      if (this.members.size >= MAX_MEMBERS) return this.send(link, { t: 'error', msg: 'Комната переполнена', fatal: true });
      m = { token: msg.token, name: cleanName(msg.name), link: null, lastSeq: 0, logSent: 0 };
      this.members.set(m.token, m);
    }
    if (m.link && m.link !== link) {
      const old = m.link;
      this.send(old, { t: 'error', msg: 'Вы вошли в комнату с другого устройства или вкладки', fatal: true });
      this.links.delete(old);
      old.close();
    }
    m.link = link;
    this.links.set(link, m.token);
    let seat = this.seatOf(m.token);
    if (this.phase === 'lobby') {
      if (seat < 0 && !msg.spectate && this.seats.length < MAX_SEATS) {
        this.seats.push({ name: m.name, kind: 'human', token: m.token });
        seat = this.seats.length - 1;
      }
    } else if (seat >= 0 && this.seats[seat].kind !== 'human') {
      // back from a disconnect: take the seat back from the bot that kept it warm
      this.seats[seat].kind = 'human';
      this.ctl?.setSeatKind(seat, 'human');
    }
    this.send(link, { t: 'welcome', you: seat, admin: m.token === this.adminToken, room: this.info() });
    if (this.ctl) this.sendState(m, true);
    this.broadcastRoom();
    this.pump();
    this.changed();
  }

  private choose(m: Member, n: number, idx: number): void {
    const c = this.ctl;
    const seat = this.seatOf(m.token);
    if (!c || !c.pending || seat < 0 || c.pending.player !== seat || this.seats[seat].kind !== 'human') return;
    if (n !== c.choices.length || !Number.isInteger(idx) || idx < 0 || idx >= c.pending.options.length) return this.sendState(m, false);
    c.choose(idx);
    this.afterMove();
  }

  private role(m: Member, spectate: boolean): void {
    if (this.phase !== 'lobby') return;
    const seat = this.seatOf(m.token);
    if (spectate && seat >= 0) this.seats.splice(seat, 1);
    if (!spectate && seat < 0 && this.seats.length < MAX_SEATS) this.seats.push({ name: m.name, kind: 'human', token: m.token });
    this.broadcastRoom();
    this.changed();
  }

  private rename(m: Member, name: string): void {
    if (this.phase !== 'lobby') return;
    m.name = cleanName(name);
    const seat = this.seatOf(m.token);
    if (seat >= 0) this.seats[seat].name = m.name;
    this.broadcastRoom();
    this.changed();
  }

  private admin(a: AdminOp): void {
    const lobby = this.phase === 'lobby';
    switch (a.op) {
      case 'addBot': {
        if (!lobby || this.seats.length >= MAX_SEATS || !BOT_KINDS.includes(a.kind)) return;
        this.seats.push({ name: this.botName(), kind: a.kind, token: null });
        break;
      }
      case 'setKind': {
        const s = this.seats[a.seat];
        if (!s || !(BOT_KINDS.includes(a.kind) || (a.kind === 'human' && s.token))) return;
        if (a.kind === 'human' && !this.members.get(s.token!)?.link) return; // nobody to give it back to
        s.kind = a.kind;
        this.ctl?.setSeatKind(a.seat, a.kind);
        break;
      }
      case 'remove': {
        if (!lobby || !this.seats[a.seat] || this.seats[a.seat].token === this.adminToken) return;
        this.seats.splice(a.seat, 1);
        break;
      }
      case 'shuffle': {
        if (!lobby) return;
        for (let i = this.seats.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [this.seats[i], this.seats[j]] = [this.seats[j], this.seats[i]];
        }
        break;
      }
      case 'start': {
        if (!lobby || this.seats.length < MIN_SEATS) return;
        this.startGame(a.seed ?? this.seed());
        return;
      }
      case 'botDelay': {
        this.botDelay = Math.max(0, Math.min(5000, Math.round(a.ms)));
        break;
      }
      case 'lobby': {
        if (lobby) return;
        this.cancelBot?.();
        this.cancelBot = null;
        this.ctl = null;
        this.phase = 'lobby';
        for (const s of this.seats) if (s.token) s.kind = 'human';
        break;
      }
    }
    this.broadcastRoom();
    this.changed();
  }

  private botName(): string {
    const taken = new Set(this.seats.map((s) => s.name));
    const pool = ['Громобой', 'Валькирия', 'Бородарь', 'Кувалда', 'Ярополк', 'Броня', 'Хрящ'];
    return pool.find((n) => !taken.has(n)) ?? `Бот ${this.seats.length + 1}`;
  }

  // ---- the game ------------------------------------------------------------------------

  private startGame(seed: number): void {
    this.ctl = new Controller(this.seats.map((s) => ({ name: s.name, kind: s.kind }) as SeatSetup), seed, this.rules);
    this.phase = 'game';
    this.animSeq = this.ctl.seq;
    for (const m of this.members.values()) { m.lastSeq = 0; m.logSent = 0; }
    this.broadcastRoom();
    for (const m of this.members.values()) if (m.link) this.sendState(m, true);
    this.pump();
    this.changed();
  }

  private afterMove(): void {
    for (const m of this.members.values()) if (m.link) this.sendState(m, false);
    const c = this.ctl;
    if (c?.g.over) {
      const code = c.exportCode();
      for (const m of this.members.values()) if (m.link) this.send(m.link, { t: 'replay', code });
    }
    this.pump();
    this.changed();
  }

  /** Schedule the next bot move, leaving time for the animations of what just happened. */
  private pump(): void {
    const c = this.ctl;
    if (this.cancelBot || !c || !c.pending || !c.botTurn()) return;
    let anim = 0;
    for (const e of c.events) {
      if (e.seq <= this.animSeq) continue;
      if (e.type === 'move' && e.a > 0) anim = Math.max(anim, 650 + e.a * STEP_MS);
      else if (e.type.startsWith('fight') || e.type.startsWith('flee') || e.type.startsWith('artifactFlee')) anim = Math.max(anim, 900);
      else if (e.type === 'spell') anim = Math.max(anim, 1100);
    }
    this.animSeq = c.seq;
    const wait = this.botDelay === 0 ? 0 : Math.max(this.botDelay, anim + 250);
    this.cancelBot = this.schedule(() => {
      this.cancelBot = null;
      if (this.ctl !== c || !c.pending || !c.botTurn()) return;
      c.stepBot();
      this.afterMove();
    }, wait);
  }

  // ---- output --------------------------------------------------------------------------

  private seatOf(token: string): number {
    return this.seats.findIndex((s) => s.token === token);
  }

  info(): RoomInfo {
    const seated = new Set(this.seats.map((s) => s.token));
    return {
      code: this.code,
      phase: this.phase,
      rules: this.rules.version,
      botDelay: this.botDelay,
      seats: this.seats.map((s) => ({
        name: s.name,
        kind: s.kind,
        person: !!s.token,
        online: s.token ? !!this.members.get(s.token)?.link : true,
        admin: s.token === this.adminToken,
      })),
      spectators: [...this.members.values()].filter((m) => !seated.has(m.token) && m.link).map((m) => m.name),
    };
  }

  private broadcastRoom(): void {
    const room = this.info();
    for (const m of this.members.values()) {
      if (m.link) this.send(m.link, { t: 'room', you: this.seatOf(m.token), admin: m.token === this.adminToken, room });
    }
  }

  private sendState(m: Member, full: boolean): void {
    const c = this.ctl;
    if (!c || !m.link) return;
    const seat = this.seatOf(m.token);
    const log = c.g.log ?? [];
    if (full) { m.lastSeq = c.seq; m.logSent = Math.max(0, log.length - FULL_LOG_LINES); }
    const view: View = {
      g: publicState(c.g, seat),
      pending: publicDecision(c.pending, seat),
      n: c.choices.length,
      events: full ? [] : c.events.filter((e) => e.seq > m.lastSeq).map((e) => publicEvent(e, seat)),
      seq: c.seq,
      logFrom: m.logSent,
      log: log.slice(m.logSent),
    };
    m.lastSeq = c.seq;
    m.logSent = log.length;
    this.send(m.link, { t: 'state', view, full });
  }

  private send(link: Link, msg: HostMsg): void {
    try { link.send(JSON.stringify(msg)); } catch { /* the link is going away; onclose will follow */ }
  }

  private changed(): void {
    this.onChange?.(this);
  }

  // ---- persistence (the host's tab can be reloaded without losing the game) ----------------

  snapshot(): RoomSnapshot {
    return {
      v: 1,
      code: this.code,
      adminToken: this.adminToken,
      phase: this.phase,
      botDelay: this.botDelay,
      seats: this.seats.map((s) => ({ ...s })),
      members: [...this.members.values()].map((m) => ({ token: m.token, name: m.name })),
      game: this.ctl ? this.ctl.exportCode() : null,
    };
  }

  static restore(s: RoomSnapshot, o: Omit<RoomOptions, 'code' | 'adminToken'>): Room {
    const r = new Room({ ...o, code: s.code, adminToken: s.adminToken });
    r.botDelay = s.botDelay;
    r.seats = s.seats.map((x) => ({ ...x }));
    for (const m of s.members) r.members.set(m.token, { token: m.token, name: m.name, link: null, lastSeq: 0, logSent: 0 });
    if (s.phase === 'game' && s.game) {
      r.ctl = Controller.fromCode(s.game, o.rules);
      r.phase = 'game';
      r.animSeq = r.ctl.seq;
      // the game waits for people to reconnect; seats already handed to bots stay with them
      r.seats.forEach((seat, i) => r.ctl!.setSeatKind(i, seat.kind));
    }
    return r;
  }
}

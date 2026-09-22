// Drives the shared engine generator for the UI. Rules live ONLY in game/core — this file just
// forwards decisions to humans or bots and keeps a replay record (seed + choices).
import type { Decision, Engine, EventType, GameState, Hooks } from '../../core/types.ts';
import type { RuleSet } from '../../rules/ruleset.ts';
import { createGame } from '../../core/state.ts';
import { playGame } from '../../core/engine.ts';
import { makeBot } from '../../simulation/bots/index.ts';
import type { Chooser } from '../../core/engine.ts';

export interface SeatSetup {
  name: string;
  /** 'human' or a bot type (tactical, aggressive, …). */
  kind: string;
}

export interface UiEvent {
  type: EventType;
  player: number;
  a: number;
  b: string | number | null;
  /** Monotonic id — the UI animates every event it has not seen yet. */
  seq: number;
}

/** What the table UI needs from a game: a local Controller or a network client (net/client.ts). */
export interface TableCtl {
  g: GameState;
  pending: Decision | null;
  seats: SeatSetup[];
  events: UiEvent[];
  seq: number;
  /** Does this UI step the bots itself? (false over the network: the room host does it.) */
  readonly drivesBots: boolean;
  botTurn(): boolean;
  stepBot(): void;
  choose(idx: number): void;
  /** Replay code, or null when this client cannot see the whole game. */
  exportCode(): string | null;
}

export class Controller implements Hooks, TableCtl {
  readonly drivesBots = true;
  g: GameState;
  it: Engine;
  pending: Decision | null = null;
  bots: Array<Chooser | null>;
  seats: SeatSetup[];
  choices: number[] = [];
  lastRoll = 0;
  lastEvent: UiEvent | null = null;
  /** Recent engine events (bounded), consumed by the UI for animations and feedback. */
  events: UiEvent[] = [];
  seq = 0;

  constructor(seats: SeatSetup[], seed: number, rules: RuleSet) {
    this.seats = seats;
    this.g = createGame(rules, seats.map((s) => ({ name: s.name, bot: s.kind })), seed, this, true);
    this.bots = seats.map((s, i) => (s.kind === 'human' ? null : makeBot(s.kind, seed * 31 + i)));
    this.it = playGame(this.g);
    this.advance(undefined);
  }

  ev(type: EventType, player: number, a: number, b: string | number | null): void {
    if (type === 'move') this.lastRoll = a;
    const e: UiEvent = { type, player, a, b, seq: ++this.seq };
    this.lastEvent = e;
    this.events.push(e);
    if (this.events.length > 600) this.events.splice(0, 300);
  }

  /** Feed a choice (or start) and stop at the next decision. */
  advance(choice: number | undefined): void {
    const r = choice === undefined ? this.it.next() : this.it.next(choice);
    this.pending = r.done ? null : r.value;
  }

  /** Is the pending decision for a bot? */
  botTurn(): boolean {
    return !!this.pending && this.bots[this.pending.player] !== null;
  }

  stepBot(): void {
    if (!this.pending) return;
    const bot = this.bots[this.pending.player];
    if (!bot) return;
    let idx = bot(this.g, this.pending);
    if (!(idx >= 0 && idx < this.pending.options.length)) idx = 0;
    this.choose(idx);
  }

  /** Hand a seat to a bot or back to a human mid-game (network: a player dropped out or returned). */
  setSeatKind(seat: number, kind: string): void {
    this.seats[seat] = { ...this.seats[seat], kind };
    this.bots[seat] = kind === 'human' ? null : makeBot(kind, this.g.seed * 31 + seat + this.choices.length * 7919);
  }

  choose(idx: number): void {
    this.choices.push(idx);
    this.advance(idx);
  }

  /** Replay code: enough to reproduce the game exactly (foundation for online play). */
  exportCode(): string {
    return JSON.stringify({ rules: this.g.rules.version, seed: this.g.seed, seats: this.seats, choices: this.choices });
  }

  static fromCode(code: string, rules: RuleSet): Controller {
    const d = JSON.parse(code) as { seed: number; seats: SeatSetup[]; choices: number[] };
    const c = new Controller(d.seats, d.seed, rules);
    for (const idx of d.choices) {
      if (!c.pending) break;
      c.choose(idx);
    }
    return c;
  }
}

// Per-game metrics collector (engine Hooks). Produces a compact GameRecord.
import type { EventType, GameState, Hooks } from '../core/types.ts';
import { power, standing } from '../core/state.ts';

export interface PlayerStats {
  hpLost: number; hpGained: number; powerGained: number; powerPaid: number; burned: number;
  captures: number; usurps: number; landsLost: number; landsEnd: number; landValueEnd: number; maxLands: number;
  artPlaced: number; artTriggeredOwn: number; artHit: number; artFleeOk: number;
  spells: number; fleeOk: number; fleeFail: number; fightWin: number; fightLose: number; encounters: number;
  died: number; deathRound: number; discards: number; changeHeal: number; income: number;
  decisions: number; meaningful: number; turns: number; skips: number; hpEnd: number; powerEnd: number;
}

export function newPlayerStats(): PlayerStats {
  return {
    hpLost: 0, hpGained: 0, powerGained: 0, powerPaid: 0, burned: 0,
    captures: 0, usurps: 0, landsLost: 0, landsEnd: 0, landValueEnd: 0, maxLands: 0,
    artPlaced: 0, artTriggeredOwn: 0, artHit: 0, artFleeOk: 0,
    spells: 0, fleeOk: 0, fleeFail: 0, fightWin: 0, fightLose: 0, encounters: 0,
    died: 0, deathRound: -1, discards: 0, changeHeal: 0, income: 0,
    decisions: 0, meaningful: 0, turns: 0, skips: 0, hpEnd: 0, powerEnd: 0,
  };
}

export interface GameRecord {
  seed: number;
  bots: string[];
  winner: number;
  rounds: number;
  turns: number;
  timeout: boolean;
  endReason: string;
  players: PlayerStats[];
  /** leader (by standing) at 25/50/75% of the game. */
  leaderAt: [number, number, number];
  lastAtHalf: number;
  leadChanges: number;
  firstCapturer: number;
  cardDrawn: Record<string, number>;
  /** per player: cards played (spells cast / artifacts placed). */
  cardPlayed: Array<Record<string, number>>;
  landCaptures: number[];
  landOwnerAtEnd: number[];
  denomCounts: Record<number, number>;
  powerByRound: number[];
  choice: Record<string, number>;
  hpLossBySource: Record<string, number>;
  maxRepeat: number;
}

export class Collector implements Hooks {
  g!: GameState;
  ps: PlayerStats[] = [];
  leaders: number[] = [];
  standings: number[][] = [];
  cardDrawn: Record<string, number> = {};
  cardPlayed: Array<Record<string, number>> = [];
  landCaptures: number[] = [];
  denomCounts: Record<number, number> = {};
  powerByRound: number[] = [];
  choiceMap = new Map<string, number>();
  hpLossBySource: Record<string, number> = {};
  firstCapturer = -1;
  lastState = '';
  repeat = 0;
  maxRepeat = 0;

  attach(g: GameState): void {
    this.g = g;
    this.ps = g.players.map(() => newPlayerStats());
    this.cardPlayed = g.players.map(() => ({}));
    this.landCaptures = g.cells.map(() => 0);
    g.hooks = this;
  }

  ev(type: EventType, p: number, a: number, b: string | number | null): void {
    const s = p >= 0 ? this.ps[p] : null;
    switch (type) {
      case 'round': this.snapshot(); break;
      case 'turn': s!.turns++; break;
      case 'skip': s!.skips++; break;
      case 'draw': this.cardDrawn[b as string] = (this.cardDrawn[b as string] ?? 0) + 1; break;
      case 'income': s!.income += a; break;
      case 'encounter': s!.encounters++; break;
      case 'capture':
        if (b === 'usurp') s!.usurps++; else s!.captures++;
        this.landCaptures[a]++;
        if (this.firstCapturer < 0) this.firstCapturer = p;
        break;
      case 'fleeOk': s!.fleeOk++; break;
      case 'fleeFail': s!.fleeFail++; break;
      case 'fightWin': s!.fightWin++; break;
      case 'fightLose': s!.fightLose++; break;
      case 'hpLoss': s!.hpLost++; this.hpLossBySource[srcKey(b as string)] = (this.hpLossBySource[srcKey(b as string)] ?? 0) + 1; break;
      case 'hpGain': s!.hpGained += a; break;
      case 'receive': s!.powerGained += a; break;
      case 'pay': s!.powerPaid += a; break;
      case 'burn': s!.burned += a; break;
      case 'change': if (a > 0) s!.changeHeal += a; break;
      case 'death': s!.died = 1; s!.deathRound = this.g.round; break;
      case 'landLost': s!.landsLost++; break;
      case 'artifactPlace': s!.artPlaced++; this.play(p, b as string); break;
      case 'artifactTrigger': s!.artTriggeredOwn++; this.ps[a].artHit++; break;
      case 'artifactFleeOk': s!.artFleeOk++; break;
      case 'spell': s!.spells++; this.play(p, b as string); break;
      case 'discard': s!.discards++; break;
      case 'decision':
        s!.decisions++;
        if (a >= 2) s!.meaningful++;
        break;
    }
  }

  /** Record which option type was chosen (called by the runner). */
  chose(kind: string, t: string): void {
    const k = kind + ':' + t;
    this.choiceMap.set(k, (this.choiceMap.get(k) ?? 0) + 1);
  }

  play(p: number, card: string): void {
    const m = this.cardPlayed[p];
    m[card] = (m[card] ?? 0) + 1;
  }

  snapshot(): void {
    const g = this.g;
    let best = -1;
    let bestS = -Infinity;
    let total = 0;
    const st: number[] = [];
    for (const p of g.players) {
      const s = standing(g, p);
      st.push(s);
      if (p.alive) total += power(p);
      if (s > bestS) { bestS = s; best = p.id; }
      for (const t of p.tokens) this.denomCounts[t] = (this.denomCounts[t] ?? 0) + 1;
      const lands = g.cells.reduce((n, c) => n + (c.land && c.land.owner === p.id ? 1 : 0), 0);
      if (lands > this.ps[p.id].maxLands) this.ps[p.id].maxLands = lands;
    }
    this.leaders.push(best);
    this.standings.push(st);
    this.powerByRound.push(total);
    // repeated-state detector (stalling / loops): positions+tokens+owners signature
    const sig = g.players.map((p) => `${p.alive ? 1 : 0}${p.tokens.join('.')}`).join('|') + g.cells.map((c) => (c.land ? c.land.owner + 1 : '')).join('');
    if (sig === this.lastState) { this.repeat++; if (this.repeat > this.maxRepeat) this.maxRepeat = this.repeat; }
    else { this.repeat = 0; this.lastState = sig; }
  }

  finish(): GameRecord {
    const g = this.g;
    this.snapshot();
    const R = this.leaders.length;
    const at = (f: number) => this.leaders[Math.min(R - 1, Math.floor(R * f))];
    const half = this.standings[Math.min(R - 1, Math.floor(R * 0.5))];
    let last = -1;
    let lastS = Infinity;
    half.forEach((s, i) => { if (s >= 0 && s < lastS) { lastS = s; last = i; } });
    let changes = 0;
    for (let i = 1; i < R; i++) if (this.leaders[i] !== this.leaders[i - 1]) changes++;
    for (const p of g.players) {
      const s = this.ps[p.id];
      s.hpEnd = p.tokens.length;
      s.powerEnd = power(p);
      for (const c of g.cells) if (c.land && c.land.owner === p.id) { s.landsEnd++; s.landValueEnd += c.land.baseMonster; }
    }
    return {
      seed: g.seed,
      bots: g.players.map((p) => p.bot),
      winner: g.winner,
      rounds: g.round,
      turns: g.turn,
      timeout: g.timeout,
      endReason: g.endReason,
      players: this.ps,
      leaderAt: [at(0.25), at(0.5), at(0.75)],
      lastAtHalf: last,
      leadChanges: changes,
      firstCapturer: this.firstCapturer,
      cardDrawn: this.cardDrawn,
      cardPlayed: this.cardPlayed,
      landCaptures: this.landCaptures,
      landOwnerAtEnd: g.cells.map((c) => (c.land ? c.land.owner : -2)),
      denomCounts: this.denomCounts,
      powerByRound: this.powerByRound,
      choice: Object.fromEntries(this.choiceMap),
      hpLossBySource: this.hpLossBySource,
      maxRepeat: this.maxRepeat,
    };
  }
}

function srcKey(s: string): string {
  if (s.startsWith('Монстр')) return 'monster';
  if (s === 'Капкан') return 'trap';
  if (s === 'Огненный шар') return 'fireball';
  return s;
}

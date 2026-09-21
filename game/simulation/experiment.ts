// Experiment definitions shared by main thread and workers (must be structured-clonable).
import type { RuleSet } from '../rules/ruleset.ts';
import type { GameState } from '../core/types.ts';
import { Rng } from '../core/rng.ts';
import { runOne } from './runner.ts';
import { addRecord, newAgg, type Agg } from '../statistics/aggregate.ts';
import type { Weights } from './bots/heuristic.ts';
import { sortDesc } from '../core/tokens.ts';

export type LineupSpec =
  | { type: 'fixed'; bots: string[] }
  | { type: 'mixed'; pool: string[]; n: number };

export interface Batch {
  rules: RuleSet;
  lineup: LineupSpec;
  seedStart: number;
  count: number;
  scenario?: string;
  genomes?: Record<string, Partial<Weights>>;
  noShuffle?: boolean;
}

export const SEEDS = {
  training: 1_000_000,
  validation: 2_000_000,
  holdout: 3_000_000,
  final: 9_000_000,
} as const;

/** Targeted scenario setups (mutate the initial state). */
export const SCENARIOS: Record<string, (g: GameState) => void> = {
  lowHp: (g) => { for (const p of g.players) p.tokens = [300]; },
  highHp: (g) => { for (const p of g.players) p.tokens = [500, 300, 300, 100, 100]; },
  extremeEconomy: (g) => { for (const p of g.players) p.tokens = [1000, 1000, 1000, 1000, 1000]; },
  poorStart: (g) => { for (const p of g.players) p.tokens = [100, 100, 100]; },
  lateGame: (g) => {
    // every land pre-owned round-robin, all with random artifacts from the deck
    let i = 0;
    for (const c of g.cells) if (c.land) { c.land.owner = i++ % g.players.length; c.land.artifact = g.artDeck.pop() ?? null; }
  },
  earlyLead: (g) => {
    // seat 0 starts with a big advantage — measures comeback potential
    g.players[0].tokens = sortDesc([1000, 500, 300, 300, 100]);
    let k = 0;
    for (const c of g.cells) if (c.land && c.land.region === 0 && k < 3) { c.land.owner = 0; k++; }
  },
};

export function lineupFor(spec: LineupSpec, seed: number): string[] {
  if (spec.type === 'fixed') return spec.bots;
  const rng = new Rng(seed ^ 0x2545f491);
  const pool = spec.pool.slice();
  const out: string[] = [];
  for (let i = 0; i < spec.n; i++) {
    if (pool.length === 0) pool.push(...spec.pool);
    out.push(pool.splice(rng.int(pool.length), 1)[0]);
  }
  return out;
}

export function runBatch(b: Batch): Agg {
  const agg = newAgg();
  const setup = b.scenario ? SCENARIOS[b.scenario] : undefined;
  for (let s = b.seedStart; s < b.seedStart + b.count; s++) {
    const lineup = lineupFor(b.lineup, s);
    const { rec } = runOne(b.rules, lineup, s, { setup, genomes: b.genomes, shuffleSeats: !b.noShuffle });
    addRecord(agg, rec);
    const cap = b.rules.roundCap;
    let reason = '';
    if (rec.timeout) reason = 'timeout';
    else if (rec.rounds <= 3) reason = 'very-short';
    else if (rec.maxRepeat >= 10) reason = 'repeat-loop';
    else if (rec.rounds >= cap * 0.8) reason = 'very-long';
    else if (rec.winner >= 0 && rec.players[rec.winner].landsEnd >= 14) reason = 'monopoly';
    if (reason && agg.anomalies.length < 20) agg.anomalies.push({ seed: s, reason, bots: lineup });
  }
  return agg;
}

// Runs one deterministic game: (rules, lineup, seed) -> GameRecord.
import type { RuleSet } from '../rules/ruleset.ts';
import type { Decision, GameState } from '../core/types.ts';
import { createGame } from '../core/state.ts';
import { runGame, type Chooser } from '../core/engine.ts';
import { Rng } from '../core/rng.ts';
import { Collector, type GameRecord } from '../statistics/metrics.ts';
import { BOT_LABEL, makeBot } from './bots/index.ts';
import type { Weights } from './bots/heuristic.ts';

export interface RunOptions {
  /** Shuffle seats deterministically by seed (default true). */
  shuffleSeats?: boolean;
  log?: boolean;
  record?: boolean;
  genomes?: Record<string, Partial<Weights>>;
  /** Mutates the fresh game before play (targeted scenarios). */
  setup?: (g: GameState) => void;
}

export interface RunResult {
  rec: GameRecord;
  choices?: number[];
  log?: string[];
}

/** Label of a chosen option for decision-diversity statistics. */
function choiceLabel(g: GameState, d: Decision, o: Decision['options'][number]): string {
  switch (o.t) {
    case 'spell': case 'artifact': case 'discard': case 'react': return `${o.t}:${o.card}`;
    case 'token': return o.value === g.players[d.player].tokens[g.players[d.player].tokens.length - 1] ? 'token:min' : 'token:other';
    case 'pay': return `pay:${o.tokens.length}`;
    default: return o.t;
  }
}

export function runOne(rules: RuleSet, lineup: string[], seed: number, opt: RunOptions = {}): RunResult {
  const bots = lineup.slice();
  if (opt.shuffleSeats !== false) new Rng(seed ^ 0x9e3779b9).shuffle(bots);
  const g = createGame(rules, bots.map((b, i) => ({ name: `${BOT_LABEL[b] ?? b}#${i + 1}`, bot: b })), seed, null, !!opt.log);
  if (opt.setup) opt.setup(g);
  const col = new Collector();
  col.attach(g);
  const choosers: Chooser[] = bots.map((b, i) => {
    const base = makeBot(b, seed * 31 + i, opt.genomes?.[b]);
    return (gs: GameState, d: Decision) => {
      const idx = base(gs, d);
      const o = d.options[idx] ?? d.options[0];
      // RandomBot noise would make trivial decisions look diverse — excluded from entropy stats
      if (b !== 'random') col.chose(d.kind, choiceLabel(gs, d, o));
      return idx;
    };
  });
  const record: number[] | undefined = opt.record ? [] : undefined;
  runGame(g, choosers, record);
  return { rec: col.finish(), choices: record, log: g.log ?? undefined };
}

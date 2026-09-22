// Standard evaluation suite: which experiments are run for every ruleset.
import type { RuleSet } from '../rules/ruleset.ts';
import type { Pool } from '../simulation/pool.ts';
import type { LineupSpec } from '../simulation/experiment.ts';
import { summarize, type Summary, type Agg } from '../statistics/aggregate.ts';
import { score, type ScoreBreakdown } from '../statistics/score.ts';
import type { Weights } from '../simulation/bots/heuristic.ts';

export const ALL_STYLES = ['random', 'aggressive', 'defensive', 'economic', 'tactical', 'survival'];

export interface ExperimentDef {
  key: string;
  label: string;
  lineup: LineupSpec;
  games: number;
  scenario?: string;
  noShuffle?: boolean;
  /** Only in the full (targeted) suite. */
  targeted?: boolean;
}

export function suiteDefs(scale = 1): ExperimentDef[] {
  const n = (x: number) => Math.max(100, Math.round(x * scale));
  return [
    { key: 'mixed4', label: 'Смешанные партии, 4 игрока, 6 типов ботов', lineup: { type: 'mixed', pool: ALL_STYLES, n: 4 }, games: n(12000) },
    { key: 'mirror4', label: 'Зеркало TacticalBot ×4 (места фиксированы)', lineup: { type: 'fixed', bots: ['tactical', 'tactical', 'tactical', 'tactical'] }, games: n(4000), noShuffle: true },
    { key: 'duel', label: 'Дуэли (2 игрока), смешанные', lineup: { type: 'mixed', pool: ALL_STYLES, n: 2 }, games: n(3000) },
    { key: 'mirror2', label: 'Зеркало TacticalBot ×2 (места фиксированы)', lineup: { type: 'fixed', bots: ['tactical', 'tactical'] }, games: n(2000), noShuffle: true },
    { key: 'three', label: '3 игрока, смешанные', lineup: { type: 'mixed', pool: ALL_STYLES, n: 3 }, games: n(2000) },
    { key: 'exploit', label: 'ExploitBot против 3 TacticalBot', lineup: { type: 'fixed', bots: ['exploit', 'tactical', 'tactical', 'tactical'] }, games: n(3000) },
    { key: 'lowHp', label: 'Low HP (старт 1 жетон 300)', lineup: { type: 'mixed', pool: ALL_STYLES, n: 4 }, games: n(1500), scenario: 'lowHp', targeted: true },
    { key: 'highHp', label: 'High HP (старт 5 жетонов)', lineup: { type: 'mixed', pool: ALL_STYLES, n: 4 }, games: n(1500), scenario: 'highHp', targeted: true },
    { key: 'extremeEconomy', label: 'Extreme economy (старт 5×1000)', lineup: { type: 'mixed', pool: ALL_STYLES, n: 4 }, games: n(1500), scenario: 'extremeEconomy', targeted: true },
    { key: 'lateGame', label: 'Late game (все Земли розданы с Артефактами)', lineup: { type: 'mixed', pool: ALL_STYLES, n: 4 }, games: n(1500), scenario: 'lateGame', targeted: true },
    { key: 'earlyLead', label: 'Comeback test: место 1 стартует с большим перевесом', lineup: { type: 'fixed', bots: ['tactical', 'tactical', 'tactical', 'tactical'] }, games: n(2000), scenario: 'earlyLead', noShuffle: true, targeted: true },
    { key: 'stall', label: 'Stalling test: DefensiveBot×2 + SurvivalBot×2', lineup: { type: 'fixed', bots: ['defensive', 'defensive', 'survival', 'survival'] }, games: n(1500), targeted: true },
    // appended after the original suite so older experiments keep their seed ranges (seed = base + index·100 000)
    { key: 'five', label: '5 игроков, смешанные', lineup: { type: 'mixed', pool: ALL_STYLES, n: 5 }, games: n(1500) },
    { key: 'six', label: '6 игроков, смешанные', lineup: { type: 'mixed', pool: ALL_STYLES, n: 6 }, games: n(1500) },
    { key: 'seven', label: '7 игроков, смешанные', lineup: { type: 'mixed', pool: ALL_STYLES, n: 7 }, games: n(1500) },
    { key: 'mirror6', label: 'Зеркало TacticalBot ×6 (места фиксированы)', lineup: { type: 'fixed', bots: ['tactical', 'tactical', 'tactical', 'tactical', 'tactical', 'tactical'] }, games: n(1500), noShuffle: true },
    { key: 'mirror7', label: 'Зеркало TacticalBot ×7 (места фиксированы)', lineup: { type: 'fixed', bots: ['tactical', 'tactical', 'tactical', 'tactical', 'tactical', 'tactical', 'tactical'] }, games: n(1500), noShuffle: true },
  ];
}

export interface Evaluation {
  rules: string;
  seedBase: number;
  summaries: Record<string, Summary>;
  anomalies: Agg['anomalies'];
  score: ScoreBreakdown;
  elapsedSec: number;
  games: number;
}

export async function evaluate(pool: Pool, rules: RuleSet, seedBase: number, opts: { scale?: number; targeted?: boolean; genomes?: Record<string, Partial<Weights>>; only?: string[] } = {}): Promise<Evaluation> {
  const t0 = performance.now();
  const defs = suiteDefs(opts.scale ?? 1).filter((d) => (opts.targeted !== false || !d.targeted) && (!opts.only || opts.only.includes(d.key)));
  const summaries: Record<string, Summary> = {};
  const anomalies: Agg['anomalies'] = [];
  let games = 0;
  // offset seed ranges per experiment so experiments don't share seeds
  const aggs = await Promise.all(defs.map((d, i) => pool.run({
    rules, lineup: d.lineup, seedStart: seedBase + i * 100_000, count: d.games, scenario: d.scenario, noShuffle: d.noShuffle, genomes: opts.genomes,
  })));
  defs.forEach((d, i) => {
    summaries[d.key] = summarize(aggs[i]);
    games += aggs[i].games;
    for (const a of aggs[i].anomalies.slice(0, 5)) anomalies.push({ ...a, reason: `${d.key}:${a.reason}` });
  });
  const sc = score(summaries.mixed4, summaries.mirror4, rules.denominations, summaries.exploit, rules.board.filter((c) => c.type === 'land').length);
  return { rules: rules.version, seedBase, summaries, anomalies, score: sc, elapsedSec: (performance.now() - t0) / 1000, games };
}

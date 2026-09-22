// CLI simulator.
//   node game/simulation/cli.ts [--rules v015] [--games 10000] [--players 4] [--bots tactical,aggressive,...]
//                               [--seed 1] [--workers N] [--scenario lowHp] [--replay SEED]
import { parseArgs } from 'node:util';
import { writeFileSync, mkdirSync } from 'node:fs';
import { loadRules } from '../rules/load.ts';
import { Pool, defaultWorkers } from './pool.ts';
import { summarize } from '../statistics/aggregate.ts';
import { detect } from '../statistics/detect.ts';
import { runOne } from './runner.ts';
import { lineupFor, SCENARIOS, type LineupSpec } from './experiment.ts';
import { ALL_STYLES } from '../balancing/suite.ts';

const { values: a } = parseArgs({
  options: {
    rules: { type: 'string', default: 'v015' },
    games: { type: 'string', default: '10000' },
    players: { type: 'string', default: '4' },
    bots: { type: 'string' },
    seed: { type: 'string', default: '1' },
    workers: { type: 'string' },
    scenario: { type: 'string' },
    replay: { type: 'string' },
  },
});

const rules = loadRules(a.rules!);
const n = Number(a.players);
const lineup: LineupSpec = a.bots
  ? (a.bots.split(',').length === n ? { type: 'fixed', bots: a.bots.split(',') } : { type: 'mixed', pool: a.bots.split(','), n })
  : { type: 'mixed', pool: ALL_STYLES, n };

if (a.replay) {
  // Full text log of one game (deterministic by seed).
  const seed = Number(a.replay);
  const bots = lineupFor(lineup, seed);
  const r = runOne(rules, bots, seed, { log: true, record: true, setup: a.scenario ? SCENARIOS[a.scenario] : undefined });
  mkdirSync('replays', { recursive: true });
  const file = `replays/manual_${rules.version}_${seed}.txt`;
  writeFileSync(file, [`rules ${rules.version} seed ${seed} bots ${bots.join(',')}`, `choices ${JSON.stringify(r.choices)}`, ...(r.log ?? [])].join('\n'));
  console.log((r.log ?? []).join('\n'));
  console.log(`\nwinner: ${r.rec.winner >= 0 ? r.rec.bots[r.rec.winner] : 'none'} · rounds ${r.rec.rounds} · saved ${file}`);
  process.exit(0);
}

const workers = a.workers ? Number(a.workers) : defaultWorkers();
const pool = new Pool(workers);
const t0 = performance.now();
const agg = await pool.run({ rules, lineup, seedStart: Number(a.seed), count: Number(a.games), scenario: a.scenario });
await pool.close();
const sec = (performance.now() - t0) / 1000;
const s = summarize(agg);
const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
console.log(`rules ${rules.version} · ${s.games} games · ${n} players · ${workers} workers · ${sec.toFixed(1)} s (${(s.games / sec).toFixed(0)} games/s)`);
console.log(`rounds: median ${s.medianRounds}, p10 ${s.p10Rounds}, p90 ${s.p90Rounds} · real-table ≈ ${s.tableMinutes.toFixed(0)} min · timeouts ${pct(s.timeoutRate)}`);
console.log('win rate:', Object.entries(s.winRate).sort((x, y) => y[1] - x[1]).map(([b, w]) => `${b} ${pct(w)}`).join(' · '));
console.log('seats:', s.seatWinRate.map(pct).join(' / '));
console.log(`comeback ${pct(s.comebackRate)} · arithmetic ${s.arithPerTurn.toFixed(2)} ops/turn · out-of-turn cards ${s.feel.reactionsPerGame.toFixed(1)}/game · peak power ×${s.feel.growth.toFixed(2)}`);
if (agg.anomalies.length) console.log('anomalies (replay with --replay SEED):', agg.anomalies.slice(0, 5).map((x) => `${x.seed}:${x.reason}`).join(', '));
if (n === 4 && !a.bots) {
  const f = detect({ rules: rules.version, seedBase: 0, summaries: { mixed4: s, mirror4: s }, anomalies: [], score: { total: 0, penalties: {}, values: {}, hardFail: [] }, elapsedSec: 0, games: s.games }, rules.denominations);
  for (const x of f) if (x.severity !== 'OK' && !x.key.startsWith('seat')) console.log(`  [${x.severity}] ${x.title}: ${x.value}`);
}

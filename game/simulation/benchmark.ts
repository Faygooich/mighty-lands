// Benchmark: single-thread games/sec, then scaling across worker counts.
// Usage: node game/simulation/benchmark.ts [rulesVersion]
import { writeFileSync, mkdirSync } from 'node:fs';
import { availableParallelism } from 'node:os';
import { loadRules } from '../rules/load.ts';
import { runBatch, SEEDS } from './experiment.ts';
import { Pool } from './pool.ts';

const rules = loadRules(process.argv[2] ?? 'v001');
const lineup = { type: 'mixed' as const, pool: ['random', 'aggressive', 'defensive', 'economic', 'tactical', 'survival'], n: 4 };

const t0 = performance.now();
const single = runBatch({ rules, lineup, seedStart: SEEDS.training, count: 400 });
const singleGps = single.games / ((performance.now() - t0) / 1000);
console.log(`single thread: ${singleGps.toFixed(0)} games/s`);

const results: Array<{ workers: number; gps: number }> = [];
const max = availableParallelism();
for (const w of [1, 2, 4, Math.max(1, max - 1), max].filter((v, i, a) => a.indexOf(v) === i && v <= max)) {
  const pool = new Pool(w);
  await pool.run({ rules, lineup, seedStart: SEEDS.training, count: w * 50 }, 50); // warm-up
  const t = performance.now();
  const agg = await pool.run({ rules, lineup, seedStart: SEEDS.training, count: 4000 }, 200);
  const gps = agg.games / ((performance.now() - t) / 1000);
  await pool.close();
  results.push({ workers: w, gps });
  console.log(`workers=${w}: ${gps.toFixed(0)} games/s`);
}
const best = results.reduce((a, b) => (b.gps > a.gps * 1.05 ? b : a));
mkdirSync('results', { recursive: true });
writeFileSync('results/benchmark.json', JSON.stringify({ rules: rules.version, cpus: max, singleGps, results, recommended: best.workers }, null, 2));
console.log(`recommended workers: ${best.workers}`);

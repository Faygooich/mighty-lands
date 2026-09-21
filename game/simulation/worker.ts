// Worker thread: receives Batch jobs, returns aggregated stats (never per-game logs).
import { parentPort } from 'node:worker_threads';
import { runBatch, type Batch } from './experiment.ts';

parentPort!.on('message', (msg: { id: number; batch: Batch }) => {
  try {
    const agg = runBatch(msg.batch);
    parentPort!.postMessage({ id: msg.id, agg });
  } catch (e) {
    parentPort!.postMessage({ id: msg.id, error: String((e as Error).stack ?? e) });
  }
});

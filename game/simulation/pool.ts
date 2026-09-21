// Persistent worker pool. Splits a big batch into chunks and merges aggregates.
import { Worker } from 'node:worker_threads';
import { availableParallelism } from 'node:os';
import { mergeAgg, newAgg, type Agg } from '../statistics/aggregate.ts';
import type { Batch } from './experiment.ts';

export class Pool {
  workers: Worker[] = [];
  idle: Worker[] = [];
  queue: Array<{ id: number; batch: Batch }> = [];
  pending = new Map<number, (a: Agg) => void>();
  rejects = new Map<number, (e: Error) => void>();
  nextId = 1;

  constructor(size = defaultWorkers()) {
    for (let i = 0; i < size; i++) {
      const w = new Worker(new URL('./worker.ts', import.meta.url));
      w.on('message', (m: { id: number; agg?: Agg; error?: string }) => {
        if (m.error) this.rejects.get(m.id)?.(new Error(m.error));
        else this.pending.get(m.id)?.(m.agg!);
        this.pending.delete(m.id);
        this.rejects.delete(m.id);
        this.idle.push(w);
        this.pump();
      });
      w.on('error', (e) => { for (const r of this.rejects.values()) r(e); });
      this.workers.push(w);
      this.idle.push(w);
    }
  }

  private pump(): void {
    while (this.idle.length && this.queue.length) {
      const w = this.idle.pop()!;
      w.postMessage(this.queue.shift()!);
    }
  }

  runChunk(batch: Batch): Promise<Agg> {
    const id = this.nextId++;
    return new Promise((res, rej) => {
      this.pending.set(id, res);
      this.rejects.set(id, rej);
      this.queue.push({ id, batch });
      this.pump();
    });
  }

  /** Run `batch.count` games split into chunks. */
  async run(batch: Batch, chunk = 200): Promise<Agg> {
    const jobs: Promise<Agg>[] = [];
    for (let s = 0; s < batch.count; s += chunk) {
      jobs.push(this.runChunk({ ...batch, seedStart: batch.seedStart + s, count: Math.min(chunk, batch.count - s) }));
    }
    const parts = await Promise.all(jobs);
    return parts.reduce((a, b) => mergeAgg(a, b), newAgg());
  }

  async close(): Promise<void> {
    await Promise.all(this.workers.map((w) => w.terminate()));
  }
}

export function defaultWorkers(): number {
  const env = Number(process.env.SIM_WORKERS);
  if (env > 0) return env;
  return Math.max(1, availableParallelism() - 1);
}

// Deterministic PRNG (sfc32) seeded via splitmix32. Same seed => same game.

function splitmix32(a: number): () => number {
  return () => {
    a = (a + 0x9e3779b9) | 0;
    let t = a ^ (a >>> 16);
    t = Math.imul(t, 0x21f0aaad);
    t = t ^ (t >>> 15);
    t = Math.imul(t, 0x735a2d97);
    return (t ^ (t >>> 15)) >>> 0;
  };
}

export class Rng {
  a: number;
  b: number;
  c: number;
  d: number;

  constructor(seed: number) {
    const sm = splitmix32(seed >>> 0);
    this.a = sm();
    this.b = sm();
    this.c = sm();
    this.d = sm();
    for (let i = 0; i < 12; i++) this.next();
  }

  next(): number {
    const t = (((this.a + this.b) | 0) + this.d) | 0;
    this.d = (this.d + 1) | 0;
    this.a = this.b ^ (this.b >>> 9);
    this.b = (this.c + (this.c << 3)) | 0;
    this.c = (this.c << 21) | (this.c >>> 11);
    this.c = (this.c + t) | 0;
    return t >>> 0;
  }

  /** Uniform integer in [0, n). */
  int(n: number): number {
    return Math.floor((this.next() / 4294967296) * n);
  }

  float(): number {
    return this.next() / 4294967296;
  }

  d6(): number {
    return this.int(6) + 1;
  }

  shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = this.int(i + 1);
      const tmp = arr[i];
      arr[i] = arr[j];
      arr[j] = tmp;
    }
    return arr;
  }

  state(): [number, number, number, number] {
    return [this.a, this.b, this.c, this.d];
  }

  static fromState(s: [number, number, number, number]): Rng {
    const r = new Rng(0);
    [r.a, r.b, r.c, r.d] = s;
    return r;
  }
}

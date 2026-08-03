/** Deterministic seeded PRNG — mulberry32. No Math.random in the engine. */

export class SeededRng {
  private state: number;

  constructor(seed: string | number | bigint) {
    this.state = hashSeed(seed);
  }

  /** Uniform [0, 1) */
  next(): number {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Uniform [min, max) */
  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  /** Integer [min, max] inclusive */
  int(min: number, max: number): number {
    return Math.floor(this.range(min, max + 1));
  }

  /** Gaussian with Box-Muller */
  gaussian(mean = 0, std = 1): number {
    const u1 = Math.max(1e-10, this.next());
    const u2 = this.next();
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    return mean + z * std;
  }

  getState(): number {
    return this.state;
  }

  setState(state: number): void {
    this.state = state >>> 0;
  }

  fork(label: string): SeededRng {
    const child = new SeededRng(this.state ^ hashSeed(label));
    child.state = hashSeed(`${this.state}:${label}`);
    return child;
  }
}

function hashSeed(seed: string | number | bigint): number {
  const s = String(seed);
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

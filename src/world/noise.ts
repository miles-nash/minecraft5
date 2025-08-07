// Simple Perlin-like noise using seeded PRNG and interpolation

class Mulberry32 {
  private seed: number;
  constructor(seed: number) { this.seed = seed >>> 0; }
  next() {
    let t = (this.seed += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
}

function fade(t: number) { return t * t * t * (t * (t * 6 - 15) + 10); }
function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }

export class Perlin2D {
  private perm: number[];
  constructor(seed = 1337) {
    const rng = new Mulberry32(seed);
    const p = new Array(256).fill(0).map((_, i) => i);
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(rng.next() * (i + 1));
      [p[i], p[j]] = [p[j], p[i]];
    }
    this.perm = p.concat(p);
  }

  private grad(hash: number, x: number, y: number) {
    switch (hash & 3) {
      case 0: return x + y;
      case 1: return -x + y;
      case 2: return x - y;
      default: return -x - y;
    }
  }

  noise(x: number, y: number) {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    x -= Math.floor(x);
    y -= Math.floor(y);
    const u = fade(x);
    const v = fade(y);

    const aa = this.perm[this.perm[X] + Y];
    const ab = this.perm[this.perm[X] + Y + 1];
    const ba = this.perm[this.perm[X + 1] + Y];
    const bb = this.perm[this.perm[X + 1] + Y + 1];

    const x1 = lerp(this.grad(aa, x, y), this.grad(ba, x - 1, y), u);
    const x2 = lerp(this.grad(ab, x, y - 1), this.grad(bb, x - 1, y - 1), u);
    return (lerp(x1, x2, v) + 1) / 2; // 0..1
  }
}



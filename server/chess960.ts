// Deterministic Chess960 (Fischer Random) back-rank generator
// We derive a seed from game.shareId (or a fallback) so initial setup is reproducible for rebuild/undo.

// xmur3 hash -> 32-bit seed
function xmur3(str: string): number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = (Math.imul(h ^ (h >>> 16), 2246822507) ^ Math.imul(h ^ (h >>> 13), 3266489909)) >>> 0;
  return h >>> 0;
}

// Mulberry32 PRNG
function mulberry32(a: number) {
  let t = a >>> 0;
  return function () {
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export type BackRankType = 'rook' | 'knight' | 'bishop' | 'queen' | 'king';

export function generateFischerBackRankFromSeed(seed: string): BackRankType[] {
  const rand = mulberry32(xmur3(seed));
  const evenSquares = [0, 2, 4, 6];
  const oddSquares = [1, 3, 5, 7];
  const positions: (BackRankType | null)[] = new Array(8).fill(null);
  const remaining: number[] = [0, 1, 2, 3, 4, 5, 6, 7];

  const pick = (arr: number[]) => {
    const idx = Math.floor(rand() * arr.length);
    return arr.splice(idx, 1)[0];
  };

  // Place bishops on opposite colors
  const evenPool = evenSquares.slice();
  const b1 = pick(evenPool);
  remaining.splice(remaining.indexOf(b1), 1);
  positions[b1] = 'bishop';

  const oddPool = oddSquares.slice();
  const b2 = pick(oddPool);
  remaining.splice(remaining.indexOf(b2), 1);
  positions[b2] = 'bishop';

  // Place queen
  const qIndex = remaining.splice(Math.floor(rand() * remaining.length), 1)[0];
  positions[qIndex] = 'queen';

  // Place two knights
  const nIndex1 = remaining.splice(Math.floor(rand() * remaining.length), 1)[0];
  positions[nIndex1] = 'knight';
  const nIndex2 = remaining.splice(Math.floor(rand() * remaining.length), 1)[0];
  positions[nIndex2] = 'knight';

  // Remaining three are R, K, R with K in the middle
  remaining.sort((a, b) => a - b);
  const [rLeft, kIdx, rRight] = remaining;
  positions[rLeft] = 'rook';
  positions[kIdx] = 'king';
  positions[rRight] = 'rook';

  return positions as BackRankType[];
}

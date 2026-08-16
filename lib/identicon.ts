// Deterministic pixel art from a string.
//
// The same algorithm MetaMask's original account icons used ("blockies"): seed
// a small PRNG from the string, fill half a square grid with it, mirror that
// half, and colour the result from the same stream. Same input, same picture,
// every time and everywhere — no state, no storage, no network.
//
// This exists so an NFT whose artwork cannot be fetched still has a face. A lot
// of PulseChain art is pinned to IPFS by whoever minted it and is simply gone;
// a grid of identical grey placeholders tells the holder nothing and looks
// broken, while a distinct picture per token at least makes them tellable
// apart at a glance.
//
// It is not the NFT's artwork, and callers must not present it as though it
// were — the tile that draws this also carries a marker saying so.

/**
 * Hash a string to a stream of well-mixed 32-bit words (xmur3).
 *
 * The mixing matters more than it looks. Seeds here share a long prefix — every
 * token in a collection is `0x<same 40 hex chars>:<id>` — and a naive
 * accumulator carries that prefix straight into the first outputs, so the hue,
 * which is drawn first, barely moved between tokens: a whole collection came
 * out the same yellow-green and the tiles were indistinguishable. This has
 * proper avalanche, so one different character changes everything downstream.
 */
function xmur3(str: string): () => number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return h >>> 0;
  };
}

/**
 * xorshift128, seeded from the hash above.
 *
 * Not cryptographic and doesn't need to be; it needs to be fast, tiny, and
 * identical on every machine.
 */
function makeRandom(seed: string): () => number {
  const h = xmur3(seed);
  const s = new Int32Array([h(), h(), h(), h()]);
  // A seed of all zeros would leave xorshift stuck at zero forever.
  if (!s[0] && !s[1] && !s[2] && !s[3]) s[0] = 1;

  return () => {
    const t = s[0] ^ (s[0] << 11);
    s[0] = s[1];
    s[1] = s[2];
    s[2] = s[3];
    s[3] = (s[3] ^ (s[3] >>> 19) ^ t ^ (t >>> 8)) | 0;
    return (s[3] >>> 0) / 0x100000000;
  };
}

export interface Identicon {
  /** Row-major cell values: 0 background, 1 foreground, 2 accent. */
  cells: Uint8Array;
  size: number;
  /** [background, foreground, accent] as CSS colours. */
  colors: [string, string, string];
}

/**
 * Build the grid.
 *
 * Colours are HSL rather than raw RGB so lightness can be pinned into a band
 * that stays legible on both themes — fully random RGB produces the occasional
 * near-black on near-black, which is exactly the unreadable tile this is meant
 * to replace.
 */
export function identicon(seed: string, size = 8): Identicon {
  const rand = makeRandom(seed || 'x');

  const hue = Math.floor(rand() * 360);
  // The accent sits well away from the base hue so it reads as a second colour.
  const accentHue = (hue + 120 + Math.floor(rand() * 120)) % 360;
  const colors: [string, string, string] = [
    `hsl(${hue} 30% 16%)`,
    `hsl(${hue} 68% ${52 + Math.floor(rand() * 14)}%)`,
    `hsl(${accentHue} 70% ${58 + Math.floor(rand() * 12)}%)`,
  ];

  const half = Math.ceil(size / 2);
  const cells = new Uint8Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < half; x++) {
      // Weighted so foreground is common, accent occasional, background the
      // rest — an even three-way split comes out as noise rather than a shape.
      const r = rand();
      const v = r < 0.42 ? 0 : r < 0.86 ? 1 : 2;
      cells[y * size + x] = v;
      cells[y * size + (size - 1 - x)] = v; // mirrored, which is what reads as a face
    }
  }
  return { cells, size, colors };
}

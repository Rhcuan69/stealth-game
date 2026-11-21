// A tiny seeded random generator (mulberry32) so a seed always replays the same
// speckles, patrol jitter and screenshot scenes.

export function createRandom(seed) {
  let state = seed >>> 0;
  return function random() {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

/** A random integer in [min, max). */
export function randomInt(random, min, max) {
  return min + Math.floor(random() * (max - min));
}

/** A random pick from an array. */
export function randomPick(random, items) {
  return items[Math.floor(random() * items.length)];
}

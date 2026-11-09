import crypto from "crypto";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no I, O, 0, 1 - easy to read out loud

export const SPIN_MIN_TURNS = 3;
export const SPIN_MAX_TURNS = 9;

// crypto-strength [0,1) - the draw decides who gets a free treatment, so no Math.random
export function secureRandom() {
  return crypto.randomInt(0, 2 ** 30) / 2 ** 30;
}

export function generateWheelCode(length = 6) {
  let out = "";
  for (let i = 0; i < length; i++) out += CODE_ALPHABET[crypto.randomInt(0, CODE_ALPHABET.length)];
  return `TOCAK-${out}`;
}

/** Weighted pick among items with a positive `weight`. Returns null when none qualifies. */
export function pickWeighted(items, rng = secureRandom) {
  const pool = items.filter((i) => i.weight > 0);
  const total = pool.reduce((sum, i) => sum + i.weight, 0);
  if (!pool.length || total <= 0) return null;
  let roll = rng() * total;
  for (const item of pool) {
    roll -= item.weight;
    if (roll < 0) return item;
  }
  return pool[pool.length - 1];
}

/**
 * How the wheel animates before stopping: a random number of full turns (3-9), a random
 * stop position inside the winning slice (so it isn't always dead centre), and a duration
 * that grows with the turns so the speed feels the same - roughly 5s for 3 turns, 9s for 9.
 */
export function buildSpinPlan(rng = secureRandom) {
  const turns = SPIN_MIN_TURNS + Math.floor(rng() * (SPIN_MAX_TURNS - SPIN_MIN_TURNS + 1));
  const offset = Math.round((0.15 + rng() * 0.7) * 1000) / 1000; // 0.15-0.85 of the slice width
  const durationMs = 3000 + turns * 650;
  return { turns, offset, durationMs };
}

import {
  mancala,
  applyMoveDetailed,
  P0_STORE,
  type MancalaState,
} from '@ancient-games/game-mancala';

/**
 * Daily Harvest: from today's position, bank as many seeds as you can in a
 * SINGLE turn — chain extra turns by landing in your store; a capture banks
 * big but ends the chain.
 *
 * The puzzle is generated deterministically from the date, so everyone on
 * Earth plays the same position with zero backend. The solver both sets the
 * target ("optimal") and acts as the generation gate: a candidate position
 * is only served if a real chain exists (optimal meaningfully beats the
 * best single move).
 */

/** Harvest #1 = launch day. Local-date based, like Wordle. */
const EPOCH_UTC = Date.UTC(2026, 6, 16);

export function todayNumber(now: Date = new Date()): number {
  const localDay = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.max(1, Math.floor((localDay - EPOCH_UTC) / 86400000) + 1);
}

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Max seeds player 0 can bank in one turn from this position. */
export function chainValue(state: MancalaState): number {
  let best = 0;
  for (const move of mancala.legalMoves(state)) {
    const o = applyMoveDetailed(state, move);
    const gained = o.state.pits[P0_STORE]! - state.pits[P0_STORE]!;
    const total =
      gained + (o.extraTurn && !mancala.isTerminal(o.state) ? chainValue(o.state) : 0);
    if (total > best) best = total;
  }
  return best;
}

function bestSingleMove(state: MancalaState): number {
  let best = 0;
  for (const move of mancala.legalMoves(state)) {
    const o = applyMoveDetailed(state, move);
    best = Math.max(best, o.state.pits[P0_STORE]! - state.pits[P0_STORE]!);
  }
  return best;
}

export interface DailyPuzzle {
  number: number;
  state: MancalaState;
  optimal: number;
}

export function generatePuzzle(number: number): DailyPuzzle {
  let fallback: DailyPuzzle | null = null;
  for (let attempt = 0; attempt < 300; attempt++) {
    const rng = mulberry32(number * 1000003 + attempt * 7919);
    const pits = new Array<number>(14).fill(0);
    for (let i = 0; i < 6; i++) pits[i] = Math.floor(rng() * 7); // your row: 0–6 seeds
    for (let i = 7; i < 13; i++) pits[i] = Math.floor(rng() * 6); // theirs: capture fodder
    const state: MancalaState = { pits, turn: 0 };

    if (mancala.legalMoves(state).length < 4) continue;
    const optimal = chainValue(state);
    const single = bestSingleMove(state);
    const candidate = { number, state, optimal };
    if (!fallback && optimal >= 3) fallback = candidate;
    // Serve only positions where chaining genuinely beats greed.
    if (optimal >= 6 && optimal <= 24 && optimal >= single + 3) return candidate;
  }
  return fallback ?? { number, state: mancala.initialState(), optimal: chainValue(mancala.initialState()) };
}

/* ===== Daily record ===== */

export interface DailyRecord {
  day: number;
  score: number;
  optimal: number;
  stars: number;
  streak: number;
}

const KEY = 'mancala_daily';

export function readDaily(): DailyRecord | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as DailyRecord) : null;
  } catch {
    return null;
  }
}

export function starsFor(score: number, optimal: number): number {
  if (optimal <= 0) return score > 0 ? 3 : 1;
  if (score >= optimal) return 3;
  if (score >= Math.ceil(optimal * 0.7)) return 2;
  return 1;
}

/** First completion of the day is the recorded result; replays don't count. */
export function recordDaily(day: number, score: number, optimal: number): DailyRecord {
  const prev = readDaily();
  if (prev && prev.day === day) return prev;
  const record: DailyRecord = {
    day,
    score,
    optimal,
    stars: starsFor(score, optimal),
    streak: prev && prev.day === day - 1 ? prev.streak + 1 : 1,
  };
  localStorage.setItem(KEY, JSON.stringify(record));
  return record;
}

export function shareText(record: DailyRecord): string {
  const lines = [
    `Mancala Daily Harvest #${record.day}`,
    `🌾 ${record.score}/${record.optimal} seeds ${'⭐'.repeat(record.stars)}`,
  ];
  if (record.streak > 1) lines.push(`🔥 ${record.streak}-day streak`);
  lines.push(`${location.origin}/daily`);
  return lines.join('\n');
}

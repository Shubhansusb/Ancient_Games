import { describe, it, expect } from 'vitest';
import { mancala, type MancalaState } from '@ancient-games/game-mancala';
import { mancalaBestMove, type Difficulty } from '../src/index';

/** Deterministic PRNG so test results are reproducible. */
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

function playGame(
  players: [Difficulty, Difficulty],
  rng: () => number,
): 0 | 1 | 'draw' {
  let state = mancala.initialState();
  let plies = 0;
  while (!mancala.isTerminal(state) && plies < 500) {
    const difficulty = players[mancala.currentPlayer(state)];
    state = mancala.applyMove(state, mancalaBestMove(state, difficulty, rng));
    plies++;
  }
  const w = mancala.winner(state);
  if (w === null) throw new Error('game did not finish');
  return w;
}

describe('tactical sanity', () => {
  it('banks the stone that clinches the game', () => {
    // P0 has 24 banked; sowing pit 5's single stone into the store makes 25
    // of 48 — a guaranteed win. Every other pit holds one stone landing on a
    // non-empty neighbour: no captures, no store gain anywhere else.
    const state: MancalaState = {
      pits: [1, 1, 1, 1, 1, 1, 24, 3, 3, 3, 3, 3, 3, 0],
      turn: 0,
    };
    const move = mancalaBestMove(state, 'hard', () => 0.99);
    expect(move).toBe(5);
  });

  it('takes a big capture when one is available', () => {
    // P0 pit 0 has 1 stone; pit 1 empty; opposite pit 11 holds 8 stones.
    const state: MancalaState = {
      pits: [1, 0, 1, 1, 1, 1, 0, 2, 2, 2, 2, 8, 2, 0],
      turn: 0,
    };
    const move = mancalaBestMove(state, 'hard', () => 0.99);
    expect(move).toBe(0);
  });
});

describe('difficulty tiers (self-play)', () => {
  it('hard beats easy in a majority of games', () => {
    const rng = mulberry32(42);
    let hardWins = 0;
    const games = 10;
    for (let i = 0; i < games; i++) {
      // alternate which seat the strong player takes to remove first-move bias
      const hardSeat = (i % 2) as 0 | 1;
      const players: [Difficulty, Difficulty] =
        hardSeat === 0 ? ['hard', 'easy'] : ['easy', 'hard'];
      const result = playGame(players, rng);
      if (result === hardSeat) hardWins++;
    }
    expect(hardWins).toBeGreaterThanOrEqual(7);
  }, 60_000);

  it('expert beats medium in a majority of games', () => {
    const rng = mulberry32(7);
    let expertWins = 0;
    const games = 6;
    for (let i = 0; i < games; i++) {
      const expertSeat = (i % 2) as 0 | 1;
      const players: [Difficulty, Difficulty] =
        expertSeat === 0 ? ['expert', 'medium'] : ['medium', 'expert'];
      const result = playGame(players, rng);
      if (result === expertSeat) expertWins++;
    }
    expect(expertWins).toBeGreaterThanOrEqual(4);
  }, 120_000);
});

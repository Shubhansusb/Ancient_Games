import { describe, it, expect } from 'vitest';
import { createMatch, playMove, replay } from '@ancient-games/engine';
import {
  mancala,
  applyMoveDetailed,
  P0_STORE,
  P1_STORE,
  type MancalaState,
  type MancalaMove,
} from '../src/index';

function state(pits: number[], turn: 0 | 1): MancalaState {
  return { pits, turn };
}

describe('initial state', () => {
  it('has 4 stones in each pit and empty stores, player 0 to move', () => {
    const s = mancala.initialState();
    expect(s.pits).toHaveLength(14);
    expect(s.pits[P0_STORE]).toBe(0);
    expect(s.pits[P1_STORE]).toBe(0);
    const stoneTotal = s.pits.reduce((a, b) => a + b, 0);
    expect(stoneTotal).toBe(48);
    expect(s.turn).toBe(0);
    expect(mancala.legalMoves(s)).toEqual([0, 1, 2, 3, 4, 5]);
  });
});

describe('sowing', () => {
  it('sows counter-clockwise one stone per pit', () => {
    const s = mancala.initialState();
    const next = mancala.applyMove(s, 0);
    expect(next.pits[0]).toBe(0);
    expect(next.pits[1]).toBe(5);
    expect(next.pits[2]).toBe(5);
    expect(next.pits[3]).toBe(5);
    expect(next.pits[4]).toBe(5);
    expect(next.turn).toBe(1);
  });

  it('grants an extra turn when the last stone lands in own store', () => {
    const s = mancala.initialState();
    // pit 2 has 4 stones: lands in pits 3,4,5 then the store
    const { state: next, extraTurn } = applyMoveDetailed(s, 2);
    expect(extraTurn).toBe(true);
    expect(next.pits[P0_STORE]).toBe(1);
    expect(next.turn).toBe(0);
  });

  it("skips the opponent's store when sowing", () => {
    // 8 stones in P0's pit 5: sow through own store, all 6 of P1's pits,
    // skip P1's store, land on P0's empty pit 0 — which then captures
    // pit 12 across the board (1 landing stone + 2 opposite = 3).
    const pits = [0, 0, 0, 0, 0, 8, 0, 1, 1, 1, 1, 1, 1, 0];
    const { state: next, sowPath, captured } = applyMoveDetailed(state(pits, 0), 5);
    expect(sowPath).not.toContain(P1_STORE);
    expect(next.pits[P1_STORE]).toBe(0);
    expect(captured).toBe(3);
    expect(next.pits[P0_STORE]).toBe(4); // 1 sown + 3 captured
    expect(next.pits[0]).toBe(0);
    expect(next.pits[12]).toBe(0);
  });

  it('total stones are always conserved', () => {
    let s = mancala.initialState();
    for (let i = 0; i < 200 && !mancala.isTerminal(s); i++) {
      const moves = mancala.legalMoves(s);
      s = mancala.applyMove(s, moves[i % moves.length]!);
      expect(s.pits.reduce((a, b) => a + b, 0)).toBe(48);
    }
  });
});

describe('capture', () => {
  it('captures when last stone lands in own empty pit and opposite pit has stones', () => {
    // P0 plays pit 0 (1 stone) -> lands in empty pit 1; opposite of 1 is 11.
    const pits = [1, 0, 0, 0, 0, 0, 0, 4, 4, 4, 4, 5, 4, 0];
    const { state: next, captured } = applyMoveDetailed(state(pits, 0), 0);
    expect(captured).toBe(6); // 1 landing stone + 5 opposite
    expect(next.pits[1]).toBe(0);
    expect(next.pits[11]).toBe(0);
    expect(next.pits[P0_STORE]).toBe(6);
  });

  it('does NOT capture when the opposite pit is empty', () => {
    const pits = [1, 0, 0, 0, 0, 4, 0, 4, 4, 4, 4, 0, 4, 0];
    const { state: next, captured } = applyMoveDetailed(state(pits, 0), 0);
    expect(captured).toBe(0);
    expect(next.pits[1]).toBe(1);
  });

  it('does NOT capture when landing in a non-empty own pit', () => {
    // P0 plays pit 0 (1 stone) -> lands in pit 1, which already has stones.
    const pits = [1, 3, 0, 0, 0, 4, 0, 4, 4, 4, 4, 4, 4, 0];
    const { captured } = applyMoveDetailed(state(pits, 0), 0);
    expect(captured).toBe(0);
  });

  it('captures for player 1 symmetrically', () => {
    // P1 plays relative pit 0 (abs 7, 1 stone) -> lands in abs 8 (empty);
    // opposite of 8 is 4. P0 keeps stones in pit 0 so the game continues.
    const pits = [2, 0, 0, 0, 3, 0, 0, 1, 0, 4, 4, 4, 4, 0];
    const { state: next, captured } = applyMoveDetailed(state(pits, 1), 0);
    expect(captured).toBe(4); // 1 + 3
    expect(next.pits[P1_STORE]).toBe(4);
    expect(next.pits[4]).toBe(0);
    expect(next.pits[8]).toBe(0);
    expect(mancala.isTerminal(next)).toBe(false);
  });
});

describe('game end', () => {
  it('sweeps the opponent row into their store when the mover empties the next player\'s row', () => {
    // P0's last stone leaves P0's row empty; P1 sweeps their remaining stones.
    const pits = [0, 0, 0, 0, 0, 1, 20, 3, 3, 0, 0, 0, 0, 18];
    const { state: next } = applyMoveDetailed(state(pits, 0), 5);
    expect(mancala.isTerminal(next)).toBe(true);
    expect(next.pits[P0_STORE]).toBe(21);
    expect(next.pits[P1_STORE]).toBe(24); // 18 + 3 + 3 swept
    expect(mancala.winner(next)).toBe(1);
  });

  it('detects a draw', () => {
    const s = state([0, 0, 0, 0, 0, 0, 24, 0, 0, 0, 0, 0, 0, 24], 0);
    expect(mancala.isTerminal(s)).toBe(true);
    expect(mancala.winner(s)).toBe('draw');
  });

  it('winner is null while the game is running', () => {
    expect(mancala.winner(mancala.initialState())).toBeNull();
  });
});

describe('engine integration', () => {
  it('rejects illegal moves through the engine', () => {
    const pits = [0, 4, 4, 4, 4, 4, 0, 4, 4, 4, 4, 4, 4, 0];
    let match = createMatch(mancala);
    match = { ...match, state: state(pits, 0) };
    expect(() => playMove(match, 0 as MancalaMove)).toThrow(/illegal/);
  });

  it('replay reconstructs any position from the move log', () => {
    let match = createMatch(mancala);
    const played: MancalaMove[] = [];
    for (let i = 0; i < 10 && !match.terminal; i++) {
      const m = mancala.legalMoves(match.state)[0]!;
      match = playMove(match, m);
      played.push(m);
    }
    expect(replay(mancala, played)).toEqual(match.state);
    // and a mid-game ply
    const mid = replay(mancala, played, 4);
    expect(mid.pits.reduce((a, b) => a + b, 0)).toBe(48);
  });
});

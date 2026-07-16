import type { GameRules, Player } from '@ancient-games/engine';

/**
 * Kalah (the most widely known Mancala variant).
 *
 * Board layout (indices into `pits`), sowing is counter-clockwise:
 *
 *        12  11  10   9   8   7        <- player 1's pits
 *   13                          6      <- stores (13 = P1, 6 = P0)
 *         0   1   2   3   4   5        <- player 0's pits
 *
 * A move is the RELATIVE pit index 0..5 on the mover's own row
 * (0 is their leftmost pit from their own point of view).
 */
export interface MancalaState {
  pits: number[];
  turn: Player;
}

export type MancalaMove = 0 | 1 | 2 | 3 | 4 | 5;

export const P0_STORE = 6;
export const P1_STORE = 13;
const STONES_PER_PIT = 4;

export function storeOf(player: Player): number {
  return player === 0 ? P0_STORE : P1_STORE;
}

export function pitIndex(player: Player, relativePit: number): number {
  return player === 0 ? relativePit : 7 + relativePit;
}

function ownPits(player: Player): number[] {
  return player === 0 ? [0, 1, 2, 3, 4, 5] : [7, 8, 9, 10, 11, 12];
}

function sideEmpty(pits: number[], player: Player): boolean {
  return ownPits(player).every((i) => pits[i] === 0);
}

/** Pit directly across the board — where captures take from. */
function oppositePit(index: number): number {
  return 12 - index;
}

export interface MoveOutcome {
  state: MancalaState;
  extraTurn: boolean;
  captured: number;
  /** Absolute pit indices touched in sowing order, for the UI animation. */
  sowPath: number[];
  /** End-of-game sweep, if this move triggered it: which pits were emptied
   *  into which store. Reporting only — the sweep itself is in `state`. */
  swept: Array<{ pit: number; count: number }>;
  sweepStore: number | null;
}

export function applyMoveDetailed(state: MancalaState, move: MancalaMove): MoveOutcome {
  const pits = [...state.pits];
  const player = state.turn;
  const from = pitIndex(player, move);
  let stones = pits[from]!;
  if (stones === 0) throw new Error(`pit ${move} is empty`);
  pits[from] = 0;

  const skip = storeOf((1 - player) as Player);
  const own = storeOf(player);
  const sowPath: number[] = [];
  let pos = from;
  while (stones > 0) {
    pos = (pos + 1) % 14;
    if (pos === skip) continue;
    pits[pos]!++;
    sowPath.push(pos);
    stones--;
  }

  const extraTurn = pos === own;

  let captured = 0;
  const landedInOwnEmptyPit =
    pos !== own && ownPits(player).includes(pos) && pits[pos] === 1;
  if (landedInOwnEmptyPit && pits[oppositePit(pos)]! > 0) {
    captured = pits[pos]! + pits[oppositePit(pos)]!;
    pits[own]! += captured;
    pits[pos] = 0;
    pits[oppositePit(pos)] = 0;
  }

  const next = (extraTurn ? player : 1 - player) as Player;

  // Game over: the player to move has an empty row -> the other player
  // sweeps everything remaining on their own row into their store.
  const swept: Array<{ pit: number; count: number }> = [];
  let sweepStore: number | null = null;
  if (sideEmpty(pits, next)) {
    const other = (1 - next) as Player;
    sweepStore = storeOf(other);
    for (const i of ownPits(other)) {
      if (pits[i]! > 0) swept.push({ pit: i, count: pits[i]! });
      pits[sweepStore]! += pits[i]!;
      pits[i] = 0;
    }
  }

  return { state: { pits, turn: next }, extraTurn, captured, sowPath, swept, sweepStore };
}

export const mancala: GameRules<MancalaState, MancalaMove> = {
  id: 'mancala-kalah',
  displayName: 'Mancala',

  initialState() {
    const pits = new Array(14).fill(STONES_PER_PIT);
    pits[P0_STORE] = 0;
    pits[P1_STORE] = 0;
    return { pits, turn: 0 };
  },

  currentPlayer(state) {
    return state.turn;
  },

  legalMoves(state) {
    return ([0, 1, 2, 3, 4, 5] as MancalaMove[]).filter(
      (m) => state.pits[pitIndex(state.turn, m)]! > 0,
    );
  },

  applyMove(state, move) {
    return applyMoveDetailed(state, move).state;
  },

  isTerminal(state) {
    return sideEmpty(state.pits, 0) && sideEmpty(state.pits, 1);
  },

  winner(state) {
    if (!this.isTerminal(state)) return null;
    const a = state.pits[P0_STORE]!;
    const b = state.pits[P1_STORE]!;
    if (a === b) return 'draw';
    return a > b ? 0 : 1;
  },
};

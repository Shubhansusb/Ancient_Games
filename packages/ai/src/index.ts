import type { GameRules, Player } from '@ancient-games/engine';
import { mancala, storeOf, type MancalaState, type MancalaMove } from '@ancient-games/game-mancala';

/** Score a state from `perspective`'s point of view. Higher is better. */
export type Evaluator<S> = (state: S, perspective: Player) => number;

export type Difficulty = 'easy' | 'medium' | 'hard' | 'expert';

export interface AIConfig {
  depth: number;
  /** Probability of ignoring the search and playing a random legal move. */
  blunderRate: number;
}

export const DIFFICULTIES: Record<Difficulty, AIConfig> = {
  easy: { depth: 2, blunderRate: 0.35 },
  medium: { depth: 4, blunderRate: 0.1 },
  hard: { depth: 7, blunderRate: 0 },
  expert: { depth: 11, blunderRate: 0 },
};

const WIN = 1_000_000;

/**
 * Alpha-beta minimax. Games like Mancala grant extra turns, so whether a
 * node maximizes or minimizes depends on rules.currentPlayer(state), not on
 * depth parity.
 */
function search<S, M>(
  rules: GameRules<S, M>,
  evaluate: Evaluator<S>,
  state: S,
  perspective: Player,
  depth: number,
  alpha: number,
  beta: number,
): number {
  if (rules.isTerminal(state)) {
    const w = rules.winner(state);
    if (w === 'draw') return 0;
    // prefer faster wins / slower losses
    return w === perspective ? WIN + depth : -(WIN + depth);
  }
  if (depth === 0) return evaluate(state, perspective);

  const maximizing = rules.currentPlayer(state) === perspective;
  let best = maximizing ? -Infinity : Infinity;
  for (const move of rules.legalMoves(state)) {
    const value = search(rules, evaluate, rules.applyMove(state, move), perspective, depth - 1, alpha, beta);
    if (maximizing) {
      best = Math.max(best, value);
      alpha = Math.max(alpha, best);
    } else {
      best = Math.min(best, value);
      beta = Math.min(beta, best);
    }
    if (beta <= alpha) break;
  }
  return best;
}

export function bestMove<S, M>(
  rules: GameRules<S, M>,
  evaluate: Evaluator<S>,
  state: S,
  config: AIConfig,
  rng: () => number = Math.random,
): M {
  const moves = rules.legalMoves(state);
  if (moves.length === 0) throw new Error('no legal moves');
  if (moves.length === 1) return moves[0]!;

  if (rng() < config.blunderRate) {
    return moves[Math.floor(rng() * moves.length)]!;
  }

  const me = rules.currentPlayer(state);
  let best = moves[0] as M;
  let bestValue = -Infinity;
  for (const move of moves) {
    const value = search(rules, evaluate, rules.applyMove(state, move), me, config.depth - 1, -Infinity, Infinity);
    if (value > bestValue) {
      bestValue = value;
      best = move;
    }
  }
  return best;
}

/**
 * Mancala evaluation: the store difference is what actually wins, with a
 * small bonus for stones still on your row (material you may bank later).
 */
export const evaluateMancala: Evaluator<MancalaState> = (state, perspective) => {
  const opp = (1 - perspective) as Player;
  const myStore = state.pits[storeOf(perspective)]!;
  const oppStore = state.pits[storeOf(opp)]!;
  let mySide = 0;
  let oppSide = 0;
  for (let i = 0; i < 6; i++) {
    mySide += state.pits[perspective === 0 ? i : 7 + i]!;
    oppSide += state.pits[perspective === 0 ? 7 + i : i]!;
  }
  return (myStore - oppStore) * 4 + (mySide - oppSide);
};

export function mancalaBestMove(
  state: MancalaState,
  difficulty: Difficulty,
  rng: () => number = Math.random,
): MancalaMove {
  return bestMove(mancala, evaluateMancala, state, DIFFICULTIES[difficulty], rng);
}

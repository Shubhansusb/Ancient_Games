export type Player = 0 | 1;

/**
 * A pure, serializable rules module. Every game on the platform implements
 * this interface; the engine, AI, and replay system only speak through it.
 * S must be JSON-serializable so games can live in Firestore and replays
 * can be reconstructed from the move log alone.
 */
export interface GameRules<S, M> {
  readonly id: string;
  readonly displayName: string;
  initialState(): S;
  currentPlayer(state: S): Player;
  legalMoves(state: S): M[];
  /** Must return a new state; never mutate the input. */
  applyMove(state: S, move: M): S;
  isTerminal(state: S): boolean;
  /** null while the game is running; 'draw' on a tie. */
  winner(state: S): Player | 'draw' | null;
}

export interface Match<S, M> {
  readonly rules: GameRules<S, M>;
  readonly state: S;
  readonly moves: readonly M[];
  readonly terminal: boolean;
}

export function createMatch<S, M>(rules: GameRules<S, M>): Match<S, M> {
  return { rules, state: rules.initialState(), moves: [], terminal: false };
}

export function playMove<S, M>(match: Match<S, M>, move: M): Match<S, M> {
  if (match.terminal) throw new Error('game is over');
  const legal = match.rules.legalMoves(match.state);
  if (!legal.some((m) => JSON.stringify(m) === JSON.stringify(move))) {
    throw new Error(`illegal move: ${JSON.stringify(move)}`);
  }
  const state = match.rules.applyMove(match.state, move);
  return {
    rules: match.rules,
    state,
    moves: [...match.moves, move],
    terminal: match.rules.isTerminal(state),
  };
}

/** Rebuild the state at any ply from a move log — this is the replay system. */
export function replay<S, M>(
  rules: GameRules<S, M>,
  moves: readonly M[],
  upToPly: number = moves.length,
): S {
  let state = rules.initialState();
  for (let i = 0; i < Math.min(upToPly, moves.length); i++) {
    state = rules.applyMove(state, moves[i]!);
  }
  return state;
}

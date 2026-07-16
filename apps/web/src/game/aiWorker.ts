import { mancalaBestMove, type Difficulty } from '@ancient-games/ai';
import type { MancalaState } from '@ancient-games/game-mancala';

interface Request {
  id: number;
  state: MancalaState;
  difficulty: Difficulty;
}

self.onmessage = (e: MessageEvent<Request>) => {
  const { id, state, difficulty } = e.data;
  const move = mancalaBestMove(state, difficulty);
  self.postMessage({ id, move });
};

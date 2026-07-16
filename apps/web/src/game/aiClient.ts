import type { Difficulty } from '@ancient-games/ai';
import type { MancalaMove, MancalaState } from '@ancient-games/game-mancala';

let worker: Worker | null = null;
let counter = 0;

export function requestAiMove(state: MancalaState, difficulty: Difficulty): Promise<MancalaMove> {
  if (!worker) {
    worker = new Worker(new URL('./aiWorker.ts', import.meta.url), { type: 'module' });
  }
  const w = worker;
  const id = ++counter;
  return new Promise((resolve) => {
    const handler = (e: MessageEvent<{ id: number; move: MancalaMove }>) => {
      if (e.data.id !== id) return;
      w.removeEventListener('message', handler);
      resolve(e.data.move);
    };
    w.addEventListener('message', handler);
    w.postMessage({ id, state, difficulty });
  });
}

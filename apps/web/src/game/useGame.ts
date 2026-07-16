import { useCallback, useEffect, useRef, useState } from 'react';
import type { Player } from '@ancient-games/engine';
import {
  mancala,
  applyMoveDetailed,
  pitIndex,
  storeOf,
  type MancalaMove,
  type MancalaState,
} from '@ancient-games/game-mancala';
import type { Difficulty } from '@ancient-games/ai';
import { requestAiMove } from './aiClient';
import { audio } from '../juice/audio';

export type Mode =
  | { kind: 'ai'; difficulty: Difficulty }
  | { kind: 'local' };

export const HUMAN_SEAT: Player = 0;
export const AI_SEAT: Player = 1;

export type GameEvent =
  | { type: 'capture'; count: number; by: Player }
  | { type: 'extraTurn'; by: Player }
  | null;

export interface GameView {
  /** Pit contents as currently displayed (mid-animation frames included). */
  pits: number[];
  /** Whose turn it is in the committed state. */
  turn: Player;
  terminal: boolean;
  winner: Player | 'draw' | null;
  /** True while sowing animation or AI thinking is in flight. */
  busy: boolean;
  /** Absolute index of the pit that just received a stone (landing pulse). */
  landing: number | null;
  /** Where the sowing hand currently hovers, and what it still holds. */
  handAt: number | null;
  handSeeds: number;
  /** Changes on every sow — lets the UI key/retrigger hand animation. */
  sowId: number;
  /** Duration of one sow step, so CSS transitions can match the rhythm. */
  stepMs: number;
  /** Absolute indices flashing during a capture, and the receiving store. */
  captureFlash: number[];
  captureStore: number | null;
  event: GameEvent;
  moveCount: number;
  /** The last committed move: who sowed which of their pits (0-5). */
  lastMove: { by: Player; pit: MancalaMove } | null;
  /** Seeds each player has stolen via captures this game. */
  captureTotals: readonly [number, number];
  /** End-of-game sweep for the harvest-finale animation. */
  sweep: { from: Array<{ pit: number; count: number }>; store: number } | null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function viewOf(state: MancalaState, moveCount: number, sowId: number): GameView {
  return {
    pits: [...state.pits],
    turn: state.turn,
    terminal: mancala.isTerminal(state),
    winner: mancala.winner(state),
    busy: false,
    landing: null,
    handAt: null,
    handSeeds: 0,
    sowId,
    stepMs: 200,
    captureFlash: [],
    captureStore: null,
    event: null,
    moveCount,
    lastMove: null,
    captureTotals: [0, 0],
    sweep: null,
  };
}

export function useGame(mode: Mode) {
  const committedRef = useRef<MancalaState>(mancala.initialState());
  const moveCountRef = useRef(0);
  const sowIdRef = useRef(0);
  const tokenRef = useRef(0);
  const busyRef = useRef(false);
  const aiPendingRef = useRef(false);
  const captureTotalsRef = useRef<[number, number]>([0, 0]);
  const [view, setView] = useState<GameView>(() => viewOf(committedRef.current, 0, 0));

  const reset = useCallback(() => {
    tokenRef.current++;
    busyRef.current = false;
    aiPendingRef.current = false;
    committedRef.current = mancala.initialState();
    moveCountRef.current = 0;
    captureTotalsRef.current = [0, 0];
    setView(viewOf(committedRef.current, 0, ++sowIdRef.current));
  }, []);

  const play = useCallback(async (move: MancalaMove) => {
    const s = committedRef.current;
    if (busyRef.current || mancala.isTerminal(s)) return;
    if (!mancala.legalMoves(s).includes(move)) return;

    busyRef.current = true;
    const token = ++tokenRef.current;
    const mover = s.turn;
    const from = pitIndex(mover, move);
    const outcome = applyMoveDetailed(s, move);
    // One drop is one readable beat: a visible landing plus one kalimba
    // note. Short sows savor each seed (~600ms); long sows quicken so a
    // 13-seed lap stays around ~5s — but never below a countable 380ms.
    const stepMs = Math.max(380, Math.min(620, 4200 / outcome.sowPath.length));
    const sowId = ++sowIdRef.current;

    const pits = [...s.pits];
    const stones = pits[from]!;
    pits[from] = 0;
    const frame = (partial: Partial<GameView>) =>
      setView((v) => ({ ...v, pits: [...pits], busy: true, stepMs, sowId, ...partial }));

    // Scoop: the hand appears over the chosen pit holding everything.
    // A beat of stillness here reads as "picking them up".
    audio.scoop();
    frame({ handAt: from, handSeeds: stones, landing: null, event: null, captureFlash: [], captureStore: null });
    await sleep(Math.max(320, stepMs * 0.9));
    if (token !== tokenRef.current) return;

    for (let i = 0; i < outcome.sowPath.length; i++) {
      const p = outcome.sowPath[i]!;
      // Glide to the next pit…
      frame({ handAt: p, handSeeds: stones - i, landing: null });
      await sleep(stepMs * 0.55);
      if (token !== tokenRef.current) return;
      // …then drop one seed.
      pits[p]!++;
      if (p === storeOf(mover)) audio.bong();
      else audio.plinkStep(i);
      frame({ handAt: p, handSeeds: stones - i - 1, landing: p });
      // The final seed decides everything — let it land and register.
      const isLast = i === outcome.sowPath.length - 1;
      await sleep(isLast ? Math.max(300, stepMs * 0.6) : stepMs * 0.45);
      if (token !== tokenRef.current) return;
    }

    if (outcome.captured > 0) {
      const landed = outcome.sowPath[outcome.sowPath.length - 1]!;
      audio.shimmer();
      frame({
        handAt: null,
        landing: null,
        captureFlash: [landed, 12 - landed],
        captureStore: storeOf(mover),
      });
      await sleep(760);
      if (token !== tokenRef.current) return;
    }

    committedRef.current = outcome.state;
    moveCountRef.current++;
    busyRef.current = false;
    if (outcome.captured > 0) captureTotalsRef.current[mover] += outcome.captured;
    if (outcome.extraTurn && !mancala.isTerminal(outcome.state)) audio.extraTurn();
    const event: GameEvent =
      outcome.captured > 0
        ? { type: 'capture', count: outcome.captured, by: mover }
        : outcome.extraTurn
          ? { type: 'extraTurn', by: mover }
          : null;
    setView({
      ...viewOf(outcome.state, moveCountRef.current, sowId),
      event,
      lastMove: { by: mover, pit: move },
      captureTotals: [...captureTotalsRef.current] as [number, number],
      sweep:
        outcome.swept.length > 0 && outcome.sweepStore != null
          ? { from: outcome.swept, store: outcome.sweepStore }
          : null,
    });
  }, []);

  // Drive the AI seat.
  useEffect(() => {
    if (mode.kind !== 'ai') return;
    if (view.busy || view.terminal || view.turn !== AI_SEAT) return;
    if (aiPendingRef.current) return;
    aiPendingRef.current = true;
    const token = tokenRef.current;
    (async () => {
      // A brief pause reads as "thinking" and keeps the rhythm human.
      const [move] = await Promise.all([
        requestAiMove(committedRef.current, mode.difficulty),
        sleep(550),
      ]);
      aiPendingRef.current = false;
      if (token !== tokenRef.current) return;
      void play(move);
    })();
  }, [mode, view.busy, view.terminal, view.turn, view.moveCount, play]);

  return { view, play, reset };
}

import { useEffect, useRef, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import type { Difficulty } from '@ancient-games/ai';
import { Board } from '../components/Board';
import { SeedTrio } from '../components/Doodles';
import { RulesButton } from '../components/Rules';
import { audio } from '../juice/audio';
import { Confetti } from '../juice/Confetti';
import { SoundMenu } from '../juice/SoundMenu';
import { useGame, type Mode, type GameView, HUMAN_SEAT, AI_SEAT } from '../game/useGame';
import { readStats, recordGame } from '../game/stats';

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
  expert: 'Expert',
};

const DIFFICULTY_ORDER: Difficulty[] = ['easy', 'medium', 'hard', 'expert'];
const FARMER = 'The Farmer';

function bestKey(d: Difficulty): string {
  return `mancala_best_${d}`;
}

function modeFromId(id: string | undefined): Mode | null {
  if (id === 'local') return { kind: 'local' };
  if (id && id in DIFFICULTY_LABELS) return { kind: 'ai', difficulty: id as Difficulty };
  return null;
}

function nameOf(seat: 0 | 1, mode: Mode): string {
  if (mode.kind === 'local') return seat === 0 ? 'Player 1' : 'Player 2';
  return seat === HUMAN_SEAT ? 'You' : FARMER;
}

/* ===== Scoreboard ===== */

interface Reaction {
  id: number;
  text: string;
}

function ScoreEntry(props: {
  emoji: string;
  name: string;
  sub?: string;
  score: number;
  active: boolean;
  thinking: boolean;
  streak?: number;
  reaction?: Reaction | null;
}) {
  return (
    <div className={`score-entry ${props.active ? 'active' : ''} ${props.thinking ? 'thinking' : ''}`}>
      <span className="score-emoji" aria-hidden="true">
        {props.emoji}
      </span>
      <span className="score-name">
        {props.name}
        {props.sub && <small>{props.sub}</small>}
      </span>
      <span key={`score-${props.score}`} className="score-value">
        {props.score}
      </span>
      {props.thinking && (
        <span className="think-dots" aria-label="thinking">
          <i />
          <i />
          <i />
        </span>
      )}
      {(props.streak ?? 0) >= 2 && <span className="streak-badge">🔥 {props.streak} win streak</span>}
      {props.reaction && (
        <span key={`reaction-${props.reaction.id}`} className="reaction" role="status">
          {props.reaction.text}
        </span>
      )}
    </div>
  );
}

/* ===== First-time tutorial (vs computer only) ===== */

function Tutorial({ view }: { view: GameView }) {
  const [step, setStep] = useState(() =>
    typeof localStorage !== 'undefined' && localStorage.getItem('mancala_played_before') ? -1 : 0,
  );

  const started = view.moveCount >= 1 || view.busy;
  useEffect(() => {
    if (step === 0 && started) {
      localStorage.setItem('mancala_played_before', 'true');
      setStep(1);
    }
  }, [step, started]);

  useEffect(() => {
    if (step === 1) {
      const t = setTimeout(() => setStep(2), 3400);
      return () => clearTimeout(t);
    }
    if (step === 2) {
      const t = setTimeout(() => setStep(3), 4400);
      return () => clearTimeout(t);
    }
    if (step === 3) {
      const t = setTimeout(() => setStep(-1), 5200);
      return () => clearTimeout(t);
    }
  }, [step]);

  if (step < 0) return null;
  const text =
    step === 0
      ? 'These are YOUR pits — tap one to sow'
      : step === 1
        ? 'Seeds sow counter-clockwise, one per pit'
        : step === 2
          ? 'Land your last seed in your store for a bonus turn!'
          : 'End in one of your empty pits to STEAL everything across from it';
  return (
    <div className={`tutorial step-${step}`} aria-live="polite">
      {step === 0 && <span className="tutorial-arrow" aria-hidden="true" />}
      {text}
    </div>
  );
}

/* ===== The game screen ===== */

function Game({ mode }: { mode: Mode }) {
  const navigate = useNavigate();
  const { view, play, reset } = useGame(mode);
  const [streak, setStreak] = useState(() => readStats().streak);
  const [newBest, setNewBest] = useState(false);
  const [reaction, setReaction] = useState<Reaction | null>(null);
  const [confirming, setConfirming] = useState<null | { label: string; run: () => void }>(null);
  const [reviewing, setReviewing] = useState(false);
  const [endReady, setEndReady] = useState(false);
  const endHandledRef = useRef(false);

  const midGame = view.moveCount > 0 && !view.terminal;
  const guard = (label: string, run: () => void) => () => {
    if (midGame) setConfirming({ label, run });
    else run();
  };

  const youScore = view.pits[6]!;
  const oppScore = view.pits[13]!;
  const diff = youScore - oppScore;

  // Settle the game once: let the harvest finale play, then jingle,
  // streak, personal best, and the stats ledger.
  useEffect(() => {
    if (!view.terminal) {
      endHandledRef.current = false;
      setNewBest(false);
      setReviewing(false);
      setEndReady(false);
      return;
    }
    if (endHandledRef.current) return;
    endHandledRef.current = true;

    const won = view.winner !== 'draw' && (mode.kind === 'local' || view.winner === HUMAN_SEAT);
    // The sweep animation takes ~350ms + 260ms per swept pit; hold the
    // card and jingle until the seeds have landed.
    const finaleMs = view.sweep ? 700 + view.sweep.from.length * 260 : 400;
    const t = setTimeout(() => {
      audio.jingle(view.winner === 'draw' ? 'draw' : won ? 'win' : 'lose');
      setEndReady(true);
    }, finaleMs);

    if (mode.kind === 'ai') {
      const result =
        view.winner === 'draw' ? 'draw' : view.winner === HUMAN_SEAT ? 'win' : 'loss';
      const stats = recordGame({
        difficulty: mode.difficulty,
        result,
        myScore: youScore,
        seedsStolen: view.captureTotals[HUMAN_SEAT],
      });
      setStreak(stats.streak);
      const key = bestKey(mode.difficulty);
      const prev = Number(localStorage.getItem(key) ?? 0);
      if (view.winner === HUMAN_SEAT && youScore > prev) {
        localStorage.setItem(key, String(youScore));
        setNewBest(true);
      }
    }
    return () => clearTimeout(t);
  }, [view.terminal, view.winner, view.sweep, view.captureTotals, mode, youScore]);

  // The Farmer reacts to captures — his own and yours.
  useEffect(() => {
    if (mode.kind !== 'ai' || view.event?.type !== 'capture' || view.terminal) return;
    setReaction({
      id: view.moveCount,
      text: view.event.by === HUMAN_SEAT ? '😤' : '😏 Gotcha!',
    });
    const t = setTimeout(() => setReaction(null), 1600);
    return () => clearTimeout(t);
  }, [mode.kind, view.event, view.moveCount, view.terminal]);

  let status: string;
  if (view.terminal) {
    if (view.winner === 'draw') status = 'A draw — evenly sown.';
    else if (mode.kind === 'ai')
      status = view.winner === HUMAN_SEAT ? 'You win — a fine harvest.' : `${FARMER} takes this one.`;
    else status = `${nameOf(view.winner!, mode)} wins the game.`;
  } else if (view.event?.type === 'capture') {
    status = `${nameOf(view.event.by, mode)} captured ${view.event.count} seeds.`;
  } else if (view.event?.type === 'extraTurn') {
    status = `${nameOf(view.event.by, mode)} landed in the store — sow again.`;
  } else if (view.busy) {
    status = 'Sowing…';
  } else if (mode.kind === 'ai' && view.turn !== HUMAN_SEAT) {
    status = `${FARMER} is thinking…`;
  } else if (mode.kind === 'ai' && view.lastMove?.by === AI_SEAT) {
    // Narrate the opponent's move — essential for screen readers, useful
    // for everyone who looked away.
    status = `${FARMER} sowed from pit ${view.lastMove.pit + 1}. Your turn — pick a pit.`;
  } else {
    status = `${nameOf(view.turn, mode)} to sow — pick a pit.`;
  }

  const won =
    view.terminal && view.winner !== 'draw' && (mode.kind === 'local' || view.winner === HUMAN_SEAT);
  const nextDifficulty =
    mode.kind === 'ai' ? DIFFICULTY_ORDER[DIFFICULTY_ORDER.indexOf(mode.difficulty) + 1] : undefined;
  const personalBest =
    mode.kind === 'ai' ? Number(localStorage.getItem(bestKey(mode.difficulty)) ?? 0) : 0;

  return (
    <main className="screen game-screen">
      <header className="topbar">
        <button type="button" className="btn btn-small" onClick={guard('Leave this game?', () => navigate('/'))}>
          ← Games
        </button>
        <span className="wordmark small">Mancala</span>
        <div className="topbar-actions">
          <RulesButton />
          <SoundMenu />
          <button type="button" className="btn btn-small" onClick={guard('Start over?', reset)}>
            New game
          </button>
        </div>
      </header>

      <div className="scoreboard" aria-label="score">
        <ScoreEntry
          emoji={mode.kind === 'ai' ? '🌱' : '🌱'}
          name={nameOf(0, mode)}
          score={youScore}
          active={!view.terminal && view.turn === 0}
          thinking={false}
          streak={mode.kind === 'ai' ? streak : 0}
        />
        {youScore + oppScore > 0 && (
          <span className={`score-diff ${diff > 0 ? 'up' : diff < 0 ? 'down' : ''}`}>
            {diff === 0 ? 'even' : diff > 0 ? `+${diff}` : `${diff}`}
          </span>
        )}
        <ScoreEntry
          emoji={mode.kind === 'ai' ? '🧑‍🌾' : '🌾'}
          name={nameOf(1, mode)}
          sub={mode.kind === 'ai' ? DIFFICULTY_LABELS[mode.difficulty] : undefined}
          score={oppScore}
          active={!view.terminal && view.turn === 1}
          thinking={mode.kind === 'ai' && !view.terminal && view.turn === 1}
          reaction={reaction}
        />
      </div>

      <div className="table">
        <Board view={view} mode={mode} onPlay={(m) => void play(m)} />

        {mode.kind === 'ai' && !view.terminal && <Tutorial view={view} />}

        {view.event && !view.terminal && (
          <div
            key={view.moveCount}
            className={`event-pop ${view.event.type === 'capture' ? 'chili' : 'mango'}`}
          >
            {view.event.type === 'capture' ? `+${view.event.count} seeds!` : 'Sow again!'}
          </div>
        )}
      </div>

      <p className="status" role="status">
        {status}
      </p>

      {view.terminal && endReady && !reviewing && (
        <>
          {won && <Confetti />}
          <div
            className="endcard-scrim"
            onClick={() => setReviewing(true)}
            aria-hidden="true"
          />
          <div className="endcard" role="dialog" aria-label="Game over">
            <SeedTrio className="endcard-seeds" />
            <p className={`endcard-title ${won ? 'won' : ''}`}>
              {view.winner === 'draw'
                ? 'A draw'
                : mode.kind === 'ai'
                  ? view.winner === HUMAN_SEAT
                    ? 'You won! 🎉'
                    : 'You lost'
                  : `${nameOf(view.winner!, mode)} wins! 🎉`}
            </p>
            <p className="endcard-score">
              {youScore} <span>vs</span> {oppScore}
            </p>
            {newBest && <p className="best-badge">★ New personal best!</p>}
            {!newBest && mode.kind === 'ai' && personalBest > 0 && (
              <p className="endcard-streak">
                Your best on {DIFFICULTY_LABELS[mode.difficulty]}: {personalBest}
              </p>
            )}
            {mode.kind === 'ai' && streak >= 2 && (
              <p className="endcard-streak">🔥 {streak} wins in a row</p>
            )}
            {mode.kind === 'ai' && !won && view.captureTotals[AI_SEAT] >= 4 && (
              <p className="endcard-insight">
                {FARMER} stole {view.captureTotals[AI_SEAT]} of your seeds — guard pits holding a
                single seed.
              </p>
            )}
            {mode.kind === 'ai' && won && view.captureTotals[HUMAN_SEAT] >= 4 && (
              <p className="endcard-insight">
                You stole {view.captureTotals[HUMAN_SEAT]} seeds from {FARMER}. Ruthless. 🌾
              </p>
            )}
            <div className="endcard-actions">
              <button type="button" className="btn btn-green" onClick={reset}>
                {won || view.winner === 'draw' ? 'Play again' : `Rematch ${mode.kind === 'ai' ? FARMER : ''}`.trim()}
              </button>
              {nextDifficulty && won && (
                <button
                  type="button"
                  className="btn"
                  onClick={() => navigate(`/play/${nextDifficulty}`)}
                >
                  Try {DIFFICULTY_LABELS[nextDifficulty]} →
                </button>
              )}
              <button type="button" className="quiet-link" onClick={() => setReviewing(true)}>
                Review the board
              </button>
              <button type="button" className="quiet-link" onClick={() => navigate('/')}>
                Change difficulty
              </button>
            </div>
          </div>
        </>
      )}

      {view.terminal && endReady && reviewing && (
        <div className="rematch-bar">
          <span>
            Final: {youScore} – {oppScore}
          </span>
          <button type="button" className="btn btn-small btn-green" onClick={reset}>
            Rematch
          </button>
          <button type="button" className="btn btn-small" onClick={() => navigate('/')}>
            Games
          </button>
        </div>
      )}

      {confirming && (
        <>
          <div className="endcard-scrim" onClick={() => setConfirming(null)} aria-hidden="true" />
          <div className="endcard confirm-card" role="dialog" aria-label={confirming.label}>
            <p className="endcard-title confirm-title">{confirming.label}</p>
            <p className="endcard-streak">This game will be lost.</p>
            <div className="endcard-actions">
              <button type="button" className="btn btn-green" onClick={() => setConfirming(null)}>
                Keep playing
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => {
                  confirming.run();
                  setConfirming(null);
                }}
              >
                Yes, leave it
              </button>
            </div>
          </div>
        </>
      )}
    </main>
  );
}

export default function GamePage() {
  const { modeId } = useParams();
  const mode = modeFromId(modeId);

  // Remember where the player likes to play — the landing's "Play now"
  // returns them here instead of always resetting to Medium.
  useEffect(() => {
    if (mode?.kind === 'ai') localStorage.setItem('mancala_last_difficulty', mode.difficulty);
  }, [mode?.kind === 'ai' ? mode.difficulty : null]);

  if (!mode) return <Navigate to="/" replace />;
  return <Game key={modeId} mode={mode} />;
}

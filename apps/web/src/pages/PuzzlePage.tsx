import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Board } from '../components/Board';
import { SeedTrio } from '../components/Doodles';
import { audio } from '../juice/audio';
import { Confetti } from '../juice/Confetti';
import { SoundMenu } from '../juice/SoundMenu';
import { useGame } from '../game/useGame';
import {
  generatePuzzle,
  todayNumber,
  readDaily,
  recordDaily,
  starsFor,
  shareText,
  type DailyRecord,
} from '../game/puzzle';

export default function PuzzlePage() {
  const navigate = useNavigate();
  const day = todayNumber();
  const puzzle = useMemo(() => generatePuzzle(day), [day]);
  const { view, play, reset } = useGame({ kind: 'puzzle' }, puzzle.state);

  const [record, setRecord] = useState<DailyRecord | null>(() => {
    const r = readDaily();
    return r && r.day === day ? r : null;
  });
  const [attemptDone, setAttemptDone] = useState(false);
  const [copied, setCopied] = useState(false);
  const settledRef = useRef(false);

  const banked = view.pits[6]! - puzzle.state.pits[6]!;
  // The chain ends when the turn passes (or the board runs out).
  const ended = !view.busy && (view.turn === 1 || view.terminal);

  useEffect(() => {
    if (!ended) {
      settledRef.current = false;
      return;
    }
    if (settledRef.current) return;
    settledRef.current = true;
    const t = setTimeout(() => {
      const rec = recordDaily(day, banked, puzzle.optimal);
      setRecord(rec);
      setAttemptDone(true);
      audio.jingle(starsFor(banked, puzzle.optimal) === 3 ? 'win' : 'draw');
    }, 500);
    return () => clearTimeout(t);
  }, [ended, banked, day, puzzle.optimal]);

  const retry = () => {
    setAttemptDone(false);
    setCopied(false);
    reset();
  };

  const share = async () => {
    if (!record) return;
    const text = shareText(record);
    try {
      if (navigator.share) await navigator.share({ text });
      else {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch {
      /* user cancelled */
    }
  };

  const liveStars = starsFor(banked, puzzle.optimal);

  return (
    <main className="screen game-screen">
      <header className="topbar">
        <button type="button" className="btn btn-small" onClick={() => navigate('/')}>
          ← Games
        </button>
        <span className="wordmark small">Daily Harvest</span>
        <div className="topbar-actions">
          <SoundMenu />
        </div>
      </header>

      <div className="scoreboard">
        <div className="score-entry active">
          <span className="score-emoji" aria-hidden="true">
            🌾
          </span>
          <span className="score-name">
            Harvest #{day}
            <small>bank seeds in ONE turn</small>
          </span>
          <span key={`score-${banked}`} className="score-value">
            {banked}
          </span>
          <span className="score-diff">goal {puzzle.optimal}</span>
        </div>
      </div>

      <div className="table">
        <Board view={view} mode={{ kind: 'puzzle' }} onPlay={(m) => void play(m)} />
      </div>

      <p className="status" role="status">
        {ended
          ? `Chain over — you banked ${banked} of ${puzzle.optimal}.`
          : view.busy
            ? 'Sowing…'
            : 'Land your last seed in your store to keep the chain going.'}
      </p>

      {attemptDone && record && (
        <>
          {liveStars === 3 && <Confetti />}
          <div className="endcard" role="dialog" aria-label="Puzzle result">
            <SeedTrio className="endcard-seeds" />
            <p className={`endcard-title ${liveStars === 3 ? 'won' : ''}`}>
              {liveStars === 3 ? 'Perfect harvest!' : liveStars === 2 ? 'Good harvest' : 'Harvested'}
            </p>
            <p className="endcard-score">
              {banked} <span>of</span> {puzzle.optimal}
            </p>
            <p className="endcard-streak">{'⭐'.repeat(liveStars)}</p>
            {record.streak > 1 && <p className="endcard-streak">🔥 {record.streak}-day streak</p>}
            {record.score !== banked && (
              <p className="endcard-streak">Today's recorded result: {record.score}/{record.optimal}</p>
            )}
            <div className="endcard-actions">
              <button type="button" className="btn btn-green" onClick={share}>
                {copied ? 'Copied!' : 'Share result'}
              </button>
              <button type="button" className="btn" onClick={retry}>
                Practice again
              </button>
              <button type="button" className="quiet-link" onClick={() => navigate('/')}>
                Back to games
              </button>
            </div>
            <p className="endcard-streak">New harvest tomorrow 🌱</p>
          </div>
        </>
      )}
    </main>
  );
}

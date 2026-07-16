import { useNavigate } from 'react-router-dom';
import type { Difficulty } from '@ancient-games/ai';
import { SproutDoodle } from '../components/Doodles';
import { RulesButton } from '../components/Rules';
import { SoundMenu } from '../juice/SoundMenu';
import { readDaily, todayNumber } from '../game/puzzle';
import { DIFFICULTY_LABELS } from './GamePage';

function lastDifficulty(): Difficulty {
  const d = localStorage.getItem('mancala_last_difficulty');
  return d && d in DIFFICULTY_LABELS ? (d as Difficulty) : 'medium';
}

function bestOf(d: Difficulty): number {
  return Number(localStorage.getItem(`mancala_best_${d}`) ?? 0);
}

/** Set to the real Ko-fi page before launch — the link stays hidden until then. */
const TIP_URL: string | null = null;

const SEED_COLORS = ['#ffb03a', '#e8503a', '#7c5cdb', '#4fa8d8', '#8fd6a4'];

/** Slow candy seeds drifting through the hero band. */
function DriftSeeds() {
  const seeds = Array.from({ length: 9 }, (_, i) => ({
    left: 4 + ((i * 41) % 90),
    top: 8 + ((i * 29) % 74),
    size: 10 + ((i * 7) % 12),
    duration: 6 + ((i * 13) % 7),
    delay: -((i * 17) % 9),
    color: SEED_COLORS[i % SEED_COLORS.length]!,
  }));
  return (
    <div className="drift-layer" aria-hidden="true">
      {seeds.map((s, i) => (
        <span
          key={i}
          className="drift-seed"
          style={{
            left: `${s.left}%`,
            top: `${s.top}%`,
            width: s.size,
            height: s.size * 0.8,
            background: s.color,
            animationDuration: `${s.duration}s`,
            animationDelay: `${s.delay}s`,
          }}
        />
      ))}
    </div>
  );
}

/** The wordmark, one letter at a time. */
function PopWordmark({ text }: { text: string }) {
  return (
    <h1 className="wordmark" aria-label={text}>
      {text.split('').map((ch, i) => (
        <span key={i} className="wordmark-letter" style={{ animationDelay: `${120 + i * 65}ms` }} aria-hidden="true">
          {ch}
        </span>
      ))}
    </h1>
  );
}

/** An endless little sow: one seed hops across four pits into the store. */
function SowLoop() {
  return (
    <div className="sowloop" aria-hidden="true">
      {[0, 1, 2, 3].map((i) => (
        <span key={i} className="sowloop-pit" style={{ animationDelay: `${i * 0.55}s` }} />
      ))}
      <span className="sowloop-store" />
      <span className="sowloop-runner">
        <span className="sowloop-seed" />
      </span>
    </div>
  );
}

const TICKER_ITEMS = [
  'Over a thousand years old',
  'No ads, ever',
  'No pay-to-win',
  'Free forever',
  'Learn it in 30 seconds',
  'Beat the Expert if you can',
];

function Ticker() {
  const row = TICKER_ITEMS.map((item, i) => (
    <span className="ticker-item" key={i}>
      {item}
      <span className="ticker-seed" />
    </span>
  ));
  return (
    <div className="ticker" aria-hidden="true">
      <div className="ticker-track">
        {row}
        {row}
      </div>
    </div>
  );
}

export default function Landing() {
  const navigate = useNavigate();
  const last = lastDifficulty();
  const day = todayNumber();
  const daily = readDaily();
  const dailyDone = daily?.day === day;
  return (
    <main className="menu-screen">
      <section className="hero">
        <DriftSeeds />
        <div className="hero-toggle">
          <RulesButton />
          <SoundMenu />
        </div>
        <div className="hero-inner">
          <div className="hero-copy">
            <p className="eyebrow">Ancient Games · Vol. 1</p>
            <PopWordmark text="Mancala" />
            <p className="tagline">
              Sow seeds. Steal harvests. People have played this for over a thousand years —
              now it's your turn.
            </p>
            <div className="hero-cta">
              <button
                type="button"
                className="btn btn-green btn-big"
                onClick={() => navigate(`/play/${last}`)}
              >
                Play now
                <small className="btn-sub">vs The Farmer · {DIFFICULTY_LABELS[last]}</small>
              </button>
              <button type="button" className="btn btn-big" onClick={() => navigate('/play/local')}>
                Play a friend
                <small className="btn-sub">pass &amp; play</small>
              </button>
            </div>
          </div>
          <div className="hero-side">
            <SproutDoodle className="hero-doodle" />
            <SowLoop />
          </div>
        </div>
      </section>

      <Ticker />

      <section className="menu-body">
        <div className="card daily-card" aria-labelledby="daily-harvest">
          <h2 id="daily-harvest" className="card-heading">
            🌾 Daily Harvest #{day}
          </h2>
          <p className="card-sub">
            One puzzle a day, same for everyone: bank as many seeds as you can in a single turn.
          </p>
          {dailyDone ? (
            <div className="daily-done">
              <span className="daily-result">
                {daily.score}/{daily.optimal} {'⭐'.repeat(daily.stars)}
                {daily.streak > 1 && ` · 🔥 ${daily.streak}`}
              </span>
              <button type="button" className="btn" onClick={() => navigate('/daily')}>
                Practice
              </button>
            </div>
          ) : (
            <button type="button" className="btn btn-green" onClick={() => navigate('/daily')}>
              Play today's harvest
            </button>
          )}
        </div>

        <div className="card" aria-labelledby="vs-computer">
          <h2 id="vs-computer" className="card-heading">
            Challenge The Farmer 🧑‍🌾
          </h2>
          <p className="card-sub">Four honest difficulties. Expert really is.</p>
          <div className="difficulty-row">
            {(Object.keys(DIFFICULTY_LABELS) as Difficulty[]).map((d) => {
              const best = bestOf(d);
              return (
                <button
                  key={d}
                  type="button"
                  className={`btn ${d === last ? 'btn-green' : ''}`}
                  onClick={() => navigate(`/play/${d}`)}
                >
                  {DIFFICULTY_LABELS[d]}
                  {best > 0 && <small className="btn-sub">best {best}</small>}
                </button>
              );
            })}
          </div>
          <button type="button" className="quiet-link stats-link" onClick={() => navigate('/stats')}>
            Your harvest → wins, streaks &amp; records
          </button>
        </div>

        <footer className="site-footer">
          <p className="promise">No ads · No pay-to-win · Free forever</p>
          {TIP_URL && (
            <a href={TIP_URL} target="_blank" rel="noreferrer">
              Enjoying the game? Leave a tip — always welcome, never required.
            </a>
          )}
        </footer>
      </section>
    </main>
  );
}

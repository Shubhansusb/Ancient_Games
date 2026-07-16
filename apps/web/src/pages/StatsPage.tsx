import { useNavigate } from 'react-router-dom';
import type { Difficulty } from '@ancient-games/ai';
import { readStats } from '../game/stats';
import { DIFFICULTY_LABELS } from './GamePage';

function bestOf(d: Difficulty): number {
  return Number(localStorage.getItem(`mancala_best_${d}`) ?? 0);
}

export default function StatsPage() {
  const navigate = useNavigate();
  const stats = readStats();
  const winRate = stats.games > 0 ? Math.round((stats.wins / stats.games) * 100) : 0;

  return (
    <main className="screen stats-screen">
      <header className="topbar">
        <button type="button" className="btn btn-small" onClick={() => navigate('/')}>
          ← Games
        </button>
        <span className="wordmark small">Your harvest</span>
        <span className="topbar-spacer" />
      </header>

      {stats.games === 0 ? (
        <div className="card stats-empty">
          <p className="card-heading">No games yet</p>
          <p className="card-sub">Your wins, streaks, and best harvests will grow here.</p>
          <button type="button" className="btn btn-green" onClick={() => navigate('/play/medium')}>
            Play your first game
          </button>
        </div>
      ) : (
        <>
          <div className="stat-tiles">
            <div className="stat-tile">
              <span className="stat-value">{stats.games}</span>
              <span className="stat-label">games</span>
            </div>
            <div className="stat-tile">
              <span className="stat-value">{winRate}%</span>
              <span className="stat-label">win rate</span>
            </div>
            <div className="stat-tile">
              <span className="stat-value">{stats.streak > 0 ? `🔥 ${stats.streak}` : '—'}</span>
              <span className="stat-label">streak</span>
            </div>
            <div className="stat-tile">
              <span className="stat-value">{stats.bestStreak}</span>
              <span className="stat-label">best streak</span>
            </div>
            <div className="stat-tile">
              <span className="stat-value">{stats.seedsBanked}</span>
              <span className="stat-label">seeds banked</span>
            </div>
            <div className="stat-tile">
              <span className="stat-value">{stats.seedsStolen}</span>
              <span className="stat-label">seeds stolen</span>
            </div>
          </div>

          <div className="card stats-table-card">
            <h2 className="card-heading">Against The Farmer 🧑‍🌾</h2>
            <table className="stats-table">
              <thead>
                <tr>
                  <th scope="col">Difficulty</th>
                  <th scope="col">W</th>
                  <th scope="col">L</th>
                  <th scope="col">D</th>
                  <th scope="col">Best</th>
                  <th scope="col" aria-label="play" />
                </tr>
              </thead>
              <tbody>
                {(Object.keys(DIFFICULTY_LABELS) as Difficulty[]).map((d) => {
                  const r = stats.byDifficulty[d];
                  const best = bestOf(d);
                  return (
                    <tr key={d}>
                      <th scope="row">{DIFFICULTY_LABELS[d]}</th>
                      <td>{r.wins}</td>
                      <td>{r.losses}</td>
                      <td>{r.draws}</td>
                      <td>{best > 0 ? best : '—'}</td>
                      <td>
                        <button
                          type="button"
                          className="btn btn-small"
                          onClick={() => navigate(`/play/${d}`)}
                        >
                          Play
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </main>
  );
}

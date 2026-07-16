import { useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { audio } from './juice/audio';
import Landing from './pages/Landing';
import GamePage from './pages/GamePage';
import StatsPage from './pages/StatsPage';
import PuzzlePage from './pages/PuzzlePage';

export default function App() {
  // Browsers gate audio behind a user gesture — unlock on the first one.
  useEffect(() => {
    const unlock = () => audio.unlock();
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, []);

  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/play/:modeId" element={<GamePage />} />
      <Route path="/stats" element={<StatsPage />} />
      <Route path="/daily" element={<PuzzlePage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

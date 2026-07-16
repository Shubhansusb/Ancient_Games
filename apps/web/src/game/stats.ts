import type { Difficulty } from '@ancient-games/ai';

export interface DifficultyRecord {
  wins: number;
  losses: number;
  draws: number;
}

export interface Stats {
  games: number;
  wins: number;
  losses: number;
  draws: number;
  streak: number;
  bestStreak: number;
  seedsBanked: number;
  seedsStolen: number;
  byDifficulty: Record<Difficulty, DifficultyRecord>;
}

const KEY = 'mancala_stats';

const EMPTY: Stats = {
  games: 0,
  wins: 0,
  losses: 0,
  draws: 0,
  streak: 0,
  bestStreak: 0,
  seedsBanked: 0,
  seedsStolen: 0,
  byDifficulty: {
    easy: { wins: 0, losses: 0, draws: 0 },
    medium: { wins: 0, losses: 0, draws: 0 },
    hard: { wins: 0, losses: 0, draws: 0 },
    expert: { wins: 0, losses: 0, draws: 0 },
  },
};

export function readStats(): Stats {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return structuredClone(EMPTY);
    const parsed = JSON.parse(raw) as Partial<Stats>;
    return { ...structuredClone(EMPTY), ...parsed, byDifficulty: { ...structuredClone(EMPTY.byDifficulty), ...parsed.byDifficulty } };
  } catch {
    return structuredClone(EMPTY);
  }
}

export function recordGame(input: {
  difficulty: Difficulty;
  result: 'win' | 'loss' | 'draw';
  myScore: number;
  seedsStolen: number;
}): Stats {
  const s = readStats();
  s.games++;
  s.seedsBanked += input.myScore;
  s.seedsStolen += input.seedsStolen;
  const rec = s.byDifficulty[input.difficulty];
  if (input.result === 'win') {
    s.wins++;
    rec.wins++;
    s.streak++;
    s.bestStreak = Math.max(s.bestStreak, s.streak);
  } else if (input.result === 'loss') {
    s.losses++;
    rec.losses++;
    s.streak = 0;
  } else {
    s.draws++;
    rec.draws++;
  }
  localStorage.setItem(KEY, JSON.stringify(s));
  return s;
}

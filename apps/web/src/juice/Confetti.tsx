import { useMemo } from 'react';

const COLORS = ['#ffb03a', '#e8503a', '#7c5cdb', '#4fa8d8', '#8fd6a4'];

/** A gentle rain of candy seeds for the win screen. */
export function Confetti({ pieces = 36 }: { pieces?: number }) {
  const seeds = useMemo(
    () =>
      Array.from({ length: pieces }, (_, i) => ({
        left: Math.random() * 100,
        delay: Math.random() * 1.6,
        duration: 2.4 + Math.random() * 1.8,
        size: 8 + Math.random() * 8,
        color: COLORS[i % COLORS.length]!,
        spin: Math.random() < 0.5 ? -1 : 1,
      })),
    [pieces],
  );
  return (
    <div className="confetti-layer" aria-hidden="true">
      {seeds.map((s, i) => (
        <span
          key={i}
          className="confetti-piece"
          style={{
            left: `${s.left}%`,
            width: s.size,
            height: s.size * 0.8,
            background: s.color,
            animationDelay: `${s.delay}s`,
            animationDuration: `${s.duration}s`,
            animationDirection: s.spin === 1 ? 'normal' : 'reverse',
          }}
        />
      ))}
    </div>
  );
}

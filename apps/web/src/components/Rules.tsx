import { useEffect, useState } from 'react';

const RULES = [
  {
    icon: '🫘',
    title: 'Sow',
    text: 'Tap one of your pits. Its seeds drop one-by-one, counter-clockwise, into the pits ahead.',
  },
  {
    icon: '🏺',
    title: 'Bank',
    text: 'Your store is the big pit on your right. Seeds that land there are yours forever — most seeds wins.',
  },
  {
    icon: '🔁',
    title: 'Go again',
    text: 'If your last seed lands exactly in your store, you take another turn.',
  },
  {
    icon: '😏',
    title: 'Steal',
    text: 'If your last seed lands in an empty pit on YOUR side, you capture it plus everything in the pit directly across.',
  },
  {
    icon: '🏁',
    title: 'The end',
    text: 'When one side runs out of seeds, the other player banks everything left on their row.',
  },
];

export function RulesButton() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [open]);

  return (
    <>
      <button
        type="button"
        className="btn btn-small"
        aria-label="How to play"
        onClick={() => setOpen(true)}
      >
        ?
      </button>
      {open && (
        <>
          <div className="endcard-scrim" onClick={() => setOpen(false)} aria-hidden="true" />
          <div className="endcard rules-card" role="dialog" aria-label="How to play">
            <p className="endcard-title rules-title">How to play</p>
            <ul className="rules-list">
              {RULES.map((r) => (
                <li key={r.title}>
                  <span className="rules-icon" aria-hidden="true">
                    {r.icon}
                  </span>
                  <span>
                    <strong>{r.title}.</strong> {r.text}
                  </span>
                </li>
              ))}
            </ul>
            <button type="button" className="btn btn-green" onClick={() => setOpen(false)}>
              Got it
            </button>
          </div>
        </>
      )}
    </>
  );
}

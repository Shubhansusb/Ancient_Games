/**
 * Hand-drawn brand illustrations. Ink strokes with round caps, candy fills —
 * the same "sticker" language as the buttons and seeds.
 */

const INK = '#2b2118';

export function SproutDoodle({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 120 130" aria-hidden="true">
      {/* mound of soil */}
      <path
        d="M18 112 Q60 96 102 112 Q84 124 60 124 Q36 124 18 112 Z"
        fill="#c9a06d"
        stroke={INK}
        strokeWidth="4"
        strokeLinejoin="round"
      />
      {/* stem */}
      <path
        d="M60 106 C58 84 62 66 60 46"
        fill="none"
        stroke={INK}
        strokeWidth="5"
        strokeLinecap="round"
      />
      {/* left leaf */}
      <path
        d="M59 62 C46 60 36 50 34 36 C50 36 60 46 61 60 Z"
        fill="#8fd6a4"
        stroke={INK}
        strokeWidth="4"
        strokeLinejoin="round"
      />
      {/* right leaf */}
      <path
        d="M61 48 C64 32 74 22 90 20 C90 38 78 50 62 52 Z"
        fill="#3ba55d"
        stroke={INK}
        strokeWidth="4"
        strokeLinejoin="round"
      />
      {/* falling seeds */}
      <ellipse cx="24" cy="78" rx="7" ry="5.6" fill="#ffb03a" stroke={INK} strokeWidth="3.5" transform="rotate(-18 24 78)" />
      <ellipse cx="97" cy="86" rx="7" ry="5.6" fill="#e8503a" stroke={INK} strokeWidth="3.5" transform="rotate(14 97 86)" />
      <ellipse cx="86" cy="60" rx="6" ry="4.8" fill="#7c5cdb" stroke={INK} strokeWidth="3.5" transform="rotate(-8 86 60)" />
    </svg>
  );
}

export function SwooshUnderline({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 220 18" aria-hidden="true" preserveAspectRatio="none">
      <path
        d="M6 12 C60 4 150 4 214 9"
        fill="none"
        stroke="#ffb03a"
        strokeWidth="7"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function SeedTrio({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 84 30" aria-hidden="true">
      <ellipse cx="16" cy="16" rx="9" ry="7.4" fill="#ffb03a" stroke={INK} strokeWidth="3" transform="rotate(-14 16 16)" />
      <ellipse cx="42" cy="13" rx="9" ry="7.4" fill="#e8503a" stroke={INK} strokeWidth="3" transform="rotate(10 42 13)" />
      <ellipse cx="68" cy="17" rx="9" ry="7.4" fill="#7c5cdb" stroke={INK} strokeWidth="3" transform="rotate(-4 68 17)" />
    </svg>
  );
}

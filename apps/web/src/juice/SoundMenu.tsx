import { useEffect, useRef, useState } from 'react';
import { audio, MUSIC_STYLES, type MusicId } from './audio';

export function SoundMenu() {
  const [open, setOpen] = useState(false);
  const [sfx, setSfx] = useState(audio.sfxOn);
  const [music, setMusic] = useState<MusicId>(audio.musicId);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('pointerdown', close);
    window.addEventListener('keydown', esc);
    return () => {
      window.removeEventListener('pointerdown', close);
      window.removeEventListener('keydown', esc);
    };
  }, [open]);

  const musicLabel = music === 'off' ? 'off' : MUSIC_STYLES.find((s) => s.id === music)?.name;

  return (
    <div className="sound-menu" ref={rootRef}>
      <button
        type="button"
        className="btn btn-small"
        aria-expanded={open}
        aria-label={`Sound settings. Music: ${musicLabel}. Effects: ${sfx ? 'on' : 'off'}.`}
        onClick={() => setOpen((o) => !o)}
      >
        {sfx || music !== 'off' ? '🔊' : '🔇'} Sound
      </button>

      {open && (
        <div className="sound-panel" role="menu">
          <div className="sound-row">
            <span className="sound-label">Effects</span>
            <button
              type="button"
              className={`pill ${sfx ? 'on' : ''}`}
              onClick={() => {
                audio.setSfx(!sfx);
                setSfx(!sfx);
                if (!sfx) audio.plinkStep(2); // audible confirmation
              }}
            >
              {sfx ? 'On' : 'Off'}
            </button>
          </div>

          <div className="sound-divider" />

          <span className="sound-label">Music</span>
          <div className="sound-tracks">
            <button
              type="button"
              className={`pill ${music === 'off' ? 'on' : ''}`}
              onClick={() => {
                audio.setMusic('off');
                setMusic('off');
              }}
            >
              Off
            </button>
            {MUSIC_STYLES.map((s) => (
              <button
                key={s.id}
                type="button"
                className={`pill ${music === s.id ? 'on' : ''}`}
                onClick={() => {
                  audio.setMusic(s.id);
                  audio.unlock();
                  setMusic(s.id);
                }}
              >
                {s.name}
                <small>{s.hint}</small>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

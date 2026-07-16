import { useEffect, useRef, useState } from 'react';
import type { Player } from '@ancient-games/engine';
import {
  mancala,
  applyMoveDetailed,
  pitIndex,
  P0_STORE,
  P1_STORE,
  type MancalaMove,
} from '@ancient-games/game-mancala';
import type { GameView, Mode } from '../game/useGame';
import { HUMAN_SEAT } from '../game/useGame';
import { audio } from '../juice/audio';

const SEED_COLORS = ['#ffb03a', '#e8503a', '#7c5cdb', '#4fa8d8'];

const reducedMotion = () =>
  typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

function Seeds({ pit, count, capacity }: { pit: number; count: number; capacity: number }) {
  const seeds = [];
  for (let i = 0; i < count; i++) {
    const angle = i * 2.39996 + pit * 1.7;
    const ring = (i % capacity) + 0.6;
    const r = 36 * Math.sqrt(ring / capacity);
    const x = 50 + r * Math.cos(angle);
    const y = 50 + r * Math.sin(angle);
    seeds.push(
      <span
        key={i}
        className="seed"
        style={{
          left: `${x}%`,
          top: `${y}%`,
          background: SEED_COLORS[(i * 7 + pit * 3) % SEED_COLORS.length],
          transform: `translate(-50%, -50%) rotate(${(angle * 57) % 360}deg)`,
        }}
      />,
    );
  }
  return <>{seeds}</>;
}

interface Preview {
  move: MancalaMove;
  landing: number;
  extraTurn: boolean;
  captured: number;
}

interface PitProps {
  abs: number;
  count: number;
  playable: boolean;
  landing: boolean;
  flashing: boolean;
  previewLanding: Preview | null;
  hovered: Preview | null;
  enterDelay: number;
  onClick: () => void;
  onHover: (on: boolean) => void;
  onPressStart: (e: { pointerType: string }) => void;
  onPressEnd: () => void;
  registerRef: (el: HTMLElement | null) => void;
  owner: Player;
  relative: number;
}

function Pit(props: PitProps) {
  const p = props.previewLanding;
  const previewClass = p ? (p.captured > 0 ? 'preview-capture' : p.extraTurn ? 'preview-extra' : 'preview-landing') : '';
  return (
    <div className="pit-slot" style={{ animationDelay: `${props.enterDelay}ms` }}>
      {props.hovered && (props.hovered.extraTurn || props.hovered.captured > 0) && (
        <span className={`preview-chip ${props.hovered.captured > 0 ? 'chili' : 'mango'}`}>
          {props.hovered.captured > 0 ? `Steal ${props.hovered.captured}!` : 'Free turn!'}
        </span>
      )}
      <button
        ref={props.registerRef}
        type="button"
        className={[
          'pit',
          props.playable ? 'playable' : '',
          props.landing ? 'landing' : '',
          props.flashing ? 'flashing' : '',
          previewClass,
        ].join(' ')}
        disabled={!props.playable}
        onClick={props.onClick}
        onMouseEnter={() => props.onHover(true)}
        onMouseLeave={() => props.onHover(false)}
        onFocus={() => props.onHover(true)}
        onBlur={() => props.onHover(false)}
        onPointerDown={props.onPressStart}
        onPointerUp={props.onPressEnd}
        onPointerCancel={props.onPressEnd}
        onPointerLeave={props.onPressEnd}
        onContextMenu={(e) => e.preventDefault()}
        aria-label={`${props.owner === 0 ? 'South' : 'North'} pit ${props.relative + 1}, ${props.count} stones`}
      >
        <Seeds pit={props.abs} count={props.count} capacity={14} />
      </button>
      <span className="pit-count">{props.count}</span>
    </div>
  );
}

function Store({
  player,
  count,
  active,
  landing,
  previewLanding,
  registerRef,
}: {
  player: Player;
  count: number;
  active: boolean;
  landing: boolean;
  previewLanding: boolean;
  registerRef: (el: HTMLElement | null) => void;
}) {
  const abs = player === 0 ? P0_STORE : P1_STORE;
  return (
    <div className={`store ${active ? 'active' : ''}`} aria-label={`store, ${count} stones`}>
      <div
        ref={registerRef}
        className={`store-well ${landing ? 'landing' : ''} ${previewLanding ? 'preview-extra' : ''}`}
      >
        <Seeds pit={abs} count={count} capacity={26} />
      </div>
      <span className="store-count">{count}</span>
    </div>
  );
}

export interface BoardProps {
  view: GameView;
  mode: Mode;
  onPlay: (move: MancalaMove) => void;
}

export function Board({ view, mode, onPlay }: BoardProps) {
  const boardRef = useRef<HTMLDivElement | null>(null);
  const slotRefs = useRef(new Map<number, HTMLElement>());
  const [hover, setHover] = useState<{ seat: Player; preview: Preview } | null>(null);
  // Touch has no hover: holding a pit ~350ms shows its move preview instead
  // of playing it; the release-click is swallowed, the next tap plays.
  const longPressTimer = useRef<number | null>(null);
  const suppressClick = useRef(false);

  const legal =
    view.busy || view.terminal ? [] : mancala.legalMoves({ pits: view.pits, turn: view.turn });
  const canAct = (seat: Player) =>
    !view.busy &&
    !view.terminal &&
    view.turn === seat &&
    (mode.kind === 'local' || seat === HUMAN_SEAT);

  const register = (abs: number) => (el: HTMLElement | null) => {
    if (el) slotRefs.current.set(abs, el);
    else slotRefs.current.delete(abs);
  };

  /** Center of a pit/store in board-local coordinates. */
  const center = (abs: number): { x: number; y: number } | null => {
    const board = boardRef.current;
    const el = slotRefs.current.get(abs);
    if (!board || !el) return null;
    const b = board.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    return { x: r.left - b.left + r.width / 2, y: r.top - b.top + r.height / 2 };
  };

  const setHoverFor = (seat: Player, relative: number) => (on: boolean) => {
    if (!on) {
      setHover((h) => (h && h.preview.move === relative && h.seat === seat ? null : h));
      return;
    }
    if (!canAct(seat) || !legal.includes(relative as MancalaMove)) return;
    const o = applyMoveDetailed({ pits: view.pits, turn: view.turn }, relative as MancalaMove);
    setHover({
      seat,
      preview: {
        move: relative as MancalaMove,
        landing: o.sowPath[o.sowPath.length - 1]!,
        extraTurn: o.extraTurn,
        captured: o.captured,
      },
    });
  };

  // Captured seeds fly home to the raider's store.
  useEffect(() => {
    if (view.captureFlash.length === 0 || view.captureStore == null) return;
    if (reducedMotion()) return;
    const board = boardRef.current;
    const target = center(view.captureStore);
    if (!board || !target) return;
    const spawned: HTMLElement[] = [];
    view.captureFlash.forEach((pitAbs, pi) => {
      const from = center(pitAbs);
      if (!from) return;
      for (let i = 0; i < 3; i++) {
        const el = document.createElement('span');
        el.className = 'fly-seed';
        el.style.background = SEED_COLORS[(i * 7 + pitAbs * 3) % SEED_COLORS.length]!;
        el.style.left = `${from.x}px`;
        el.style.top = `${from.y}px`;
        board.appendChild(el);
        spawned.push(el);
        el.animate(
          [
            { transform: 'translate(-50%, -50%) scale(1)' },
            {
              transform: `translate(${target.x - from.x - 8 + i * 8}px, ${target.y - from.y}px) translate(-50%, -50%) scale(0.7)`,
            },
          ],
          {
            duration: 430,
            delay: 60 + i * 65 + pi * 45,
            easing: 'cubic-bezier(0.45, -0.25, 0.6, 1)',
            fill: 'both',
          },
        ).finished.then(() => el.remove()).catch(() => {});
      }
    });
    return () => spawned.forEach((el) => el.remove());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view.captureFlash, view.captureStore]);

  // Harvest finale: the end-of-game sweep flies each remaining seed home,
  // pit by pit, each landing with a low bong. The slow ceremony is the
  // reward moment — this is what gets screen-recorded.
  useEffect(() => {
    if (!view.sweep || reducedMotion()) return;
    const board = boardRef.current;
    const target = center(view.sweep.store);
    if (!board || !target) return;
    const spawned: HTMLElement[] = [];
    const timers: number[] = [];
    let delay = 350;
    view.sweep.from.forEach(({ pit, count }) => {
      const from = center(pit);
      if (!from) return;
      const seeds = Math.min(count, 4);
      timers.push(window.setTimeout(() => audio.bong(), delay));
      for (let i = 0; i < seeds; i++) {
        const el = document.createElement('span');
        el.className = 'fly-seed';
        el.style.background = SEED_COLORS[(i * 7 + pit * 3) % SEED_COLORS.length]!;
        el.style.left = `${from.x}px`;
        el.style.top = `${from.y}px`;
        board.appendChild(el);
        spawned.push(el);
        el.animate(
          [
            { transform: 'translate(-50%, -50%) scale(1)', opacity: 1 },
            {
              transform: `translate(${target.x - from.x + (i - 1.5) * 7}px, ${target.y - from.y}px) translate(-50%, -50%) scale(0.75)`,
              opacity: 1,
            },
          ],
          { duration: 620, delay: delay + i * 70, easing: 'cubic-bezier(0.45, -0.2, 0.55, 1)', fill: 'both' },
        ).finished.then(() => el.remove()).catch(() => {});
      }
      delay += 260;
    });
    return () => {
      spawned.forEach((el) => el.remove());
      timers.forEach(clearTimeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view.sweep]);

  const activePreview = hover && !view.busy && !view.terminal ? hover.preview : null;

  const renderPit = (seat: Player, relative: number) => {
    const abs = pitIndex(seat, relative);
    const hoveredHere = activePreview?.move === relative && hover?.seat === seat ? activePreview : null;
    return (
      <Pit
        key={abs}
        abs={abs}
        relative={relative}
        owner={seat}
        count={view.pits[abs]!}
        playable={canAct(seat) && legal.includes(relative as MancalaMove)}
        landing={view.landing === abs}
        flashing={view.captureFlash.includes(abs)}
        previewLanding={activePreview?.landing === abs ? activePreview : null}
        hovered={hoveredHere}
        enterDelay={(seat === 1 ? 5 - relative : 6 + relative) * 45}
        onClick={() => {
          if (suppressClick.current) {
            suppressClick.current = false;
            return;
          }
          setHover(null); // touch devices: don't leave the focus-preview stuck
          onPlay(relative as MancalaMove);
        }}
        onHover={setHoverFor(seat, relative)}
        onPressStart={(e) => {
          // A stale flag would swallow this tap (e.g. the finger slid off
          // after a long-press, so no click ever consumed it).
          suppressClick.current = false;
          if (e.pointerType !== 'touch') return;
          longPressTimer.current = window.setTimeout(() => {
            suppressClick.current = true;
            setHoverFor(seat, relative)(true);
          }, 350);
        }}
        onPressEnd={() => {
          if (longPressTimer.current != null) {
            clearTimeout(longPressTimer.current);
            longPressTimer.current = null;
          }
        }}
        registerRef={register(abs)}
      />
    );
  };

  const handPos = view.handAt != null ? center(view.handAt) : null;

  return (
    <div
      className={`board ${view.captureFlash.length > 0 ? 'capturing' : ''}`}
      aria-label="Mancala board"
      ref={boardRef}
    >
      <Store
        player={1}
        count={view.pits[P1_STORE]!}
        active={!view.terminal && view.turn === 1}
        landing={view.landing === P1_STORE}
        previewLanding={activePreview?.landing === P1_STORE}
        registerRef={register(P1_STORE)}
      />
      <div className="rows">
        <div className={`row row-top ${!view.terminal && view.turn === 1 ? 'active-row' : ''}`}>
          {[5, 4, 3, 2, 1, 0].map((r) => renderPit(1, r))}
        </div>
        <div className={`row row-bottom ${!view.terminal && view.turn === 0 ? 'active-row' : ''}`}>
          {[0, 1, 2, 3, 4, 5].map((r) => renderPit(0, r))}
        </div>
      </div>
      <Store
        player={0}
        count={view.pits[P0_STORE]!}
        active={!view.terminal && view.turn === 0}
        landing={view.landing === P0_STORE}
        previewLanding={activePreview?.landing === P0_STORE}
        registerRef={register(P0_STORE)}
      />

      {handPos && (
        <div
          key={view.sowId}
          className="hand"
          style={{
            transform: `translate(${handPos.x}px, ${handPos.y - 8}px)`,
            transitionDuration: `${Math.round(view.stepMs * 0.55)}ms`,
          }}
        >
          <span className="hand-pouch" />
          {view.handSeeds > 0 && <span className="hand-badge">{view.handSeeds}</span>}
        </div>
      )}
    </div>
  );
}

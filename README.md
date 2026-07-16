# Ancient Games

A platform for beautiful, ad-free digital versions of ancient board games.
**No ads. No pay-to-win. Free forever.** Monetized by a tip jar and a one-time
cosmetic supporter unlock.

Game #1 is **Mancala** (Kalah rules). The architecture is a shared engine with
pluggable rules modules, so each new game (Nine Men's Morris is next) is a
small package, not a rewrite.

## Structure

```
packages/
  engine/         Game-agnostic core: rules interface, match/replay from move logs
  game-mancala/   Kalah rules module (sowing, captures, extra turns, end sweep)
  ai/             Alpha-beta minimax, 4 difficulty tiers (easy/medium/hard/expert)
apps/
  web/            React + Vite PWA. AI runs in a Web Worker. Primary surface.
```

## Develop

```sh
npm install
npm run dev        # Vite dev server (apps/web)
npm test           # rules + AI self-play tests
npm run build      # production PWA build
```

## Roadmap (see full plan)

1. ✅ Playable Mancala vs AI + pass-and-play, PWA
2. Online play: Firebase anonymous auth, private rooms (4-letter codes), async turns, Elo ladder
3. Monetization: Ko-fi tip jar + one-time supporter unlock (Stripe on web, IAP in apps); daily puzzle share loop
4. Nine Men's Morris module; Capacitor builds for App Store / Play Store

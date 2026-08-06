# Choresies 🏔👑

Chores-tracking PWA for the flat. Log a chore in seconds, minutes are points,
weekly leaderboard with a golden leader. Nipto, minus everything we never used.

- **Spec:** [SPEC.md](SPEC.md) — every requirement, checkable
- **Deploying:** [DEPLOY.md](DEPLOY.md) — `npm run deploy` (Firebase Hosting)
- **Backend setup (one time):** [FIREBASE-SETUP.md](FIREBASE-SETUP.md)
- **Build verification log:** [VERIFICATION.md](VERIFICATION.md)
- **Design:** "Alpenglow" — from the living-room prints. Tokens in
  [src/styles.css](src/styles.css); original inspiration photos in the repo root.

Stack: Vite + Preact + TypeScript, vite-plugin-pwa (offline + auto-update),
Firebase Firestore (free tier) behind a store interface with an on-device demo
mode. Fonts (Fraunces, Inter) self-hosted. No other runtime dependencies.

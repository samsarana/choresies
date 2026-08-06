# Deploying Choresies

Everything lives in one Firebase project: the flat's data (Firestore) and the
site itself (Firebase Hosting). Deploys are one terminal command.

## One-time setup (~2 minutes)

Already done in this repo: `firebase.json` (hosting config) and the
`firebase-tools` CLI are set up. You just need to connect your account:

```bash
npx firebase login
```

A browser window opens — sign in with the **same Google account** that owns
the Firebase project. That's it; the login is remembered on this machine.

(`.firebaserc`, which pins this folder to your project id, is created when the
Firebase config values go into `src/config.ts`.)

## Deploy (first time and every update)

```bash
npm run deploy
```

That runs the type-checked production build and pushes `dist/` to Firebase
Hosting. The app is live at:

```
https://getchoresies.web.app
```

(a custom site name on the project; the project's default site
`choresies-bbf67.web.app` is intentionally disabled so there's exactly one
URL — phones key their logins and home-screen installs to it.)

## What happens to users when you redeploy

- **Chore data**: lives in Firestore, untouched.
- **Logins**: stored on each phone, keyed to the site URL — nobody re-enters
  anything.
- **The update itself**: the service worker fetches the new version in the
  background; people get it on their next open (occasionally the one after).
  No reinstall, no action.

So: ship early, iterate freely. The only thing that needs care is changing how
existing data is *stored* — that's a code problem (migrations), not a deploy
problem.

## Demo mode vs cloud

- `src/config.ts` has `firebaseConfig = null` → the app runs in **Demo mode**
  (fully working, data stays on the device — fine for trying it out).
- After the one-time [FIREBASE-SETUP.md](FIREBASE-SETUP.md), the config goes
  into `src/config.ts`, then `npm run deploy` → cloud sync for the whole flat.

## Installing on phones (tell the flat)

- **iPhone**: open the site in Safari → Share → **Add to Home Screen**.
- **Android**: open in Chrome → it offers **Install app** (or ⋮ menu → Install).
- There's also a reminder under Board → ⚙ → "Get the app feel".

## Local development

```bash
npm install     # once
npm run dev     # http://localhost:5173
npm test        # unit tests (week/timezone math, search rules)
npm run icons   # regenerate PWA icons from the SVG in scripts/make-icons.mjs
```

## Handy Firebase Hosting extras (optional, later)

- **Custom domain**: Hosting → Add custom domain (free SSL). If you add one,
  also add it under Authentication → Settings → Authorized domains.
- **Roll back a bad deploy**: Hosting → Release history → ⋮ → Rollback.
- **Preview before shipping**: `npx firebase hosting:channel:deploy test`
  gives a temporary preview URL without touching the live site.

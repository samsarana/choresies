# Choresies — Product Spec

Chores-tracking PWA for a shared flat. Inspired by Nipto, stripped to the features the household actually uses. Optimised for: open app → log chore → done, in under 10 seconds.

Source of truth: `instructions.txt` (voice-note transcription) + user's design-review reply (2026-07-07). This file distills them into checkable requirements. Subagent verification passes check the build against THIS file.

All previously-pending items are now decided. ✅ = requirement.

---

## 1. Platform & distribution

- ✅ Progressive Web App: single codebase, installable on iPhone (Safari → Add to Home Screen) and Android (Chrome install prompt).
- ✅ Built as a static site (Vite + Preact + TypeScript), deployed to Firebase Hosting via `npm run deploy` (decision 2026-07-07: user prefers everything in one Firebase project over Netlify drag-drop). No server code to run.
- ✅ Service worker: app shell cached for instant load; app opens offline (viewing works, logging queues and syncs when back online — Firestore handles this natively).
- ✅ Auto-update on redeploy: SW `autoUpdate` registration — new deploys apply silently on next open; device identity and cloud data unaffected.
- ✅ In-app install hint screen for iOS (explains Share → Add to Home Screen) and Android.
- ✅ Demo mode: until Firebase config values are pasted in, the app runs fully on a local on-device store with a visible "Demo mode" badge — lets us test everything and lets Sam play with the build immediately.

## 2. Identity model (no passwords for people)

- ✅ First launch: enter household name → if it exists, prompt for household password to join; if not, offer to create it (sets password, timezone auto-detected, threshold default 75).
- ✅ Inside a household: Netflix-style profile picker. Create your profile (name + avatar) or tap your existing one. No per-person password.
- ✅ Device remembers household + profile indefinitely (localStorage/IndexedDB — persists for installed PWAs on both platforms). Reopening the app lands you signed-in on the Log screen.
- ✅ Switching profile/household possible from settings (rare path, buried is fine).
- ✅ Multiple households supported from day one (data namespaced per household).
- ✅ No password reset flow in v1 (flat can ask whoever created it; documented limitation).
- ✅ Delete your own profile (the one this device is signed in as) from Settings — added post-launch 2026-07-07. Their logs stay stored (history is never destroyed) but leave the charts; rules only allow deleting device-claimed profiles.
- ✅ Avatars: pick an emoji + colour, or upload a photo (client-resized to ~128px, stored inline in the DB — avoids paid file storage).

## 3. Log screen (default screen, the whole point)

- ✅ Opens directly on Log after first-time setup. Search box at top, focused on open where the platform allows (iOS standalone may require one tap — acceptable per spec).
- ✅ Below search: ranked list of frequent chores.
  - Only chores logged **≥ 2 times** ever appear in this default list.
  - Ranked by total log count, descending.
  - Hard cap: **20 entries**.
  - **No frequency counts shown** next to chores (user: "this is just noise"). Counts are stored and used for ranking only.
- ✅ Typing filters live, each keystroke: substring match anywhere in the name (typing "di" matches "unstack **di**shwasher"), not just prefix.
- ✅ Return in the search box = "log what I typed": opens the minutes sheet for the new chore (or for the exactly-matching existing one — no duplicates). Return in the minutes input confirms. Keyboard-only logging end to end (added 2026-07-12).
- ✅ Alias matching: chores carry a small set of aliases seeded from a built-in synonym map (dishwasher: unstack/unload/empty; vacuum/hoover; bins/rubbish/trash; bathroom/toilet/loo; washing/laundry; etc.), so "unlo" finds "Unstack dishwasher". New chores get aliases attached automatically when their name contains a known concept.
- ✅ Near-duplicate nudge: when typing a new chore name that closely matches an existing one, the existing chore is suggested first to keep counts consolidated.
- ✅ Selecting a chore (or "Add '<typed text>' as new chore") → minutes entry: quick chips (5/10/15/20/30/45/60) + free number input, prefilled with that chore's typical minutes when known (rounded mean of past logs, snapped to 5 — deliberately approximate; it's a prefill, not a score). Confirm = logged, then reset to a clean search.
- ✅ **Confetti animation on successful log** (small, fast, tasteful; suppressed under `prefers-reduced-motion`).
- ✅ Minutes are the score. No separate points concept. 1 log = {chore, person, minutes, timestamp}.
- ✅ Undo: your own recent logs are visible (small history on the You tab + toast Undo right after logging); you can delete your own logs, nobody else's. No editing others', no admin roles in v1.

## 4. Leaderboard

- ✅ Screen header says **"Leaderboard"** (not "This week" — the Week selector already implies it).
- ✅ Default view: current week — vertical bar per person (Nipto-style: avatar at the base, minutes embedded in the bar), tallest = most minutes.
- ✅ Tiers, colour-coded per bar:
  - **Below threshold** ("not enough") — red-family.
  - **Enough** — at/above threshold — green-family.
  - **Leader** — most minutes this week — **gold, clearly golden rather than orange** (semantically *beyond* green, not between red and green), gradient/variable colour retained, crown marker retained.
  - Icons/markers accompany colour (colour-blind safe).
- ✅ Threshold: **75 minutes/week default**, editable per household in Settings.
- ✅ Threshold shown as a subtle dashed line on the chart — **no numeric label on the line**.
- ✅ Week = Monday 00:00 → Sunday 23:59:59 in the **household timezone** (captured at household creation). Scores reset visually each Monday; history is never deleted.
- ✅ Navigate to previous weeks (adjacent-week navigation) — clamped to the household's creation week/month; no navigating into the pre-inception void (added 2026-07-12). The You-tab 8-week chart clamps the same way.
- ✅ Household log feed: the Board's week view lists that week's logs (avatar, name, chore, weekday, mins) under the chart — realtime, read-only, follows week navigation (added 2026-07-12).
- ✅ Monthly view and All-time view: simple totals per person.
- ✅ Personal view ("You" tab): your week-by-week and month-by-month minutes, non-competitive framing, plus your recent logs (with delete-own).
- ✅ **New-week celebration**: the first time the app is opened after a week rollover (per device), a small, cute, tasteful animation celebrates last week's leader (name, avatar, crown, minutes). Dismissible, ~a few seconds, static card under `prefers-reduced-motion`, skipped if last week had no logs.
- ✅ History persists indefinitely.
- ✅ Leaderboard updates live (realtime listeners).

## 5. Settings (minimal)

- ✅ Household: threshold minutes, timezone, household name display.
- ✅ Profile: name, avatar, switch profile, leave to household screen.
- ✅ Explicitly OUT of scope (anti-features per spec): recurring/scheduled chores, task assignment, reminders/notifications, penalties, comments, task create/manage screens (chores exist only by being logged), admin roles.

## 6. Data model (Firestore — confirmed)

```
households/{hid}: name, nameLower, salt, tz, thresholdMinutes=75, createdBy, createdAt
households/{hid}/private/auth: passwordHash (salted SHA-256; never client-readable)
households/{hid}/joins/{uid}: proof, at        ← membership = this doc exists; creating it requires proving the password (rules)
households/{hid}/members/{mid}: name, avatar{kind: emoji|photo, value, color}, deviceUids[], createdAt
households/{hid}/tasks/{tid}: name, nameLower, aliases[], logCount, totalMinutes, lastLoggedAt   (typical minutes derived: mean snapped to 5)
households/{hid}/logs/{lid}: taskId, taskName, memberId, memberName, minutes, at, weekKey, monthKey("2026-07")
households/{hid}/stats/allTime: totals{memberId: {minutes, logs}}   (lazily created on first log)
```

- weekKey format is the Monday date of the week, e.g. `"2026-07-06"` — sorts correctly and avoids ISO week-number edge cases.

- Week/month keys computed in household tz at write time → leaderboard = one indexed query per view, summed client-side (flat-scale data).
- Denormalised names on logs so history renders without joins and survives renames.
- Task stats (logCount, typicalMinutes) updated transactionally on log/undo.
- Client identity: Firebase Anonymous Auth uid per device; joining creates `joins/{uid}` (rules verify the password proof against private/auth), and picking a profile records the uid on that member's `deviceUids`. Security rules restrict all household data to joined uids.
- Data layer behind a `Store` interface with two implementations: `FirestoreStore` (production) and `LocalStore` (demo mode + development + tests).
- Threat model is honest-flatmates; this is a chores app, not a bank.

## 7. Design — Alpenglow (chosen)

Derived from the flat's gouache prints: cream paper, dusk periwinkle, gold light on peaks.

- ✅ Tokens: bg `#F6F1E7`, panel `#FFFDF6`, ink `#2E2D38`, muted `#8F8B9E`, periwinkle accent `#5C6491`, tier-low (clay) `#C4634F`, tier-ok (alpine moss) `#4C7A5E`, tier-leader gradient **golden** `#F6CE5B → #E4A72E` (less orange than the v1 mockup, per feedback) with soft gold glow.
- ✅ Type: Fraunces (display; italic wordmark) + Inter (UI, tabular numerals) — self-hosted/bundled so they work offline; system-stack fallbacks.
- ✅ Mobile-first (~390px), thumb-reachable primary actions, works fine on desktop.
- ✅ Three tabs: **Log** (default) · **Board** · **You**. Settings gear in Board header.
- ✅ Warm, artful, calm; soft shadows, rounded panels; no clutter.
- ✅ App icon: ragdoll cat vacuuming, dusty-rose background (`assets/icon-source.png` → `scripts/make-icons.mjs` → 192/512/maskable-512/apple-touch/favicon). Chosen 2026-07-08 over the original alpenglow-peak mark. Full-frame at every size; the source's own padding keeps the subject inside a launcher mask's safe circle, so it doubles as the maskable icon.

## 8. Storage/backend — DECIDED: Firebase Firestore (Spark free plan)

- Free tier ~50k reads/20k writes per day (a flat uses a few hundred), 1 GiB storage, never sleeps, built-in offline persistence + realtime, no card required.
- One-time ~10-minute console setup by Sam, guided by `FIREBASE-SETUP.md`; Sam pastes 6 config values; config keys are safe to embed in the static site (security lives in Firestore rules, shipped in `firestore.rules`).
- Until then the app runs in demo mode (see §1).

## 9. Deployment

- ✅ Firebase Hosting: `npm run deploy` builds and ships `dist/` (SPA rewrites + cache headers in `firebase.json`; PWA manifest/icons/service worker included). Live at `https://getchoresies.web.app` (custom site id; default `-bbf67` site disabled) with free HTTPS (required for PWA).
- ✅ One-time: `npx firebase login` with the project owner's Google account.
- ✅ Redeploys: rerun `npm run deploy` — auto-update per §1, data and logins unaffected.
- ✅ `DEPLOY.md` documents the exact steps; `FIREBASE-SETUP.md` documents the one-time backend setup.

## 10. Verification protocol — DECIDED: after each milestone

- Method per checkpoint:
  1. Independent subagent(s) review the code + behaviour **against this SPEC.md**, section by section, reporting pass/fail/gap per requirement.
  2. Mobile-viewport browser preview click-through of the core flows (first-run, join, log, board, offline reload).
  3. Findings logged to `VERIFICATION.md`; fixes applied before the next milestone.
- Milestones: M1 scaffold+data layer (incl. week/timezone math tests) → M2 onboarding/identity → M3 log flow (search/rank/alias/minutes/undo/confetti) → M4 leaderboard views + celebration → M5 settings+PWA/offline/install/fonts/icons → M6 pre-deploy full-spec sweep (every ✅ line above re-checked) + fresh-eyes UX pass.

## 11. Resolved decisions log

1. Backend: Firebase Firestore ✅ (chosen 2026-07-07)
2. Design direction: **Alpenglow** ✅ with tweaks: no threshold label, no frequency counts on Log, "Leaderboard" header, more-golden leader bar ✅
3. Verification cadence: each milestone ✅
4. Name: **Choresies** ✅ (confirmed)
5. Added features from design review: log confetti ✅, new-week leader celebration ✅

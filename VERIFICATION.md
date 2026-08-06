# Choresies — Verification Log

Protocol per SPEC.md §10: after each milestone, independent subagent(s) review
the build against SPEC.md, findings get fixed before the next milestone, and
the outcome is recorded here.

---

## M1 — Scaffold + data layer (2026-07-07)

**Checks:** 27/27 unit tests pass (week/timezone math incl. DST + year
boundaries, search/alias/frequent-list/near-duplicate rules). Independent
subagent reviewed the data layer + firestore.rules against SPEC §1–§4, §6, §8,
including adversarial timezone probes beyond the shipped tests (all passed) and
a static walk of every Firestore operation against the security rules.

**Verdict:** PASS-WITH-GAPS → all gaps fixed same day:

1. **BLOCKING:** `createHousehold`'s batch seeded `stats/allTime`, but the
   rules gate stats on `joined()`, which reads *pre-batch* state → every cloud
   household creation would have been rejected. Fixed: stats doc is now created
   lazily by the first `logChore` (rules `write` covers `create`).
2. Re-joining from an already-joined device hit the immutable-join-doc rule and
   misreported "wrong password". Fixed: `joinHousehold` short-circuits via
   `hasJoined()` in both stores (device already trusted per §2).
3. Unused import broke `npm run build` (`noUnusedLocals`). Fixed.
4. `taskName` denormalisation diverged between stores (empty string vs stored
   name). Fixed: both stores now require `input.name` and use it.
5. SPEC §6 drift: schema block updated to the shipped design (joins/{uid}
   membership model, Monday-date weekKey, derived typical minutes as snapped
   mean — consciously chosen over median, see §3).
6. Firestore listeners had no error callbacks (silent death on
   permission/network errors). Fixed: all five `onSnapshot` sites log errors.

Hardening from reviewer risk list also applied: `claimMember` uses atomic
`arrayUnion` (offline-safe), `stats` rules no longer permit `delete`,
`updateHousehold` builds a clean patch (no `undefined` field crashes),
`vite.config.ts` uses `vitest/config` types instead of an `as never` cast.

Accepted risks (documented, not fixed — honest-flatmates threat model per §6):
client clock is authoritative for week keys; household names/salts are listable
by any anonymous user; a signed-in flatmate could claim another member profile;
find-then-create household race can duplicate a name.

**Post-fix state:** `tsc --noEmit` clean, 27/27 tests green.

---

## M2–M4 — Onboarding, log flow, leaderboard (2026-07-07)

**Checks:** manual mobile-viewport click-through of every flow (create
household → profile → log new chore → alias search "unlo" → frequent list →
duplicate nudge → undo → board tiers → past weeks → month/all-time → You tab →
threshold live-update → new-week celebration with seeded multi-member data),
plus an independent adversarial subagent review of all UI code against SPEC
§2–§5, §7 (including a11y quickscan, crash-path probing, and a hex-by-hex
token audit).

**Verdict:** PASS-WITH-GAPS (no spec line missing) → all 8 gaps fixed same day:

1. **Board threshold line drew ~9% too high** — the line and the bars measured
   against different CSS boxes (padding vs content box), so a bar at exactly
   the threshold looked "not enough" while coloured "enough". Fixed with a
   shared-reference inner wrapper; alignment re-verified numerically
   (line at y=315.8 vs expected 317.3 incl. border width). Same class of fix
   applied to the You-tab mini chart (labels moved out of the bar geometry).
2. Cloud-mode celebration could crown the wrong flatmate from a stale
   cache-first snapshot. Fixed: new `fetchLogsForWeekOnce` store method,
   server-preferred with cache fallback offline.
3. `rainConfetti` could tear down its canvas on the first frame (~26–50%
   chance depending on refresh rate) because unborn particles didn't count as
   alive. Fixed.
4. Undo wasn't idempotent in cloud mode (double-tap or undo-after-manual-delete
   double-reversed stats). Fixed: one-shot toast guard + existence-checked
   `deleteLog`.
5. Reduced-motion left infinite micro-animations ticking (crown bob, splash
   pulse). Fixed: `animation-iteration-count: 1`.
6. A remotely-deleted profile stranded the device on the splash screen
   forever. Fixed: bounce to the profile picker once members have loaded.
7. Month leaderboard was a one-shot fetch, not live (SPEC §4 says realtime).
   Fixed: `subscribeLogsForMonth` in both stores.
8. Re-selecting the same avatar photo did nothing; corrupt images failed
   silently. Fixed: input reset + inline error message.

Also hardened from the risk list: unsearchable chore names (normalise to
empty, e.g. "???") can no longer be created; celebration guard uses `<` so a
backwards clock jump can't fire it; month/all-time gold highlight now covers
ties like the weekly view does.

Accepted risks (documented): denormalised `memberName` on celebrations shows a
pre-rename name; dialogs have no focus trap; list keyboard navigation is
pointer-first; names in non-Latin scripts normalise poorly (not this
household's use case).

**Post-fix state:** `tsc --noEmit` clean, 27/27 tests green, threshold
geometry re-verified in-browser.

---

## M5 — Settings, PWA, offline, fonts, icons (2026-07-07)

**Checks:** production build inspected; service worker registration, manifest
(name/display/theme/3 icon entries), and full precache contents verified in a
running built app (index, all JS/CSS, 3 self-hosted font files, 5 icons);
`document.fonts.load` confirmed Fraunces actually renders; icons generated
from an Alpenglow SVG (crowned peak) at 192/512/maskable-512/apple-touch/
favicon sizes; install hints (iOS instructions, Android
`beforeinstallprompt` button) added to Settings.

Covered in full by the M6 sweep below rather than a separate subagent round.

---

## M6 — Final pre-deploy sweep (2026-07-07)

**Checks:** independent subagent re-verified **every ✅ requirement in
SPEC.md §1–§10** (46 lines) against the final tree with file:line evidence,
including: a scripted two-way CSS↔JSX class audit, a walk of all 6
FIREBASE-SETUP.md steps and DEPLOY.md against the actual code, font-coverage
inspection of the shipped woff2 subsets, icon dimension checks against the
manifest, a fresh copy pass over all user-facing strings, and a final
rules-vs-client-operations table (every Firestore call allowed for joined
members, denied otherwise; wrong-password join denied; others' log deletion
denied).

**Verdict: SHIP.** Zero gaps. Eight polish nits reported; all fixed same day
(stray glyph in iOS install hint, `replaceAll` for multi-underscore
timezones, dead CSS rule, duplicate precache entries, missing `.catch` on the
celebration fetch, softened leave-household copy, SPEC §6 prose drift). One
accepted-by-design quirk documented: when logging offline, the entry appears
in lists immediately but confetti + the Undo toast wait for reconnect
(`batch.commit()` resolves on server ack).

**Final state:** `tsc --noEmit` clean · 27/27 tests · `npm run build` green ·
precache 19 entries (~849 KiB) · dist/ ready for Netlify drag-and-drop.

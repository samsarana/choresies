# Firebase setup — one time, ~10 minutes, free, no card

Choresies stores the flat's shared data in Google's Firebase Firestore (free
"Spark" plan — never sleeps, more than enough quota for a hundred flats). You
create the project so you own the data; then paste six config values back to
Claude (or into `src/config.ts` yourself) and the app switches from Demo mode
to cloud sync.

## 1. Create the project

1. Go to https://console.firebase.google.com and sign in with any Google account.
2. Click **Create a project** (it may say "Add project").
3. Name it `choresies` (anything works). You can decline Google Analytics —
   not needed. Create, wait a moment, **Continue**.

## 2. Turn on Anonymous sign-in

Each phone gets an anonymous identity so the security rules can tell devices apart.

1. Left sidebar → **Build → Authentication** → **Get started**.
2. **Sign-in method** tab → **Anonymous** → toggle **Enable** → **Save**.

## 3. Create the Firestore database

1. Left sidebar → **Build → Firestore Database** → **Create database**.
2. Choose a location near you (e.g. `australia-southeast1` for NZ/AU — this
   can't be changed later; any nearby region is fine).
3. Start in **production mode** (we replace the rules next). **Create**.

## 4. Paste the security rules

1. In Firestore, open the **Rules** tab.
2. Delete everything in the editor and paste the full contents of
   [`firestore.rules`](firestore.rules) from this folder.
3. Click **Publish**.

These rules are what make the household password real: joining requires
proving the password, the stored hash is never readable, and you can only
delete your own logs.

## 5. Register the web app

1. Project overview (⚙ gear → **Project settings** if you get lost) → under
   **Your apps**, click the **`</>`** (Web) icon.
2. Nickname: `choresies-web`. The **"Also set up Firebase Hosting"** checkbox
   doesn't matter either way — the project already contains the hosting config
   (`firebase.json`) and deploys with `npm run deploy` (see DEPLOY.md). If you
   tick it, skip the CLI snippets the console shows; ours are already set up.
3. Click **Register app**.

## 6. Copy the config

You'll now see a code block containing `firebaseConfig = { ... }`. Copy these
six values (also findable later in Project settings → Your apps):

```
apiKey, authDomain, projectId, storageBucket, messagingSenderId, appId
```

Paste them to Claude in chat, or directly into `src/config.ts` replacing
`null`:

```ts
export const firebaseConfig: FirebaseConfig | null = {
  apiKey: '…',
  authDomain: '…',
  projectId: '…',
  storageBucket: '…',
  messagingSenderId: '…',
  appId: '…',
}
```

These values are **safe to publish** — they identify the project, they don't
grant access. Access control lives in the rules you pasted in step 4.

Then run `npx firebase login` once (sign in with this same Google account) and
`npm run deploy` per DEPLOY.md. The site goes live at
`https://<project-id>.web.app`, the demo badge disappears, and every phone
sees the same leaderboard.

## Troubleshooting: sign-in errors on the deployed site

Unlikely with Firebase Hosting (its `web.app` / `firebaseapp.com` domains are
pre-authorized), but if you later add a custom domain and sign-in errors:
**Authentication → Settings → Authorized domains → Add domain**. Takes 30
seconds.

## Free-tier reality check

Spark limits: 50,000 reads + 20,000 writes per **day**, 1 GiB storage. A flat
of five logging ten chores a day uses well under 1% of that. There is no
auto-upgrade to paid — if you somehow hit a limit, the app just errors until
midnight (US Pacific) rather than charging anyone.

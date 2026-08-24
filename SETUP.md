# Setup — remaining credentials and console steps

The client-side Firebase config is already wired into `.env.local`. Six things still need to come from you before Phase 0 can finish. Each takes a minute or two.

**Project:** `weighttracker-76f46` · **Repo:** `Thecityismine/WeightTracker` · **Live:** https://weight-tracker-beta-umber.vercel.app/

---

## 1. Enable Firestore

Console → **Build → Firestore Database → Create database**

- Start in **production mode** (the repo's rules replace the defaults in step 7)
- Location: `nam5 (us-central)` unless you have a reason otherwise — it cannot be changed later

## 2. ~~Enable Storage~~ ✅ done

## 3. Turn on Email/Password auth and create your account

Console → **Build → Authentication → Get started**

1. **Sign-in method** tab → enable **Email/Password**. Leave "Email link (passwordless)" off.
2. **Settings** tab → **User actions** → **uncheck "Enable create (sign-up)"**. This is the step that keeps the internet out — without it, the provider accepts new registrations from anyone who finds the app.
3. **Users** tab → **Add user** → your email and a password. This is your login.
4. Copy the **User UID** from the users table.

→ Paste that UID into `ALLOWED_UID` in `.env.local`.

## 4. Generate a service-account key

Console → **⚙ Project settings → Service accounts → Generate new private key**

Downloads a JSON file. From it:

- `client_email` → `FIREBASE_CLIENT_EMAIL`
- `private_key` → `FIREBASE_PRIVATE_KEY` (keep the surrounding double quotes and the literal `\n` sequences intact)

**Do not save that JSON into this folder.** `.gitignore` covers the common names, but the safest move is to copy the two values out and delete the download.

## 5. Claude API key

https://console.anthropic.com/settings/keys → create a key → `ANTHROPIC_API_KEY`

Used for label scanning, natural-language food lookup, and the weekly coaching summary. Not needed until Phase 9 — the app builds and runs without it.

## 6. USDA FoodData Central key

https://fdc.nal.usda.gov/api-key-signup — free, arrives by email in seconds → `USDA_API_KEY`

Not needed until Phase 8.

## 7. Deploy the security rules

`firestore.rules` and `storage.rules` are written and committed, but both carry a placeholder where your UID goes. Until it's replaced, **the rules deny everything** — which is the safe failure direction, but nothing will work.

1. Open `firestore.rules` and `storage.rules`
2. Replace `PASTE_YOUR_FIREBASE_AUTH_UID_HERE` in both with the UID from step 3
3. Deploy:

```bash
firebase login
firebase use weighttracker-76f46
firebase deploy --only firestore:rules,firestore:indexes,storage
```

Verify in the console that the Rules tab shows your UID and not the placeholder.

---

## Running it locally right now

```bash
npm run dev        # http://localhost:3000
```

The login screen renders and the theme is live. Signing in will fail until steps 1–3 are done — there is no account to sign into yet.

---

## Vercel

The project already exists and the CLI is authenticated as `thecityismine`. Once `.env.local` is complete:

```bash
vercel link                      # connect this folder to the existing project
vercel env pull                  # or push each var:
vercel env add ALLOWED_UID production
```

Every variable in `.env.local` needs to exist in Vercel too — Preview and Production both.

---

## What is and is not secret

| Value | Secret? |
| --- | --- |
| `NEXT_PUBLIC_FIREBASE_*` | **No.** These ship in the browser bundle on every Firebase app. Security comes from the Firestore rules, not from hiding these |
| `FIREBASE_PRIVATE_KEY`, `FIREBASE_CLIENT_EMAIL` | **Yes.** Full admin access to the project, bypasses all security rules |
| `ANTHROPIC_API_KEY`, `USDA_API_KEY` | **Yes.** Billable |
| `ALLOWED_UID` | Not sensitive, but keep it server-side anyway |

`weighttracker_keys.txt` and `.env*` are gitignored and verified excluded.

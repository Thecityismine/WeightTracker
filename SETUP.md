# Setup — remaining credentials and console steps

The client-side Firebase config is already wired into `.env.local`. Firestore, Storage, the auth account, and the security rules are all live. What remains is the service-account key, two API keys, and one console toggle.

**Project:** `weighttracker-76f46` · **Repo:** `Thecityismine/WeightTracker` · **Live:** https://weight-tracker-georges-projects-b78bafb0.vercel.app/

---

## 1. ~~Enable Firestore~~ ✅ done

## 2. ~~Enable Storage~~ ✅ done

## 3. Auth account ✅ created — one step left

Your account exists (`georgemedina7@aol.com`, password set) and its UID is already
wired into the rules, `.env.local`, and Vercel.

**Still to do:** Console → **Authentication → Settings → User actions** →
**uncheck "Enable create (sign-up)"**.

Without it the Email/Password provider accepts new registrations from anyone who
finds the app. The rules deny those accounts every byte of data, so this is the
second layer rather than the only one — but leaving open signup on a public URL
is still an invitation worth declining.

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

## 7. ~~Deploy the security rules~~ ✅ done

Rules and indexes are live on `weighttracker-76f46`, pinned to your UID.
Verified: anonymous reads of `foods`, `foodLogs`, `weightLogs` and `dailyTotals`
all return `403 PERMISSION_DENIED`.

Redeploy after any rules change:

```bash
npx firebase deploy --only firestore:rules,firestore:indexes,storage
```

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

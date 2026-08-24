# Muscle Gain Food Tracker — Build Roadmap

**Goal:** a fast, mobile-first personal food tracker built to answer four questions instantly:

1. How much have I eaten today?
2. Have I hit my calorie and protein targets?
3. Am I consistently eating enough each week?
4. Is my body weight actually increasing?

**Mission:** 144 lb → 149 lb at 0.25–0.5 lb/week. A controlled surplus is the objective, not a failure state.

---

## Decisions (locked)

| Area | Choice |
| --- | --- |
| Framework | Next.js 16 (App Router) + React 19 + TypeScript |
| Styling | Tailwind CSS v4 (CSS-first `@theme`), hand-built primitives, dark theme per [DESIGN.md](DESIGN.md) |
| Database | Firebase Firestore |
| File storage | Firebase Storage (nutrition-label photos) |
| Hosting | Vercel |
| Auth | **Firebase Auth, email + password.** One account — yours. Login screen, no signup flow |
| AI | Claude (Anthropic) — `claude-opus-5` for label vision + coaching, `claude-sonnet-5` for routine lookups |
| Nutrition source | USDA FoodData Central API (server-side only) |
| Charts | Recharts |
| Units | Weight in **pounds**, food weights in **grams** |

### Auth architecture

One real account, locked down four ways:

1. **Email + password only.** No Google, no signup screen, no password-reset self-service. The account is created once by hand in the Firebase console.
2. **Firestore rules pin the UID.** `allow read, write: if request.auth.uid == "<YOUR_UID>";` — even if someone somehow creates a second Firebase account, it can read and write nothing.
3. **Disable public sign-up** in the Firebase console (Authentication → Settings → *User actions* → uncheck "Enable create"). Otherwise the email/password provider will happily accept new registrations.
4. **Server routes verify the ID token.** Every `/api/*` route calls `verifyIdToken` and checks the UID against `ALLOWED_UID` before spending a Claude or USDA call.

Data reads and writes go through the **Firebase client SDK** with those rules enforcing ownership — that buys offline persistence and real-time updates for free on mobile. Server routes exist only where a secret key is involved (Claude, USDA) or where a write must be trusted.

**Session:** persistence set to `browserLocalPersistence`, so logging in once on your phone keeps you logged in indefinitely. The login screen should be the rare exception, not a daily toll.

### Design system

[DESIGN.md](DESIGN.md) is the source of truth for every visual decision — colors, typography, spacing, component anatomy, motion. Build against the tokens, never hardcode a hex value in a component. Two rules that are easy to break and worth repeating:

- **Blue is for active states, primary actions, progress, and important numbers.** Nothing else. Blue on everything kills its impact.
- **Green means a target was reached.** It is never decoration.

---

## Non-negotiable rules

These exist because they are exactly what broke the Notion tracker.

### 1. One base serving is the single source of truth

Every food stores nutrition for **exactly one base serving**. Totals are always computed, never typed.

```text
totalCalories = caloriesPerServing × quantity
totalProtein  = proteinPerServing  × quantity
totalFat      = fatPerServing      × quantity
```

For gram-based entry:

```text
servingsConsumed = gramsConsumed ÷ servingWeightGrams
totalCalories    = servingsConsumed × caloriesPerServing
```

There is **one** function that does this math, in `lib/nutrition.ts`. No component computes macros inline. Ever.

### 2. Log entries store snapshots

A `foodLog` copies the food's macros at the moment of logging. Editing a food later must never rewrite history.

### 3. Never label a reached calorie target as "over"

Above target reads as **"On target"** or **"Surplus"** — green, not red. Only fat carries a soft upper bound.

### 4. AI never silently guesses a serving size

Every AI-derived food carries a verification status and, if estimated, a visible warning until the user confirms it.

---

## Data model (Firestore)

Top-level collections. Every document carries `userId` — the Firebase Auth UID — which the security rules match against `request.auth.uid`. That is both the ownership check and the multi-user path if this ever opens up.

```
profile/{userId}
  name, startingWeight, goalWeight, startingDate, targetDate?, height, birthDate,
  sex?, activityLevel, workoutDays, weightUnit,
  dailyCalorieTarget, dailyProteinTarget, dailyFatTarget,
  createdAt, updatedAt

foods/{foodId}
  userId, name, brand, category,
  servingDescription, servingAmount, servingUnit, servingWeightGrams,
  caloriesPerServing, proteinPerServing, fatPerServing, carbsPerServing, fiberPerServing,
  dataSource, externalFoodId, verificationStatus, confidenceScore, labelImageUrl,
  isFavorite, isActive, useCount, lastUsedAt, createdAt, updatedAt

foodLogs/{logId}
  userId, foodId, logDate (YYYY-MM-DD), mealCategory, quantity,
  servingDescriptionSnapshot, caloriesSnapshot, proteinSnapshot,
  fatSnapshot, carbsSnapshot, fiberSnapshot, createdAt, updatedAt

dailyTotals/{YYYY-MM-DD}          <- derived, rewritten on every log change
  userId, date, calories, protein, fat, carbs, fiber, entryCount, status

weightLogs/{YYYY-MM-DD}           <- one entry per day, date is the doc id
  userId, date, weight, waistMeasurement?, note?, createdAt

mealTemplates/{templateId}
  userId, name, defaultMealCategory, createdAt
  items/{itemId}: foodId, quantity, order

aiFoodSearches/{searchId}
  userId, searchQuery, imageUrl, suggestedResult, dataSource,
  confidenceScore, approved, createdAt
```

**Verification statuses:** `label_verified` · `usda_verified` · `user_entered` · `ai_estimated`

**Meal categories (fixed order):** `breakfast` · `lunch` · `snack` · `shake` · `dinner`

**`dailyTotals` is a cache.** It must be rebuildable from `foodLogs` alone — Phase 5 ships the rebuild script. The calendar and weekly views read it so they never fan out into hundreds of log reads.

---

## Starting targets

| Metric | Value |
| --- | --- |
| Starting weight | 144 lb |
| Goal weight | 149 lb |
| Daily calories | 2,800 |
| Daily protein | 130 g |
| Daily fat | 80 g |
| Expected gain | 0.25–0.5 lb/week |

All editable in Settings. Carbs and fiber are stored from day one but stay off the main dashboard.

**Calendar status colors:** `<90%` red · `90–99%` yellow · `100–115%` green · `>115%` orange · no data gray

---

# Phases

Each phase ends deployable. Ship it, use it for a day, then start the next one.

---

## Phase 0 — Foundation, auth, and deploy pipeline

**Goal:** a locked, correctly themed empty app live on Vercel, talking to Firestore.

### Scaffold

- [x] `create-next-app` — Next 16.3.2, React 19.2, TypeScript, Tailwind **v4**, App Router, `src/`
- [x] Install: `firebase`, `firebase-admin`, `@anthropic-ai/sdk`, `recharts`, `date-fns`, `zod`, `lucide-react`, `clsx`, `tailwind-merge`
- [x] ~~shadcn/ui~~ — **skipped deliberately.** Its defaults fight this theme; every primitive would need overriding anyway. Primitives are hand-built against the tokens instead. Revisit only if a genuinely complex component (combobox, date picker) shows up
- [x] `.env.local` + `.env.example`; `.gitignore` covering `.env*`, `*serviceAccount*.json`, `*_keys*`
- [x] `turbopack.root` pinned in `next.config.ts` (a stray lockfile in the home dir was hijacking the workspace root)

### Firebase and auth

- [x] Firebase project `weighttracker-76f46` created; **Storage enabled**
- [ ] **Enable Firestore** — Console → Firestore Database → Create database *(you)*
- [ ] Enable the **Email/Password** provider; **disable public sign-up** *(you)*
- [ ] Create the single account by hand; copy the UID *(you)*
- [x] `firestore.rules` — every collection pinned to `ownerUid()`, catch-all deny at the bottom
- [x] `storage.rules` — same UID pin, images only, 10 MB ceiling
- [x] `firestore.indexes.json` — composite indexes for the log, food and weight queries
- [ ] Paste the UID into both rules files, then `firebase deploy --only firestore:rules,firestore:indexes,storage`
- [x] `lib/firebase.ts` — client SDK, `browserLocalPersistence`, persistent offline cache
- [x] `lib/firebase-admin.ts` — singleton Admin SDK that survives hot reload, clear error when unconfigured
- [x] `lib/auth-context.tsx` — `AuthProvider` + `useAuth()`, exposes `getToken()` for API calls
- [x] Login screen — email, password, single vague error, no signup link, no social buttons
- [x] `AuthGate` — restoring / signed-out / signed-in; never flashes login on refresh
- [x] Sign out lives in Settings, nowhere else
- [x] `lib/api-auth.ts` — `requireOwner()` verifies the ID token against `ALLOWED_UID`, **fails closed** if the var is unset

### Design foundation

- [x] Tokens in `globals.css` under `:root`, exposed to Tailwind v4 via `@theme inline` (v4 is CSS-first — there is no `tailwind.config.ts`)
- [x] Utility classes: `.card`, `.progress-*`, `.btn-*`, `.input`, `.metric`, `.label-metric`, `.pressable`
- [x] Geist Sans + Geist Mono via `next/font`; `tabular-nums` on every metric
- [x] Body background: blue radial glow over `#050608`, fixed attachment
- [x] `<Card>`, `<SectionLabel>`, `<PageHeader>` primitives
- [x] Bottom nav: Today · Calendar · **+** · Progress · Settings, elevated 52px blue center button, blue indicator line on the active item
- [x] Viewport meta, `viewportFit: cover`, safe-area insets, `overscroll-behavior: none`, no pinch-zoom
- [x] `prefers-reduced-motion` respected

### Ship

- [x] Committed and pushed to GitHub
- [x] Vercel project linked; GitHub auto-deploy confirmed working
- [x] Firebase config set in Vercel for production, preview and development
- [x] Production deploy **Ready**
- [ ] Service-account vars (`FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`, `ALLOWED_UID`) — add to Vercel once the account exists
- [ ] Resolve site access: Deployment Protection is on, and the `weight-tracker-beta-umber` alias 404s

**Deploy pipeline:** push to `main` → Vercel builds and promotes to production automatically. Every completed phase gets pushed.

> **Lesson from the first failed deploy:** Next prerenders client components on the server during `next build`, so anything at module scope runs there too. Firebase now initializes lazily on first access. Before pushing anything that touches SDK setup, build once with `.env.local` renamed — that reproduces Vercel's environment exactly.

### Verified

- [x] `npm run build` — clean, 6 static routes, no warnings
- [x] `npx tsc --noEmit` — clean
- [x] `npm run lint` — clean
- [x] Dev server boots, `/` returns 200, no console errors
- [ ] Login actually authenticates *(blocked until the account exists)*

**Env vars**

```
# client (safe to expose — rules do the enforcing)
NEXT_PUBLIC_FIREBASE_API_KEY
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
NEXT_PUBLIC_FIREBASE_PROJECT_ID
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
NEXT_PUBLIC_FIREBASE_APP_ID

# server only
FIREBASE_PROJECT_ID
FIREBASE_CLIENT_EMAIL
FIREBASE_PRIVATE_KEY
FIREBASE_STORAGE_BUCKET
ALLOWED_UID
ANTHROPIC_API_KEY
USDA_API_KEY
```

**Done when:** the live Vercel URL shows the login screen, your credentials get in, a refresh keeps you in, the bottom nav moves between five themed pages, and an unauthenticated `curl` against a test Firestore read is rejected by the rules.

---

## Phase 1 — Domain layer and the calculation engine

**Goal:** the math is correct, and provably so, before any UI depends on it.

- [ ] `types/index.ts` — `Food`, `FoodLog`, `WeightLog`, `Profile`, `MealTemplate`, `DailyTotals`, enums
- [ ] `lib/nutrition.ts` — the only place macros are ever computed:
  - `computeLogMacros(food, quantity)` → calories, protein, fat, carbs, fiber
  - `gramsToServings(grams, servingWeightGrams)`
  - `sumMacros(logs[])`
  - `remaining(totals, targets)`
  - `dayStatus(calories, target)` → below | near | ontarget | surplus | none
- [ ] Zod schemas on every write path — reject a food with no serving size or negative macros
- [ ] Unit tests on `lib/nutrition.ts` (Vitest), including the egg case: 72 × 2 = 144
- [ ] Rounding policy: calories to whole numbers, macros to one decimal, **round only at display time**
- [ ] `lib/repo/*.ts` — server-only data access per collection; every write recomputes `dailyTotals`
- [ ] Seed script: 30–50 regularly eaten foods (eggs, banana, oatmeal, almond milk, pork chop, quinoa, Ratio yogurt, ISO protein, Cheerios, trail mix, whole milk, honey, rolled oats…) entered from real labels and marked `label_verified`

**Done when:** `npm test` passes and the seed script populates Firestore with foods whose serving math checks out against their labels.

---

## Phase 2 — Today screen (the core loop)

**Goal:** log a full day of food on a phone in under two minutes. This is the app.

- [ ] Header: greeting, date, current weight, day count — weight secondary, calories dominant
- [ ] **One** full-width calorie card: 40–48px number, muted target beneath, blue gradient bar with the glow at the leading edge only, percentage, remaining
- [ ] Bar transitions blue → green when the target is reached. Never the word "over"
- [ ] Two half-width macro cards below: protein (violet bar), fat (gold bar), each showing `used / target` and remaining
- [ ] Surplus/deficit estimate against target, plus whether on track to gain
- [ ] Five meal sections as light list groups, not heavy containers: muted uppercase title, total aligned right, hairline divider
- [ ] Collapsed state: `LUNCH   901 kcal • 56g protein ›`
- [ ] Empty dinner state picks up an amber accent if the target is unmet by evening
- [ ] Food row: name white, portion muted below it, calories and protein right-aligned; tap to change quantity
- [ ] Swipe left to edit or delete, with undo
- [ ] **Add Food** full-height bottom sheet, four tabs — Recent · Favorites · My Foods · AI Search (last stubbed) — active tab is blue text with a thin underline, no pill
- [ ] Recent sorted by frequency and recency; Favorites from `isFavorite`
- [ ] Quantity sheet: `− 2 +` controls at minimum 44 × 44px, live total, full-width blue gradient "Add to Breakfast"
- [ ] Date switcher — log yesterday without leaving the screen
- [ ] Optimistic UI: a logged food appears instantly and reconciles after the write
- [ ] Motion: 100ms press, 300ms progress, 250ms sheet, checkmark + haptic on add

**Done when:** a full day of eating is logged on a phone without touching a keyboard, a repeat food takes **three taps or fewer**, and the counters match a hand calculation exactly.

---

## Phase 3 — Foods database

**Goal:** own the ~40 foods actually eaten.

> **Navigation note:** the design's bottom nav is Today · Calendar · **+** · Progress · Settings — the center button opens quick food selection, so Foods has no nav slot of its own. Reach the foods database from **Settings → Nutrition database → Manage foods** and from the **My Foods** tab of the Add Food sheet. Route stays `/foods`.

- [ ] Foods list: search, filter by category, favorites toggle, sort by most-used
- [ ] Source dots on every row — green label-verified, blue USDA, gray user-entered, amber AI-estimated
- [ ] Manual create/edit form covering every field in the schema
- [ ] Verification badges — Label Verified · USDA Verified · User Entered · AI Estimated
- [ ] AI Estimated badge shows: *"Estimated nutrition. Confirm the serving size or replace it with label data when available."*
- [ ] Label-photo upload to Firebase Storage, thumbnail on the food detail
- [ ] Archive instead of delete when a food already has logs (protects history)
- [ ] Duplicate-a-food action for label variants
- [ ] Live "1 serving = X cal / Y g protein" preview while filling the form

**Done when:** a new food can be added from a package label in under a minute and used immediately from the Today screen.

---

## Phase 4 — Weight tracking and Settings

**Goal:** know whether any of this is working.

- [ ] Settings: starting weight, goal weight, start date, target date, height, birth date, sex, activity level, workout days, weight unit
- [ ] Editable daily targets (calories, protein, fat), defaulting to 2,800 / 130 / 80
- [ ] Weight entry — one per day; the doc id is the date, so re-entry overwrites cleanly
- [ ] Optional note and waist measurement
- [ ] Morning weigh-in guidance on the entry screen
- [ ] Weight prompt on the Today header when today's weight is missing
- [ ] Seven-day rolling average computed and stored alongside each entry

**Done when:** weight can be entered in two taps and the seven-day average appears on the Today header.

---

## Phase 5 — Calendar

**Goal:** see consistency at a glance.

- [ ] Month grid on black; each cell shows the day, calories, `132P`, and a **status dot or thin bottom line** — never a filled bright cell
- [ ] Selected date: translucent blue fill, blue border, soft outer glow
- [ ] Previous / next month, jump to today
- [ ] Tap a date to open that day's full log
- [ ] Weekly summary row beside or beneath each week
- [ ] **Copy entire day to today**
- [ ] `scripts/rebuild-daily-totals.ts` — recompute all `dailyTotals` from `foodLogs`
- [ ] Framing copy: one low day is not a failure; the weekly average is what matters

**Done when:** a month of logging is legible in one screen and any past day can be copied forward in one tap.

---

## Phase 6 — Progress and weekly summary

**Goal:** the trend, not the noise.

- [ ] Progress header: starting weight, current seven-day average (the largest number on the page), goal weight, pounds gained, pounds remaining, percent to goal, estimated goal date
- [ ] Weight progress line: starting left, goal right, glowing blue position marker that turns green at goal
- [ ] Chart 1 — daily weight (muted gray) with the seven-day average (electric blue) overlaid
- [ ] Chart 2 — daily calories against a thin horizontal target line
- [ ] Chart 3 — daily protein in violet against its target line
- [ ] Chart 4 — weekly calorie intake versus weekly weight change
- [ ] Chart surfaces carry faint horizontal grid lines only — no grid boxes, no vertical rules
- [ ] Weekly summary table: average calories, protein, and fat; calorie-target days (5 of 7); protein-target days; starting, ending, and average weekly weight; weekly change
- [ ] Plain-language interpretation generated from those numbers
- [ ] Stall detection: no weight change across two full weeks → suggest +150 cal/day
- [ ] **The app suggests; the user approves.** Targets never change on their own

**Done when:** the weekly summary reads like a coach's note, and applying a suggested adjustment requires an explicit tap.

---

## Phase 7 — Meal templates and copying

**Goal:** cut logging time to near zero for repeat meals.

- [ ] Create a template from scratch or from an already-logged meal ("Save as meal")
- [ ] Template detail: ingredients with quantities and computed total macros
- [ ] Apply a template → adds every item to its meal category, quantities still editable afterward
- [ ] **Copy meal from yesterday** button on each meal section
- [ ] Starter templates: Regular breakfast, Workday lunch, Regular shake, Apple and trail mix, Weekend breakfast
- [ ] Regular shake seeded as ISO protein 1 scoop, Ratio yogurt ½, rolled oats ½ cup, banana 1, whole milk 1 cup, honey 1 tbsp

**Done when:** a normal breakfast is logged in one tap.

---

## Phase 8 — USDA food lookup

**Goal:** foods that are not in the personal database yet.

- [ ] `app/api/usda/search/route.ts` — server-side; the key never reaches the client
- [ ] `app/api/usda/food/[fdcId]/route.ts` — full detail with serving options
- [ ] Map USDA `foodNutrients` onto the app's per-serving fields (per-100 g conversion handled here)
- [ ] Serving picker when USDA offers several household measures
- [ ] Result cards: name, brand, serving, calories, protein, fat, source
- [ ] Save into My Foods as `usda_verified`, retaining `externalFoodId`
- [ ] Cache searches to stay well inside the rate limit

**Done when:** an unfamiliar packaged food can be found, saved, and logged without leaving the Add Food sheet.

---

## Phase 9 — Claude AI assistant

**Goal:** AI as a search and data-entry assistant, never the authoritative nutrition source.

**Source priority, enforced in code:** label photo → branded USDA → generic USDA → AI estimate

- [ ] Floating circular assistant button, bottom right — black center, thin animated blue border, sparkle icon, no mascot
- [ ] Result card: name, serving, macros, source, confidence, `[ Edit serving ] [ Save food ]`
- [ ] Estimated results carry the amber strip: *"Nutrition may vary by preparation. Confirm the serving before saving."*
- [ ] `app/api/ai/label-scan` — photo in, structured macros out (Claude vision + tool-use JSON schema)
- [ ] `app/api/ai/lookup` — natural language in ("medium grilled pork chop, about 5 oz cooked"), candidate food, serving, and confidence out
- [ ] Mandatory review screen before anything saves, with every field editable
- [ ] Confidence score stored and surfaced; low confidence blocks a silent save
- [ ] Log every request to `aiFoodSearches` along with its approval state
- [ ] `app/api/ai/coach` — weekly summary interpretation, and "why was my intake low this week"
- [ ] Assistant commands: add a food, macros for X, scan this label, copy yesterday's breakfast, protein still needed today, "which food gets me another 400 calories without exceeding 25 g fat"
- [ ] Never invent a serving size — if it is unclear, the model asks

**Done when:** photographing a nutrition label produces a correct, reviewable food entry, and the weekly coach note is accurate against the raw numbers.

---

## Phase 10 — Polish

- [ ] PWA manifest and icons — installs to the home screen, opens on Today, black splash
- [ ] Offline read of today's log; queue writes made while offline
- [ ] Loading skeletons, empty states, error toasts — all on theme
- [ ] Haptics on log and delete; weight-milestone blue-to-green animation
- [ ] Design audit against [DESIGN.md](DESIGN.md): no stray hex values, blue confined to active states and key numbers, green only on reached targets, nothing pulsing
- [ ] Data export to JSON/CSV
- [ ] Lighthouse mobile pass; target a sub-second Today screen load

---

## V2 backlog (explicitly not now)

Barcode scanning · Apple Health · smart scale · workout tracking · recipe builder · progress photos · micronutrients · grocery lists · multiple users · restaurant menus · recurring weekday meals

---

## Working agreement

- One phase per branch, merged when its **Done when** is satisfied.
- Every phase ends deployed to Vercel and used for at least one real day before the next begins.
- Nutrition math changes require a test.
- Colors, spacing, and type come from the tokens in [DESIGN.md](DESIGN.md). A hardcoded hex in a component is a bug.
- If a phase drags, ship the useful half and move the remainder to the backlog.

**The best V1 is not a MyFitnessPal replacement.** It is a fast personal tracker holding the 30–50 foods actually eaten, with AI available when something unfamiliar shows up.

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
| AI | Claude (Anthropic) — `claude-opus-5` throughout, including routine lookups |
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

**Secondary label values** (added 2026-08-24): `sugarPerServing`, `saturatedFatPerServing` in **grams**; `cholesterolMgPerServing`, `sodiumMgPerServing` in **milligrams**, matching how a label prints them.

These are **nullable**, unlike the five core macros. Null means *not known*, which is a different claim from zero — a food with no sodium on its label must not report 0 mg, or a day of unlabelled foods would total up looking authoritative and be wrong. They scale by quantity and snapshot into logs like everything else, but are deliberately **not** aggregated into `dailyTotals` yet: that is a dashboard decision, and the data is now being captured so it can be turned on without a backfill.

Validation mirrors the fiber rule: sugar cannot exceed total carbohydrate, saturated fat cannot exceed total fat.

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

- [x] `types/index.ts` — `Food`, `FoodLog`, `WeightLog`, `Profile`, `MealTemplate`, `DailyTotals`, `MacroSet`, enums
- [x] `lib/nutrition.ts` — the only place macros are ever computed:
  - `computeLogMacros(food, quantity)` → calories, protein, fat, carbs, fiber
  - `gramsToServings(grams, servingWeightGrams)`
  - `sumMacros(logs[])`
  - `remaining(totals, targets)`
  - `dayStatus(calories, target)` → below | near | ontarget | surplus | none
  - `progressRatio` / `progressPercent` / `isTargetReached`
  - `projectedWeeklyGain`, `trailingAverage` (the seven-day weight number)
- [x] Throws `TypeError`/`RangeError` on NaN, Infinity or negative input — a wrong number that *looks* like a number is the exact failure this app exists to prevent
- [x] `lib/schemas.ts` — Zod on every write path; rejects missing serving sizes, negative macros, fiber exceeding carbs, and AI foods with no confidence score
- [x] `lib/dates.ts` — local-timezone `YYYY-MM-DD` keys. **Never `toISOString()`** for a log date: it converts to UTC, so anything logged after 7pm Eastern would land on tomorrow
- [x] Rounding policy: whole calories, one decimal for macros, **rounded only at display time**
- [x] `lib/repo/*.ts` — foods, food-logs, weight-logs, daily-totals, profile; every log mutation recomputes that day's `dailyTotals` from the logs themselves
- [x] `updateLogQuantity` rescales from the stored **snapshot**, so editing a portion never pulls in a later label correction
- [x] `data/seed-foods.ts` — 41 foods entered from labels and USDA references
- [x] `scripts/seed.mts` — idempotent, keyed on name + brand, never resets `useCount`
- [x] `scripts/rebuild-daily-totals.mts` — proves the cache is reproducible from `foodLogs` alone

### Verified

- [x] **42 tests passing** — including the egg case, `72 × 2 = 144`
- [x] Every seed food passes schema validation, has a serving weight, and survives an **Atwater cross-check** (4/9/4 kcal per gram) that catches a typo'd decimal
- [x] The framework doc's breakfast reproduces exactly: 2 eggs + oatmeal + banana = 479 kcal, 25.9 g protein
- [x] Typecheck, lint, and a build with `.env.local` removed all clean

**Done when:** ~~`npm test` passes and the seed script populates Firestore~~ — tests pass; seeding runs once the service-account key and `ALLOWED_UID` exist.

---

## Phase 2 — Today screen (the core loop)

**Goal:** log a full day of food on a phone in under two minutes. This is the app.

- [x] Header: greeting and date, with a prev/next **date switcher** so yesterday is logged without leaving the screen
- [x] **One** full-width calorie card: 44px number, muted target, blue gradient bar, glow behind the number
- [x] Bar turns blue → green at target, and the label flips from "remaining" to "surplus". The word "over" appears nowhere
- [x] Two half-width macro cards: protein (violet), fat (gold). Fat past target turns amber — it is the one macro with a real ceiling; protein past target stays green
- [x] Five meal sections as light list groups: muted uppercase title, total right-aligned, hairline divider, collapsible
- [x] Collapsed state shows `901 kcal • 56g protein`
- [x] Empty dinner after 5pm with the target unmet picks up an amber accent and a nudge
- [x] Food row: name white, `2 × 1 large egg` muted beneath, calories and protein right-aligned; tap to change quantity
- [x] Delete control per row
- [x] **Add Food** full-height sheet, four tabs — Recent · Favorites · My Foods · AI Search (stubbed to Phase 9) — active tab is blue text with a thin underline
- [x] Recent sorted by real use count; Favorites toggled by the heart on each card
- [x] Source dots on every food card — green label, blue USDA, gray user, amber AI
- [x] Quantity sheet: `− 2 +` at 56px, half-serving steps, live totals computed by the **same engine function** that writes the snapshot
- [x] Live data via `onSnapshot` — instant from the offline cache, updates the moment a write lands, works with no connection
- [x] Loading derived from the subscription key, so switching dates never flashes the previous day's food
- [x] Haptic tick on add
- [x] Nav **+** opens the picker, guessing the meal from the clock
- [x] **Load starter foods** button in Settings — seeds all 41 foods as the signed-in owner, no service-account key needed

### Verified

- [x] Typecheck, lint and tests (42) all clean
- [x] Build passes with `.env.local` removed, reproducing Vercel exactly
- [ ] Logging a real day on a phone *(needs your login + starter foods)*

**Done when:** ~~a full day of eating is logged on a phone~~ — built and deployed; confirm on your phone that a repeat food takes **three taps or fewer** and the counters match a hand calculation.

---

## Phase 3 — Foods database

**Goal:** own the ~40 foods actually eaten.

> **Navigation note:** the design's bottom nav is Today · Calendar · **+** · Progress · Settings — the center button opens quick food selection, so Foods has no nav slot of its own. Reach the foods database from **Settings → Nutrition database → Manage foods** and from the **My Foods** tab of the Add Food sheet. Route stays `/foods`.

- [x] Foods list: search, category filter, favorites-only toggle, sort by most-used or A–Z
- [x] Source dots on every row — green label, blue USDA, gray user, amber AI — plus a "logged N×" counter
- [x] Manual create and edit covering every schema field, at `/foods/new` and `/foods/[id]`
- [x] Live preview: "1 × 1 large egg counts as 72 kcal, 6.3g P, 4.8g F" while you type
- [x] Validation surfaces the first real problem rather than a wall of messages
- [x] Label photo capture straight to Firebase Storage; adding one promotes the food to **label-verified**
- [x] AI-estimated foods carry the amber confirm-the-serving strip
- [x] **Archive rather than delete** when a food has ever been logged — the app checks for logs and says which happened and why
- [x] Duplicate a food, for label variants
- [x] Favorite toggle inline on each row

### Verified

- [x] Typecheck, lint, 42 tests, and a build with `.env.local` removed all clean
- [ ] Adding a real food from a package *(yours to confirm)*

**Done when:** ~~a new food can be added from a package label in under a minute~~ — built and deployed; confirm on a real package.

---

## Phase 4 — Weight tracking and Settings

**Goal:** know whether any of this is working.

- [x] Settings profile: name, starting weight, goal weight, start date, birthday, height, activity level, workouts per week, weight unit
- [x] Editable daily targets (calories, protein, fat) with numeric steppers, per DESIGN.md — tapping beats summoning a keyboard
- [x] Changing a target updates Today immediately; past days keep the numbers they were logged against
- [x] Weight entry sheet — one per day, date as the document id, so re-entry overwrites instead of duplicating
- [x] Optional waist measurement and note; delete an entry
- [x] Morning weigh-in guidance on the sheet
- [x] Weight chip on the Today header — **amber when today's weigh-in is missing**, tap to log
- [x] Seven-day average and day counter beside it
- [x] Settings form derived from the stored profile plus local edits, so a background snapshot never clobbers half-finished typing

### Verified

- [x] Typecheck, lint, 42 tests, and a build with `.env.local` removed all clean
- [ ] Entering a real weigh-in *(yours to confirm)*

**Done when:** ~~weight can be entered in two taps~~ — built and deployed; confirm the seven-day average appears on the Today header once you have a few weigh-ins.

---

## Phase 5 — Calendar

**Goal:** see consistency at a glance.

- [x] Month grid on black; each cell shows the day, calories, `132P`, and a **thin status line** — never a filled bright cell
- [x] Selected date: translucent blue fill, blue border, soft outer glow
- [x] Previous / next month, jump to today; future months disabled
- [x] Tap a date to open that day's full log, grouped by meal, beneath the grid
- [x] Weekly summary line under each row: average calories and days on target
- [x] **Copy this day to today** — copies the snapshots verbatim, so a day reproduces exactly what was eaten even if a label has since been corrected
- [x] Status derived from the **current** target rather than the stored record, so changing a target recolors history consistently
- [x] Framing copy: one low day is not a failure; the weekly average moves the scale
- [x] `scripts/rebuild-daily-totals.mts` — recompute all `dailyTotals` from `foodLogs`

### Verified

- [x] Typecheck, lint, 42 tests, and a build with `.env.local` removed all clean
- [ ] Reading a real month of logging *(needs a few days of data)*

**Done when:** ~~a month of logging is legible in one screen~~ — built and deployed; the grid fills in as you log.

---

## Phase 6 — Progress and weekly summary

**Goal:** the trend, not the noise.

- [x] Progress header: starting weight, **current seven-day average as the largest number on the page**, goal weight, pounds gained, pounds remaining, percent to goal, estimated goal date
- [x] Weight progress bar from start to goal, turning green at the goal
- [x] Chart 1 — daily weight (muted gray) with the seven-day average (electric blue) overlaid
- [x] Chart 2 — daily calories against a dashed target line
- [x] Chart 3 — daily protein in violet against its target line
- [x] Chart 4 — weekly average intake against the weight change it produced
- [x] Chart surfaces carry faint horizontal grid lines only — no grid boxes, no vertical rules, no axis lines
- [x] Weekly summary table: average calories, protein and fat; calorie-target days; protein-target days; average weekly weight; weekly change
- [x] Plain-language interpretation, including a warning when the gain is *too fast* — that adds fat, not muscle
- [x] Stall detection over two **complete** weeks → suggests +150 cal/day
- [x] **The app suggests; you approve.** The new target is applied only by an explicit tap
- [x] Goal-date projection refuses to print a date when weight is flat or falling, rather than inventing a confident number
- [x] `lib/progress.ts` is pure and fully tested — the screen renders these numbers, it never derives its own

### Verified

- [x] **66 tests passing** (24 new), covering week grouping, stall detection, goal projection and the interpretation copy
- [x] Weekly change compares weekly **averages**, not single mornings — with a test proving the difference
- [x] Typecheck, lint, and a build with `.env.local` removed all clean
- [ ] Reading real trends *(needs two weeks of data)*

**Done when:** ~~the weekly summary reads like a coach's note~~ — built and deployed; the charts fill in as data accumulates.

---

## Phase 7 — Meal templates and copying

**Goal:** cut logging time to near zero for repeat meals.

- [x] Create a template from scratch (`/templates` → New template) or from an already-logged meal (**Save as meal** on any meal section)
- [x] Template detail: ingredients with quantities and computed total macros
- [x] Apply a template → adds every item to the chosen meal, quantities still editable afterward
- [x] **Meals** tab in the Add Food sheet, so a template is reachable mid-log
- [x] **Copy yesterday** on every meal section
- [x] Template editor: rename, re-categorize, adjust quantities, add and remove ingredients
- [x] Starter templates: Regular breakfast, Weekend breakfast, Workday lunch, Regular shake, Apple and trail mix
- [x] Regular shake seeded as ISO protein 1 scoop, Ratio yogurt ½, rolled oats ½ cup, banana 1, whole milk 1 cup, honey 1 tbsp
- [x] A starter template whose ingredients are missing is **skipped and reported**, never created half-complete
- [x] Applying a template writes all logs then rebuilds daily totals **once**, not once per ingredient

### Design notes

- **Template items reference a food; they do not snapshot it.** This is the deliberate opposite of a food log. A log records what was eaten and must never change; a template is a recipe for what you are *about* to eat, so it should pick up any label correction made since.
- **Items live in an array on the template document**, not the subcollection originally sketched in the data model. A template is a handful of ingredients always read as a unit, so a subcollection would mean one extra listener per template for nothing.

### Verified

- [x] Typecheck, lint, 66 tests, and a build with `.env.local` removed all clean
- [ ] One-tap logging of a real shake *(yours to confirm)*

**Done when:** ~~a normal breakfast is logged in one tap~~ — built and deployed.

---

## Phase 8 — USDA food lookup

**Goal:** foods that are not in the personal database yet.

- [x] `app/api/usda/search/route.ts` — server-side; the key never reaches the client
- [x] `app/api/usda/food/[fdcId]/route.ts` — full detail with serving options
- [x] Both routes behind `requireOwner()` — an ID token is verified against `ALLOWED_UID` before any billable call
- [x] `lib/usda.ts` maps USDA's **two different shapes** onto one base serving:
  - **Branded** — `labelNutrients` are already per serving, straight off the package, and are used verbatim
  - **Foundation / SR Legacy** — `foodNutrients` are per 100 g and get scaled by the chosen portion's gram weight
- [x] Serving picker built from `foodPortions`, always including 100 g so there is a usable option
- [x] Result cards: name, brand, data type, serving
- [x] Review screen with a live "1 × 4 oz counts as…" preview before saving
- [x] Saved as `usda_verified`, retaining `externalFoodId` so a food traces back to its record
- [x] Searches cached for ten minutes, detail lookups for an hour, to stay inside the 1,000/hour limit
- [x] Reachable from the Foods screen and from the food picker's empty state ("Search USDA for …")
- [x] Copy states that a package label beats a USDA record, and invites replacing it

### Verified

- [x] **84 tests passing** (18 new) over the mapping layer, including branded-vs-generic handling, portion scaling, and schema conformance of the output
- [x] Refuses to invent nutrition: a record with no energy value returns null rather than defaulting to zero
- [x] Typecheck, lint, and a build with `.env.local` removed all clean
- [ ] A live search *(needs `USDA_API_KEY`)*

**Done when:** ~~an unfamiliar packaged food can be found and saved~~ — built and deployed; add `USDA_API_KEY` to switch it on.

---

## Phase 9 — Claude AI assistant

**Goal:** AI as a search and data-entry assistant, never the authoritative nutrition source.

**Source priority, enforced in code:** label photo → branded USDA → generic USDA → AI estimate

- [x] `app/api/ai/label-scan` — photo in, structured macros out (Claude vision + `messages.parse` with a Zod output schema)
- [x] `app/api/ai/lookup` — natural language in; candidate food, serving and confidence out
- [x] `app/api/ai/coach` — weekly interpretation grounded strictly in the numbers passed in
- [x] All three behind `requireOwner()`, so an ID token is verified before any billable call
- [x] **Mandatory review screen** — every field editable, nothing saved until looked at
- [x] Confidence stored (`high` 0.9 / `medium` 0.6 / `low` 0.3) and surfaced as a colored dot
- [x] **Never invents a serving size**: an ambiguous portion sets `needsClarification` and shows the question it would have asked
- [x] Label photos save as `label_verified`; descriptions save as `ai_estimated` with the amber confirm-the-serving strip
- [x] Every suggestion logged to `aiFoodSearches` with its approval state; a logging failure never blocks the save
- [x] Photos downscaled to 1600px client-side — phone JPEGs otherwise exceed the request body limit and waste vision tokens
- [x] Saving from AI drops straight into the quantity sheet, so a new food is logged in the same motion it was created
- [x] Coach card on Progress, on demand rather than automatic — it costs a call, and the numbers above already say most of it
- [x] ~~Floating assistant button~~ — the bottom nav's elevated **+** already occupies that position and opens the picker, where the AI tab lives. A second floating button in the same corner would compete with it

### Verified against the live API

- [x] `"a bowl of oatmeal"` → **needsClarification: true**, asking how big the bowl was and whether it was made with milk
- [x] `"medium grilled pork chop, ~5 oz cooked"` → 295 kcal, 38 g protein, 15 g fat, 142 g — and honestly marked **low** confidence, because a description is not a label
- [x] Coach summary on two flat weeks correctly identified the stall and named the shortfall
- [x] Typecheck, lint, 84 tests, and a build with `.env.local` removed all clean

**Done when:** ~~photographing a label produces a correct, reviewable entry~~ — built, deployed, and exercised against the live API.

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

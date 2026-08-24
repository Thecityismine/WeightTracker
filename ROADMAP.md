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
| Framework | Next.js (App Router) + TypeScript |
| Styling | Tailwind CSS + shadcn/ui |
| Database | Firebase Firestore |
| File storage | Firebase Storage (nutrition-label photos) |
| Hosting | Vercel |
| Auth | **None** — no login screen. All Firestore access goes through Next.js server routes using `firebase-admin`; client-side Firestore rules are deny-all |
| AI | Claude (Anthropic) — `claude-opus-5` for label vision + coaching, `claude-sonnet-5` for routine lookups |
| Nutrition source | USDA FoodData Central API (server-side only) |
| Charts | Recharts |
| Units | Weight in **pounds**, food weights in **grams** |

**Note on "no auth":** there is no login screen, as chosen. Firestore rules deny all direct client access so bots cannot scrape or wipe the database — reads and writes happen only through this app's own server routes. The remaining exposure is that anyone who has the Vercel URL can use the app. Phase 10 includes an optional one-line passphrase gate (single env var, no user accounts) that can be switched on later without touching the data model.

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

Top-level collections. Every document carries `userId` (hardcoded `"me"` in V1) so nothing needs rewriting if this ever becomes multi-user.

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

## Phase 0 — Foundation and deploy pipeline

**Goal:** an empty app live on Vercel, talking to Firestore.

- [ ] `npx create-next-app@latest` — TypeScript, Tailwind, App Router, `src/` dir
- [ ] Install: `firebase-admin`, `@anthropic-ai/sdk`, `recharts`, `date-fns`, `zod`, `lucide-react`
- [ ] Init shadcn/ui; add button, card, dialog, drawer, input, tabs, progress, select, sheet, toast
- [ ] Create the Firebase project, enable Firestore + Storage
- [ ] Generate a service-account key; store as env vars (never commit the JSON)
- [ ] `firestore.rules` — deny all client reads and writes
- [ ] `lib/firebase-admin.ts` — singleton Admin SDK init that survives hot reload
- [ ] `.env.local` + `.env.example`; `.gitignore` covering `.env*` and `*serviceAccount*.json`
- [ ] Bottom nav shell: Today · Calendar · Progress · Foods · Settings (five routes, empty pages)
- [ ] Mobile viewport meta, safe-area insets, dark theme
- [ ] First commit, push to GitHub, connect Vercel, set env vars, deploy

**Env vars**

```
FIREBASE_PROJECT_ID
FIREBASE_CLIENT_EMAIL
FIREBASE_PRIVATE_KEY
FIREBASE_STORAGE_BUCKET
ANTHROPIC_API_KEY
USDA_API_KEY
```

**Done when:** the live Vercel URL loads, the bottom nav switches between five pages, and a test server route writes and reads one Firestore document.

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

- [ ] Daily header: date, current weight, streak, days since start, on-target status
- [ ] Three macro counters — calories, protein, fat — with progress rings
- [ ] Remaining line: *"490 calories and 12 g protein remaining today."*
- [ ] Surplus/deficit estimate against target, plus whether on track to gain
- [ ] Five collapsible meal sections with per-section totals
- [ ] Food row: name, quantity, calories, protein — tap to edit quantity in place
- [ ] Swipe-to-delete or long-press delete, with undo
- [ ] **Add Food** sheet with four tabs: Recent · Favorites · My Foods · AI Search (last tab stubbed)
- [ ] Recent sorted by frequency and recency; Favorites from `isFavorite`
- [ ] Quantity control `− 2 +` with a live total preview before saving
- [ ] Date switcher — log yesterday without leaving the screen
- [ ] Optimistic UI: a logged food appears instantly and reconciles after the write

**Done when:** a full day of eating is logged on a phone without touching a keyboard, and the counters match a hand calculation exactly.

---

## Phase 3 — Foods database

**Goal:** own the ~40 foods actually eaten.

- [ ] Foods list: search, filter by category, favorites toggle, sort by most-used
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

- [ ] Month grid; each cell shows the day, calories, protein, and status color
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
- [ ] Chart 1 — daily weight with the seven-day average overlaid
- [ ] Chart 2 — daily calories against the target line
- [ ] Chart 3 — daily protein against the target line
- [ ] Chart 4 — weekly calorie intake versus weekly weight change
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

- [ ] PWA manifest and icons — installs to the home screen, opens on Today
- [ ] Offline read of today's log; queue writes made while offline
- [ ] Loading skeletons, empty states, error toasts
- [ ] Haptics on log and delete
- [ ] Optional passphrase gate (single env var, no accounts)
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
- If a phase drags, ship the useful half and move the remainder to the backlog.

**The best V1 is not a MyFitnessPal replacement.** It is a fast personal tracker holding the 30–50 foods actually eaten, with AI available when something unfamiliar shows up.

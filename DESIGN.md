# Design System — Muscle Gain Food Tracker

The app should feel like a clean performance dashboard, not a traditional calorie-counting app. Deep black surfaces, thin electric-blue highlights, soft progress glows, rounded cards that do not read as a pile of separate boxes.

**Fitness dashboard meets financial terminal — without looking like the control panel of a spaceship.**

## Visual direction

- Premium, dark, minimal
- Black background with layered charcoal surfaces
- Electric blue as the primary brand color
- Green **only** for successfully reaching targets
- Orange and red reserved for warnings
- Large numbers, compact supporting labels
- Thin borders, restrained glow, generous spacing
- Mobile-first, one-handed controls

**The discipline rule:** do not put bright blue around every element. It loses impact fast. Blue is for active states, primary actions, progress indicators, and important numbers — nothing else.

---

## Color system

| Purpose | Name | Hex |
| --- | --- | --- |
| App background | Obsidian | `#050608` |
| Secondary background | Carbon | `#090C10` |
| Elevated surface | Graphite | `#10151B` |
| Active card | Deep blue surface | `#0B1722` |
| Primary blue | Electric blue | `#00A8FF` |
| Bright highlight | Neon cyan | `#29D9FF` |
| Primary text | Cool white | `#F4F7FA` |
| Secondary text | Silver | `#9AA6B2` |
| Muted text | Slate | `#66717D` |
| Standard border | Dark gray | `#202832` |
| Active border | Blue | `#007ECC` |
| Success | Performance green | `#2DDB8C` |
| Warning | Amber | `#FFB547` |
| Danger | Coral red | `#FF5B6E` |
| Protein accent | Violet | `#A78BFA` |
| Fat accent | Gold | `#F5B942` |
| Carbohydrate accent | Cyan | `#2DD4BF` |

### Tokens

```css
:root {
  --background: #050608;
  --background-secondary: #090c10;
  --surface: #10151b;
  --surface-active: #0b1722;
  --blue: #00a8ff;
  --cyan: #29d9ff;
  --blue-dark: #007ecc;
  --text-primary: #f4f7fa;
  --text-secondary: #9aa6b2;
  --text-muted: #66717d;
  --border: #202832;
  --border-active: #007ecc;
  --success: #2ddb8c;
  --warning: #ffb547;
  --danger: #ff5b6e;
  --protein: #a78bfa;
  --fat: #f5b942;
  --carbs: #2dd4bf;
  --radius-card: 16px;
  --radius-control: 12px;
  --radius-sheet: 24px;
}
```

---

## Background treatment

Nearly black, with a very subtle blue radial glow near the top.

```css
background:
  radial-gradient(
    circle at 50% -10%,
    rgba(0, 168, 255, 0.12),
    transparent 32%
  ),
  #050608;
```

Cards use slightly different surface colors to establish depth. Avoid heavy drop shadows.

```css
background: rgba(16, 21, 27, 0.82);
border: 1px solid rgba(255, 255, 255, 0.07);
box-shadow:
  0 14px 40px rgba(0, 0, 0, 0.28),
  inset 0 1px 0 rgba(255, 255, 255, 0.025);
backdrop-filter: blur(16px);
```

---

## Typography

Clean and geometric.

- **Primary:** Geist Sans
- **Numbers:** Geist Mono
- **Alternative:** Inter

Use **tabular numbers** for calories, protein, fat, and weight so values do not shift as they update.

| Element | Size | Weight |
| --- | --- | --- |
| Daily calorie total | 40–48px | 650 |
| Page title | 26–30px | 650 |
| Card metric | 22–28px | 650 |
| Section title | 16–18px | 600 |
| Body text | 14–16px | 450 |
| Caption | 12–13px | 500 |
| Navigation label | 11–12px | 550 |

Uppercase sparingly — small metric labels only (`CALORIES`, `PROTEIN`, `FAT`).

---

## Shape and spacing

| Element | Radius |
| --- | --- |
| Main cards | 16px |
| Food rows | 12px |
| Buttons | 12px |
| Inputs | 12px |
| Tags | 999px |
| Modal sheets | 24px top corners |

| Spacing | Use |
| --- | --- |
| 4px | Micro spacing |
| 8px | Icon and label spacing |
| 12px | Food-row spacing |
| 16px | Standard card padding |
| 20px | Large card padding |
| 24px | Section spacing |
| 32px | Major page spacing |

---

## Today screen

### Header

Personal and useful.

```text
Good morning, Jorge
Sunday, August 23
144.2 lb                  Day 12
```

Current weight is a secondary metric. The calorie counter stays the visual focus.

### Main calorie card

One large card across the full width.

```text
TODAY
2,310
of 2,800 calories
████████████████░░░  83%
490 remaining
```

- Large white number
- Smaller muted target
- Electric-blue progress bar
- Blue glow **only** at the leading edge
- Remaining calories in green or blue
- Subtle radial glow behind the number

```css
.calorie-progress {
  background: linear-gradient(
    90deg,
    #007ecc,
    #00a8ff,
    #29d9ff
  );
  box-shadow: 0 0 16px rgba(0, 168, 255, 0.38);
}
```

When the target is reached, transition the bar from blue to green.

### Macro cards

Protein and fat side by side beneath calories, roughly half-width each on mobile.

| Protein | Fat |
| --- | --- |
| 118 / 130g | 67 / 80g |
| Violet progress | Gold progress |
| 12g remaining | 13g remaining |

**Do not use large circular charts for every metric.** They eat mobile space. One primary progress visualization, smaller horizontal bars for supporting macros.

### Meal sections

A clean list section, not a heavy container.

```text
BREAKFAST                         479 kcal
─────────────────────────────────────────
Eggs
2 large                     144 kcal  12.6g
Instant oatmeal
1 packet                    230 kcal  12.0g
Banana
1 medium                    105 kcal   1.3g
+ Add food
```

- Meal title in muted uppercase, total aligned right
- Thin divider under the heading
- Food name white, portion muted gray
- Calories and protein aligned right
- Swipe left to edit or delete; tap the row to change quantity
- Blue only when the section is active

Collapsed:

```text
LUNCH                  901 kcal  •  56g protein  ›
```

Empty:

```text
DINNER
No foods logged
[ + Add dinner ]
```

Give an empty dinner a subtle amber accent if the daily target has not been reached by evening.

---

## Food selection

Full-height bottom sheet.

**Search field** — dark graphite background, thin gray border, blue border on focus, microphone and camera icons on the right.

```text
🔍 Search your foods or ask AI
```

**Filter tabs** — active tab uses blue text and a thin blue underline. No large pill background.

```text
Recent    Favorites    My Foods    AI Search
```

**Result card**

```text
EB Eggs                                    ♥
1 large egg
72 kcal    6.3g protein    4.8g fat
Nutrition label verified
```

Source tags:

- Verified label — green dot
- USDA verified — blue dot
- User entered — gray dot
- AI estimated — amber dot

**Quantity selector** — compact bottom sheet after selection.

```text
EB Eggs
1 large egg per serving
           −     2     +
144 calories
12.6g protein  •  9.6g fat
[ Add to Breakfast ]
```

Plus and minus controls are at least **44 × 44px** for one-handed use. The final button is a full-width electric-blue gradient.

---

## Calendar

Black monthly grid with compact nutrition indicators.

```text
23
2,810
132P
```

Status dot or thin bottom line:

- Green — calorie target reached
- Blue — within 10% of target
- Amber — slightly below target
- Red — significantly below target
- Gray — no entry

Selected date:

```css
background: rgba(0, 168, 255, 0.12);
border: 1px solid #00a8ff;
box-shadow: 0 0 18px rgba(0, 168, 255, 0.12);
```

**Do not fill entire dates with bright color.** That turns the calendar into a Christmas tree surprisingly quickly.

---

## Progress screen

### Weight progress card

```text
WEIGHT PROGRESS
144.0 lb                      149.0 lb
Starting                         Goal
145.2 lb
Current average
1.2 lb gained                 24%
```

Horizontal progress line: starting weight left, goal right, glowing blue position marker, green marker once the goal is reached.

### Charts

- Electric blue — seven-day weight average
- Muted gray — daily weights
- Violet — protein
- Green — target achievement
- Thin horizontal target line

No visible grid boxes. Faint horizontal grid lines only.

---

## AI assistant

Floating circular button, bottom right: black center, thin animated blue border, small sparkle icon. **No oversized chatbot mascot.**

Opened:

```text
Nutrition Assistant
Ask about a food or photograph its label.
"What are the macros for a
5 oz grilled pork chop?"
[ Camera ]  [ Type a question ]
```

Results appear as a structured card:

```text
Grilled pork chop
Estimated cooked serving: 5 oz
Calories     290
Protein      38g
Fat          14g
Source: USDA closest match
Confidence: High
[ Edit serving ]    [ Save food ]
```

Estimated results carry an amber information strip:

> Nutrition may vary by preparation. Confirm the serving before saving.

---

## Settings

Grouped, each row separated by a thin divider rather than its own card.

**Profile** — name, starting weight, current weight, goal weight, height, birthday

**Daily targets** — calories, protein, fat, expected weekly gain

**Nutrition database** — add food, manage foods, import label, AI search history, default serving units

**Preferences** — pounds or kilograms, theme, week starts Sunday or Monday, reminders

Use numeric stepper controls instead of open text fields wherever possible.

---

## Buttons

**Primary**

```css
background: linear-gradient(135deg, #007ecc, #00a8ff);
color: #ffffff;
border: 1px solid rgba(41, 217, 255, 0.45);
box-shadow: 0 8px 24px rgba(0, 168, 255, 0.22);
```

**Secondary**

```css
background: #10151b;
color: #f4f7fa;
border: 1px solid #28323d;
```

**Destructive** — dark red surface with coral text. Do not make the entire screen red.

---

## Bottom navigation

Five items:

```text
Today    Calendar    +    Progress    Settings
```

The center Add button is slightly elevated: 52px circular, blue gradient, white plus icon, subtle blue glow. It opens quick food selection.

- **Active item** — electric-blue icon, white label, small blue indicator line
- **Inactive item** — slate-gray icon, muted label

---

## Motion

Short and functional.

| Interaction | Duration |
| --- | --- |
| Button press | 100ms scale-down |
| Progress update | 300ms |
| Bottom sheet | 250ms |
| Macro completion glow | 500ms |
| Food added | subtle checkmark + vibration |
| Weight milestone | brief blue-to-green animation |

Avoid constant pulsing or glowing. **The app should feel alive, not radioactive.**

---

## Success criteria

Polished and data-driven, with the daily calorie goal as the main visual priority, and food logging requiring **no more than three taps** for foods already in the database.

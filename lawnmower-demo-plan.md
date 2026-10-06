# Minigame Hub + Lawn Mower Demo: Build Plan

## Context

This is a course project demo, not a product. We need:

1. A well-designed menu where the player picks from a list of minigames.
2. One playable minigame: a top-down lawn mowing game.
3. All other minigames lead to a "work in progress" page.

It only needs to run reliably on localhost. No hosting, no backend, no accounts, no real multiplayer. Prioritise a polished, stable demo over feature depth. It will be shown on a laptop and projector during a presentation.

The game is a mobile game concept, so the whole app renders inside a portrait phone-shaped frame (about 390 x 844 px) centred on the screen. Touch controls must work (testable via browser devtools mobile mode), and arrow keys / WASD must work for laptop demos.

## Tech stack

- **Vite + TypeScript** (vanilla, no React)
- **Phaser 3** for the game scene only
- **Plain HTML/CSS** for the menu pages (hub, WIP, base, results), so they look clean and designed
- **localStorage** for saving money, upgrades, passed maps and the cooldown timestamp
- Graphics: simple shapes drawn in code, or CC0 sprites (for example from kenney.nl) placed in `public/assets`. Keep the visual style consistent: bright, friendly, flat colours, rounded UI.

Run with `npm install` then `npm run dev`. Everything must work offline after install.

## Pages

### 1. Minigame hub (start page)
- App title and a short tagline.
- A grid or list of minigame cards (icon, name, one-line description).
- "Lawn Mower" card is marked as playable and opens the Lawn Mower base page.
- All other cards open the WIP page.
- The minigame list lives in one config file so names and descriptions are easy to edit. Use these placeholders for now: Lawn Mower (playable), plus 4 to 5 placeholder minigames with neutral names (for example "Garden Planner", "Recycling Sort", "Delivery Run", "Fishing Trip").

### 2. Work in progress page
- Shows the selected minigame's name and icon, a friendly "This minigame is still in development" message, and a back button to the hub.

### 3. Lawn Mower base page
- Header: money balance and back button to the hub.
- **Job board / level selection:** three maps (Small, Medium, Large). Each card shows map size, time limit, base payout, recommended gear, and best grade achieved so far.
  - Medium is locked until Small has been passed (grade D or better). Large is locked until Medium has been passed.
- **Upgrade shop:** two upgrades, Speed and Mowing width, each with 3 tiers above the base level. Show current tier, next tier's effect and price. Buy button disabled if not enough money.
- **Cooldown:** after any job ends (pass, fail or game over), job buttons lock for 15 minutes with a visible countdown and a short message explaining the cooldown encourages breaks from the screen. The shop stays usable during cooldown. The cooldown end time is stored in localStorage so it survives reloads.
- Disabled "Online race (coming soon)" button to show the planned online mode.
- **Presenter tools** (small, low-key, for example in a settings/gear menu):
  - Skip cooldown (also keyboard shortcut `K`)
  - Add 1000 money (also keyboard shortcut `M`)
  - Reset all progress (with confirmation)

### 4. Game page (Phaser)
- Top-down view of the lawn with a mower the player controls.
- HUD: remaining time, live coverage %, flower beds destroyed, pause button (pause menu: resume, quit to base).
- Camera follows the mower on maps larger than the screen. A small minimap in a corner showing mowed vs unmowed area is a nice extra if time allows.
- A short "3, 2, 1, Go" countdown before the timer starts.
- The job ends when the timer runs out, when the player taps "Finish job" (allowed once coverage reaches the pass threshold), or on game over.

### 5. Results page
- Shows: coverage %, flower beds destroyed, time remaining, final score, letter grade (large and prominent), payout.
- Game over (pool) shows a distinct message: "You drove into the pool! Job failed." with no payout.
- Buttons: "Back to base" (the cooldown then starts). No retry button, since the cooldown applies.

## Gameplay rules

### Controls
- Keyboard: arrow keys and WASD.
- Touch: virtual joystick that appears where the player touches the lower half of the screen. Analog direction, normalised speed.
- The mower rotates smoothly to face its movement direction.

### Mowing and coverage
- The lawn is a grid of small cells (for example 8 x 8 px). The mower cuts every grass cell under its cutting area each frame. The cutting width depends on the width upgrade and the visible cut strip must match it.
- Unmowed grass and mowed grass have clearly different colours or textures (long dark stripes vs short light green). Render the mowed state efficiently, for example with a RenderTexture, so large maps stay smooth.
- Coverage % = mowed grass cells / total mowable grass cells. Cells under obstacles do not count.
- Small grass-clipping particle effect while mowing.

### Obstacles
- **Pool:** driving into it is game over. Job fails, grade F, no payout.
- **Flower beds:** driving over one destroys it (visual change to trampled state, red flash, small camera shake). Each bed counts once toward the penalty.
- **Trees, house, shed, fences:** solid blockers. The mower collides and stops, no penalty.
- Map edges are solid.

### Maps
Define maps as data (TypeScript or JSON): size, time limit, base payout, and obstacle positions as rectangles/circles. Start values (tune in balancing):

| Map | Size (px) | Time limit | Base payout | Notes |
|---|---|---|---|---|
| Small | about 600 x 900 | 120 s | 100 | Garden with a few flower beds, one tree, small pool |
| Medium | about 1000 x 1400 | 150 s | 250 | More flower beds, trees, a shed |
| Large | about 1500 x 2000 | 180 s | 500 | Big estate, larger pool, many beds |

### Upgrades
| Tier | Speed (px/s) | Width (px) | Price (each upgrade) |
|---|---|---|---|
| Base | 120 | 40 | owned |
| 1 | 150 | 55 | 150 |
| 2 | 185 | 70 | 350 |
| 3 | 225 | 90 | 700 |

Starting money: 0.

### Grading
1. If the player hit the pool: grade **F**, payout 0.
2. If coverage < 80%: grade **F**, payout 0, job counts as failed.
3. Otherwise: `score = coverage% - 5 x flowerBedsDestroyed + timeBonus`, where `timeBonus` is up to 5 points, proportional to the fraction of time left.
4. Grade from score: **A** >= 95, **B** >= 88, **C** >= 80, **D** >= 70, **F** < 70.
5. Payout = base payout x multiplier: A 1.0, B 0.8, C 0.6, D 0.4, F 0.
6. A map counts as passed with grade D or better.

## Balancing requirement

The progression must feel real:
- **Small:** comfortably passable (grade B or better) with base gear.
- **Medium:** only just possible with base gear if played very well. Comfortable with one or two upgrade tiers.
- **Large:** not reachable at 80% coverage with base gear, because the maths does not allow it. Needs roughly tier 2 in both upgrades.

Check this with a rough calculation: maximum mowable area per run is about `speed x width x timeLimit`, multiplied by an efficiency factor of about 0.6 to account for turning and overlap. Compare that against 80% of each map's mowable area, then adjust map sizes, time limits or upgrade values. Write the calculation as a small script or a comment in the config so it can be rerun after tweaks.

Also check the economy: a player should be able to afford the upgrades needed for Large after a reasonable number of jobs (about 5 to 8 jobs total), assuming mostly B and C grades.

## Config

All tuning values (map sizes, time limits, payouts, upgrade values and prices, grade thresholds, penalty per bed, pass threshold, cooldown duration, starting money) live in one file, for example `src/config.ts`, with comments. The minigame list for the hub lives in the same place or in its own config file.

## Build stages

Work in stages. After each stage, run the type check and build, start the dev server, and confirm the stage works before moving on.

1. **Scaffold and hub:** Vite + TypeScript project, phone frame layout, hub page with minigame cards, WIP page, navigation between them.
2. **Core mowing:** Phaser game page with the Small map, mower movement (keyboard + touch joystick), mowing grid, coverage %, timer, HUD.
3. **Obstacles and results:** pool game over, flower beds with penalty, solid blockers, grading, results page.
4. **Progression:** base page with job board, upgrade shop, money, saving to localStorage, map locking, Medium and Large maps.
5. **Cooldown and presenter tools:** 15-minute cooldown with countdown, skip/money/reset tools and shortcuts.
6. **Balancing:** run the calculation, tune values, playtest all three maps.
7. **Polish:** transitions between pages, particles, screen shake, button states, simple sound effects if easy (with a mute toggle), consistent styling, check for console errors.

## Out of scope

- Real online multiplayer or any backend
- Accounts or login
- Hosting or deployment
- The other minigames (WIP page only)

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running the Game

No build tooling. Pure ES modules served directly by any static file server:

```
python -m http.server 5500
```

Then open `http://localhost:5500`. There is no transpilation, bundling, or package manager.

## Architecture

The game is a browser idle game called "Dimensional Alchemy". `src/main.js` is the entry point — it wires all systems together and owns the top-level event listeners.

**`src/engine/`** — core primitives
- `gameState.js` — `createInitialState()` defines the full state shape; `sanitizeState()` clamps/coerces every field when loading from localStorage. State version is `CURRENT_STATE_VERSION`.
- `formulas.js` — all game math (generator costs, production rates, prestige shard gain, ascend cost). Import from here rather than duplicating math.
- `tickSystem.js` — 100ms `setInterval` loop; emits `tick` on the eventBus each tick with `{ state, rates, dtSeconds }`.
- `eventBus.js` — simple pub/sub; events: `tick`, `generator:purchased`, `upgrade:purchased`, `research:leveled`, `action:transmute`, `action:convert`, `action:ascend`, `expedition:*`, `dungeon:*`.

**`src/config/`** — tuning constants only (no logic)
- `gameBalance.js` — single `BALANCE` export; all numeric constants (tick rate, base costs, growth rates, upgrade/research definitions, expedition config). Changing a number here propagates everywhere.
- `ascendTree.js` — hexagonal ascension node definitions with `{ id, cost, q, r, effect }` in axial hex coordinates.
- `currencyDisplay.js` — icon paths and fallback tokens per currency.

**`src/game/`** — game systems (each is a factory returning an API)
- `modifiers.js` — `recomputePerks()` rebuilds `state.perks` from scratch by iterating upgrades, research levels, ascension tree nodes, and claimed collection milestones. **Call `recompute()` whenever any of these change.**
- `progressionActions.js` — `manualTransmute`, `convertMatterToFire`, `ascend`.
- `generatorSystem.js`, `upgradesSystem.js`, `researchSystem.js`, `ascendTreeSystem.js`, `shipSystem.js`, `expeditionSystem.js`, `dungeonSystem.js` — one factory per system.
- `resourceManager.js` — `add(resource, amount)` and `spend(resource, amount)` with lifetime tracking.
- `unlockRules.js` — `isUnlockMet(state, unlock)` checks unlock conditions (`matterSeen`, `fireSeen`, `ascensions`, `ascensionNode`, `ascensionNodeCount`).

**`src/persistence/`**
- `saveSystem.js` — localStorage, 3 save slots (`dimensional-alchemy-save:slot-N`), autosave every 30s, offline progress applied on load.

**`src/ui/`**
- `render.js` — single monolithic renderer. Tabs: `upgrades`, `research`, `expeditions`, `collection`, `dungeons`, `ascend`. View state (active tab, sub-views) is persisted to localStorage under `dimensionalAlchemy.viewState`.

## Key Patterns

**Perk system**: `state.perks` is computed, not stored persistently. Every upgrade/research/node effect flows through `recomputePerks()` which writes directly to `state.perks`. Never mutate `state.perks` directly outside of `modifiers.js`.

**Balance telemetry**: `Ctrl+Shift+D` toggles a debug panel in-game. The telemetry logger samples tick events and key actions to `console.log` with tag `[balance-telemetry]`.

**Offline gains**: Applied once at startup via `applyOfflineProgress()`. Expeditions and dungeons each receive an `advance(elapsedSeconds, multiplier)` call with their own offline multipliers (0.5 and 0.45 respectively).

**Hex grid** (ascend tree, dungeon layout): Axial `(q, r)` coordinates. Dungeon rooms use a 15×15 grid.

## Adding Content

- **New upgrade**: add to `BALANCE.upgrades` in `gameBalance.js`, add its ID to `BALANCE.upgradeOrder`, and add its perk contribution in `modifiers.js`.
- **New research node**: same pattern — `BALANCE.research`, `BALANCE.researchOrder`, then `modifiers.js`.
- **New ascension node**: add to `ASCEND_TREE` array in `ascendTree.js` with `q`/`r` position and `effect` object.
- **New perk field**: add it to `createInitialState()` in `gameState.js`, `sanitizeState()` clamp logic, the baseline in `recomputePerks()`, and any formula that reads it.

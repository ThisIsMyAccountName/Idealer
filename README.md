# Dimensional Alchemy (Idle Game Prototype)

This is the first implementation slice of a browser idle game.

## Current Status

Implemented:
- Deterministic tick loop (`100ms`)
- Input-safe delegated click handling with throttled rendering (responsive interactions)
- Resource economy (`Matter`, `Fire`, `Shards`)
- Manual action (`Transmute Matter`)
- Conversion action (`100 Matter -> 1 Fire`)
- Generator system (`Furnace`, `Condenser`, `Element Prism`)
- Cost scaling (`baseCost * 1.15^level`)
- Prestige action (`Ascend`) with soft reset and permanent multiplier
- Upgrades tab with unlock-gated permanent run bonuses
- Research tab with level-based unlock-gated progression nodes
- Autosave every 30s + save on tab close
- Offline gains based on elapsed time at 50% efficiency
- Responsive single-screen GUI

## Architecture

- `src/engine`: state, formulas, event bus, tick loop
- `src/game`: generators, actions, resource manager
- `src/persistence`: local save/load and offline replay
- `src/ui`: rendering and interaction bindings
- `src/config`: tuning constants and content definitions

## Run

No build tooling is required.

Use any static file server and open `index.html` from that server root.

Example command if Python is available:

```powershell
python -m http.server 5500
```

Then open:

- `http://localhost:5500`

## Next Milestone

- Ascend tab with hexagonal shard tree
- 10 additional upgrades and 10 additional research nodes
- More resource tiers and recipes
- More automation unlocks
- Better progression telemetry and balancing tools

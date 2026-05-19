// Throwaway balance projection for the currency rebalance.
// Models the idle core loop (generators + conversion + prestige tree) only.
// Research / upgrades / expeditions are NOT modeled, so prestige ETAs here are
// a conservative UPPER BOUND (real game is faster once those multipliers stack).
//
// Run: node tools/balanceSim.mjs
import { BALANCE } from "../src/config/gameBalance.js";
import { ASCEND_TREE } from "../src/config/ascendTree.js";
import {
  generatorCost,
  ascendCost,
  ascendShardGainFromResources,
  productionPerSecond
} from "../src/engine/formulas.js";
import { isUnlockMet } from "../src/game/unlockRules.js";

const GEN = BALANCE.generators;
const GEN_IDS = Object.keys(GEN);
const freshGenerators = () => Object.fromEntries(GEN_IDS.map((id) => [id, 0]));

function freshPerks() {
  return {
    productionMultiplier: 1,
    matterRateMultiplier: 1,
    fireRateMultiplier: 1,
    prestigeGainMultiplier: 1,
    generatorCostGrowthMultiplier: 1,
    conversionCostMultiplier: 1,
    conversionYieldMultiplier: 1,
    conversionFireBonus: 0,
    clickMatterBonus: 0,
    furnaceRateMultiplier: 1,
    condenserRateMultiplier: 1,
    prismRateMultiplier: 1,
    kilnRateMultiplier: 1,
    crucibleRateMultiplier: 1,
    aetherSpireRateMultiplier: 1,
    crucibleSynergyPerPrism: 0
  };
}

function freshState(perks) {
  return {
    resources: { matter: 0, fire: 0, shards: 0 },
    generators: freshGenerators(),
    lifetime: { totalAscensions: 0, matterSeen: 0, fireSeen: 0 },
    ascensionTree: {},
    perks
  };
}

// Greedy: best added-rate-per-cost generator we can afford without draining
// more than 60% of the relevant resource on hand.
function tryBuyGenerators(state) {
  let bought = true;
  while (bought) {
    bought = false;
    let best = null;
    for (const id of GEN_IDS) {
      const def = GEN[id];
      if (def.unlock && !isUnlockMet(state, def.unlock)) continue;
      const lvl = state.generators[id];
      const cost = generatorCost(def, lvl, state.perks.generatorCostGrowthMultiplier);
      const have = state.resources[def.costResource];
      if (cost > have * 0.6) continue;
      const roi = (def.baseRate) / cost; // added units/sec per cost unit
      if (!best || roi > best.roi) best = { id, def, cost, roi };
    }
    if (best) {
      state.resources[best.def.costResource] -= best.cost;
      state.generators[best.id] += 1;
      bought = true;
    }
  }
}

function convCost() {
  return Math.max(1, Math.floor(BALANCE.elementConversionCost * 1)); // perks.conversionCostMultiplier modeled via state below
}

function applyTreeEffect(perks, eff) {
  if (!eff) return;
  if (eff.productionMultiplier) perks.productionMultiplier *= eff.productionMultiplier;
  if (eff.matterRateMultiplier) perks.matterRateMultiplier *= eff.matterRateMultiplier;
  if (eff.fireRateMultiplier) perks.fireRateMultiplier *= eff.fireRateMultiplier;
  if (eff.prestigeGainMultiplier) perks.prestigeGainMultiplier *= eff.prestigeGainMultiplier;
  if (eff.generatorCostGrowthMultiplier) perks.generatorCostGrowthMultiplier *= eff.generatorCostGrowthMultiplier;
  if (eff.conversionCostMultiplier) perks.conversionCostMultiplier *= eff.conversionCostMultiplier;
  if (eff.conversionFireBonus) perks.conversionFireBonus += eff.conversionFireBonus;
  if (eff.clickMatterBonus) perks.clickMatterBonus += eff.clickMatterBonus;
}

function fmtTime(sec) {
  if (sec === Infinity) return ">cap";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  if (h > 24) return `${(h / 24).toFixed(1)}d`;
  if (h > 0) return `${h}h${m}m`;
  if (m > 0) return `${m}m${s}s`;
  return `${s}s`;
}

// ---- Core loop simulation ----
const perks = freshPerks();
let state = freshState(perks);
const ownedNodes = new Set();
const nodesByCost = [...ASCEND_TREE].sort((a, b) => a.cost - b.cost);

const RUN_CAP_SEC = 6 * 3600;
const TOTAL_CAP_SEC = 21 * 24 * 3600;
let totalSec = 0;
let ascendNum = 0;
const ascendLog = [];

function cheapestUnownedCost() {
  for (const n of nodesByCost) if (!ownedNodes.has(n.id)) return n.cost;
  return null;
}

while (ownedNodes.size < ASCEND_TREE.length && totalSec < TOTAL_CAP_SEC) {
  state.resources.matter = 0;
  state.resources.fire = 0;
  state.generators = freshGenerators();
  const cost = ascendCost(state);
  const target = cheapestUnownedCost() ?? 1;

  let runSec = 0;
  // light active bootstrap that fades once generators dominate
  while (runSec < RUN_CAP_SEC) {
    const prod = productionPerSecond(state, GEN);
    const genMatterPerSec = prod.matter;
    const click = genMatterPerSec > 5 ? 0 : 2; // ~2 matter/s of light tapping early
    state.resources.matter += genMatterPerSec + click + state.perks.clickMatterBonus * (click > 0 ? 1 : 0);
    state.resources.fire += prod.fire;
    state.lifetime.matterSeen += genMatterPerSec + click;
    state.lifetime.fireSeen += prod.fire;

    tryBuyGenerators(state);

    // convert toward the fire side of the ascend cost + a little buffer
    const cc = Math.max(1, Math.floor(BALANCE.elementConversionCost * state.perks.conversionCostMultiplier));
    while (
      state.resources.fire < cost.fireCost + 5 &&
      state.resources.matter > cc * 3 &&
      state.resources.matter > cost.matterCost * 0.4
    ) {
      state.resources.matter -= cc;
      state.resources.fire += (1 + state.perks.conversionFireBonus) * state.perks.conversionYieldMultiplier;
    }

    runSec += 1;
    totalSec += 1;
    if (totalSec >= TOTAL_CAP_SEC) break;

    const gain = ascendShardGainFromResources(state);
    if (
      state.resources.matter >= cost.matterCost &&
      state.resources.fire >= cost.fireCost &&
      gain >= target
    ) break;
  }

  const gain = Math.max(1, ascendShardGainFromResources(state));
  state.resources.shards += gain;
  ascendNum += 1;
  state.lifetime.totalAscensions += 1;
  if (ascendNum <= 10) {
    ascendLog.push({
      n: ascendNum,
      runSec,
      totalSec,
      gain,
      shards: state.resources.shards,
      matter: Math.floor(state.resources.matter),
      fire: Math.floor(state.resources.fire)
    });
  }

  // spend shards cheapest-first (adjacency NOT enforced — projection only)
  let spent = true;
  while (spent) {
    spent = false;
    for (const n of nodesByCost) {
      if (ownedNodes.has(n.id)) continue;
      if (state.resources.shards >= n.cost) {
        state.resources.shards -= n.cost;
        ownedNodes.add(n.id);
        applyTreeEffect(state.perks, n.effect);
        spent = true;
      }
    }
  }
  if (runSec >= RUN_CAP_SEC && gain < target) {
    // not converging on this target — bail to avoid runaway
    ascendLog.push({ note: `stalled at ascend ${ascendNum}, target ${target} shards/run` });
    break;
  }
}

console.log("=== CORE LOOP (idle only; research/upgrades/expeditions excluded → upper bound) ===");
console.log(`conversion ${BALANCE.elementConversionCost}:1  prestigeDivisor ${BALANCE.prestigeDivisor}  ` +
  `ascendBase {m:${BALANCE.ascendBaseMatter}, f:${BALANCE.ascendBaseFire}} x${BALANCE.ascendCostGrowth}`);
console.log(`First ascend: ${ascendLog[0] ? fmtTime(ascendLog[0].runSec) : "n/a"} ` +
  `→ ${ascendLog[0]?.gain ?? "?"} shards (matter ${ascendLog[0]?.matter}, fire ${ascendLog[0]?.fire})`);
console.log("\nAscend  runTime  cumТime  shardGain  totalShards");
for (const a of ascendLog) {
  if (a.note) { console.log("  " + a.note); continue; }
  console.log(
    `  #${String(a.n).padStart(2)}   ${fmtTime(a.runSec).padStart(7)}  ${fmtTime(a.totalSec).padStart(7)}` +
    `   ${String(a.gain).padStart(7)}   ${a.shards}`
  );
}
console.log(`\nTree: ${ownedNodes.size}/${ASCEND_TREE.length} nodes after ${ascendNum} ascends, ` +
  `cum time ${fmtTime(totalSec)} (full-tree ETA ${ownedNodes.size === ASCEND_TREE.length ? fmtTime(totalSec) : ">" + fmtTime(totalSec)})`);

// ---- Intel / voyage report ----
console.log("\n=== EXPEDITION INTEL FLOW ===");
const bands = BALANCE.expeditions.bands;
console.log("band               cost(m/f)        reward(m/f/intel)   buyIntel  payback(runs)  matterROI");
let prevIntel = 0;
for (const b of bands) {
  const r = b.rewards;
  const cm = b.cost?.matter ?? 0;
  const cf = b.cost?.fire ?? 0;
  const payback = b.purchaseIntelCost > 0 && prevIntel > 0
    ? Math.ceil(b.purchaseIntelCost / prevIntel)
    : (b.purchaseIntelCost > 0 ? Math.ceil(b.purchaseIntelCost / r.intel) : 0);
  const matterROI = (r.matter / Math.max(1, cm)).toFixed(2);
  console.log(
    `${b.id.padEnd(18)} ${String(cm).padStart(7)}/${String(cf).padStart(4)}   ` +
    `${String(r.matter).padStart(7)}/${String(r.fire).padStart(4)}/${String(r.intel).padStart(3)}   ` +
    `${String(b.purchaseIntelCost).padStart(6)}   ${String(payback).padStart(6)} runs   x${matterROI}`
  );
  prevIntel = r.intel;
}
const mono = bands.every((b, i) => i === 0 || b.purchaseIntelCost >= bands[i - 1].purchaseIntelCost);
console.log(`purchaseIntelCost monotonic non-decreasing: ${mono ? "YES" : "NO"}`);

console.log("\n=== INTEL SINK COVERAGE (full facility line @ runs of contemporaneous band) ===");
const fac = BALANCE.expeditions.shipFacilities;
const facIntelTotal = Object.fromEntries(
  Object.entries(fac).map(([k, v]) => [k, v.levelCosts.reduce((s, c) => s + (c.intel || 0), 0)])
);
const earlyIntelPerRun = bands[0].rewards.intel; // initiate
console.log(`facility totals (intel): ${JSON.stringify(facIntelTotal)}  ` +
  `→ all 4 facilities = ${Object.values(facIntelTotal).reduce((a, b) => a + b, 0)} intel ` +
  `≈ ${Math.ceil(Object.values(facIntelTotal).reduce((a, b) => a + b, 0) / earlyIntelPerRun)} initiate runs`);
for (const sid of ["sloop", "brig", "galleon"]) {
  const s = BALANCE.expeditions.ships[sid];
  console.log(`ship ${sid}: intel ${s.purchaseCost.intel}`);
}
console.log(`duplicate blueprint → intel: ${BALANCE.expeditions.duplicateBlueprintPolicy.intelPerDuplicate}/dup`);

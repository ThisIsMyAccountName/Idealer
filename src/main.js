import { BALANCE } from "./config/gameBalance.js";
import { CURRENCY_DISPLAY } from "./config/currencyDisplay.js";
import { createEventBus } from "./engine/eventBus.js";
import { createInitialState, sanitizeState } from "./engine/gameState.js";
import * as formulas from "./engine/formulas.js";
import { createTickSystem } from "./engine/tickSystem.js";
import { ASCEND_TREE } from "./config/ascendTree.js";
import { createAscendTreeSystem } from "./game/ascendTreeSystem.js";
import { createExpeditionSystem } from "./game/expeditionSystem.js";
import { createGeneratorSystem } from "./game/generatorSystem.js";
import { createLabyrinthSystem } from "./game/labyrinthSystem.js";
import { recomputePerks } from "./game/modifiers.js";
import { createProgressionActions } from "./game/progressionActions.js";
import { createResearchSystem } from "./game/researchSystem.js";
import { createResourceManager } from "./game/resourceManager.js";
import { createShipSystem } from "./game/shipSystem.js";
import { createUpgradesSystem } from "./game/upgradesSystem.js";
import {
  applyOfflineProgress,
  getActiveSlot,
  listSlots,
  loadState,
  resetSlot,
  saveState,
  setActiveSlot
} from "./persistence/saveSystem.js";
import { createRenderer } from "./ui/render.js";

const appEl = document.querySelector("#app");
const eventBus = createEventBus();
const activeSlotId = getActiveSlot();
const state = sanitizeState(loadState(activeSlotId) || createInitialState());

const generatorDefs = BALANCE.generators;
const upgradeDefs = BALANCE.upgrades;
const researchDefs = BALANCE.research;
const upgradeOrder = BALANCE.upgradeOrder;
const researchOrder = BALANCE.researchOrder;
const resourceManager = createResourceManager(state);
const recompute = () => recomputePerks({ state, balance: BALANCE, ascendNodes: ASCEND_TREE });

recompute();

const systems = {
  generators: createGeneratorSystem({ state, generatorDefs, resourceManager, eventBus }),
  upgrades: createUpgradesSystem({ state, upgradeDefs, upgradeOrder, resourceManager, eventBus, recompute }),
  research: createResearchSystem({
    state,
    researchDefs,
    researchOrder,
    costDefaults: BALANCE.researchCostDefaults,
    resourceManager,
    eventBus,
    recompute
  }),
  ascendTree: createAscendTreeSystem({ state, nodes: ASCEND_TREE, resourceManager, eventBus, recompute }),
  ships: createShipSystem({ state, balance: BALANCE, resourceManager, eventBus }),
  expeditions: null,
  labyrinth: null
};
systems.expeditions = createExpeditionSystem({
  state,
  resourceManager,
  eventBus,
  balance: BALANCE,
  shipSystem: systems.ships,
  recompute
});
systems.labyrinth = createLabyrinthSystem({
  state,
  resourceManager,
  eventBus,
  balance: BALANCE,
  registerCollectionDiscovery: systems.expeditions.registerCollectionDiscovery
});
systems.actions = createProgressionActions({
  state,
  resourceManager,
  eventBus,
  recompute,
  expeditionSystem: systems.expeditions,
  labyrinthSystem: systems.labyrinth
});

const DEBUG_TICK_SAMPLE_EVERY = 10;
const TRANSMUTE_LOG_SAMPLE_EVERY = 20;
const telemetryState = {
  enabled: false,
  tickCounter: 0,
  transmuteCounter: 0
};

function roundMetric(value, digits = 2) {
  const n = Number(value);
  if (!Number.isFinite(n)) {
    return 0;
  }
  const factor = Math.pow(10, digits);
  return Math.round(n * factor) / factor;
}

function formatIntOrFixed(value, digits = 2) {
  const rounded = roundMetric(value, digits);
  if (Number.isInteger(rounded)) {
    return String(rounded);
  }
  return rounded.toFixed(digits);
}

function resourceSnapshot() {
  return {
    matter: roundMetric(state.resources.matter, 2),
    fire: roundMetric(state.resources.fire, 2),
    shards: roundMetric(state.resources.shards, 2),
    glyphDust: roundMetric(state.resources.glyphDust, 2)
  };
}

function multiplierSnapshot() {
  return {
    production: roundMetric(state.perks.productionMultiplier, 4),
    matter: roundMetric(state.perks.matterRateMultiplier, 4),
    fire: roundMetric(state.perks.fireRateMultiplier, 4),
    growth: roundMetric(state.perks.generatorCostGrowthMultiplier, 4)
  };
}

function generatorSnapshot(def) {
  const level = state.generators[def.id] || 0;
  const cost = formulas.generatorCost(def, level, state.perks.generatorCostGrowthMultiplier);
  const available = state.resources[def.costResource] || 0;
  return {
    id: def.id,
    level,
    cost,
    costResource: def.costResource,
    affordable: available >= cost
  };
}

function telemetryLog(event, payload = {}) {
  if (!telemetryState.enabled) {
    return;
  }
  console.log("[balance-telemetry]", {
    event,
    t: Date.now(),
    ...payload
  });
}

function setTelemetryEnabled(enabled) {
  telemetryState.enabled = Boolean(enabled);
  telemetryState.tickCounter = 0;
  telemetryState.transmuteCounter = 0;
  console.log("[balance-telemetry]", {
    event: "telemetry:state",
    t: Date.now(),
    enabled: telemetryState.enabled
  });
}

function isTelemetryEnabled() {
  return telemetryState.enabled;
}

const renderer = createRenderer({
  appEl,
  state,
  balance: BALANCE,
  currencyDisplay: CURRENCY_DISPLAY,
  generatorDefs,
  formulas,
  systems,
  debugOptions: {
    isTelemetryEnabled,
    setTelemetryEnabled
  },
  saveSlots: {
    slots: listSlots(),
    activeSlotId,
    onSelect: (slotId) => {
      state.meta.offlineEligible = false;
      saveState(state, activeSlotId);
      setActiveSlot(slotId);
      window.location.reload();
    },
    onReset: (slotId) => {
      resetSlot(slotId);
      if (slotId === activeSlotId) {
        window.location.reload();
      }
    }
  }
});

const offline = applyOfflineProgress(
  state,
  BALANCE,
  resourceManager,
  generatorDefs,
  formulas,
  (elapsedSeconds) => {
    systems.expeditions.advance(elapsedSeconds, BALANCE.expeditions?.offlineProgressMultiplier || 0.5);
    systems.labyrinth.advance(elapsedSeconds, BALANCE.labyrinth?.offlineProgressMultiplier || 0.5);
  }
);
if (offline.elapsedSeconds > 5) {
  renderer.setNotice(
    `Offline gains: +${formatIntOrFixed(offline.matterGain)} Matter, +${formatIntOrFixed(offline.fireGain)} Fire.`,
    true
  );
}

const tickSystem = createTickSystem({
  state,
  balance: BALANCE,
  generatorDefs,
  resourceManager,
  eventBus,
  onAdvance: (dtSeconds) => {
    systems.expeditions.advance(dtSeconds, 1);
    systems.labyrinth.advance(dtSeconds, 1);
  }
});

setInterval(() => {
  state.meta.offlineEligible = true;
  saveState(state, activeSlotId);
}, BALANCE.autoSaveMs);

window.addEventListener("beforeunload", () => {
  state.meta.offlineEligible = true;
  saveState(state, activeSlotId);
});

window.addEventListener("keydown", (event) => {
  const key = typeof event.key === "string" ? event.key.toLowerCase() : "";
  if (!(event.ctrlKey && event.shiftKey && key === "d")) {
    return;
  }
  const tagName = event.target?.tagName;
  if (tagName === "INPUT" || tagName === "TEXTAREA" || tagName === "SELECT") {
    return;
  }
  event.preventDefault();
  renderer.toggleDebugPanel();
});

eventBus.on("tick", ({ rates, dtSeconds }) => {
  renderer.refreshHud();

  if (!telemetryState.enabled) {
    return;
  }

  telemetryState.tickCounter += 1;
  if (telemetryState.tickCounter % DEBUG_TICK_SAMPLE_EVERY !== 0) {
    return;
  }

  telemetryLog("tick", {
    dtSeconds: roundMetric(dtSeconds, 3),
    rates: {
      matter: roundMetric(rates.matter, 3),
      fire: roundMetric(rates.fire, 3)
    },
    resources: resourceSnapshot(),
    multipliers: multiplierSnapshot(),
    generators: Object.values(generatorDefs).map(generatorSnapshot)
  });
});

eventBus.on("generator:purchased", ({ generatorId, newLevel, cost }) => {
  const def = generatorDefs[generatorId];
  telemetryLog("generator:purchased", {
    generatorId,
    level: newLevel,
    cost,
    costResource: def?.costResource || "matter",
    resources: resourceSnapshot(),
    multipliers: multiplierSnapshot()
  });
});

eventBus.on("upgrade:purchased", ({ upgradeId, tier }) => {
  telemetryLog("upgrade:purchased", {
    upgradeId,
    tier,
    nextCost: systems.upgrades.getCost(upgradeId),
    resources: resourceSnapshot(),
    multipliers: multiplierSnapshot()
  });
});

eventBus.on("research:leveled", ({ researchId, level }) => {
  telemetryLog("research:leveled", {
    researchId,
    level,
    nextCost: systems.research.getCost(researchId),
    resources: resourceSnapshot(),
    multipliers: multiplierSnapshot()
  });
});

eventBus.on("action:convert", ({ cost, out }) => {
  telemetryLog("action:convert", {
    cost,
    out: roundMetric(out, 3),
    resources: resourceSnapshot(),
    multipliers: multiplierSnapshot()
  });
});

eventBus.on("action:ascend", ({ gain, total, cost }) => {
  telemetryLog("action:ascend", {
    gain,
    total,
    cost,
    resources: resourceSnapshot(),
    multipliers: multiplierSnapshot()
  });
});

eventBus.on("action:transmute", ({ amount }) => {
  if (!telemetryState.enabled) {
    return;
  }
  telemetryState.transmuteCounter += 1;
  if (telemetryState.transmuteCounter % TRANSMUTE_LOG_SAMPLE_EVERY !== 0) {
    return;
  }
  telemetryLog("action:transmute:sample", {
    sampleEvery: TRANSMUTE_LOG_SAMPLE_EVERY,
    amount: roundMetric(amount, 3),
    totalClicks: state.lifetime.totalClicks,
    resources: resourceSnapshot()
  });
});

eventBus.on("expedition:continuousStopped", ({ reasonKey, reason }) => {
  if (reasonKey === "cancelled") {
    return;
  }
  renderer.setNotice(`Expedition loop stopped: ${reason || "unknown reason"}.`, false);
});

eventBus.on("expedition:claim", ({ drops }) => {
  renderer.showRareDropPopup(drops);
});

eventBus.on("labyrinth:complete", ({ relicDrops }) => {
  const dropCount = Array.isArray(relicDrops) ? relicDrops.length : 0;
  renderer.setNotice(
    dropCount > 0
      ? `Labyrinth route complete. ${dropCount} relic drop${dropCount === 1 ? "" : "s"} ready to claim.`
      : "Labyrinth route complete. Rewards ready to claim.",
    true
  );
});

eventBus.on("labyrinth:claim", ({ discoveries }) => {
  const discoveryCount = Math.max(0, Number(discoveries) || 0);
  renderer.setNotice(
    discoveryCount > 0
      ? `Labyrinth rewards claimed. ${discoveryCount} new relic discover${discoveryCount === 1 ? "y" : "ies"}.`
      : "Labyrinth rewards claimed.",
    true
  );
});

renderer.start();
tickSystem.start();

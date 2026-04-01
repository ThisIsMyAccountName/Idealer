import { BALANCE } from "./config/gameBalance.js";
import { createEventBus } from "./engine/eventBus.js";
import { createInitialState, sanitizeState } from "./engine/gameState.js";
import * as formulas from "./engine/formulas.js";
import { createTickSystem } from "./engine/tickSystem.js";
import { ASCEND_TREE } from "./config/ascendTree.js";
import { createAscendTreeSystem } from "./game/ascendTreeSystem.js";
import { createExpeditionSystem } from "./game/expeditionSystem.js";
import { createGeneratorSystem } from "./game/generatorSystem.js";
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
  expeditions: null
};
systems.expeditions = createExpeditionSystem({
  state,
  resourceManager,
  eventBus,
  balance: BALANCE,
  shipSystem: systems.ships
});
systems.actions = createProgressionActions({ state, resourceManager, eventBus, recompute, expeditionSystem: systems.expeditions });

const renderer = createRenderer({
  appEl,
  state,
  balance: BALANCE,
  generatorDefs,
  formulas,
  systems,
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
  }
);
if (offline.elapsedSeconds > 5) {
  renderer.setNotice(
    `Offline gains: +${offline.matterGain.toFixed(1)} Matter, +${offline.fireGain.toFixed(1)} Fire.`,
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

eventBus.on("tick", () => {
  renderer.refreshHud();
});

renderer.start();
tickSystem.start();

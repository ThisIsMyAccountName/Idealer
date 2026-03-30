import { BALANCE } from "./config/gameBalance.js";
import { createEventBus } from "./engine/eventBus.js";
import { createInitialState, sanitizeState } from "./engine/gameState.js";
import * as formulas from "./engine/formulas.js";
import { createTickSystem } from "./engine/tickSystem.js";
import { createGeneratorSystem } from "./game/generatorSystem.js";
import { recomputePerks } from "./game/modifiers.js";
import { createProgressionActions } from "./game/progressionActions.js";
import { createResearchSystem } from "./game/researchSystem.js";
import { createResourceManager } from "./game/resourceManager.js";
import { createUpgradesSystem } from "./game/upgradesSystem.js";
import { applyOfflineProgress, loadState, saveState } from "./persistence/saveSystem.js";
import { createRenderer } from "./ui/render.js";

const appEl = document.querySelector("#app");
const eventBus = createEventBus();
const state = sanitizeState(loadState() || createInitialState());

const generatorDefs = BALANCE.generators;
const upgradeDefs = BALANCE.upgrades;
const researchDefs = BALANCE.research;
const resourceManager = createResourceManager(state);
const recompute = () => recomputePerks({ state, balance: BALANCE });

recompute();

const systems = {
  generators: createGeneratorSystem({ state, generatorDefs, resourceManager, eventBus }),
  upgrades: createUpgradesSystem({ state, upgradeDefs, resourceManager, eventBus, recompute }),
  research: createResearchSystem({ state, researchDefs, resourceManager, eventBus, recompute }),
  actions: createProgressionActions({ state, resourceManager, eventBus, recompute })
};

const renderer = createRenderer({
  appEl,
  state,
  balance: BALANCE,
  generatorDefs,
  formulas,
  systems
});

const offline = applyOfflineProgress(state, BALANCE, resourceManager, generatorDefs, formulas);
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
  eventBus
});

setInterval(() => {
  saveState(state);
}, BALANCE.autoSaveMs);

window.addEventListener("beforeunload", () => {
  saveState(state);
});

eventBus.on("tick", () => {
  renderer.invalidate();
});

renderer.start();
tickSystem.start();

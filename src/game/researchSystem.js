import { isUnlockMet } from "./unlockRules.js";

export function researchCost(def, currentLevel) {
  return Math.floor(def.baseCost * Math.pow(def.costGrowth, currentLevel));
}

export function createResearchSystem({ state, researchDefs, resourceManager, eventBus, recompute }) {
  function isUnlocked(researchId) {
    const def = researchDefs[researchId];
    if (!def) {
      return false;
    }
    return isUnlockMet(state, def.unlock);
  }

  function levelUp(researchId) {
    const def = researchDefs[researchId];
    if (!def) {
      return { ok: false, reason: "Unknown research." };
    }

    const currentLevel = state.research[researchId] || 0;
    if (currentLevel >= def.maxLevel) {
      return { ok: false, reason: "Research at max level." };
    }
    if (!isUnlocked(researchId)) {
      return { ok: false, reason: "Research not unlocked yet." };
    }

    const cost = researchCost(def, currentLevel);
    if (!resourceManager.spend(def.costResource, cost)) {
      return { ok: false, reason: `Need ${cost} ${def.costResource}.` };
    }

    state.research[researchId] = currentLevel + 1;
    recompute();
    eventBus.emit("research:leveled", { researchId, level: currentLevel + 1 });
    return { ok: true };
  }

  return { levelUp, isUnlocked };
}

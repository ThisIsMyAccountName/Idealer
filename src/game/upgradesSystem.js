import { isUnlockMet } from "./unlockRules.js";

export function createUpgradesSystem({ state, upgradeDefs, resourceManager, eventBus, recompute }) {
  function isUnlocked(upgradeId) {
    const def = upgradeDefs[upgradeId];
    if (!def) {
      return false;
    }
    return isUnlockMet(state, def.unlock);
  }

  function buy(upgradeId) {
    const def = upgradeDefs[upgradeId];
    if (!def) {
      return { ok: false, reason: "Unknown upgrade." };
    }
    if (state.upgrades[upgradeId]) {
      return { ok: false, reason: "Already purchased." };
    }
    if (!isUnlocked(upgradeId)) {
      return { ok: false, reason: "Upgrade not unlocked yet." };
    }
    if (!resourceManager.spend(def.costResource, def.cost)) {
      return { ok: false, reason: `Not enough ${def.costResource}.` };
    }

    state.upgrades[upgradeId] = true;
    recompute();
    eventBus.emit("upgrade:purchased", { upgradeId });
    return { ok: true };
  }

  return { buy, isUnlocked };
}

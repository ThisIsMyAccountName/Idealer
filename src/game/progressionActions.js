import { BALANCE } from "../config/gameBalance.js";
import { prestigeShardGain } from "../engine/formulas.js";

export function createProgressionActions({ state, resourceManager, eventBus, recompute }) {
  function manualTransmute() {
    const amount = BALANCE.baseClickMatter + state.perks.clickMatterBonus;
    resourceManager.add("matter", amount);
    state.lifetime.totalClicks += 1;
    eventBus.emit("action:transmute", { amount });
  }

  function convertMatterToFire() {
    const cost = BALANCE.elementConversionCost;
    if (!resourceManager.spend("matter", cost)) {
      return { ok: false, reason: `Need ${cost} Matter.` };
    }
    const out = 1 + state.perks.conversionFireBonus;
    resourceManager.add("fire", out);
    eventBus.emit("action:convert", { cost, out });
    return { ok: true };
  }

  function ascend() {
    const gain = prestigeShardGain(state);
    if (gain < 1) {
      return { ok: false, reason: "Ascension not ready." };
    }

    state.resources.shards += gain;
    state.lifetime.totalAscensions += 1;
    state.perks.productionMultiplier = 1 + state.resources.shards * 0.02;

    state.resources.matter = 0;
    state.resources.fire = 0;
    Object.keys(state.generators).forEach((key) => {
      state.generators[key] = 0;
    });

    state.upgrades = {};
    state.research = {};
    recompute();

    eventBus.emit("action:ascend", { gain, total: state.resources.shards });
    return { ok: true, gain };
  }

  return { manualTransmute, convertMatterToFire, ascend };
}

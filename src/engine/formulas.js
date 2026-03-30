import { BALANCE } from "../config/gameBalance.js";

export function generatorCost(generatorDef, level) {
  return Math.floor(generatorDef.baseCost * Math.pow(BALANCE.generatorCostGrowth, level));
}

export function productionPerSecond(state, generatorDefs) {
  const rates = {
    matter: 0,
    fire: 0
  };

  Object.values(generatorDefs).forEach((def) => {
    const level = state.generators[def.id] || 0;
    if (level <= 0) {
      return;
    }
    rates[def.resource] += def.baseRate * level;
  });

  rates.matter *= state.perks.productionMultiplier * state.perks.matterRateMultiplier;
  rates.fire *= state.perks.productionMultiplier * state.perks.fireRateMultiplier;
  return rates;
}

export function prestigeShardGain(state) {
  const sumSeen = state.lifetime.matterSeen + state.lifetime.fireSeen * 100;
  const raw = Math.floor(Math.sqrt(sumSeen) / BALANCE.prestigeDivisor);
  return Math.floor(raw * state.perks.prestigeGainMultiplier);
}

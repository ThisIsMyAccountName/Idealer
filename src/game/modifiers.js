export function recomputePerks({ state, balance }) {
  const perks = {
    productionMultiplier: 1 + state.resources.shards * 0.02,
    matterRateMultiplier: 1,
    fireRateMultiplier: 1,
    clickMatterBonus: 0,
    conversionFireBonus: 0,
    prestigeGainMultiplier: 1
  };

  if (state.upgrades.kineticGloves) {
    perks.clickMatterBonus += 1;
  }
  if (state.upgrades.alloyIntake) {
    perks.matterRateMultiplier *= 1.2;
  }
  if (state.upgrades.emberCatalyst) {
    perks.fireRateMultiplier *= 1.25;
  }
  if (state.upgrades.thermalLens) {
    perks.conversionFireBonus += 1;
  }

  const thermoLevel = state.research.arcaneThermodynamics || 0;
  if (thermoLevel > 0) {
    perks.matterRateMultiplier *= 1 + thermoLevel * 0.1;
  }

  const latticeLevel = state.research.crystalLattice || 0;
  if (latticeLevel > 0) {
    perks.fireRateMultiplier *= 1 + latticeLevel * 0.15;
  }

  const shardTheoryLevel = state.research.shardTheory || 0;
  if (shardTheoryLevel > 0) {
    perks.prestigeGainMultiplier *= 1 + shardTheoryLevel * 0.05;
  }

  state.perks = perks;
  return perks;
}

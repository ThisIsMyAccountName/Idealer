export function createInitialState() {
  return {
    meta: {
      version: "0.2.0",
      startedAt: Date.now(),
      lastTickAt: Date.now(),
      lastSavedAt: Date.now(),
      offlineEligible: true
    },
    resources: {
      matter: 0,
      fire: 0,
      shards: 0
    },
    lifetime: {
      matterSeen: 0,
      fireSeen: 0,
      totalClicks: 0,
      totalAscensions: 0
    },
    generators: {
      furnace: 0,
      condenser: 0,
      prism: 0
    },
    upgrades: {},
    research: {},
    ascensionTree: {},
    perks: {
      productionMultiplier: 1,
      matterRateMultiplier: 1,
      fireRateMultiplier: 1,
      clickMatterBonus: 0,
      clickMultiplier: 1,
      clickCritChance: 0,
      clickCritMultiplier: 1.5,
      clickFireBonus: 0,
      conversionFireBonus: 0,
      conversionYieldMultiplier: 1,
      conversionCostFlatReduction: 0,
      conversionRefundFraction: 0,
      prestigeGainMultiplier: 1,
      generatorCostGrowthMultiplier: 1,
      furnaceRateMultiplier: 1,
      condenserRateMultiplier: 1,
      prismRateMultiplier: 1,
      conversionCostMultiplier: 1,
      offlineEfficiencyMultiplier: 1,
      researchCostMultiplier: 1
    }
  };
}

export function sanitizeState(state) {
  const safe = createInitialState();
  if (!state || typeof state !== "object") {
    return safe;
  }

  safe.meta = { ...safe.meta, ...(state.meta || {}) };
  safe.resources = { ...safe.resources, ...(state.resources || {}) };
  safe.lifetime = { ...safe.lifetime, ...(state.lifetime || {}) };
  safe.generators = { ...safe.generators, ...(state.generators || {}) };
  safe.upgrades = { ...safe.upgrades, ...(state.upgrades || {}) };
  safe.research = { ...safe.research, ...(state.research || {}) };
  safe.ascensionTree = { ...safe.ascensionTree, ...(state.ascensionTree || {}) };
  safe.perks = { ...safe.perks, ...(state.perks || {}) };

  Object.keys(safe.resources).forEach((key) => {
    safe.resources[key] = Math.max(0, Number(safe.resources[key]) || 0);
  });
  Object.keys(safe.generators).forEach((key) => {
    safe.generators[key] = Math.max(0, Math.floor(Number(safe.generators[key]) || 0));
  });
  Object.keys(safe.upgrades).forEach((key) => {
    const raw = safe.upgrades[key];
    if (raw === true) {
      safe.upgrades[key] = 1;
    } else if (raw === false) {
      safe.upgrades[key] = 0;
    } else {
      safe.upgrades[key] = Math.max(0, Math.floor(Number(raw) || 0));
    }
  });
  Object.keys(safe.research).forEach((key) => {
    safe.research[key] = Math.max(0, Math.floor(Number(safe.research[key]) || 0));
  });
  Object.keys(safe.ascensionTree).forEach((key) => {
    safe.ascensionTree[key] = Boolean(safe.ascensionTree[key]);
  });
  safe.perks.productionMultiplier = Math.max(1, Number(safe.perks.productionMultiplier) || 1);
  safe.perks.matterRateMultiplier = Math.max(1, Number(safe.perks.matterRateMultiplier) || 1);
  safe.perks.fireRateMultiplier = Math.max(1, Number(safe.perks.fireRateMultiplier) || 1);
  safe.perks.clickMatterBonus = Math.max(0, Number(safe.perks.clickMatterBonus) || 0);
  safe.perks.clickMultiplier = Math.max(0.1, Number(safe.perks.clickMultiplier) || 1);
  safe.perks.clickCritChance = Math.max(0, Number(safe.perks.clickCritChance) || 0);
  safe.perks.clickCritMultiplier = Math.max(1, Number(safe.perks.clickCritMultiplier) || 1.5);
  safe.perks.clickFireBonus = Math.max(0, Number(safe.perks.clickFireBonus) || 0);
  safe.perks.conversionFireBonus = Math.max(0, Number(safe.perks.conversionFireBonus) || 0);
  safe.perks.conversionYieldMultiplier = Math.max(0.1, Number(safe.perks.conversionYieldMultiplier) || 1);
  safe.perks.conversionCostFlatReduction = Math.max(0, Number(safe.perks.conversionCostFlatReduction) || 0);
  safe.perks.conversionRefundFraction = Math.max(0, Number(safe.perks.conversionRefundFraction) || 0);
  safe.perks.prestigeGainMultiplier = Math.max(1, Number(safe.perks.prestigeGainMultiplier) || 1);
  safe.perks.generatorCostGrowthMultiplier = Math.max(0.7, Number(safe.perks.generatorCostGrowthMultiplier) || 1);
  safe.perks.furnaceRateMultiplier = Math.max(0.1, Number(safe.perks.furnaceRateMultiplier) || 1);
  safe.perks.condenserRateMultiplier = Math.max(0.1, Number(safe.perks.condenserRateMultiplier) || 1);
  safe.perks.prismRateMultiplier = Math.max(0.1, Number(safe.perks.prismRateMultiplier) || 1);
  safe.perks.conversionCostMultiplier = Math.max(0.5, Number(safe.perks.conversionCostMultiplier) || 1);
  safe.perks.offlineEfficiencyMultiplier = Math.max(0.5, Number(safe.perks.offlineEfficiencyMultiplier) || 1);
  safe.perks.researchCostMultiplier = Math.max(0.5, Number(safe.perks.researchCostMultiplier) || 1);

  return safe;
}

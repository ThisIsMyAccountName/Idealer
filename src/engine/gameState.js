export function createInitialState() {
  return {
    meta: {
      version: "0.4.0",
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
      totalAscensions: 0,
      expeditionRuns: 0,
      expeditionWins: 0,
      expeditionLosses: 0,
      expeditionBestBand: 0
    },
    generators: {
      furnace: 0,
      condenser: 0,
      prism: 0
    },
    upgrades: {},
    research: {},
    ascensionTree: {},
    expeditions: {
      meta: {
        intel: 0,
        unlockedBands: {},
        completedRuns: 0,
        failedRuns: 0,
        bestBand: 0
      },
      selectedShip: "raft",
      ships: {
        raft: {
          acquired: true,
          facilities: {
            hull: 0,
            sail: 0,
            anchor: 0,
            net: 0
          },
          equippedParts: {
            hull: null,
            sail: null,
            anchor: null,
            net: null
          }
        },
        sloop: {
          acquired: false,
          facilities: {
            hull: 0,
            sail: 0,
            anchor: 0,
            net: 0
          },
          equippedParts: {
            hull: null,
            sail: null,
            anchor: null,
            net: null
          }
        },
        brig: {
          acquired: false,
          facilities: {
            hull: 0,
            sail: 0,
            anchor: 0,
            net: 0
          },
          equippedParts: {
            hull: null,
            sail: null,
            anchor: null,
            net: null
          }
        },
        galleon: {
          acquired: false,
          facilities: {
            hull: 0,
            sail: 0,
            anchor: 0,
            net: 0
          },
          equippedParts: {
            hull: null,
            sail: null,
            anchor: null,
            net: null
          }
        }
      },
      blueprintInventory: {},
      partInventory: {},
      activeRun: null,
      pendingRewards: null
    },
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
      researchCostMultiplier: 1,
      expeditionYieldMultiplier: 1,
      expeditionSpeedMultiplier: 1,
      expeditionRiskMitigation: 0,
      expeditionShardBonus: 0,
      expeditionIntelMultiplier: 1
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
  safe.expeditions = {
    ...safe.expeditions,
    ...(state.expeditions || {}),
    meta: {
      ...safe.expeditions.meta,
      ...(state.expeditions?.meta || {})
    }
  };
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
  Object.keys(safe.expeditions.meta.unlockedBands).forEach((key) => {
    safe.expeditions.meta.unlockedBands[key] = Boolean(safe.expeditions.meta.unlockedBands[key]);
  });
  const defaultShip = "raft";
  const shipIds = Object.keys(safe.expeditions.ships);
  if (typeof safe.expeditions.selectedShip !== "string" || !shipIds.includes(safe.expeditions.selectedShip)) {
    safe.expeditions.selectedShip = defaultShip;
  }
  shipIds.forEach((shipId) => {
    const ship = safe.expeditions.ships[shipId] || {};
    ship.acquired = Boolean(ship.acquired);
    ship.facilities = {
      hull: Math.max(0, Math.floor(Number(ship.facilities?.hull) || 0)),
      sail: Math.max(0, Math.floor(Number(ship.facilities?.sail) || 0)),
      anchor: Math.max(0, Math.floor(Number(ship.facilities?.anchor) || 0)),
      net: Math.max(0, Math.floor(Number(ship.facilities?.net) || 0))
    };
    ship.equippedParts = {
      hull: typeof ship.equippedParts?.hull === "string" ? ship.equippedParts.hull : null,
      sail: typeof ship.equippedParts?.sail === "string" ? ship.equippedParts.sail : null,
      anchor: typeof ship.equippedParts?.anchor === "string" ? ship.equippedParts.anchor : null,
      net: typeof ship.equippedParts?.net === "string" ? ship.equippedParts.net : null
    };
    safe.expeditions.ships[shipId] = ship;
  });
  if (!safe.expeditions.ships.raft?.acquired) {
    safe.expeditions.ships.raft.acquired = true;
  }
  Object.keys(safe.expeditions.blueprintInventory || {}).forEach((key) => {
    safe.expeditions.blueprintInventory[key] = Math.max(0, Math.floor(Number(safe.expeditions.blueprintInventory[key]) || 0));
  });
  Object.keys(safe.expeditions.partInventory || {}).forEach((key) => {
    safe.expeditions.partInventory[key] = Math.max(0, Math.floor(Number(safe.expeditions.partInventory[key]) || 0));
  });
  safe.expeditions.meta.intel = Math.max(0, Number(safe.expeditions.meta.intel) || 0);
  safe.expeditions.meta.completedRuns = Math.max(0, Math.floor(Number(safe.expeditions.meta.completedRuns) || 0));
  safe.expeditions.meta.failedRuns = Math.max(0, Math.floor(Number(safe.expeditions.meta.failedRuns) || 0));
  safe.expeditions.meta.bestBand = Math.max(0, Math.floor(Number(safe.expeditions.meta.bestBand) || 0));
  if (!safe.expeditions.activeRun || typeof safe.expeditions.activeRun !== "object") {
    safe.expeditions.activeRun = null;
  }
  if (!safe.expeditions.pendingRewards || typeof safe.expeditions.pendingRewards !== "object") {
    safe.expeditions.pendingRewards = null;
  }
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
  safe.perks.expeditionYieldMultiplier = Math.max(0.25, Number(safe.perks.expeditionYieldMultiplier) || 1);
  safe.perks.expeditionSpeedMultiplier = Math.max(0.25, Number(safe.perks.expeditionSpeedMultiplier) || 1);
  safe.perks.expeditionRiskMitigation = Math.max(0, Number(safe.perks.expeditionRiskMitigation) || 0);
  safe.perks.expeditionShardBonus = Math.max(0, Number(safe.perks.expeditionShardBonus) || 0);
  safe.perks.expeditionIntelMultiplier = Math.max(0.25, Number(safe.perks.expeditionIntelMultiplier) || 1);

  return safe;
}

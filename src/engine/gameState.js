const CURRENT_STATE_VERSION = "0.6.0";
const PART_TIER_SUFFIX_RE = /@t(\d+)$/i;
const COLLECTION_ITEM_KEY_SEPARATOR = "::";

function createCollectionItemKey(sourceId, itemId) {
  const cleanItemId = typeof itemId === "string" ? itemId.trim() : "";
  if (!cleanItemId) {
    return "";
  }
  const cleanSourceId = typeof sourceId === "string" ? sourceId.trim() : "";
  const resolvedSourceId = cleanSourceId || "expeditionRareDrops";
  return `${resolvedSourceId}${COLLECTION_ITEM_KEY_SEPARATOR}${cleanItemId}`;
}

function parseCollectionItemKey(rawKey) {
  if (typeof rawKey !== "string") {
    return null;
  }
  const key = rawKey.trim();
  if (!key) {
    return null;
  }
  const separatorIndex = key.indexOf(COLLECTION_ITEM_KEY_SEPARATOR);
  if (separatorIndex <= 0) {
    return {
      sourceId: "expeditionRareDrops",
      itemId: key
    };
  }
  const sourceId = key.slice(0, separatorIndex).trim();
  const itemId = key.slice(separatorIndex + COLLECTION_ITEM_KEY_SEPARATOR.length).trim();
  if (!sourceId || !itemId) {
    return null;
  }
  return { sourceId, itemId };
}

function clampInt(value, min = 0, max = Number.MAX_SAFE_INTEGER) {
  const parsed = Math.floor(Number(value) || 0);
  return Math.min(max, Math.max(min, parsed));
}

function sanitizeRewardPayload(rewards) {
  return {
    matter: clampInt(rewards?.matter),
    fire: clampInt(rewards?.fire),
    shards: clampInt(rewards?.shards),
    intel: clampInt(rewards?.intel)
  };
}

function createPartRef(partId, tier = 1) {
  const cleanPartId = typeof partId === "string" ? partId.trim() : "";
  if (!cleanPartId) {
    return "";
  }
  const safeTier = clampInt(tier, 1, 99);
  return safeTier <= 1 ? cleanPartId : `${cleanPartId}@t${safeTier}`;
}

function parsePartRef(partRef) {
  if (typeof partRef !== "string") {
    return null;
  }
  const raw = partRef.trim();
  if (!raw) {
    return null;
  }
  const match = raw.match(PART_TIER_SUFFIX_RE);
  if (!match) {
    return { partId: raw, tier: 1, ref: raw };
  }
  const partId = raw.slice(0, match.index);
  if (!partId) {
    return null;
  }
  const tier = clampInt(match[1], 1, 99);
  return {
    partId,
    tier,
    ref: createPartRef(partId, tier)
  };
}

function sanitizePartRef(partRef) {
  const parsed = parsePartRef(partRef);
  return parsed ? parsed.ref : null;
}

function normalizePartInventoryMap(partInventory) {
  const source = partInventory && typeof partInventory === "object" ? partInventory : {};
  const normalized = {};
  Object.entries(source).forEach(([rawRef, value]) => {
    const parsed = parsePartRef(rawRef);
    if (!parsed) {
      return;
    }
    const count = clampInt(value);
    if (count <= 0) {
      return;
    }
    normalized[parsed.ref] = (normalized[parsed.ref] || 0) + count;
  });
  return normalized;
}

function sanitizeChestItem(item) {
  if (!item || typeof item !== "object") {
    return null;
  }

  const routeHistory = Array.isArray(item.routeHistory)
    ? item.routeHistory
      .map((step) => ({
        stage: clampInt(step?.stage, 0),
        id: typeof step?.id === "string" ? step.id : "",
        name: typeof step?.name === "string" ? step.name : ""
      }))
      .filter((step) => step.id || step.name)
    : [];

  const encounters = Array.isArray(item.encounters)
    ? item.encounters
      .map((entry) => ({
        stage: clampInt(entry?.stage, 0),
        poolId: typeof entry?.poolId === "string" ? entry.poolId : "",
        name: typeof entry?.name === "string" ? entry.name : "",
        description: typeof entry?.description === "string" ? entry.description : "",
        success: Boolean(entry?.success),
        drop: typeof entry?.drop === "string" ? entry.drop : ""
      }))
      .filter((entry) => entry.name)
    : [];

  const drops = Array.isArray(item.drops)
    ? item.drops
      .map((drop) => ({
        id: typeof drop?.id === "string" ? drop.id : "",
        name: typeof drop?.name === "string" ? drop.name : "",
        rarity: typeof drop?.rarity === "string" ? drop.rarity : "rare",
        blueprintForShip: typeof drop?.blueprintForShip === "string" ? drop.blueprintForShip : null,
        slot: typeof drop?.slot === "string" ? drop.slot : null,
        shipId: typeof drop?.shipId === "string" ? drop.shipId : null,
        effects: drop?.effects && typeof drop.effects === "object" ? drop.effects : null
      }))
      .filter((drop) => drop.id)
    : [];

  return {
    success: Boolean(item.success),
    bandId: typeof item.bandId === "string" ? item.bandId : "",
    bandName: typeof item.bandName === "string" ? item.bandName : "Unknown Voyage",
    finalRisk: Math.max(0, Number(item.finalRisk) || 0),
    shipId: typeof item.shipId === "string" ? item.shipId : null,
    routeHistory,
    encounters,
    drops,
    rewards: sanitizeRewardPayload(item.rewards),
    completedAt: clampInt(item.completedAt, 0)
  };
}

export function createInitialState() {
  return {
    meta: {
      version: CURRENT_STATE_VERSION,
      startedAt: Date.now(),
      lastTickAt: Date.now(),
      lastSavedAt: Date.now(),
      offlineEligible: true
    },
    resources: {
      matter: 0,
      fire: 0,
      shards: 0,
      glyphDust: 0
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
        purchasedVoyages: {},
        completedRuns: 0,
        failedRuns: 0,
        bestBand: 0,
        autoRouteMode: "manual",
        continuous: {
          active: false,
          bandId: null,
          stopReason: ""
        }
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
      mapInventory: {},
      partInventory: {},
      collection: {
        discoveredItems: {},
        claimedMilestones: {},
        legacyBackfillDone: false
      },
      rewardsChest: {
        capacity: 10,
        items: []
      },
      activeRun: null,
      pendingRewards: null
    },
    labyrinth: {
      meta: {
        completedPuzzles: 0,
        bestDepth: 0,
        totalNodesResolved: 0,
        totalGlyphDustEarned: 0
      },
      activePuzzle: null,
      pendingRewards: null,
      unlocks: {}
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
      expeditionIntelMultiplier: 1,
      partTierCapBonus: 0,
      facilityMaxLevelBonus: 0,
      rewardsChestCapacityBonus: 0
    }
  };
}

export function sanitizeState(state) {
  const safe = createInitialState();
  if (!state || typeof state !== "object") {
    return safe;
  }

  safe.meta = { ...safe.meta, ...(state.meta || {}) };
  safe.meta.version = CURRENT_STATE_VERSION;
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
    },
    collection: {
      ...safe.expeditions.collection,
      ...(state.expeditions?.collection || {})
    }
  };
  safe.labyrinth = {
    ...safe.labyrinth,
    ...(state.labyrinth || {}),
    meta: {
      ...safe.labyrinth.meta,
      ...(state.labyrinth?.meta || {})
    },
    unlocks: {
      ...safe.labyrinth.unlocks,
      ...(state.labyrinth?.unlocks || {})
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
  const purchasedVoyages = safe.expeditions.meta.purchasedVoyages && typeof safe.expeditions.meta.purchasedVoyages === "object"
    ? safe.expeditions.meta.purchasedVoyages
    : {};
  Object.keys(purchasedVoyages).forEach((key) => {
    purchasedVoyages[key] = Boolean(purchasedVoyages[key]);
  });
  safe.expeditions.meta.purchasedVoyages = purchasedVoyages;
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
      hull: sanitizePartRef(ship.equippedParts?.hull),
      sail: sanitizePartRef(ship.equippedParts?.sail),
      anchor: sanitizePartRef(ship.equippedParts?.anchor),
      net: sanitizePartRef(ship.equippedParts?.net)
    };
    safe.expeditions.ships[shipId] = ship;
  });
  if (!safe.expeditions.ships.raft?.acquired) {
    safe.expeditions.ships.raft.acquired = true;
  }
  Object.keys(safe.expeditions.blueprintInventory || {}).forEach((key) => {
    safe.expeditions.blueprintInventory[key] = Math.max(0, Math.floor(Number(safe.expeditions.blueprintInventory[key]) || 0));
  });
  const rawMapInventory = safe.expeditions.mapInventory && typeof safe.expeditions.mapInventory === "object"
    ? safe.expeditions.mapInventory
    : {};
  const normalizedMapInventory = {};
  Object.entries(rawMapInventory).forEach(([mapId, rawCount]) => {
    if (typeof mapId !== "string") {
      return;
    }
    const id = mapId.trim();
    if (!id) {
      return;
    }
    const count = Math.max(0, Math.floor(Number(rawCount) || 0));
    if (count <= 0) {
      return;
    }
    normalizedMapInventory[id] = count;
  });
  safe.expeditions.mapInventory = normalizedMapInventory;
  safe.expeditions.partInventory = normalizePartInventoryMap(safe.expeditions.partInventory);
  safe.expeditions.meta.intel = Math.max(0, Number(safe.expeditions.meta.intel) || 0);
  safe.expeditions.meta.completedRuns = Math.max(0, Math.floor(Number(safe.expeditions.meta.completedRuns) || 0));
  safe.expeditions.meta.failedRuns = Math.max(0, Math.floor(Number(safe.expeditions.meta.failedRuns) || 0));
  safe.expeditions.meta.bestBand = Math.max(0, Math.floor(Number(safe.expeditions.meta.bestBand) || 0));
  const allowedRouteModes = new Set(["manual", "safe", "balanced", "aggressive"]);
  if (!allowedRouteModes.has(safe.expeditions.meta.autoRouteMode)) {
    safe.expeditions.meta.autoRouteMode = "manual";
  }
  const continuous = safe.expeditions.meta.continuous && typeof safe.expeditions.meta.continuous === "object"
    ? safe.expeditions.meta.continuous
    : {};
  safe.expeditions.meta.continuous = {
    active: Boolean(continuous.active),
    bandId: typeof continuous.bandId === "string" ? continuous.bandId : null,
    stopReason: typeof continuous.stopReason === "string" ? continuous.stopReason : ""
  };
  if (!safe.expeditions.meta.continuous.active) {
    safe.expeditions.meta.continuous.bandId = null;
  }

  const legacyPending = sanitizeChestItem(safe.expeditions.pendingRewards);
  const chest = safe.expeditions.rewardsChest && typeof safe.expeditions.rewardsChest === "object"
    ? safe.expeditions.rewardsChest
    : {};
  const chestCapacity = clampInt(chest.capacity, 1, 200) || 10;
  const chestItems = Array.isArray(chest.items)
    ? chest.items.map(sanitizeChestItem).filter(Boolean)
    : [];
  if (legacyPending) {
    chestItems.unshift(legacyPending);
  }
  safe.expeditions.rewardsChest = {
    capacity: chestCapacity,
    items: chestItems.slice(0, chestCapacity)
  };

  const collection = safe.expeditions.collection && typeof safe.expeditions.collection === "object"
    ? safe.expeditions.collection
    : {};
  const rawDiscovered = collection.discoveredItems && typeof collection.discoveredItems === "object"
    ? collection.discoveredItems
    : {};
  const normalizedDiscovered = {};

  Object.entries(rawDiscovered).forEach(([rawKey, rawValue]) => {
    if (rawValue == null || rawValue === false) {
      return;
    }
    const parsedKey = parseCollectionItemKey(rawKey);
    const entry = rawValue && typeof rawValue === "object" ? rawValue : {};
    const sourceId = typeof entry.sourceId === "string" && entry.sourceId.trim()
      ? entry.sourceId.trim()
      : (parsedKey?.sourceId || "expeditionRareDrops");
    const itemId = typeof entry.itemId === "string" && entry.itemId.trim()
      ? entry.itemId.trim()
      : (parsedKey?.itemId || "");
    const normalizedKey = createCollectionItemKey(sourceId, itemId);
    if (!normalizedKey) {
      return;
    }
    normalizedDiscovered[normalizedKey] = {
      sourceId,
      itemId,
      name: typeof entry.name === "string" ? entry.name : "",
      rarity: typeof entry.rarity === "string" ? entry.rarity : "",
      discoveredAt: clampInt(entry.discoveredAt, 0)
    };
  });

  const rawClaimed = collection.claimedMilestones && typeof collection.claimedMilestones === "object"
    ? collection.claimedMilestones
    : {};
  const normalizedClaimed = {};
  Object.keys(rawClaimed).forEach((milestoneId) => {
    const cleanId = typeof milestoneId === "string" ? milestoneId.trim() : "";
    if (!cleanId) {
      return;
    }
    normalizedClaimed[cleanId] = Boolean(rawClaimed[milestoneId]);
  });

  safe.expeditions.collection = {
    discoveredItems: normalizedDiscovered,
    claimedMilestones: normalizedClaimed,
    legacyBackfillDone: Boolean(collection.legacyBackfillDone)
  };

  safe.labyrinth.meta.completedPuzzles = clampInt(safe.labyrinth.meta.completedPuzzles, 0);
  safe.labyrinth.meta.bestDepth = clampInt(safe.labyrinth.meta.bestDepth, 0);
  safe.labyrinth.meta.totalNodesResolved = clampInt(safe.labyrinth.meta.totalNodesResolved, 0);
  safe.labyrinth.meta.totalGlyphDustEarned = clampInt(safe.labyrinth.meta.totalGlyphDustEarned, 0);

  const rawLabyrinthUnlocks = safe.labyrinth.unlocks && typeof safe.labyrinth.unlocks === "object"
    ? safe.labyrinth.unlocks
    : {};
  const normalizedLabyrinthUnlocks = {};
  Object.keys(rawLabyrinthUnlocks).forEach((unlockId) => {
    const cleanUnlockId = typeof unlockId === "string" ? unlockId.trim() : "";
    if (!cleanUnlockId) {
      return;
    }
    normalizedLabyrinthUnlocks[cleanUnlockId] = Boolean(rawLabyrinthUnlocks[unlockId]);
  });
  safe.labyrinth.unlocks = normalizedLabyrinthUnlocks;

  safe.labyrinth.activePuzzle = safe.labyrinth.activePuzzle && typeof safe.labyrinth.activePuzzle === "object"
    ? safe.labyrinth.activePuzzle
    : null;
  safe.labyrinth.pendingRewards = safe.labyrinth.pendingRewards && typeof safe.labyrinth.pendingRewards === "object"
    ? safe.labyrinth.pendingRewards
    : null;

  if (!safe.expeditions.activeRun || typeof safe.expeditions.activeRun !== "object") {
    safe.expeditions.activeRun = null;
  }
  safe.expeditions.pendingRewards = null;
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
  safe.perks.generatorCostGrowthMultiplier = Math.max(0.2, Number(safe.perks.generatorCostGrowthMultiplier) || 1);
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
  safe.perks.partTierCapBonus = clampInt(safe.perks.partTierCapBonus, 0, 99);
  safe.perks.facilityMaxLevelBonus = clampInt(safe.perks.facilityMaxLevelBonus, 0, 99);
  safe.perks.rewardsChestCapacityBonus = clampInt(safe.perks.rewardsChestCapacityBonus, 0, 999);

  return safe;
}

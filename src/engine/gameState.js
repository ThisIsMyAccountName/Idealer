export function createInitialState() {
  return {
    meta: {
      version: "0.2.0",
      startedAt: Date.now(),
      lastTickAt: Date.now(),
      lastSavedAt: Date.now()
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
    perks: {
      productionMultiplier: 1,
      matterRateMultiplier: 1,
      fireRateMultiplier: 1,
      clickMatterBonus: 0,
      conversionFireBonus: 0,
      prestigeGainMultiplier: 1
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
  safe.perks = { ...safe.perks, ...(state.perks || {}) };

  Object.keys(safe.resources).forEach((key) => {
    safe.resources[key] = Math.max(0, Number(safe.resources[key]) || 0);
  });
  Object.keys(safe.generators).forEach((key) => {
    safe.generators[key] = Math.max(0, Math.floor(Number(safe.generators[key]) || 0));
  });
  Object.keys(safe.upgrades).forEach((key) => {
    safe.upgrades[key] = Boolean(safe.upgrades[key]);
  });
  Object.keys(safe.research).forEach((key) => {
    safe.research[key] = Math.max(0, Math.floor(Number(safe.research[key]) || 0));
  });
  safe.perks.productionMultiplier = Math.max(1, Number(safe.perks.productionMultiplier) || 1);
  safe.perks.matterRateMultiplier = Math.max(1, Number(safe.perks.matterRateMultiplier) || 1);
  safe.perks.fireRateMultiplier = Math.max(1, Number(safe.perks.fireRateMultiplier) || 1);
  safe.perks.clickMatterBonus = Math.max(0, Number(safe.perks.clickMatterBonus) || 0);
  safe.perks.conversionFireBonus = Math.max(0, Number(safe.perks.conversionFireBonus) || 0);
  safe.perks.prestigeGainMultiplier = Math.max(1, Number(safe.perks.prestigeGainMultiplier) || 1);

  return safe;
}

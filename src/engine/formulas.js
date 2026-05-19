import { BALANCE } from "../config/gameBalance.js";

export function resolveGeneratorCostGrowth(costGrowthMultiplier = 1) {
  const parsedMultiplier = Number(costGrowthMultiplier);
  const safeMultiplier = Number.isFinite(parsedMultiplier) ? parsedMultiplier : 1;
  const normalizedMultiplier = Math.max(0, safeMultiplier);
  const growthDelta = Math.max(0, BALANCE.generatorCostGrowth - 1);
  const growth = 1 + growthDelta * normalizedMultiplier;
  return Math.max(1.01, growth);
}

export function generatorCost(generatorDef, level, costGrowthMultiplier = 1) {
  const growth = resolveGeneratorCostGrowth(costGrowthMultiplier);
  const rawCost = generatorDef.baseCost * (Math.pow(growth, level + 1) / BALANCE.generatorCostGrowth);
  return Math.max(0.01, Math.round(rawCost * 100) / 100);
}

export function normalizeUpgradeCostCurve(def, curveOverride) {
  const defaults = BALANCE.upgradeCostDefaults || {};
  const defCurve = def && def.costCurve ? def.costCurve : {};
  return {
    quadCap: defaults.quadCap ?? 35,
    quadScale: defaults.quadScale ?? 0.015,
    targetEnd: defaults.targetEnd ?? 1e31,
    unlockCostFactor: defaults.unlockCostFactor ?? 1,
    autoBalance: defaults.autoBalance ?? true,
    ...defCurve,
    ...(curveOverride || {})
  };
}

export function upgradeCost(def, tier, baseCostOverride, curveOverride) {
  const baseCost = baseCostOverride ?? def.baseCost ?? def.cost ?? 1;
  const curve = normalizeUpgradeCostCurve(def, curveOverride);
  const maxTier = Math.max(1, def.maxTier ?? 1);
  const lastTierIndex = Math.max(0, maxTier - 1);
  const quadCap = Math.min(curve.quadCap, lastTierIndex);
  const quadMultiplier = 1 + curve.quadScale * Math.pow(tier + 1, 2);
  const quadMultiplierCap = 1 + curve.quadScale * Math.pow(quadCap + 1, 2);

  if (tier <= quadCap) {
    return Math.floor(baseCost * quadMultiplier);
  }

  const expSteps = Math.max(1, lastTierIndex - quadCap);
  const targetEnd = Math.max(baseCost * quadMultiplierCap, curve.targetEnd);
  const expBaseRaw = Math.pow(targetEnd / (baseCost * quadMultiplierCap), 1 / expSteps);
  const expBase = Math.max(1.02, expBaseRaw);
  const expTier = tier - quadCap;
  return Math.floor(baseCost * quadMultiplierCap * Math.pow(expBase, expTier));
}

export function productionPerSecond(state, generatorDefs) {
  const rates = {
    matter: 0,
    fire: 0
  };
  const perks = state.perks;
  let metaGen = null;

  Object.values(generatorDefs).forEach((def) => {
    if (def.meta) {
      metaGen = def;
      return;
    }
    const level = state.generators[def.id] || 0;
    if (level <= 0) {
      return;
    }
    let rate = def.baseRate * level;
    if (def.rateMultiplierPerk) {
      rate *= perks[def.rateMultiplierPerk] || 1;
    }
    if (def.synergy) {
      const synergyLevel = state.generators[def.synergy.generator] || 0;
      rate *= 1 + (perks[def.synergy.perk] || 0) * synergyLevel;
    }
    rates[def.resource] += rate;
  });

  // Aether Spire: each level feeds back a slice of pooled base production
  // into both resources. Computed before global multipliers so it never
  // recursively amplifies itself.
  if (metaGen) {
    const spireLevel = state.generators[metaGen.id] || 0;
    if (spireLevel > 0) {
      const spireMult = metaGen.rateMultiplierPerk
        ? perks[metaGen.rateMultiplierPerk] || 1
        : 1;
      const pooled = rates.matter + rates.fire;
      const bonus = metaGen.baseRate * spireLevel * spireMult * pooled;
      const split = metaGen.meta.split ?? 0.5;
      rates.matter += bonus * split;
      rates.fire += bonus * (1 - split);
    }
  }

  rates.matter *= perks.productionMultiplier * perks.matterRateMultiplier;
  rates.fire *= perks.productionMultiplier * perks.fireRateMultiplier;
  return rates;
}

export function prestigeShardGain(state) {
  const sumSeen = state.lifetime.matterSeen + state.lifetime.fireSeen * BALANCE.fireShardValue;
  const raw = Math.floor(Math.sqrt(sumSeen) / BALANCE.prestigeDivisor);
  return Math.floor(raw * state.perks.prestigeGainMultiplier);
}

export function ascendCost(state) {
  const count = state.lifetime.totalAscensions;
  return {
    matterCost: Math.floor(BALANCE.ascendBaseMatter * Math.pow(BALANCE.ascendCostGrowth, count)),
    fireCost: Math.floor(BALANCE.ascendBaseFire * Math.pow(BALANCE.ascendCostGrowth, count))
  };
}

export function ascendShardGainFromResources(state) {
  const matterLost = state.resources.matter;
  const fireLost = state.resources.fire;
  const base = matterLost + fireLost * BALANCE.fireShardValue;
  const raw = Math.floor(Math.sqrt(base) / BALANCE.prestigeDivisor);
  return Math.floor(raw * state.perks.prestigeGainMultiplier);
}

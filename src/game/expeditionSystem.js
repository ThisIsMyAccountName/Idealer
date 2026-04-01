import { isUnlockMet } from "./unlockRules.js";

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function countOwnedNodes(state) {
  return Object.values(state.ascensionTree || {}).filter(Boolean).length;
}

function clampInt(value) {
  return Math.max(0, Math.floor(Number(value) || 0));
}

function cloneRewards() {
  return {
    matter: 0,
    fire: 0,
    shards: 0,
    intel: 0
  };
}

const AUTO_ROUTE_MODES = new Set(["manual", "safe", "balanced", "aggressive"]);

export function createExpeditionSystem({ state, resourceManager, eventBus, balance, shipSystem }) {
  const expeditionBalance = balance.expeditions || {};
  const bandDefs = expeditionBalance.bands || [];
  const unlockNodeId = expeditionBalance.unlockNodeId;
  const shipDefs = expeditionBalance.ships || {};

  function getBandById(bandId) {
    return bandDefs.find((band) => band.id === bandId) || null;
  }

  function getBandRank(bandId) {
    const idx = bandDefs.findIndex((band) => band.id === bandId);
    return idx >= 0 ? idx + 1 : 1;
  }

  function getShipFallbackStats(shipId) {
    const base = shipDefs[shipId]?.baseStats || {};
    return {
      speedMultiplier: Math.max(0.25, Number(base.speedMultiplier) || 1),
      riskMitigation: Math.max(0, Number(base.riskMitigation) || 0),
      yieldMultiplier: Math.max(0.25, Number(base.yieldMultiplier) || 1),
      penaltyDampening: Math.max(0, Number(base.penaltyDampening) || 0),
      rareDropWeight: Math.max(0.1, Number(base.rareDropWeight) || 1)
    };
  }

  function getSelectedShipContext() {
    const shipId = state.expeditions.selectedShip;
    const shipState = state.expeditions.ships?.[shipId];
    if (!shipId || !shipState || !shipState.acquired) {
      return null;
    }
    const resolvedStats = shipSystem?.getShipStats?.(shipId) || getShipFallbackStats(shipId);
    return {
      shipId,
      stats: {
        speedMultiplier: Math.max(0.25, Number(resolvedStats.speedMultiplier) || 1),
        riskMitigation: Math.max(0, Number(resolvedStats.riskMitigation) || 0),
        yieldMultiplier: Math.max(0.25, Number(resolvedStats.yieldMultiplier) || 1),
        penaltyDampening: Math.max(0, Number(resolvedStats.penaltyDampening) || 0),
        rareDropWeight: Math.max(0.1, Number(resolvedStats.rareDropWeight) || 1)
      }
    };
  }

  function getDropDefsForBand(bandId) {
    const table = expeditionBalance.rareBlueprintDrops || {};
    const list = table[bandId];
    return Array.isArray(list) ? list : [];
  }

  function hasRequiredNodes(band) {
    const requiredNodes = band.requiredNodes || [];
    return requiredNodes.every((nodeId) => Boolean(state.ascensionTree[nodeId]));
  }

  function getChoiceUnlock(choice) {
    const requiredNodes = choice.requiredNodes || [];
    if (requiredNodes.length === 0) {
      return { ok: true };
    }
    const missing = requiredNodes.filter((nodeId) => !state.ascensionTree[nodeId]);
    if (missing.length > 0) {
      return {
        ok: false,
        reason: `Requires nodes: ${missing.join(", ")}.`
      };
    }
    return { ok: true };
  }

  function isBandUnlocked(bandId) {
    const band = getBandById(bandId);
    if (!band) {
      return { ok: false, reason: "Unknown expedition band." };
    }
    if (unlockNodeId && !state.ascensionTree[unlockNodeId]) {
      return { ok: false, reason: "Unlock Expedition Keystone in the Ascend tab." };
    }
    if (band.unlock && !isUnlockMet(state, band.unlock)) {
      if (band.unlock.type === "ascensionNodeCount") {
        return {
          ok: false,
          reason: `Need ${band.unlock.value} owned ascension nodes (${countOwnedNodes(state)} current).`
        };
      }
      return { ok: false, reason: "Prestige requirements not met." };
    }
    if (!hasRequiredNodes(band)) {
      return { ok: false, reason: "Missing required ascension branch nodes." };
    }
    return { ok: true };
  }

  function getBands() {
    return bandDefs.map((band, index) => {
      const unlock = isBandUnlocked(band.id);
      const rank = index + 1;
      const intelLaunchCost = getIntelLaunchCostForBand(band, Date.now(), rank);
      return {
        ...band,
        rank,
        unlock,
        intelLaunchCost
      };
    });
  }

  function roll(run) {
    const next = (1664525 * run.seed + 1013904223) >>> 0;
    run.seed = next;
    return next / 0x100000000;
  }

  function segmentDurationSeconds(run, band) {
    const total = Math.max(12, Number(band.durationSeconds) || 60);
    const stageCount = Math.max(1, run.stageCount || 1);
    const perStage = total / stageCount;
    const baseSpeed = Math.max(0.25, state.perks.expeditionSpeedMultiplier || 1);
    const shipSpeed = Math.max(0.25, run.ship?.stats?.speedMultiplier || 1);
    const routeSpeed = Math.max(0.3, run.modifiers.speedMultiplier || 1);
    return Math.max(6, perStage / (baseSpeed * shipSpeed * routeSpeed));
  }

  function makeChoicesForBand(band) {
    const choices = Array.isArray(band.routeChoices) && band.routeChoices.length > 0
      ? band.routeChoices
      : expeditionBalance.defaultRouteChoices || [];
    return choices.map((choice) => {
      const unlock = getChoiceUnlock(choice);
      return {
        ...choice,
        unlocked: unlock.ok,
        lockReason: unlock.ok ? "" : unlock.reason
      };
    });
  }

  function normalizeAutoMode(mode) {
    return AUTO_ROUTE_MODES.has(mode) ? mode : "manual";
  }

  function getPressureConfig() {
    return {
      minRank: Math.max(1, Math.floor(Number(expeditionBalance?.intelLaunchPressure?.minRank) || 3)),
      windowSeconds: Math.max(10, Number(expeditionBalance?.intelLaunchPressure?.windowSeconds) || 600),
      stackGrowth: Math.max(0.01, Number(expeditionBalance?.intelLaunchPressure?.stackGrowth) || 0.55),
      maxStacks: Math.max(1, Math.floor(Number(expeditionBalance?.intelLaunchPressure?.maxStacks) || 6)),
      maxFeeMultiplier: Math.max(1, Number(expeditionBalance?.intelLaunchPressure?.maxFeeMultiplier) || 3.5)
    };
  }

  function getPressureEntry(bandId) {
    if (!state.expeditions.meta.intelPressure || typeof state.expeditions.meta.intelPressure !== "object") {
      state.expeditions.meta.intelPressure = {};
    }
    if (!state.expeditions.meta.intelPressure[bandId] || typeof state.expeditions.meta.intelPressure[bandId] !== "object") {
      state.expeditions.meta.intelPressure[bandId] = { stacks: 0, lastLaunchAt: 0 };
    }
    return state.expeditions.meta.intelPressure[bandId];
  }

  function getBaseIntelLaunchCost(band, rankHint = null) {
    const base = Number(band?.intelLaunchCost);
    if (Number.isFinite(base) && base >= 0) {
      return base;
    }
    const rank = Math.max(1, Number(rankHint) || Number(band?.rank) || 1);
    return rank <= 2 ? 0 : rank === 3 ? 8 : 14;
  }

  function getIntelLaunchCostForBand(band, now = Date.now(), rankHint = null) {
    const rank = Math.max(1, Number(rankHint) || Number(band?.rank) || 1);
    const baseIntelCost = Math.max(0, getBaseIntelLaunchCost(band, rank));
    const pressure = getPressureConfig();
    if (rank < pressure.minRank || baseIntelCost <= 0) {
      return 0;
    }
    const entry = getPressureEntry(band.id);
    const elapsedSeconds = entry.lastLaunchAt > 0 ? Math.max(0, (now - entry.lastLaunchAt) / 1000) : pressure.windowSeconds;
    const decayWindows = Math.floor(elapsedSeconds / pressure.windowSeconds);
    const decayedStacks = Math.max(0, entry.stacks - decayWindows);
    const feeMultiplier = Math.min(
      pressure.maxFeeMultiplier,
      1 + decayedStacks * pressure.stackGrowth
    );
    return Math.max(0, Math.floor(baseIntelCost * feeMultiplier));
  }

  function applyIntelPressureLaunch(band, now = Date.now()) {
    const rank = Math.max(1, Number(band?.rank) || 1);
    const pressure = getPressureConfig();
    const entry = getPressureEntry(band.id);
    const elapsedSeconds = entry.lastLaunchAt > 0 ? Math.max(0, (now - entry.lastLaunchAt) / 1000) : pressure.windowSeconds;
    const decayWindows = Math.floor(elapsedSeconds / pressure.windowSeconds);
    const decayedStacks = Math.max(0, entry.stacks - decayWindows);
    const nextStacks = rank < pressure.minRank ? 0 : Math.min(pressure.maxStacks, decayedStacks + 1);
    entry.stacks = nextStacks;
    entry.lastLaunchAt = now;
  }

  function stageVarianceConfigForBand(band) {
    const fallback = expeditionBalance.defaultStageVarianceRanges || {};
    const ranges = band.stageVarianceRanges || fallback;
    function normalizeRange(range, min, max, fallbackMin, fallbackMax) {
      const a = Number(range?.min);
      const b = Number(range?.max);
      if (Number.isFinite(a) && Number.isFinite(b)) {
        return {
          min: clamp(Math.min(a, b), min, max),
          max: clamp(Math.max(a, b), min, max)
        };
      }
      return { min: fallbackMin, max: fallbackMax };
    }
    return {
      riskDelta: normalizeRange(ranges.riskDelta, -0.2, 0.2, -0.03, 0.04),
      yieldDelta: normalizeRange(ranges.yieldDelta, -0.25, 0.3, -0.04, 0.05),
      speedMultiplier: normalizeRange(ranges.speedMultiplier, 0.75, 1.25, 0.96, 1.05),
      intelFlat: normalizeRange(ranges.intelFlat, -2, 4, 0, 1)
    };
  }

  function rollRange(run, range) {
    const min = Number(range?.min) || 0;
    const max = Number(range?.max) || 0;
    return min + (max - min) * roll(run);
  }

  function buildStageVariances(run, band, stageCount) {
    const ranges = stageVarianceConfigForBand(band);
    const results = [];
    for (let i = 0; i < stageCount; i += 1) {
      results.push({
        riskDelta: rollRange(run, ranges.riskDelta),
        yieldDelta: rollRange(run, ranges.yieldDelta),
        speedMultiplier: rollRange(run, ranges.speedMultiplier),
        intelFlat: Math.round(rollRange(run, ranges.intelFlat))
      });
    }
    return results;
  }

  function buildStageChoices(run, band, stageIndex) {
    const stageVariance = run.stageVariances?.[stageIndex] || null;
    const baseChoices = makeChoicesForBand(band);
    if (!stageVariance) {
      return baseChoices;
    }
    return baseChoices.map((choice) => ({
      ...choice,
      riskDelta: Number(choice.riskDelta || 0) + stageVariance.riskDelta,
      yieldDelta: Number(choice.yieldDelta || 0) + stageVariance.yieldDelta,
      speedMultiplier: Math.max(0.7, Number(choice.speedMultiplier || 1) * stageVariance.speedMultiplier),
      intelFlat: Math.floor(Number(choice.intelFlat || 0) + stageVariance.intelFlat),
      stageVarianceSummary: stageVariance
    }));
  }

  function scoreChoiceForMode(choice, mode) {
    const risk = Number(choice.riskDelta) || 0;
    const yieldDelta = Number(choice.yieldDelta) || 0;
    const speedFactor = Number(choice.speedMultiplier) || 1;
    const speedDelta = speedFactor - 1;
    const intelFlat = Number(choice.intelFlat) || 0;
    if (mode === "safe") {
      return (-risk * 2.4) + (yieldDelta * 0.3) + (speedDelta * 0.15) + (intelFlat * 0.2);
    }
    if (mode === "aggressive") {
      return (yieldDelta * 2.1) + (speedDelta * 0.8) + (intelFlat * 0.35) - (Math.max(0, risk) * 0.2);
    }
    return (yieldDelta * 1.1) + (speedDelta * 0.5) + (intelFlat * 0.3) - (Math.abs(risk) * 0.65);
  }

  function autoChooseRouteIfNeeded() {
    const run = state.expeditions.activeRun;
    if (!run || !run.awaitingChoice) {
      return { ok: false, reason: "No route decision pending." };
    }
    const mode = normalizeAutoMode(run.autoRouteMode || state.expeditions.meta.autoRouteMode);
    if (mode === "manual") {
      return { ok: false, reason: "Manual mode." };
    }
    const options = (run.pendingChoices || []).filter((choice) => choice.unlocked);
    if (options.length === 0) {
      return { ok: false, reason: "No unlocked route options." };
    }
    const selected = options
      .map((choice) => ({ choice, score: scoreChoiceForMode(choice, mode) }))
      .sort((a, b) => b.score - a.score)[0]?.choice;
    if (!selected) {
      return { ok: false, reason: "No route selected." };
    }
    const result = chooseRoute(selected.id);
    if (result.ok) {
      eventBus.emit("expedition:autoRoute", {
        mode,
        bandId: run.bandId,
        stage: run.stageIndex + 1,
        choiceId: selected.id
      });
    }
    return result;
  }

  function applyOutcome(run, outcome) {
    if (!outcome) {
      return;
    }
    run.modifiers.riskDelta += Number(outcome.riskDelta) || 0;
    run.modifiers.yieldDelta += Number(outcome.yieldDelta) || 0;
    if (outcome.speedMultiplier) {
      run.modifiers.speedMultiplier *= Number(outcome.speedMultiplier) || 1;
    }
    run.modifiers.rewardFlat.matter += clampInt(outcome.matterFlat);
    run.modifiers.rewardFlat.fire += clampInt(outcome.fireFlat);
    run.modifiers.rewardFlat.shards += 0;
    run.modifiers.rewardFlat.intel += clampInt(outcome.intelFlat) + clampInt(outcome.shardsFlat);
    run.modifiers.penalty.matter += clampInt(outcome.matterPenalty);
    run.modifiers.penalty.fire += clampInt(outcome.firePenalty);
    run.modifiers.penalty.shards += 0;
  }

  function resolveEncounter(run, band, choice) {
    const encounterDefs = band.encounters || [];
    if (encounterDefs.length === 0) {
      return null;
    }

    const encounterMap = new Map(encounterDefs.map((entry) => [entry.id, entry]));
    const poolId = choice?.encounterPool;
    const poolIds = poolId ? (band.encounterPools?.[poolId] || []) : [];
    const pooledEncounters = poolIds
      .map((encounterId) => encounterMap.get(encounterId))
      .filter(Boolean);
    const activePool = pooledEncounters.length > 0 ? pooledEncounters : encounterDefs;

    const encounter = activePool[Math.floor(roll(run) * activePool.length)];
    if (!encounter) {
      return null;
    }

    const shipMitigation = run.ship?.stats?.riskMitigation || 0;
    const mitigation = clamp((state.perks.expeditionRiskMitigation || 0) + shipMitigation, 0, 0.8);
    const effectiveRisk = clamp((band.risk || 0.2) + run.modifiers.riskDelta, 0.05, 0.95);
    const difficulty = clamp((encounter.difficulty || 0.4) + effectiveRisk * 0.35, 0.05, 0.98);
    const successChance = clamp(1 - difficulty * (1 - mitigation), 0.12, 0.96);
    const success = roll(run) <= successChance;

    applyOutcome(run, success ? encounter.success : encounter.fail);

    const logEntry = {
      stage: run.stageIndex,
      poolId: poolId || "default",
      name: encounter.name,
      description: encounter.description,
      success
    };

    if (success) {
      const dropDefs = getDropDefsForBand(run.bandId)
        .filter((drop) => {
          if (!Array.isArray(drop.fromPool) || drop.fromPool.length === 0) {
            return true;
          }
          return drop.fromPool.includes(logEntry.poolId);
        })
        .sort((a, b) => (a.chance || 0) - (b.chance || 0));
      const shipWeight = Math.max(0.1, run.ship?.stats?.rareDropWeight || 1);
      for (const drop of dropDefs) {
        const rawChance = Math.max(0, Number(drop.chance) || 0);
        const chance = clamp(rawChance * shipWeight, 0, 0.85);
        if (roll(run) <= chance) {
          const dropEntry = {
            id: drop.id,
            name: drop.name || drop.id,
            rarity: drop.rarity || "rare",
            blueprintForShip: drop.blueprintForShip || null,
            slot: drop.slot || null,
            shipId: drop.shipId || null,
            effects: drop.effects || null
          };
          run.pendingDrops.push(dropEntry);
          logEntry.drop = dropEntry.name;
          eventBus.emit("expedition:rareDrop", {
            bandId: run.bandId,
            stage: run.stageIndex,
            dropId: dropEntry.id
          });
          break;
        }
      }
    }

    run.encounterLog.push(logEntry);
    eventBus.emit("expedition:event", {
      type: "encounter",
      stage: run.stageIndex,
      encounterId: encounter.id,
      success
    });

    return logEntry;
  }

  function start(bandId) {
    if (state.expeditions.pendingRewards) {
      return { ok: false, reason: "Claim pending rewards first." };
    }
    if (state.expeditions.activeRun) {
      return { ok: false, reason: "An expedition is already in progress." };
    }

    const band = getBandById(bandId);
    if (!band) {
      return { ok: false, reason: "Unknown expedition band." };
    }
    const ship = getSelectedShipContext();
    if (!ship) {
      return { ok: false, reason: "Select an acquired ship in Fleet Dock before launching." };
    }

    const unlock = isBandUnlocked(bandId);
    if (!unlock.ok) {
      eventBus.emit("expedition:blockedByPrestige", { bandId, reason: unlock.reason });
      return unlock;
    }

    const matterCost = Math.max(0, band.cost?.matter || 0);
    const fireCost = Math.max(0, band.cost?.fire || 0);
    const baseIntelCost = Math.max(0, band.cost?.intel || 0);
    const rank = getBandRank(bandId);
    band.rank = rank;
    const intelPressureCost = getIntelLaunchCostForBand(band, Date.now(), rank);
    const totalIntelCost = baseIntelCost + intelPressureCost;

    if (!resourceManager.spend("matter", matterCost)) {
      return { ok: false, reason: `Need ${matterCost} Matter.` };
    }
    if (!resourceManager.spend("fire", fireCost)) {
      state.resources.matter += matterCost;
      return { ok: false, reason: `Need ${fireCost} Fire.` };
    }
    if ((state.expeditions.meta.intel || 0) < totalIntelCost) {
      state.resources.matter += matterCost;
      state.resources.fire += fireCost;
      return { ok: false, reason: `Need ${totalIntelCost} Intel.` };
    }
    state.expeditions.meta.intel = Math.max(0, Number(state.expeditions.meta.intel || 0) - totalIntelCost);
    applyIntelPressureLaunch({ ...band, rank }, Date.now());

    const seed = (Date.now() + Math.floor(Math.random() * 1000000)) >>> 0;
    const stageCount = Math.max(1, Math.floor(Number(band.stageCount) || 2));
    const perkSpeedMultiplier = Math.max(0.25, state.perks.expeditionSpeedMultiplier || 1);
    const shipSpeed = Math.max(0.25, ship.stats.speedMultiplier || 1);

    state.expeditions.activeRun = {
      bandId,
      ship,
      rank: band.rank || getBands().find((item) => item.id === bandId)?.rank || 1,
      elapsedSeconds: 0,
      totalDurationSeconds: Math.max(12, Number(band.durationSeconds) || 60) / (perkSpeedMultiplier * shipSpeed),
      segmentElapsedSeconds: 0,
      segmentDurationSeconds: Math.max(6, (Number(band.durationSeconds) || 60) / stageCount / (perkSpeedMultiplier * shipSpeed)),
      stageCount,
      stageIndex: 0,
      autoRouteMode: normalizeAutoMode(state.expeditions.meta.autoRouteMode),
      awaitingChoice: false,
      pendingChoices: [],
      routeHistory: [],
      encounterLog: [],
      pendingDrops: [],
      modifiers: {
        riskDelta: 0,
        yieldDelta: 0,
        speedMultiplier: 1,
        rewardFlat: cloneRewards(),
        penalty: { matter: 0, fire: 0, shards: 0 }
      },
      seed,
      startedAt: Date.now(),
      costs: { matter: matterCost, fire: fireCost, intel: totalIntelCost }
    };

    state.expeditions.activeRun.stageVariances = buildStageVariances(state.expeditions.activeRun, band, stageCount);

    state.expeditions.activeRun.pendingChoices = buildStageChoices(state.expeditions.activeRun, band, 0);
    state.expeditions.activeRun.awaitingChoice = true;

    autoChooseRouteIfNeeded();

    eventBus.emit("expedition:start", {
      bandId,
      stageCount,
      shipId: ship.shipId,
      intelCost: totalIntelCost,
      intelBaseCost: baseIntelCost,
      intelPressureCost
    });
    return { ok: true };
  }

  function resolveActiveRun() {
    const run = state.expeditions.activeRun;
    if (!run) {
      return null;
    }
    const band = getBandById(run.bandId);
    if (!band) {
      state.expeditions.activeRun = null;
      return null;
    }

    const shipRiskMitigation = run.ship?.stats?.riskMitigation || 0;
    const shipYieldMultiplier = run.ship?.stats?.yieldMultiplier || 1;
    const penaltyDampening = clamp(run.ship?.stats?.penaltyDampening || 0, 0, 0.85);
    const riskMitigation = clamp((state.perks.expeditionRiskMitigation || 0) + shipRiskMitigation, 0, 0.7);
    const finalRisk = clamp((band.risk || 0.2) + run.modifiers.riskDelta, 0.04, 0.98);
    const rawSuccess = 1 - finalRisk * (1 - riskMitigation);
    const successChance = clamp(
      rawSuccess,
      expeditionBalance.minSuccessChance || 0.15,
      expeditionBalance.maxSuccessChance || 0.95
    );
    const success = roll(run) <= successChance;

    const variance = 0.9 + roll(run) * 0.25;
    const routeYield = clamp(1 + (run.modifiers.yieldDelta || 0), 0.2, 3);
    const yieldMultiplier = Math.max(0.25, (state.perks.expeditionYieldMultiplier || 1) * shipYieldMultiplier * variance * routeYield);
    const intelMultiplier = Math.max(0.25, state.perks.expeditionIntelMultiplier || 1);

    const baseReward = band.rewards || {};
    const rewardFlat = run.modifiers.rewardFlat || cloneRewards();
    const penalty = run.modifiers.penalty || { matter: 0, fire: 0, shards: 0 };
    const dampenedPenalty = {
      matter: Math.floor((penalty.matter || 0) * (1 - penaltyDampening)),
      fire: Math.floor((penalty.fire || 0) * (1 - penaltyDampening)),
      shards: Math.floor((penalty.shards || 0) * (1 - penaltyDampening))
    };
    const rewards = success
      ? {
          matter: Math.max(0, Math.floor((baseReward.matter || 0) * yieldMultiplier) + rewardFlat.matter - dampenedPenalty.matter),
          fire: Math.max(0, Math.floor((baseReward.fire || 0) * yieldMultiplier) + rewardFlat.fire - dampenedPenalty.fire),
          shards: 0,
          intel: Math.max(0, Math.floor((baseReward.intel || 0) * intelMultiplier) + rewardFlat.intel)
        }
      : {
          matter: Math.max(0, Math.floor((baseReward.matter || 0) * 0.12) - dampenedPenalty.matter),
          fire: Math.max(0, Math.floor((baseReward.fire || 0) * 0.12) - dampenedPenalty.fire),
          shards: 0,
          intel: Math.max(1, 1 + rewardFlat.intel)
        };

    state.expeditions.pendingRewards = {
      success,
      bandId: band.id,
      bandName: band.name,
      finalRisk,
      shipId: run.ship?.shipId || null,
      routeHistory: run.routeHistory,
      encounters: run.encounterLog,
      drops: run.pendingDrops,
      rewards,
      completedAt: Date.now()
    };
    state.expeditions.activeRun = null;

    state.lifetime.expeditionRuns += 1;
    if (success) {
      state.lifetime.expeditionWins += 1;
      state.expeditions.meta.completedRuns += 1;
      const rank = getBands().find((item) => item.id === band.id)?.rank || 1;
      state.expeditions.meta.bestBand = Math.max(state.expeditions.meta.bestBand, rank);
      state.lifetime.expeditionBestBand = Math.max(state.lifetime.expeditionBestBand, rank);
    } else {
      state.lifetime.expeditionLosses += 1;
      state.expeditions.meta.failedRuns += 1;
    }

    eventBus.emit("expedition:complete", {
      bandId: band.id,
      success,
      rewards
    });

    return state.expeditions.pendingRewards;
  }

  function chooseRoute(choiceId) {
    const run = state.expeditions.activeRun;
    if (!run) {
      return { ok: false, reason: "No active expedition." };
    }
    if (!run.awaitingChoice) {
      return { ok: false, reason: "No route decision pending." };
    }

    const band = getBandById(run.bandId);
    if (!band) {
      return { ok: false, reason: "Unknown expedition band." };
    }

    const choice = (run.pendingChoices || []).find((item) => item.id === choiceId);
    if (!choice) {
      return { ok: false, reason: "Invalid route choice." };
    }
    if (!choice.unlocked) {
      return { ok: false, reason: choice.lockReason || "Route is locked by ascension requirements." };
    }

    applyOutcome(run, {
      riskDelta: choice.riskDelta,
      yieldDelta: choice.yieldDelta,
      speedMultiplier: choice.speedMultiplier,
      intelFlat: choice.intelFlat
    });

    run.routeHistory.push({
      stage: run.stageIndex + 1,
      id: choice.id,
      name: choice.name
    });
    run.awaitingChoice = false;
    run.pendingChoices = [];
    run.segmentDurationSeconds = segmentDurationSeconds(run, band);

    const encounter = resolveEncounter(run, band, choice);
    eventBus.emit("expedition:branch", {
      bandId: run.bandId,
      stage: run.stageIndex + 1,
      choiceId: choice.id,
      encounter: encounter?.name || null
    });

    return { ok: true, encounter };
  }

  function advance(dtSeconds, offlineMultiplier = 1) {
    const run = state.expeditions.activeRun;
    if (!run) {
      return { resolved: false };
    }
    if (run.awaitingChoice) {
      const autoResult = autoChooseRouteIfNeeded();
      if (autoResult.ok) {
        return { resolved: false, needsChoice: false, autoRouted: true };
      }
      return { resolved: false, needsChoice: true };
    }

    const safeDelta = Math.max(0, Number(dtSeconds) || 0) * Math.max(0, Number(offlineMultiplier) || 0);
    if (safeDelta <= 0) {
      return { resolved: false };
    }

    run.elapsedSeconds += safeDelta;
    run.segmentElapsedSeconds += safeDelta;
    eventBus.emit("expedition:step", {
      bandId: run.bandId,
      elapsedSeconds: run.elapsedSeconds,
      durationSeconds: run.totalDurationSeconds
    });

    if (run.segmentElapsedSeconds < run.segmentDurationSeconds) {
      return { resolved: false };
    }

    run.segmentElapsedSeconds = 0;
    run.stageIndex += 1;

    const band = getBandById(run.bandId);
    if (!band) {
      state.expeditions.activeRun = null;
      return { resolved: false };
    }

    if (run.stageIndex >= run.stageCount) {
      resolveActiveRun();
      return { resolved: true };
    }

    run.awaitingChoice = true;
    run.pendingChoices = buildStageChoices(run, band, run.stageIndex);
    autoChooseRouteIfNeeded();
    eventBus.emit("expedition:event", {
      type: "routeChoice",
      stage: run.stageIndex + 1,
      options: run.pendingChoices.map((item) => item.id)
    });
    return { resolved: false, needsChoice: true };
  }

  function claim() {
    const pending = state.expeditions.pendingRewards;
    if (!pending) {
      return { ok: false, reason: "No rewards to claim." };
    }

    const rewards = pending.rewards || {};
    const policy = expeditionBalance.duplicateBlueprintPolicy || {};
    const drops = Array.isArray(pending.drops) ? pending.drops : [];
    let duplicateIntel = 0;
    let duplicateShards = 0;

    drops.forEach((drop) => {
      if (!drop?.id) {
        return;
      }
      if (drop.blueprintForShip) {
        const existing = state.expeditions.blueprintInventory[drop.id] || 0;
        if (existing > 0) {
          duplicateIntel += Math.max(0, Number(policy.intelPerDuplicate) || 0);
          duplicateShards += Math.max(0, Number(policy.shardsPerDuplicate) || 0);
        } else {
          state.expeditions.blueprintInventory[drop.id] = 1;
        }
      } else {
        state.expeditions.partInventory[drop.id] = (state.expeditions.partInventory[drop.id] || 0) + 1;
      }
    });

    resourceManager.add("matter", rewards.matter || 0);
    resourceManager.add("fire", rewards.fire || 0);
    resourceManager.add("shards", 0);
    resourceManager.add("shards", duplicateShards);
    state.expeditions.meta.intel += Math.max(0, rewards.intel || 0);
    state.expeditions.meta.intel += duplicateIntel;

    state.expeditions.pendingRewards = null;
    eventBus.emit("expedition:claim", {
      rewards,
      success: pending.success,
      bandId: pending.bandId,
      drops,
      duplicateIntel,
      duplicateShards
    });

    return {
      ok: true,
      rewards,
      success: pending.success,
      bandId: pending.bandId,
      drops,
      duplicateIntel,
      duplicateShards
    };
  }

  function abandon() {
    if (!state.expeditions.activeRun) {
      return { ok: false, reason: "No active expedition." };
    }
    const bandId = state.expeditions.activeRun.bandId;
    state.expeditions.activeRun = null;
    state.lifetime.expeditionLosses += 1;
    state.expeditions.meta.failedRuns += 1;
    eventBus.emit("expedition:event", { type: "abandoned", bandId });
    return { ok: true };
  }

  function handleAscendReset() {
    state.expeditions.activeRun = null;
    state.expeditions.pendingRewards = null;
    state.expeditions.meta.intelPressure = {};
  }

  function setAutoRouteMode(mode) {
    const next = normalizeAutoMode(mode);
    state.expeditions.meta.autoRouteMode = next;
    if (state.expeditions.activeRun) {
      state.expeditions.activeRun.autoRouteMode = next;
      if (state.expeditions.activeRun.awaitingChoice && next !== "manual") {
        autoChooseRouteIfNeeded();
      }
    }
    return { ok: true, mode: next };
  }

  function getStatus() {
    return {
      unlockNodeId,
      unlocked: !unlockNodeId || Boolean(state.ascensionTree[unlockNodeId]),
      selectedShip: state.expeditions.selectedShip,
      selectedShipStats: getSelectedShipContext()?.stats || null,
      activeRun: state.expeditions.activeRun,
      pendingRewards: state.expeditions.pendingRewards,
      meta: state.expeditions.meta,
      autoRouteMode: normalizeAutoMode(state.expeditions.meta.autoRouteMode),
      bands: getBands()
    };
  }

  return {
    getStatus,
    getBands,
    isBandUnlocked,
    start,
    chooseRoute,
    setAutoRouteMode,
    advance,
    claim,
    abandon,
    handleAscendReset
  };
}

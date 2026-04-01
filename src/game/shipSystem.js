import { isUnlockMet } from "./unlockRules.js";

function hasBlueprint(state, blueprintId) {
  return (state.expeditions.blueprintInventory[blueprintId] || 0) > 0;
}

function ensureShip(state, shipId) {
  const ship = state.expeditions.ships[shipId];
  return ship && typeof ship === "object" ? ship : null;
}

export function createShipSystem({ state, balance, resourceManager, eventBus }) {
  const expeditionBalance = balance.expeditions || {};
  const shipDefs = expeditionBalance.ships || {};
  const facilityDefs = expeditionBalance.shipFacilities || {};
  const partDefs = Object.values(expeditionBalance.rareBlueprintDrops || {})
    .flat()
    .filter((entry) => entry && !entry.blueprintForShip)
    .reduce((map, entry) => {
      map[entry.id] = entry;
      return map;
    }, {});

  function getEquippedPartCounts() {
    const counts = {};
    Object.values(state.expeditions.ships || {}).forEach((ship) => {
      Object.values(ship?.equippedParts || {}).forEach((partId) => {
        if (!partId || typeof partId !== "string") {
          return;
        }
        counts[partId] = (counts[partId] || 0) + 1;
      });
    });
    return counts;
  }

  function getShipStats(shipId) {
    const shipState = ensureShip(state, shipId);
    const shipDef = shipDefs[shipId];
    if (!shipState || !shipDef) {
      return null;
    }

    const stats = {
      speedMultiplier: shipDef.baseStats?.speedMultiplier || 1,
      riskMitigation: shipDef.baseStats?.riskMitigation || 0,
      yieldMultiplier: shipDef.baseStats?.yieldMultiplier || 1,
      penaltyDampening: shipDef.baseStats?.penaltyDampening || 0,
      rareDropWeight: shipDef.baseStats?.rareDropWeight || 1
    };

    Object.entries(shipState.facilities || {}).forEach(([facilityId, level]) => {
      const def = facilityDefs[facilityId];
      if (!def || !def.effectsPerLevel) {
        return;
      }
      const n = Math.max(0, Math.floor(Number(level) || 0));
      stats.speedMultiplier *= 1 + (def.effectsPerLevel.speedMultiplier || 0) * n;
      stats.yieldMultiplier *= 1 + (def.effectsPerLevel.yieldMultiplier || 0) * n;
      stats.rareDropWeight *= 1 + (def.effectsPerLevel.rareDropWeight || 0) * n;
      stats.riskMitigation += (def.effectsPerLevel.riskMitigation || 0) * n;
      stats.penaltyDampening += (def.effectsPerLevel.penaltyDampening || 0) * n;
    });

    Object.entries(shipState.equippedParts || {}).forEach(([slotId, partId]) => {
      if (!partId || typeof partId !== "string") {
        return;
      }
      const part = partDefs[partId];
      if (!part || part.slot !== slotId) {
        return;
      }
      const effects = part.effects || {};
      stats.speedMultiplier *= 1 + (effects.speedMultiplier || 0);
      stats.yieldMultiplier *= 1 + (effects.yieldMultiplier || 0);
      stats.rareDropWeight *= 1 + (effects.rareDropWeight || 0);
      stats.riskMitigation += effects.riskMitigation || 0;
      stats.penaltyDampening += effects.penaltyDampening || 0;
    });

    stats.riskMitigation = Math.max(0, Math.min(0.9, stats.riskMitigation));
    stats.penaltyDampening = Math.max(0, Math.min(0.85, stats.penaltyDampening));
    return stats;
  }

  function isShipUnlockMet(shipId) {
    const def = shipDefs[shipId];
    if (!def) {
      return { ok: false, reason: "Unknown ship." };
    }
    if (def.unlock && !isUnlockMet(state, def.unlock)) {
      return { ok: false, reason: "Prestige unlock requirement not met." };
    }
    if (def.requiredBlueprint && !hasBlueprint(state, def.requiredBlueprint)) {
      return { ok: false, reason: `Missing blueprint: ${def.requiredBlueprint}.` };
    }
    return { ok: true };
  }

  function buyShip(shipId) {
    const shipState = ensureShip(state, shipId);
    const shipDef = shipDefs[shipId];
    if (!shipState || !shipDef) {
      return { ok: false, reason: "Unknown ship." };
    }
    if (shipState.acquired) {
      return { ok: false, reason: "Ship already acquired." };
    }

    const unlock = isShipUnlockMet(shipId);
    if (!unlock.ok) {
      return unlock;
    }

    const cost = shipDef.purchaseCost || {};
    const matter = Math.max(0, cost.matter || 0);
    const fire = Math.max(0, cost.fire || 0);
    const shards = Math.max(0, cost.shards || 0);

    if (!resourceManager.spend("matter", matter)) {
      return { ok: false, reason: `Need ${matter} Matter.` };
    }
    if (!resourceManager.spend("fire", fire)) {
      state.resources.matter += matter;
      return { ok: false, reason: `Need ${fire} Fire.` };
    }
    if (!resourceManager.spend("shards", shards)) {
      state.resources.matter += matter;
      state.resources.fire += fire;
      return { ok: false, reason: `Need ${shards} Shards.` };
    }

    shipState.acquired = true;
    eventBus.emit("ship:bought", { shipId });
    return { ok: true };
  }

  function selectShip(shipId) {
    const shipState = ensureShip(state, shipId);
    if (!shipState) {
      return { ok: false, reason: "Unknown ship." };
    }
    if (!shipState.acquired) {
      return { ok: false, reason: "Ship not acquired." };
    }
    state.expeditions.selectedShip = shipId;
    eventBus.emit("ship:selected", { shipId });
    return { ok: true };
  }

  function upgradeFacility(shipId, facilityId) {
    const shipState = ensureShip(state, shipId);
    const facilityDef = facilityDefs[facilityId];
    if (!shipState || !facilityDef) {
      return { ok: false, reason: "Unknown ship or facility." };
    }
    if (!shipState.acquired) {
      return { ok: false, reason: "Ship not acquired." };
    }

    const currentLevel = Math.max(0, Math.floor(Number(shipState.facilities?.[facilityId]) || 0));
    if (currentLevel >= (facilityDef.maxLevel || 0)) {
      return { ok: false, reason: "Facility is maxed." };
    }

    const cost = facilityDef.levelCosts?.[currentLevel];
    if (!cost) {
      return { ok: false, reason: "Missing upgrade cost data." };
    }

    if (!resourceManager.spend("matter", Math.max(0, cost.matter || 0))) {
      return { ok: false, reason: `Need ${cost.matter || 0} Matter.` };
    }
    if (!resourceManager.spend("fire", Math.max(0, cost.fire || 0))) {
      state.resources.matter += Math.max(0, cost.matter || 0);
      return { ok: false, reason: `Need ${cost.fire || 0} Fire.` };
    }
    if (!resourceManager.spend("shards", Math.max(0, cost.shards || 0))) {
      state.resources.matter += Math.max(0, cost.matter || 0);
      state.resources.fire += Math.max(0, cost.fire || 0);
      return { ok: false, reason: `Need ${cost.shards || 0} Shards.` };
    }

    shipState.facilities[facilityId] = currentLevel + 1;
    eventBus.emit("ship:facilityUpgraded", { shipId, facilityId, level: currentLevel + 1 });
    return { ok: true };
  }

  function equipPart(shipId, slotId, partId) {
    const shipState = ensureShip(state, shipId);
    if (!shipState) {
      return { ok: false, reason: "Unknown ship." };
    }
    if (!shipState.acquired) {
      return { ok: false, reason: "Ship not acquired." };
    }
    const part = partDefs[partId];
    if (!part) {
      return { ok: false, reason: "Unknown part." };
    }
    if (part.slot !== slotId) {
      return { ok: false, reason: `Part fits ${part.slot}, not ${slotId}.` };
    }
    if (part.shipId && part.shipId !== shipId) {
      return { ok: false, reason: `Part is restricted to ${part.shipId}.` };
    }
    if ((state.expeditions.partInventory[partId] || 0) <= 0) {
      return { ok: false, reason: "Part not in inventory." };
    }

    const equippedCounts = getEquippedPartCounts();
    const currentlyEquipped = shipState.equippedParts?.[slotId] === partId;
    const allocation = Number(equippedCounts[partId]) || 0;
    const totalOwned = Math.max(0, Number(state.expeditions.partInventory[partId]) || 0);
    if (!currentlyEquipped && allocation >= totalOwned) {
      return { ok: false, reason: "All copies of this part are already equipped." };
    }

    shipState.equippedParts[slotId] = partId;
    eventBus.emit("ship:partEquipped", { shipId, slotId, partId });
    return { ok: true };
  }

  function unequipPart(shipId, slotId) {
    const shipState = ensureShip(state, shipId);
    if (!shipState) {
      return { ok: false, reason: "Unknown ship." };
    }
    if (!shipState.equippedParts[slotId]) {
      return { ok: false, reason: "No part equipped in slot." };
    }

    const partId = shipState.equippedParts[slotId];
    shipState.equippedParts[slotId] = null;
    eventBus.emit("ship:partUnequipped", { shipId, slotId, partId });
    return { ok: true };
  }

  function getStatus() {
    const equippedPartCounts = getEquippedPartCounts();
    return {
      selectedShip: state.expeditions.selectedShip,
      ships: state.expeditions.ships,
      shipDefs,
      facilityDefs,
      partDefs,
      equippedPartCounts,
      blueprintInventory: state.expeditions.blueprintInventory,
      partInventory: state.expeditions.partInventory
    };
  }

  return {
    getStatus,
    getShipStats,
    isShipUnlockMet,
    buyShip,
    selectShip,
    upgradeFacility,
    equipPart,
    unequipPart
  };
}

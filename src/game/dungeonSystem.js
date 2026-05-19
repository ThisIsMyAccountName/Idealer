import { isUnlockMet } from "./unlockRules.js";
import { generateRun } from "./dungeonGen.js";

function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function clampInt(value, min, max) {
  const v = Math.floor(toNumber(value, min));
  return Math.min(max, Math.max(min, v));
}

function positionKey(x, y) {
  return `${x},${y}`;
}

function chebyshev(a, b) {
  return Math.max(Math.abs((a?.x ?? 0) - (b?.x ?? 0)), Math.abs((a?.y ?? 0) - (b?.y ?? 0)));
}

export function createDungeonSystem({ state, resourceManager, eventBus, balance }) {
  const config = balance?.riftDelve || {};

  // --- relic upgrades ------------------------------------------------------

  function relicBonuses() {
    const tree = config.relicTree || {};
    const owned = state.riftDelve.relicUpgrades || {};
    const out = {
      maxHpBonus: 0,
      powerBonus: 0,
      slotBonus: 0,
      lootMult: 1,
      rewardMult: 1,
      stepMult: 1,
      startTool: null
    };
    Object.entries(tree).forEach(([id, def]) => {
      const level = clampInt(owned[id], 0, toNumber(def.maxLevel, 0));
      if (level <= 0) {
        return;
      }
      const e = def.effect || {};
      out.maxHpBonus += toNumber(e.maxHpPerLevel, 0) * level;
      out.powerBonus += toNumber(e.powerPerLevel, 0) * level;
      out.slotBonus += toNumber(e.slotsPerLevel, 0) * level;
      out.lootMult += toNumber(e.lootMultPerLevel, 0) * level;
      out.rewardMult += toNumber(e.rewardMultPerLevel, 0) * level;
      out.stepMult += toNumber(e.stepMultPerLevel, 0) * level;
      if (e.startTool) {
        out.startTool = e.startTool;
      }
    });
    out.stepMult = Math.max(0.3, out.stepMult);
    out.lootMult = Math.max(1, out.lootMult);
    out.rewardMult = Math.max(1, out.rewardMult);
    return out;
  }

  function metaBonuses() {
    const tree = config.metaCrafts || {};
    const owned = state.riftDelve.metaCrafts || {};
    const out = {
      powerBonus: 0,
      maxHpBonus: 0,
      slotBonus: 0,
      damageReduce: 0,
      autoHeal: false,
      healStoneCharges: 0
    };
    Object.entries(tree).forEach(([id, def]) => {
      const level = clampInt(owned[id], 0, toNumber(def.maxLevel, 0));
      if (level <= 0) {
        return;
      }
      const e = def.effect || {};
      out.powerBonus += toNumber(e.powerPerLevel, 0) * level;
      out.maxHpBonus += toNumber(e.maxHpPerLevel, 0) * level;
      out.slotBonus += toNumber(e.slotsPerLevel, 0) * level;
      out.damageReduce += toNumber(e.damageReducePerLevel, 0) * level;
      out.healStoneCharges += toNumber(e.healStoneChargesPerLevel, 0) * level;
      if (e.autoHeal) {
        out.autoHeal = true;
      }
    });
    return out;
  }

  function getSlotCount() {
    const base = Math.max(1, Math.floor(toNumber(config.inventorySlots, 6)));
    return base + Math.max(0, Math.floor(relicBonuses().slotBonus + metaBonuses().slotBonus));
  }

  function getPlayerMaxHp() {
    return Math.max(
      1,
      Math.floor(
        toNumber(config.player?.baseHp, 50) + relicBonuses().maxHpBonus + metaBonuses().maxHpBonus
      )
    );
  }

  // --- inventory -----------------------------------------------------------

  function getItemDef(itemId) {
    if (!itemId || typeof itemId !== "string") {
      return null;
    }
    return config.itemDefs?.[itemId] || null;
  }

  function makeEmptySlots(count) {
    return Array.from({ length: count }, () => null);
  }

  function resetInventoryState() {
    state.riftDelve.inventory.slots = makeEmptySlots(getSlotCount());
    state.riftDelve.inventory.equipped = { mainHand: null, offHand: null };
  }

  function createInventoryEntry(def, count) {
    const maxStack = Math.max(1, Math.floor(toNumber(def.maxStack, 1)));
    return {
      itemId: def.id,
      itemType: def.type || "material",
      name: def.name || def.id,
      count: Math.max(0, Math.floor(toNumber(count, 0))),
      maxStack,
      toolTag: typeof def.toolTag === "string" ? def.toolTag : null,
      unlockTags: [],
      keyUses: 0
    };
  }

  function syncEquippedTools() {
    const slots = state.riftDelve.inventory.slots;
    const equipped = state.riftDelve.inventory.equipped;
    const owned = new Set(
      slots.filter((s) => s && typeof s.toolTag === "string" && s.toolTag).map((s) => s.toolTag)
    );
    if (equipped.mainHand && !owned.has(equipped.mainHand)) {
      equipped.mainHand = null;
    }
    if (equipped.offHand && !owned.has(equipped.offHand)) {
      equipped.offHand = null;
    }
    if (!equipped.mainHand && equipped.offHand) {
      equipped.mainHand = equipped.offHand;
      equipped.offHand = null;
    }
  }

  function addInventoryItem(itemId, count = 1) {
    const def = getItemDef(itemId);
    if (!def) {
      return { ok: false, reason: `Unknown item: ${itemId}.` };
    }
    const slots = state.riftDelve.inventory.slots;
    let remaining = Math.max(1, Math.floor(toNumber(count, 1)));

    if (def.type !== "tool") {
      for (let i = 0; i < slots.length && remaining > 0; i += 1) {
        const slot = slots[i];
        if (!slot || slot.itemId !== itemId || slot.count >= slot.maxStack) {
          continue;
        }
        const add = Math.min(remaining, slot.maxStack - slot.count);
        slot.count += add;
        remaining -= add;
      }
    }
    while (remaining > 0) {
      const idx = slots.findIndex((s) => !s);
      if (idx === -1) {
        return { ok: false, reason: "Inventory full." };
      }
      const entry = createInventoryEntry(def, 0);
      const place = Math.min(remaining, entry.maxStack);
      entry.count = place;
      slots[idx] = entry;
      remaining -= place;
    }
    if (def.type === "tool") {
      const equipped = state.riftDelve.inventory.equipped;
      const tag = def.toolTag || def.id;
      if (!equipped.mainHand) {
        equipped.mainHand = tag;
      } else if (!equipped.offHand && equipped.mainHand !== tag) {
        equipped.offHand = tag;
      }
    }
    return { ok: true };
  }

  function countInventoryItem(itemId) {
    return state.riftDelve.inventory.slots
      .filter((s) => s && s.itemId === itemId)
      .reduce((sum, s) => sum + s.count, 0);
  }

  function removeInventoryItem(itemId, amount) {
    let remaining = Math.max(0, Math.floor(toNumber(amount, 0)));
    if (remaining <= 0) {
      return true;
    }
    const slots = state.riftDelve.inventory.slots;
    for (let i = 0; i < slots.length && remaining > 0; i += 1) {
      const slot = slots[i];
      if (!slot || slot.itemId !== itemId) {
        continue;
      }
      const take = Math.min(slot.count, remaining);
      slot.count -= take;
      remaining -= take;
      if (slot.count <= 0) {
        slots[i] = null;
      }
    }
    syncEquippedTools();
    return remaining <= 0;
  }

  function hasToolEquipped(toolTag) {
    const eq = state.riftDelve.inventory.equipped || {};
    if (eq.mainHand === toolTag || eq.offHand === toolTag) {
      return true;
    }
    return state.riftDelve.inventory.slots.some((s) => s && s.toolTag === toolTag);
  }

  function getEquippedToolTags() {
    const eq = state.riftDelve.inventory.equipped || {};
    const tags = [];
    if (eq.mainHand) {
      tags.push(eq.mainHand);
    }
    if (eq.offHand && eq.offHand !== eq.mainHand) {
      tags.push(eq.offHand);
    }
    return tags;
  }

  function getPlayerCombatPower() {
    const base = Math.max(1, Math.floor(toNumber(config.player?.basePower, 3)));
    const toolPower = config.player?.toolPower || {};
    const fromTools = getEquippedToolTags().reduce(
      (sum, tag) => sum + Math.max(0, toNumber(toolPower[tag], 0)),
      0
    );
    return (
      base +
      fromTools +
      Math.max(0, Math.floor(relicBonuses().powerBonus + metaBonuses().powerBonus))
    );
  }

  // --- run helpers ---------------------------------------------------------

  function getUnlockNodeId() {
    return typeof config.unlockNodeId === "string" && config.unlockNodeId
      ? config.unlockNodeId
      : "riftDelveKeystone";
  }

  function isUnlocked() {
    return isUnlockMet(state, { type: "ascensionNode", value: getUnlockNodeId() });
  }

  function getRun() {
    return state.riftDelve.activeRun || null;
  }

  function getCurrentRoom() {
    const run = getRun();
    if (!run || !run.rooms) {
      return null;
    }
    return run.rooms[run.currentRoomId] || null;
  }

  function getWallSet(room) {
    return new Set(Array.isArray(room.walls) ? room.walls : []);
  }

  function isWithinGrid(x, y, grid) {
    return x >= 0 && x < grid.width && y >= 0 && y < grid.height;
  }

  function getDoorByPosition(room, x, y) {
    const doors = room?.doors || {};
    for (const dir of Object.keys(doors)) {
      const d = doors[dir];
      if (d && d.x === x && d.y === y) {
        return d;
      }
    }
    return null;
  }

  function getInteractionAt(room, x, y) {
    if (room.special && room.special.type === "descend" && room.special.x === x && room.special.y === y) {
      return { type: "descend" };
    }
    const chest = room.chests.find((c) => !c.opened && c.x === x && c.y === y);
    if (chest) {
      return { type: "chest", chestId: chest.chestId };
    }
    const mob = room.mobs.find((m) => m.alive && m.x === x && m.y === y);
    if (mob) {
      return { type: "mob", mobId: mob.mobId };
    }
    const item = room.floorItems.find((i) => !i.pickedUp && i.x === x && i.y === y);
    if (item) {
      return { type: "item", entityId: item.entityId };
    }
    const node = room.gatherNodes.find((n) => n.remainingCharges > 0 && n.x === x && n.y === y);
    if (node) {
      return { type: "gather", nodeId: node.nodeId };
    }
    const door = getDoorByPosition(room, x, y);
    if (door) {
      return { type: "door", direction: door.direction };
    }
    return null;
  }

  function buildPathBfs(start, target, grid, isBlocked) {
    if (start.x === target.x && start.y === target.y) {
      return [];
    }
    const startKey = positionKey(start.x, start.y);
    const targetKey = positionKey(target.x, target.y);
    const queue = [{ x: start.x, y: start.y }];
    const visited = new Set([startKey]);
    const parent = new Map();
    const dirs = [
      { dx: 1, dy: 0 },
      { dx: -1, dy: 0 },
      { dx: 0, dy: 1 },
      { dx: 0, dy: -1 },
      { dx: 1, dy: 1 },
      { dx: 1, dy: -1 },
      { dx: -1, dy: 1 },
      { dx: -1, dy: -1 }
    ];
    let found = false;
    while (queue.length > 0 && !found) {
      const cur = queue.shift();
      for (const d of dirs) {
        const nx = cur.x + d.dx;
        const ny = cur.y + d.dy;
        if (!isWithinGrid(nx, ny, grid)) {
          continue;
        }
        if (isBlocked(nx, ny)) {
          continue;
        }
        // No diagonal corner-cutting: both shared orthogonal tiles must be open.
        if (d.dx !== 0 && d.dy !== 0) {
          if (isBlocked(cur.x + d.dx, cur.y) || isBlocked(cur.x, cur.y + d.dy)) {
            continue;
          }
        }
        const nk = positionKey(nx, ny);
        if (visited.has(nk)) {
          continue;
        }
        visited.add(nk);
        parent.set(nk, positionKey(cur.x, cur.y));
        if (nk === targetKey) {
          found = true;
          break;
        }
        queue.push({ x: nx, y: ny });
      }
    }
    if (!found) {
      return null;
    }
    const path = [];
    let cursor = targetKey;
    while (cursor && cursor !== startKey) {
      const [px, py] = cursor.split(",");
      path.push({ x: Number(px), y: Number(py) });
      cursor = parent.get(cursor);
    }
    path.reverse();
    return path;
  }

  function stepMsForRoom(room) {
    const base = clampInt(room?.grid?.stepMs, 40, 2000);
    return Math.max(40, Math.round(base * relicBonuses().stepMult));
  }

  function rollLoot(count) {
    const mult = relicBonuses().lootMult;
    return Math.max(1, Math.floor(toNumber(count, 1) * mult));
  }

  // --- combat --------------------------------------------------------------

  function startCombat(mob) {
    const run = getRun();
    run.movement = null;
    run.combat = { mobId: mob.mobId, roomId: run.currentRoomId, accMs: 0 };
    eventBus.emit("dungeon:combatStart", {
      roomId: run.currentRoomId,
      x: mob.x,
      y: mob.y,
      mobName: mob.name,
      mobType: mob.mobType,
      mobHp: mob.hp,
      mobMaxHp: mob.maxHp
    });
  }

  function endRunFailed(reasonMob) {
    const run = getRun();
    const depth = run ? run.depth : state.riftDelve.meta.depth;
    state.riftDelve.activeRun = null;
    resetInventoryState();
    eventBus.emit("dungeon:runFailed", {
      depth,
      mobName: reasonMob?.name || "the rift"
    });
  }

  function resolveCombatTick() {
    const run = getRun();
    if (!run || !run.combat) {
      return;
    }
    const room = run.rooms[run.combat.roomId];
    const mob = room?.mobs.find((m) => m.mobId === run.combat.mobId);
    if (!mob || !mob.alive) {
      run.combat = null;
      return;
    }

    const power = getPlayerCombatPower();
    mob.hp -= power;
    if (mob.hp <= 0) {
      mob.alive = false;
      run.combat = null;
      const loot = [];
      mob.drops.forEach((drop) => {
        const amount = rollLoot(drop.count);
        const added = addInventoryItem(drop.itemId, amount);
        loot.push({ itemId: drop.itemId, count: amount, collected: added.ok });
      });
      eventBus.emit("dungeon:mobDefeated", {
        roomId: room.roomId,
        x: mob.x,
        y: mob.y,
        mobName: mob.name,
        mobType: mob.mobType,
        loot
      });
      return;
    }

    const reduce = Math.max(0, Math.floor(metaBonuses().damageReduce));
    const dealt = Math.max(1, Math.floor(toNumber(mob.damage, 1)) - reduce);
    run.player.hp = Math.max(0, run.player.hp - dealt);
    eventBus.emit("dungeon:playerHurt", {
      roomId: room.roomId,
      x: run.player.x,
      y: run.player.y,
      damage: dealt,
      hp: run.player.hp,
      maxHp: run.player.maxHp
    });
    if (run.player.hp <= 0) {
      endRunFailed(mob);
      return;
    }
    if (metaBonuses().autoHeal) {
      const threshold = toNumber(config.autoHealThreshold, 0.35);
      if (run.player.hp <= run.player.maxHp * threshold) {
        autoUseBestHeal();
      }
    }
  }

  function autoUseBestHeal() {
    const run = getRun();
    if (!run || run.player.hp >= run.player.maxHp) {
      return;
    }
    const slots = state.riftDelve.inventory.slots;
    let bestIdx = -1;
    let bestHeal = 0;
    for (let i = 0; i < slots.length; i += 1) {
      const slot = slots[i];
      if (!slot) {
        continue;
      }
      const def = getItemDef(slot.itemId);
      if (def && def.type === "consumable" && toNumber(def.heal, 0) > bestHeal) {
        bestHeal = toNumber(def.heal, 0);
        bestIdx = i;
      }
    }
    if (bestIdx >= 0) {
      useInventorySlot(bestIdx);
    }
  }

  function aggroCheck() {
    const run = getRun();
    if (!run || run.combat) {
      return;
    }
    const room = getCurrentRoom();
    if (!room) {
      return;
    }
    const threat = room.mobs
      .filter((m) => m.alive && chebyshev(run.player, m) <= 1)
      .sort((a, b) => chebyshev(run.player, a) - chebyshev(run.player, b))[0];
    if (threat) {
      startCombat(threat);
    }
  }

  // --- crafting ------------------------------------------------------------

  function canCraftRecipe(recipe) {
    return (recipe.costs || []).every((c) => countInventoryItem(c.itemId) >= c.count);
  }

  function getRecipeStatus() {
    const recipes = Array.isArray(config.craftingRecipes) ? config.craftingRecipes : [];
    return recipes.map((recipe) => ({ ...recipe, canCraft: canCraftRecipe(recipe) }));
  }

  // --- status --------------------------------------------------------------

  function getRelicTree() {
    const tree = config.relicTree || {};
    const owned = state.riftDelve.relicUpgrades || {};
    const relics = clampInt(state.riftDelve.relics, 0, Number.MAX_SAFE_INTEGER);
    return Object.entries(tree).map(([id, def]) => {
      const level = clampInt(owned[id], 0, toNumber(def.maxLevel, 0));
      const maxLevel = Math.max(1, Math.floor(toNumber(def.maxLevel, 1)));
      const maxed = level >= maxLevel;
      const cost = maxed
        ? 0
        : Math.ceil(toNumber(def.baseCost, 1) * Math.pow(toNumber(def.costGrowth, 1.5), level));
      return {
        id,
        name: def.name || id,
        desc: def.desc || "",
        level,
        maxLevel,
        maxed,
        cost,
        canAfford: !maxed && relics >= cost
      };
    });
  }

  function metaCraftCost(def, level) {
    const growth = toNumber(def.costGrowth, 1.6);
    const out = {};
    Object.entries(def.baseCost || {}).forEach(([res, amt]) => {
      out[res] = Math.ceil(toNumber(amt, 1) * Math.pow(growth, level));
    });
    return out;
  }

  function getMetaResources() {
    const res = state.riftDelve.metaResources || {};
    return Object.keys(res)
      .filter((id) => clampInt(res[id], 0, Number.MAX_SAFE_INTEGER) > 0)
      .map((id) => ({
        itemId: id,
        name: getItemDef(id)?.name || id,
        count: clampInt(res[id], 0, Number.MAX_SAFE_INTEGER)
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  function getMetaCraftList() {
    const tree = config.metaCrafts || {};
    const owned = state.riftDelve.metaCrafts || {};
    const res = state.riftDelve.metaResources || {};
    return Object.entries(tree).map(([id, def]) => {
      const level = clampInt(owned[id], 0, toNumber(def.maxLevel, 0));
      const maxLevel = Math.max(1, Math.floor(toNumber(def.maxLevel, 1)));
      const maxed = level >= maxLevel;
      const cost = maxed ? {} : metaCraftCost(def, level);
      const costList = Object.entries(cost).map(([r, a]) => ({
        itemId: r,
        name: getItemDef(r)?.name || r,
        amount: a,
        have: clampInt(res[r], 0, Number.MAX_SAFE_INTEGER)
      }));
      const canAfford = !maxed && costList.every((c) => c.have >= c.amount);
      return {
        id,
        name: def.name || id,
        desc: def.desc || "",
        level,
        maxLevel,
        maxed,
        cost: costList,
        canAfford
      };
    });
  }

  function craftMeta(id) {
    const def = (config.metaCrafts || {})[id];
    if (!def) {
      return { ok: false, reason: "Unknown workshop upgrade." };
    }
    const owned = state.riftDelve.metaCrafts || {};
    const level = clampInt(owned[id], 0, toNumber(def.maxLevel, 0));
    const maxLevel = Math.max(1, Math.floor(toNumber(def.maxLevel, 1)));
    if (level >= maxLevel) {
      return { ok: false, reason: "Already maxed." };
    }
    const cost = metaCraftCost(def, level);
    const res = state.riftDelve.metaResources || {};
    const lacking = Object.entries(cost).find(
      ([r, a]) => clampInt(res[r], 0, Number.MAX_SAFE_INTEGER) < a
    );
    if (lacking) {
      const d = getItemDef(lacking[0]);
      return { ok: false, reason: `Need ${lacking[1]} ${d?.name || lacking[0]}.` };
    }
    Object.entries(cost).forEach(([r, a]) => {
      const left = clampInt(res[r], 0, Number.MAX_SAFE_INTEGER) - a;
      if (left > 0) {
        res[r] = left;
      } else {
        delete res[r];
      }
    });
    state.riftDelve.metaResources = res;
    state.riftDelve.metaCrafts = { ...owned, [id]: level + 1 };
    eventBus.emit("dungeon:metaCrafted", { id, name: def.name || id, level: level + 1 });
    return { ok: true, level: level + 1 };
  }

  function getMap() {
    const run = getRun();
    if (!run) {
      return null;
    }
    const revealed = new Set(Array.isArray(run.revealed) ? run.revealed : []);
    const known = new Set();
    revealed.forEach((id) => {
      const r = run.rooms[id];
      Object.values(r?.doors || {}).forEach((d) => {
        if (!d.blocked && d.targetRoomId) {
          known.add(d.targetRoomId);
        }
      });
    });
    const cur = run.rooms[run.currentRoomId];
    const nodes = Object.values(run.rooms)
      .filter((r) => revealed.has(r.roomId) || known.has(r.roomId))
      .map((r) => ({
        roomId: r.roomId,
        x: r.mapX || 0,
        y: r.mapY || 0,
        explored: revealed.has(r.roomId),
        isCurrent: r.roomId === run.currentRoomId,
        isDescend: r.roomId === run.descendRoomId,
        isBoss: Boolean(r.isBoss),
        bossCleared: Boolean(r.isBoss) && !(r.mobs || []).some((m) => m.boss && m.alive)
      }));
    return { currentX: cur?.mapX || 0, currentY: cur?.mapY || 0, nodes };
  }

  function getStatus() {
    const run = getRun();
    const currentRoom = getCurrentRoom();
    return {
      unlocked: isUnlocked(),
      unlockNodeId: getUnlockNodeId(),
      meta: state.riftDelve.meta,
      relics: clampInt(state.riftDelve.relics, 0, Number.MAX_SAFE_INTEGER),
      rewards: state.riftDelve.rewards,
      activeRun: run,
      currentRoom,
      inventory: state.riftDelve.inventory,
      recipes: getRecipeStatus(),
      relicTree: getRelicTree(),
      metaResources: getMetaResources(),
      metaCraftList: getMetaCraftList(),
      map: getMap(),
      movement: run?.movement || null,
      combat: run?.combat || null,
      player: run?.player || null,
      playerPower: getPlayerCombatPower(),
      playerHp: run?.player?.hp ?? 0,
      playerMaxHp: run?.player?.maxHp ?? getPlayerMaxHp()
    };
  }

  // --- run lifecycle -------------------------------------------------------

  function validateRunStructure(run) {
    if (!run || typeof run !== "object" || !run.rooms) {
      return "Generator returned no rooms.";
    }
    if (!run.rooms[run.currentRoomId]) {
      return "Start room missing.";
    }
    if (!run.rooms[run.descendRoomId] || run.rooms[run.descendRoomId].special?.type !== "descend") {
      return "Descend room missing.";
    }
    // Graph reachability start -> descend over open doors.
    const seen = new Set([run.startRoomId]);
    const queue = [run.startRoomId];
    while (queue.length > 0) {
      const room = run.rooms[queue.shift()];
      Object.values(room?.doors || {}).forEach((d) => {
        if (d.blocked || !d.targetRoomId || seen.has(d.targetRoomId)) {
          return;
        }
        seen.add(d.targetRoomId);
        queue.push(d.targetRoomId);
      });
    }
    if (!seen.has(run.descendRoomId)) {
      return "Descend room unreachable in graph.";
    }
    // Each room: spawn must reach every open door + special over walls.
    for (const room of Object.values(run.rooms)) {
      const walls = getWallSet(room);
      const reach = new Set([positionKey(room.spawn.x, room.spawn.y)]);
      const q = [{ x: room.spawn.x, y: room.spawn.y }];
      while (q.length > 0) {
        const c = q.shift();
        [
          { x: c.x + 1, y: c.y },
          { x: c.x - 1, y: c.y },
          { x: c.x, y: c.y + 1 },
          { x: c.x, y: c.y - 1 }
        ].forEach((n) => {
          if (!isWithinGrid(n.x, n.y, room.grid)) {
            return;
          }
          const k = positionKey(n.x, n.y);
          if (reach.has(k) || walls.has(k)) {
            return;
          }
          reach.add(k);
          q.push(n);
        });
      }
      const targets = [];
      Object.values(room.doors || {}).forEach((d) => {
        if (!d.blocked) {
          targets.push(d);
        }
      });
      if (room.special) {
        targets.push(room.special);
      }
      for (const t of targets) {
        if (!reach.has(positionKey(t.x, t.y))) {
          return `Unreachable target in ${room.roomId}.`;
        }
      }
    }
    return null;
  }

  function runSafetyValidation(options = {}) {
    const sampleCount = clampInt(options.sampleCount, 1, 200);
    const startDepth = clampInt(options.startDepth ?? state.riftDelve.meta.depth, 1, 999);
    const failures = [];
    for (let i = 0; i < sampleCount; i += 1) {
      const depth = clampInt(startDepth + i, 1, 999);
      try {
        const run = generateRun({ config, depth, runCounter: i + 1 });
        const issue = validateRunStructure(run);
        if (issue) {
          failures.push({ index: i, depth, seed: run?.seed || 0, reason: issue });
        }
      } catch (error) {
        failures.push({
          index: i,
          depth,
          seed: 0,
          reason: error instanceof Error ? error.message : "Unexpected error."
        });
      }
    }
    return { ok: failures.length === 0, sampleCount, startDepth, failures };
  }

  function startRun() {
    if (!isUnlocked()) {
      return { ok: false, reason: "Unlock Rift Delve Keystone in Ascend." };
    }
    if (getRun()) {
      return { ok: false, reason: "A Rift Delve run is already active." };
    }

    state.riftDelve.meta.seededRunCounter += 1;
    let run;
    try {
      run = generateRun({
        config,
        depth: state.riftDelve.meta.depth,
        runCounter: state.riftDelve.meta.seededRunCounter
      });
    } catch (error) {
      return {
        ok: false,
        reason: `Rift generation failed: ${error instanceof Error ? error.message : "unknown"}.`
      };
    }
    const issue = validateRunStructure(run);
    if (issue) {
      return { ok: false, reason: `Rift generation invalid: ${issue}` };
    }

    resetInventoryState();

    const maxHp = getPlayerMaxHp();
    run.player.hp = maxHp;
    run.player.maxHp = maxHp;
    state.riftDelve.activeRun = run;

    const startTool = relicBonuses().startTool;
    if (startTool) {
      addInventoryItem(startTool, 1);
    }
    const healCharges = Math.floor(metaBonuses().healStoneCharges);
    if (healCharges > 0) {
      addInventoryItem("healStone", healCharges);
    }

    eventBus.emit("dungeon:start", { depth: run.depth, runId: run.runId });
    return { ok: true };
  }

  function abandonRun() {
    if (!getRun()) {
      return { ok: false, reason: "No active run to abandon." };
    }
    state.riftDelve.activeRun = null;
    resetInventoryState();
    eventBus.emit("dungeon:abandon", {});
    return { ok: true };
  }

  function doorInnerTile(door, grid) {
    if (!door) {
      return null;
    }
    if (door.direction === "north") {
      return { x: door.x, y: 1 };
    }
    if (door.direction === "south") {
      return { x: door.x, y: grid.height - 2 };
    }
    if (door.direction === "east") {
      return { x: grid.width - 2, y: door.y };
    }
    return { x: 1, y: door.y }; // west
  }

  function transitionToRoom(targetRoomId) {
    const run = getRun();
    const fromRoomId = run.currentRoomId;
    const targetRoom = run.rooms[targetRoomId];
    if (!targetRoom) {
      return false;
    }
    run.currentRoomId = targetRoomId;
    // Arrive at the doorway that leads back the way we came.
    const backDoor = Object.values(targetRoom.doors || {}).find(
      (d) => d && !d.blocked && d.targetRoomId === fromRoomId
    );
    const entry = doorInnerTile(backDoor, targetRoom.grid) || targetRoom.spawn;
    run.player = {
      x: entry.x,
      y: entry.y,
      hp: run.player.hp,
      maxHp: run.player.maxHp
    };
    run.movement = null;
    run.combat = null;
    if (!Array.isArray(run.revealed)) {
      run.revealed = [];
    }
    if (!run.revealed.includes(targetRoomId)) {
      run.revealed.push(targetRoomId);
    }
    if (!targetRoom.visited) {
      targetRoom.visited = true;
      state.riftDelve.meta.totalRoomsCleared += 1;
    }
    eventBus.emit("dungeon:roomEntered", { roomId: targetRoomId, depth: run.depth });
    aggroCheck();
    return true;
  }

  // --- interactions --------------------------------------------------------

  function isAdjacentOrSame(x, y) {
    return chebyshev(getRun().player, { x, y }) <= 1;
  }

  function pickupItem(entityId) {
    const run = getRun();
    const room = getCurrentRoom();
    const item = room?.floorItems.find((i) => i.entityId === entityId);
    if (!item) {
      return { ok: false, reason: "Item not found." };
    }
    if (item.pickedUp) {
      return { ok: false, reason: "Already picked up." };
    }
    if (!isAdjacentOrSame(item.x, item.y)) {
      return { ok: false, reason: "Move next to the item." };
    }
    const added = addInventoryItem(item.itemId, 1);
    if (!added.ok) {
      return added;
    }
    item.pickedUp = true;
    eventBus.emit("dungeon:pickup", {
      roomId: room.roomId,
      x: item.x,
      y: item.y,
      itemId: item.itemId,
      itemName: item.name,
      count: 1
    });
    return { ok: true };
  }

  function gatherNode(nodeId) {
    const room = getCurrentRoom();
    const node = room?.gatherNodes.find((n) => n.nodeId === nodeId);
    if (!node) {
      return { ok: false, reason: "Resource not found." };
    }
    if (node.remainingCharges <= 0) {
      return { ok: false, reason: `${node.name} is depleted.` };
    }
    if (!isAdjacentOrSame(node.x, node.y)) {
      return { ok: false, reason: "Move next to this resource." };
    }
    if (node.requiredTool && !hasToolEquipped(node.requiredTool)) {
      return { ok: false, reason: `Need a ${node.requiredTool} to gather here.` };
    }
    const amount = rollLoot(node.yieldCount);
    const added = addInventoryItem(node.yieldItemId, amount);
    if (!added.ok) {
      return added;
    }
    node.remainingCharges -= 1;
    eventBus.emit("dungeon:gather", {
      roomId: room.roomId,
      x: node.x,
      y: node.y,
      nodeType: node.nodeType,
      nodeName: node.name,
      itemId: node.yieldItemId,
      itemName: getItemDef(node.yieldItemId)?.name || node.yieldItemId,
      amount
    });
    return { ok: true };
  }

  function fightMob(mobId) {
    const run = getRun();
    const room = getCurrentRoom();
    const mob = room?.mobs.find((m) => m.mobId === mobId);
    if (!mob) {
      return { ok: false, reason: "Mob not found." };
    }
    if (!mob.alive) {
      return { ok: false, reason: "Already defeated." };
    }
    if (run.combat) {
      return { ok: false, reason: "Already fighting." };
    }
    if (!isAdjacentOrSame(mob.x, mob.y)) {
      return { ok: false, reason: "Move next to the mob to engage." };
    }
    startCombat(mob);
    return { ok: true, message: `Engaging ${mob.name}.` };
  }

  function openChest(chestId) {
    const room = getCurrentRoom();
    const chest = room?.chests.find((c) => c.chestId === chestId);
    if (!chest) {
      return { ok: false, reason: "Chest not found." };
    }
    if (chest.opened) {
      return { ok: false, reason: "Already opened." };
    }
    if (!isAdjacentOrSame(chest.x, chest.y)) {
      return { ok: false, reason: "Move next to the chest." };
    }
    chest.opened = true;
    const loot = [];
    chest.loot.forEach((drop) => {
      const amount = rollLoot(drop.count);
      const added = addInventoryItem(drop.itemId, amount);
      loot.push({ itemId: drop.itemId, count: amount, collected: added.ok });
    });
    eventBus.emit("dungeon:chestOpened", {
      roomId: room.roomId,
      x: chest.x,
      y: chest.y,
      chestType: chest.chestType,
      chestName: chest.name,
      loot
    });
    return { ok: true, loot };
  }

  function craft(recipeId) {
    const room = getCurrentRoom();
    if (!room) {
      return { ok: false, reason: "No active run." };
    }
    const recipe = (config.craftingRecipes || []).find((r) => r.id === recipeId);
    if (!recipe) {
      return { ok: false, reason: "Unknown recipe." };
    }
    if (!canCraftRecipe(recipe)) {
      return { ok: false, reason: "Missing materials." };
    }
    const outDef = getItemDef(recipe.output?.itemId);
    if (!outDef) {
      return { ok: false, reason: "Recipe output not configured." };
    }
    recipe.costs.forEach((c) => removeInventoryItem(c.itemId, c.count));
    const outCount = Math.max(1, Math.floor(toNumber(recipe.output?.count, 1)));
    const added = addInventoryItem(recipe.output.itemId, outCount);
    if (!added.ok) {
      recipe.costs.forEach((c) => addInventoryItem(c.itemId, c.count));
      return added;
    }
    eventBus.emit("dungeon:craft", {
      roomId: room.roomId,
      x: room.special?.x ?? getRun().player.x,
      y: room.special?.y ?? getRun().player.y,
      recipeId,
      outputItemId: recipe.output.itemId,
      outputName: outDef.name || recipe.output.itemId,
      outputCount: outCount
    });
    return { ok: true };
  }

  function useInventorySlot(rawIndex) {
    const run = getRun();
    if (!run) {
      return { ok: false, reason: "No active run." };
    }
    const idx = Math.floor(toNumber(rawIndex, -1));
    const slots = state.riftDelve.inventory.slots;
    const slot = slots[idx];
    if (!slot) {
      return { ok: false, reason: "Empty slot." };
    }
    const def = getItemDef(slot.itemId);
    if (!def || def.type !== "consumable") {
      return { ok: false, reason: "That item cannot be used." };
    }
    const heal = Math.max(0, Math.floor(toNumber(def.heal, 0)));
    if (run.player.hp >= run.player.maxHp) {
      return { ok: false, reason: "Already at full health." };
    }
    run.player.hp = Math.min(run.player.maxHp, run.player.hp + heal);
    slot.count -= 1;
    if (slot.count <= 0) {
      slots[idx] = null;
    }
    eventBus.emit("dungeon:consumableUsed", {
      roomId: run.currentRoomId,
      x: run.player.x,
      y: run.player.y,
      itemName: def.name || slot.itemId,
      heal,
      hp: run.player.hp,
      maxHp: run.player.maxHp
    });
    return { ok: true, healed: heal };
  }

  function findNearbyDropTile(run, room) {
    const walls = getWallSet(room);
    const candidates = [
      { x: run.player.x, y: run.player.y },
      { x: run.player.x + 1, y: run.player.y },
      { x: run.player.x - 1, y: run.player.y },
      { x: run.player.x, y: run.player.y + 1 },
      { x: run.player.x, y: run.player.y - 1 }
    ];
    for (const c of candidates) {
      if (!isWithinGrid(c.x, c.y, room.grid)) {
        continue;
      }
      if (walls.has(positionKey(c.x, c.y))) {
        continue;
      }
      if (getInteractionAt(room, c.x, c.y)) {
        continue;
      }
      return c;
    }
    return null;
  }

  function dropInventorySlot(rawIndex) {
    const run = getRun();
    const room = getCurrentRoom();
    if (!run || !room) {
      return { ok: false, reason: "No active run." };
    }
    if (run.movement || run.combat) {
      return { ok: false, reason: "Cannot drop right now." };
    }
    const idx = Math.floor(toNumber(rawIndex, -1));
    const slots = state.riftDelve.inventory.slots;
    const slot = slots[idx];
    if (!slot) {
      return { ok: false, reason: "Empty slot." };
    }
    const tile = findNearbyDropTile(run, room);
    if (!tile) {
      return { ok: false, reason: "No free tile to drop here." };
    }
    run.droppedItemCounter = Math.max(0, Math.floor(toNumber(run.droppedItemCounter, 0))) + 1;
    room.floorItems.push({
      entityId: `${room.roomId}:drop:${run.droppedItemCounter}`,
      itemId: slot.itemId,
      name: slot.name || getItemDef(slot.itemId)?.name || slot.itemId,
      pickedUp: false,
      x: tile.x,
      y: tile.y
    });
    slot.count -= 1;
    if (slot.count <= 0) {
      slots[idx] = null;
    }
    syncEquippedTools();
    eventBus.emit("dungeon:drop", {
      roomId: room.roomId,
      x: tile.x,
      y: tile.y,
      itemId: slot.itemId,
      itemName: slot.name || slot.itemId,
      count: 1
    });
    return {
      ok: true,
      dropped: { itemName: slot.name || slot.itemId, count: 1, x: tile.x, y: tile.y }
    };
  }

  function interactDescend() {
    const run = getRun();
    const room = getCurrentRoom();
    if (!room || room.special?.type !== "descend") {
      return { ok: false, reason: "No black hole here." };
    }
    if (!isAdjacentOrSame(room.special.x, room.special.y)) {
      return { ok: false, reason: "Move next to the black hole." };
    }
    const depth = Math.max(1, Math.floor(toNumber(state.riftDelve.meta.depth, 1)));
    const rb = relicBonuses();
    const mult =
      (1 + Math.max(0, depth - 1) * toNumber(config.depthScaling?.rewardPerDepth, 0.12)) *
      rb.rewardMult;
    const base = config.rewards?.descendBase || { matter: 0, fire: 0, shards: 0, relics: 0 };
    const reward = {
      matter: Math.max(0, Math.floor(toNumber(base.matter, 0) * mult)),
      fire: Math.max(0, Math.floor(toNumber(base.fire, 0) * mult)),
      shards: Math.max(0, Math.floor(toNumber(base.shards, 0) * mult)),
      relics: Math.max(0, Math.floor(toNumber(base.relics, 0) * mult))
    };
    resourceManager.add("matter", reward.matter);
    resourceManager.add("fire", reward.fire);
    resourceManager.add("shards", reward.shards);
    state.riftDelve.relics = clampInt(state.riftDelve.relics, 0, Number.MAX_SAFE_INTEGER) + reward.relics;
    state.riftDelve.rewards.lifetime.relicsEarned += reward.relics;
    state.riftDelve.meta.totalDescends += 1;
    state.riftDelve.meta.bestDepth = Math.max(state.riftDelve.meta.bestDepth, depth);
    state.riftDelve.meta.depth = depth + 1;

    // Extract meta resources from the run inventory into the persistent store.
    const extracted = {};
    (state.riftDelve.inventory.slots || []).forEach((slot) => {
      if (!slot) {
        return;
      }
      const def = getItemDef(slot.itemId);
      if (def && def.meta) {
        const have = clampInt(state.riftDelve.metaResources[slot.itemId], 0, Number.MAX_SAFE_INTEGER);
        state.riftDelve.metaResources[slot.itemId] = have + slot.count;
        extracted[slot.itemId] = (extracted[slot.itemId] || 0) + slot.count;
      }
    });

    state.riftDelve.activeRun = null;
    resetInventoryState();
    eventBus.emit("dungeon:descend", {
      roomId: room.roomId,
      x: room.special.x,
      y: room.special.y,
      depth,
      reward,
      extracted,
      nextDepth: state.riftDelve.meta.depth
    });
    return { ok: true, reward, extracted, nextDepth: state.riftDelve.meta.depth };
  }

  function executeInteraction(interaction) {
    if (!interaction) {
      return { ok: false, reason: "Nothing to interact with." };
    }
    if (interaction.type === "descend") {
      return interactDescend();
    }
    if (interaction.type === "chest") {
      return openChest(interaction.chestId);
    }
    if (interaction.type === "mob") {
      return fightMob(interaction.mobId);
    }
    if (interaction.type === "item") {
      return pickupItem(interaction.entityId);
    }
    if (interaction.type === "gather") {
      return gatherNode(interaction.nodeId);
    }
    if (interaction.type === "door") {
      const room = getCurrentRoom();
      const door = room?.doors?.[interaction.direction];
      if (!door) {
        return { ok: false, reason: "Unknown door." };
      }
      if (door.blocked) {
        return { ok: false, reason: "That doorway is collapsed." };
      }
      if (!door.targetRoomId) {
        return { ok: false, reason: "That door leads nowhere." };
      }
      if (room?.isBoss && room.mobs.some((m) => m.boss && m.alive)) {
        return { ok: false, reason: "The boss seals the room — defeat it to proceed." };
      }
      if (!transitionToRoom(door.targetRoomId)) {
        return { ok: false, reason: "Door destination invalid." };
      }
      return { ok: true, message: "Entered next room." };
    }
    return { ok: false, reason: "Unknown interaction." };
  }

  function interactAtTile(x, y) {
    const run = getRun();
    const room = getCurrentRoom();
    if (!run || !room) {
      return { ok: false, reason: "No active run." };
    }
    if (run.combat) {
      return { ok: false, reason: "Busy fighting." };
    }
    if (!isAdjacentOrSame(x, y)) {
      return { ok: false, reason: "Move closer first." };
    }
    return executeInteraction(getInteractionAt(room, x, y));
  }

  function moveToTile(rawX, rawY) {
    const run = getRun();
    const room = getCurrentRoom();
    if (!run || !room) {
      return { ok: false, reason: "No active run." };
    }
    if (run.combat) {
      return { ok: false, reason: "Cannot move while fighting." };
    }
    const x = Math.floor(toNumber(rawX, -1));
    const y = Math.floor(toNumber(rawY, -1));
    if (!isWithinGrid(x, y, room.grid)) {
      return { ok: false, reason: "Outside the room." };
    }

    const walls = getWallSet(room);
    const gateBlocked = new Set(
      (room.mobs || [])
        .filter((m) => m.alive && m.gate)
        .map((m) => positionKey(m.x, m.y))
    );
    const interaction = getInteractionAt(room, x, y);

    if (interaction && isAdjacentOrSame(x, y)) {
      return executeInteraction(interaction);
    }

    const blockedFn = (tx, ty) => {
      if (tx === run.player.x && ty === run.player.y) {
        return false;
      }
      const k = positionKey(tx, ty);
      return walls.has(k) || gateBlocked.has(k);
    };

    if (interaction) {
      const adj = [
        { x, y },
        { x: x + 1, y },
        { x: x - 1, y },
        { x, y: y + 1 },
        { x, y: y - 1 },
        { x: x + 1, y: y + 1 },
        { x: x + 1, y: y - 1 },
        { x: x - 1, y: y + 1 },
        { x: x - 1, y: y - 1 }
      ].filter(
        (c) =>
          isWithinGrid(c.x, c.y, room.grid) &&
          !walls.has(positionKey(c.x, c.y)) &&
          !gateBlocked.has(positionKey(c.x, c.y))
      );
      let best = null;
      let bestTarget = null;
      for (const c of adj) {
        const path = buildPathBfs(run.player, c, room.grid, blockedFn);
        if (path && (!best || path.length < best.length)) {
          best = path;
          bestTarget = c;
        }
      }
      if (!best || !bestTarget) {
        return { ok: false, reason: "No path to that object." };
      }
      if (best.length === 0) {
        return executeInteraction(interaction);
      }
      run.movement = {
        steps: best,
        stepMs: stepMsForRoom(room),
        remainingMs: stepMsForRoom(room),
        target: bestTarget,
        onArrive: { type: "interact", x, y }
      };
      eventBus.emit("dungeon:move", {
        roomId: room.roomId,
        to: { x, y },
        steps: best.length
      });
      return { ok: true, message: "Moving." };
    }

    if (walls.has(positionKey(x, y))) {
      return { ok: false, reason: "That tile is solid rock." };
    }
    if (run.player.x === x && run.player.y === y) {
      return { ok: false, reason: "Already there." };
    }
    const path = buildPathBfs(run.player, { x, y }, room.grid, blockedFn);
    if (!path || path.length === 0) {
      return { ok: false, reason: "No path to that tile." };
    }
    run.movement = {
      steps: path,
      stepMs: stepMsForRoom(room),
      remainingMs: stepMsForRoom(room),
      target: { x, y },
      onArrive: null
    };
    eventBus.emit("dungeon:move", { roomId: room.roomId, to: { x, y }, steps: path.length });
    return { ok: true, message: "Moving." };
  }

  function buyRelicUpgrade(nodeId) {
    const tree = config.relicTree || {};
    const def = tree[nodeId];
    if (!def) {
      return { ok: false, reason: "Unknown relic upgrade." };
    }
    const owned = state.riftDelve.relicUpgrades || {};
    const level = clampInt(owned[nodeId], 0, toNumber(def.maxLevel, 0));
    const maxLevel = Math.max(1, Math.floor(toNumber(def.maxLevel, 1)));
    if (level >= maxLevel) {
      return { ok: false, reason: "Already maxed." };
    }
    const cost = Math.ceil(toNumber(def.baseCost, 1) * Math.pow(toNumber(def.costGrowth, 1.5), level));
    const relics = clampInt(state.riftDelve.relics, 0, Number.MAX_SAFE_INTEGER);
    if (relics < cost) {
      return { ok: false, reason: `Need ${cost} relics.` };
    }
    state.riftDelve.relics = relics - cost;
    state.riftDelve.relicUpgrades = { ...owned, [nodeId]: level + 1 };
    eventBus.emit("dungeon:relicPurchased", {
      nodeId,
      name: def.name || nodeId,
      level: level + 1,
      cost
    });
    return { ok: true, level: level + 1 };
  }

  // --- offline / tick advance ---------------------------------------------

  function advanceMovementStep() {
    const run = getRun();
    const movement = run.movement;
    const next = movement.steps.shift();
    if (next) {
      run.player.x = next.x;
      run.player.y = next.y;
    }
    aggroCheck();
    if (getRun()?.combat) {
      // combat interrupted the path
      if (getRun()) {
        getRun().movement = null;
      }
      return;
    }
    if (!run.movement) {
      return;
    }
    if (movement.steps.length > 0) {
      movement.remainingMs += movement.stepMs;
      return;
    }
    const arrival = movement.onArrive;
    run.movement = null;
    if (arrival?.type === "interact") {
      const room = getCurrentRoom();
      if (room) {
        executeInteraction(getInteractionAt(room, arrival.x, arrival.y));
      }
    }
  }

  function advance(dtSeconds, offlineMultiplier = 1) {
    if (!getRun()) {
      return;
    }
    const mult = Math.max(0, toNumber(offlineMultiplier, 1));
    let ms = Math.max(0, toNumber(dtSeconds, 0) * 1000 * mult);
    if (ms <= 0) {
      return;
    }
    let safety = 0;
    while (ms > 0 && getRun() && safety < 5000) {
      safety += 1;
      const run = getRun();
      if (run.combat) {
        const tickMs = clampInt(config.combat?.tickMs, 50, 5000);
        const need = tickMs - run.combat.accMs;
        const consume = Math.min(ms, need);
        run.combat.accMs += consume;
        ms -= consume;
        if (run.combat.accMs >= tickMs) {
          run.combat.accMs = 0;
          resolveCombatTick();
        }
        continue;
      }
      if (run.movement) {
        const consume = Math.min(ms, run.movement.remainingMs);
        run.movement.remainingMs -= consume;
        ms -= consume;
        if (run.movement.remainingMs > 0) {
          continue;
        }
        advanceMovementStep();
        continue;
      }
      break;
    }
  }

  return {
    getStatus,
    startRun,
    abandonRun,
    moveToTile,
    interactAtTile,
    pickupItem,
    gatherNode,
    fightMob,
    openChest,
    craft,
    useInventorySlot,
    dropInventorySlot,
    interactDescend,
    buyRelicUpgrade,
    getRelicTree,
    craftMeta,
    advance,
    runSafetyValidation
  };
}

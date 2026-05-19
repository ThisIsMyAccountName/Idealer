// Pure, seeded procedural generator for the Rift Delve.
// No game state, no eventBus — given config + depth + run counter it returns a
// fully-formed run graph. Same inputs always produce the same dungeon.

const DIRS = {
  north: { dx: 0, dy: -1 },
  south: { dx: 0, dy: 1 },
  east: { dx: 1, dy: 0 },
  west: { dx: -1, dy: 0 }
};
const OPPOSITE = { north: "south", south: "north", east: "west", west: "east" };
const DIR_NAMES = ["north", "south", "east", "west"];

function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function clampInt(value, min, max) {
  const v = Math.floor(toNumber(value, min));
  return Math.min(max, Math.max(min, v));
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeRng(seed) {
  const next = mulberry32(seed);
  const api = {
    next,
    int(min, max) {
      if (max < min) {
        return min;
      }
      return min + Math.floor(next() * (max - min + 1));
    },
    range(pair, fallback = 1) {
      if (Array.isArray(pair)) {
        return api.int(clampInt(pair[0], 0, 9999), clampInt(pair[1], 0, 9999));
      }
      return clampInt(pair, 0, 9999) || fallback;
    },
    pick(arr) {
      if (!Array.isArray(arr) || arr.length === 0) {
        return null;
      }
      return arr[Math.floor(next() * arr.length)];
    },
    chance(p) {
      return next() < p;
    },
    shuffle(arr) {
      for (let i = arr.length - 1; i > 0; i -= 1) {
        const j = Math.floor(next() * (i + 1));
        const tmp = arr[i];
        arr[i] = arr[j];
        arr[j] = tmp;
      }
      return arr;
    }
  };
  return api;
}

function key(x, y) {
  return `${x},${y}`;
}

function computeSeed(depth, runCounter) {
  const d = clampInt(depth, 1, 9999);
  const r = clampInt(runCounter, 0, 9_999_999);
  return ((Math.imul(d, 2654435761) ^ Math.imul(r + 1, 40503)) >>> 0);
}

function pickArchetype(rng, archetypes) {
  const entries = Object.entries(archetypes || {});
  if (entries.length === 0) {
    return null;
  }
  const total = entries.reduce((sum, [, def]) => sum + Math.max(0, toNumber(def.weight, 1)), 0);
  let roll = rng.next() * total;
  for (const [id, def] of entries) {
    roll -= Math.max(0, toNumber(def.weight, 1));
    if (roll <= 0) {
      return { id, def };
    }
  }
  const [id, def] = entries[entries.length - 1];
  return { id, def };
}

// --- graph layout ----------------------------------------------------------

function buildGraph(rng, config, depth) {
  const gen = config.generation || {};
  const baseRooms = clampInt(gen.baseRooms, 2, 50);
  const maxRooms = clampInt(gen.maxRooms, baseRooms, 60);
  const target = clampInt(
    Math.round(baseRooms + (depth - 1) * toNumber(gen.roomsPerDepth, 0.5)) + rng.int(0, 1),
    baseRooms,
    maxRooms
  );

  const cells = new Map(); // "gx,gy" -> node index
  const nodes = []; // { gx, gy, parent, dirFromParent, children:[], onSpine }

  function addNode(gx, gy, parent, dir) {
    const idx = nodes.length;
    nodes.push({ gx, gy, parent, dirFromParent: dir, children: [], onSpine: false });
    cells.set(key(gx, gy), idx);
    if (parent !== null) {
      nodes[parent].children.push(idx);
    }
    return idx;
  }

  // Spine = guaranteed critical path start -> descend (self-avoiding walk).
  const startIdx = addNode(0, 0, null, null);
  nodes[startIdx].onSpine = true;
  const spineLen = clampInt(Math.round(target * 0.6), 3, target);
  let cursor = startIdx;
  while (nodes.length < spineLen) {
    const cur = nodes[cursor];
    const options = rng.shuffle(DIR_NAMES.slice()).filter((dir) => {
      const nx = cur.gx + DIRS[dir].dx;
      const ny = cur.gy + DIRS[dir].dy;
      return !cells.has(key(nx, ny));
    });
    if (options.length === 0) {
      break; // trapped early — spine ends here
    }
    const dir = options[0];
    const nx = cur.gx + DIRS[dir].dx;
    const ny = cur.gy + DIRS[dir].dy;
    cursor = addNode(nx, ny, cursor, dir);
    nodes[cursor].onSpine = true;
  }
  const descendIdx = cursor;

  // Branch rooms hang off any node with a free side.
  let guard = 0;
  while (nodes.length < target && guard < target * 12) {
    guard += 1;
    const parentIdx = rng.int(0, nodes.length - 1);
    const p = nodes[parentIdx];
    const options = rng.shuffle(DIR_NAMES.slice()).filter((dir) => {
      const nx = p.gx + DIRS[dir].dx;
      const ny = p.gy + DIRS[dir].dy;
      return !cells.has(key(nx, ny));
    });
    if (options.length === 0) {
      continue;
    }
    const dir = options[0];
    addNode(p.gx + DIRS[dir].dx, p.gy + DIRS[dir].dy, parentIdx, dir);
  }

  return { nodes, startIdx, descendIdx };
}

// --- room interiors --------------------------------------------------------

function doorTile(direction, w, h) {
  const mx = Math.floor(w / 2);
  const my = Math.floor(h / 2);
  if (direction === "north") return { x: mx, y: 0 };
  if (direction === "south") return { x: mx, y: h - 1 };
  if (direction === "east") return { x: w - 1, y: my };
  return { x: 0, y: my }; // west
}

function innerTile(direction, w, h) {
  const mx = Math.floor(w / 2);
  const my = Math.floor(h / 2);
  if (direction === "north") return { x: mx, y: 1 };
  if (direction === "south") return { x: mx, y: h - 2 };
  if (direction === "east") return { x: w - 2, y: my };
  return { x: 1, y: my }; // west
}

function floodReach(spawn, w, h, walls) {
  const seen = new Set([key(spawn.x, spawn.y)]);
  const queue = [spawn];
  while (queue.length > 0) {
    const cur = queue.shift();
    for (const dir of DIR_NAMES) {
      const nx = cur.x + DIRS[dir].dx;
      const ny = cur.y + DIRS[dir].dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const k = key(nx, ny);
      if (seen.has(k) || walls.has(k)) continue;
      seen.add(k);
      queue.push({ x: nx, y: ny });
    }
  }
  return seen;
}

function carveCorridor(from, to, walls) {
  let cx = from.x;
  let cy = from.y;
  const step = (a, b) => (a < b ? 1 : a > b ? -1 : 0);
  while (cx !== to.x) {
    cx += step(cx, to.x);
    walls.delete(key(cx, cy));
  }
  while (cy !== to.y) {
    cy += step(cy, to.y);
    walls.delete(key(cx, cy));
  }
}

function generateRoomInterior(rng, config, node, roomId, depth, isStart, isDescend) {
  const grid = config.grid || {};
  const w = clampInt(grid.width, 7, 30);
  const h = clampInt(grid.height, 7, 30);
  const stepMs = clampInt(grid.stepMs, 40, 2000);

  let archetypeId = "combat";
  let archetypeDef = config.archetypes?.combat || {};
  let name = "Rift Room";
  let description = "";
  let specialType = null;

  if (isStart) {
    archetypeId = "start";
    archetypeDef = config.startRoom || {};
    name = archetypeDef.name || "Threshold";
    description = archetypeDef.description || "";
    specialType = archetypeDef.special || null;
  } else if (isDescend) {
    archetypeId = "descend";
    archetypeDef = config.descendRoom || {};
    name = archetypeDef.name || "Collapse Chamber";
    description = archetypeDef.description || "";
    specialType = archetypeDef.special || "descend";
  } else {
    const picked = pickArchetype(rng, config.archetypes);
    if (picked) {
      archetypeId = picked.id;
      archetypeDef = picked.def;
      name = picked.def.name || "Rift Room";
      description = picked.def.description || "";
      specialType = picked.def.special || null;
    }
  }

  // Walls: solid border + interior clusters. Doors carve openings.
  const walls = new Set();
  for (let x = 0; x < w; x += 1) {
    walls.add(key(x, 0));
    walls.add(key(x, h - 1));
  }
  for (let y = 0; y < h; y += 1) {
    walls.add(key(0, y));
    walls.add(key(w - 1, y));
  }

  const spawn = { x: Math.floor(w / 2), y: Math.floor(h / 2) };

  // Doors from graph edges (+ cosmetic collapsed dead-ends on free sides).
  const doors = {};
  const reservedClear = new Set([key(spawn.x, spawn.y)]);

  function addOpenDoor(direction, targetRoomId) {
    const dt = doorTile(direction, w, h);
    const it = innerTile(direction, w, h);
    walls.delete(key(dt.x, dt.y));
    walls.delete(key(it.x, it.y));
    reservedClear.add(key(dt.x, dt.y));
    reservedClear.add(key(it.x, it.y));
    doors[direction] = {
      direction,
      x: dt.x,
      y: dt.y,
      targetRoomId,
      blocked: false,
      open: true
    };
  }

  return {
    roomId,
    archetype: archetypeId,
    name,
    description,
    grid: { width: w, height: h, stepMs },
    walls: [],
    spawn,
    doors,
    floorItems: [],
    gatherNodes: [],
    mobs: [],
    chests: [],
    special: specialType ? { type: specialType } : null,
    visited: false,
    // internals used during a second pass
    __ctx: { rng, config, node, depth, isStart, isDescend, w, h, walls, reservedClear, archetypeDef, addOpenDoor }
  };
}

function populateRoom(room) {
  const { rng, config, node, depth, isStart, isDescend, w, h, walls, reservedClear, archetypeDef, addOpenDoor } = room.__ctx;

  // Open doors for tree edges.
  if (node.parent !== null) {
    addOpenDoor(OPPOSITE[node.dirFromParent], `room-${node.parent}`);
  }
  node.children.forEach((childIdx, i) => {
    // childDir is recorded on the child node; map by lookup in caller.
    const dir = node.childDirs ? node.childDirs[i] : null;
    if (dir) {
      addOpenDoor(dir, `room-${childIdx}`);
    }
  });

  // Cosmetic collapsed doors on remaining free sides.
  const collapsedChance = toNumber(config.generation?.collapsedDoorChance, 0.18);
  DIR_NAMES.forEach((dir) => {
    if (room.doors[dir]) return;
    if (!rng.chance(collapsedChance)) return;
    const dt = doorTile(dir, w, h);
    room.doors[dir] = {
      direction: dir,
      x: dt.x,
      y: dt.y,
      targetRoomId: null,
      blocked: true,
      open: false
    };
  });

  const lootCount = (range) => {
    const base = rng.range(range, 1);
    return Math.max(1, base);
  };

  const ds = config.depthScaling || {};
  const eligibleMobs = (config.mobPool || []).filter(
    (id) => toNumber(config.mobDefs?.[id]?.minDepth, 1) <= depth
  );
  const bossScale = config.bossScaling || {};
  let mobIndex = 0;
  function spawnMob(mobId, tx, ty, gate = false, boss = false) {
    const def = config.mobDefs?.[mobId] || {};
    let power = Math.ceil(toNumber(def.basePower, 2) * (1 + (depth - 1) * toNumber(ds.mobPowerPerDepth, 0.18)));
    let maxHp = Math.ceil(toNumber(def.baseHp, 10) * (1 + (depth - 1) * toNumber(ds.mobHpPerDepth, 0.22)));
    let damage = Math.ceil(toNumber(def.baseDamage, 3) * (1 + (depth - 1) * toNumber(ds.mobDamagePerDepth, 0.12)));
    if (boss) {
      power = Math.ceil(power * toNumber(bossScale.power, 2.2));
      maxHp = Math.ceil(maxHp * toNumber(bossScale.hp, 4));
      damage = Math.ceil(damage * toNumber(bossScale.damage, 1.6));
    }
    const baseDrops = (Array.isArray(def.drops) ? def.drops : []).map((d) => ({
      itemId: d.itemId,
      count: lootCount(d.count) * (boss ? Math.max(2, Math.floor(toNumber(bossScale.loot, 3))) : 1)
    }));
    const mob = {
      mobId: `${room.roomId}:mob:${mobIndex}`,
      mobType: mobId,
      name: boss ? `${config.bossName || "Rift Warden"} (Boss)` : (def.name || mobId),
      alive: true,
      gate: Boolean(gate),
      boss: Boolean(boss),
      power,
      hp: maxHp,
      maxHp,
      damage,
      drops: baseDrops,
      x: tx,
      y: ty
    };
    mobIndex += 1;
    room.mobs.push(mob);
    return mob;
  }

  // A barrier wall cuts the room with a single opening guarded by a mob that
  // must be cleared to pass; otherwise scatter light obstacle clusters.
  const canBarrier =
    !isStart &&
    !isDescend &&
    !room.isBoss &&
    eligibleMobs.length > 0 &&
    rng.chance(toNumber(config.generation?.barrierChance, 0.5));

  if (canBarrier) {
    const vertical = rng.chance(0.5);
    if (vertical) {
      let bx = rng.int(3, w - 4);
      if (Math.abs(bx - room.spawn.x) < 2) {
        bx = bx <= room.spawn.x ? Math.max(2, room.spawn.x - 2) : Math.min(w - 3, room.spawn.x + 2);
      }
      const gy = rng.int(2, h - 3);
      for (let y = 1; y < h - 1; y += 1) {
        if (y === gy) continue;
        const k = key(bx, y);
        if (!reservedClear.has(k)) {
          walls.add(k);
        }
      }
      spawnMob(rng.pick(eligibleMobs), bx, gy, true);
    } else {
      let by = rng.int(3, h - 4);
      if (Math.abs(by - room.spawn.y) < 2) {
        by = by <= room.spawn.y ? Math.max(2, room.spawn.y - 2) : Math.min(h - 3, room.spawn.y + 2);
      }
      const gx = rng.int(2, w - 3);
      for (let x = 1; x < w - 1; x += 1) {
        if (x === gx) continue;
        const k = key(x, by);
        if (!reservedClear.has(k)) {
          walls.add(k);
        }
      }
      spawnMob(rng.pick(eligibleMobs), gx, by, true);
    }
  } else {
    const clusterCount = rng.range(config.generation?.obstacleClusters || [2, 5]);
    const clusterSize = config.generation?.clusterSize || [2, 4];
    for (let c = 0; c < clusterCount; c += 1) {
      let cx = rng.int(2, w - 3);
      let cy = rng.int(2, h - 3);
      const size = rng.range(clusterSize);
      for (let s = 0; s < size; s += 1) {
        const k = key(cx, cy);
        const nearSpawn = Math.abs(cx - room.spawn.x) <= 1 && Math.abs(cy - room.spawn.y) <= 1;
        if (!nearSpawn && !reservedClear.has(k)) {
          walls.add(k);
        }
        const dir = rng.pick(DIR_NAMES);
        cx = Math.min(w - 2, Math.max(1, cx + DIRS[dir].dx));
        cy = Math.min(h - 2, Math.max(1, cy + DIRS[dir].dy));
      }
    }
  }

  // Free interior tiles for entities.
  const free = [];
  for (let y = 1; y < h - 1; y += 1) {
    for (let x = 1; x < w - 1; x += 1) {
      const k = key(x, y);
      if (walls.has(k)) continue;
      if (Math.abs(x - room.spawn.x) <= 1 && Math.abs(y - room.spawn.y) <= 1) continue;
      if (reservedClear.has(k)) continue;
      free.push({ x, y });
    }
  }
  rng.shuffle(free);
  let cur = 0;
  const takeTile = () => (cur < free.length ? free[cur++] : null);

  const counts = (rangeOrDefault, fallback) => {
    const r = rangeOrDefault || fallback;
    return rng.range(r);
  };

  // Boss room: a single powerful boss that seals the room until defeated.
  if (room.isBoss && eligibleMobs.length > 0) {
    const tile = takeTile();
    if (tile) {
      const bossType = eligibleMobs[eligibleMobs.length - 1];
      spawnMob(bossType, tile.x, tile.y, false, true);
    }
  }

  // Roaming mobs (in addition to any barrier gate / boss mob already placed).
  const mobCount = isStart || isDescend || room.isBoss ? 0 : counts(archetypeDef.mobs, [0, 1]);
  for (let i = 0; i < mobCount; i += 1) {
    const tile = takeTile();
    if (!tile) break;
    spawnMob(rng.pick(eligibleMobs) || "wisp", tile.x, tile.y, false);
  }

  // Chests
  const chestCount = isStart || isDescend ? 0 : counts(archetypeDef.chests, [0, 1]);
  for (let i = 0; i < chestCount; i += 1) {
    const tile = takeTile();
    if (!tile) break;
    const chestType = rng.chance(0.3) ? "rare" : "common";
    const def = config.chestDefs?.[chestType] || {};
    room.chests.push({
      chestId: `${room.roomId}:chest:${i}`,
      chestType,
      name: def.name || chestType,
      opened: false,
      loot: (Array.isArray(def.loot) ? def.loot : []).map((d) => ({
        itemId: d.itemId,
        count: lootCount(d.count)
      })),
      x: tile.x,
      y: tile.y
    });
  }

  // Gather nodes
  const nodeCount = isDescend ? 0 : counts(archetypeDef.gatherNodes, [0, 0]);
  for (let i = 0; i < nodeCount; i += 1) {
    const tile = takeTile();
    if (!tile) break;
    const nodeType = rng.pick(config.gatherNodePool || []) || "tree";
    const def = config.gatherNodeDefs?.[nodeType] || {};
    const ds = config.depthScaling || {};
    const charges =
      Math.max(1, toNumber(def.baseCharges, 3)) +
      Math.floor((depth - 1) * toNumber(ds.nodeChargesPerDepth, 0.34));
    room.gatherNodes.push({
      nodeId: `${room.roomId}:node:${i}`,
      nodeType,
      name: def.name || nodeType,
      requiredTool: def.requiredTool || null,
      yieldItemId: def.yieldItemId || null,
      yieldCount: lootCount(def.yieldCount),
      remainingCharges: charges,
      x: tile.x,
      y: tile.y
    });
  }

  // Floor items (start room hands out the basic tools).
  const floorItems = Array.isArray(archetypeDef.floorItems) ? archetypeDef.floorItems : [];
  floorItems.forEach((itemId, i) => {
    const tile = takeTile();
    if (!tile) return;
    const def = config.itemDefs?.[itemId];
    room.floorItems.push({
      entityId: `${room.roomId}:item:${i}`,
      itemId,
      name: def?.name || itemId,
      pickedUp: false,
      x: tile.x,
      y: tile.y
    });
  });

  // Special tile (workbench / black hole).
  if (room.special) {
    const tile = takeTile() || { x: room.spawn.x, y: Math.max(1, room.spawn.y - 1) };
    room.special = {
      type: room.special.type,
      name: room.special.type === "descend" ? "Black Hole" : "Workbench",
      x: tile.x,
      y: tile.y
    };
  }

  // Reachability repair: everything must be reachable from spawn over walls.
  const targets = [];
  Object.values(room.doors).forEach((d) => {
    if (!d.blocked) targets.push({ x: d.x, y: d.y });
  });
  room.floorItems.forEach((e) => targets.push({ x: e.x, y: e.y }));
  room.gatherNodes.forEach((e) => targets.push({ x: e.x, y: e.y }));
  room.mobs.forEach((e) => targets.push({ x: e.x, y: e.y }));
  room.chests.forEach((e) => targets.push({ x: e.x, y: e.y }));
  if (room.special) targets.push({ x: room.special.x, y: room.special.y });

  let repair = 0;
  while (repair < 40) {
    repair += 1;
    const reachable = floodReach(room.spawn, w, h, walls);
    const stranded = targets.find((t) => !reachable.has(key(t.x, t.y)));
    if (!stranded) break;
    carveCorridor(room.spawn, stranded, walls);
  }

  room.walls = Array.from(walls);
  delete room.__ctx;
}

export function generateRun({ config, depth, runCounter }) {
  const safeDepth = clampInt(depth, 1, 999);
  const safeCounter = clampInt(runCounter, 0, 9_999_999);
  const seed = computeSeed(safeDepth, safeCounter);
  const rng = makeRng(seed);

  const { nodes, startIdx, descendIdx } = buildGraph(rng, config, safeDepth);

  // Record each child's direction on the parent for door wiring.
  nodes.forEach((n) => {
    n.childDirs = n.children.map((childIdx) => {
      const c = nodes[childIdx];
      const dx = c.gx - n.gx;
      const dy = c.gy - n.gy;
      if (dx === 1) return "east";
      if (dx === -1) return "west";
      if (dy === 1) return "south";
      return "north";
    });
  });

  // Normalised lattice coords for the minimap.
  const minGx = Math.min(...nodes.map((n) => n.gx));
  const minGy = Math.min(...nodes.map((n) => n.gy));

  // The room directly before the exit becomes a boss room (skip if that would
  // be the start room on a very short layout).
  const descendParent = nodes[descendIdx]?.parent;
  const bossIdx =
    descendParent != null && descendParent !== startIdx ? descendParent : null;

  const rooms = {};
  nodes.forEach((node, idx) => {
    const roomId = `room-${idx}`;
    const room = generateRoomInterior(
      rng,
      config,
      node,
      roomId,
      safeDepth,
      idx === startIdx,
      idx === descendIdx
    );
    room.mapX = node.gx - minGx;
    room.mapY = node.gy - minGy;
    room.isBoss = idx === bossIdx;
    rooms[roomId] = room;
  });

  // Second pass: doors + entities (needs childDirs resolved above).
  nodes.forEach((node, idx) => {
    rooms[`room-${idx}`].__ctx.node = node;
    populateRoom(rooms[`room-${idx}`]);
  });

  const startRoomId = `room-${startIdx}`;
  const startRoom = rooms[startRoomId];
  startRoom.visited = true;

  return {
    runId: `rift-${safeDepth}-${safeCounter}`,
    seed,
    depth: safeDepth,
    startRoomId,
    descendRoomId: `room-${descendIdx}`,
    currentRoomId: startRoomId,
    player: { x: startRoom.spawn.x, y: startRoom.spawn.y },
    movement: null,
    combat: null,
    revealed: [startRoomId],
    droppedItemCounter: 0,
    rooms
  };
}

export { DIR_NAMES, OPPOSITE, DIRS };

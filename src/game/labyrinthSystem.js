function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function clampInt(value, min = 0, max = Number.MAX_SAFE_INTEGER) {
  const numeric = Math.floor(Number(value) || 0);
  return Math.min(max, Math.max(min, numeric));
}

function toTitleToken(value) {
  return String(value || "")
    .trim()
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function createSeed() {
  return (Date.now() + Math.floor(Math.random() * 0xffffffff)) >>> 0;
}

function rollSeed(seedRef) {
  const next = (1664525 * seedRef.value + 1013904223) >>> 0;
  seedRef.value = next;
  return next / 0x100000000;
}

function rollPuzzle(activePuzzle) {
  const next = (1664525 * (activePuzzle.rngSeed >>> 0) + 1013904223) >>> 0;
  activePuzzle.rngSeed = next;
  return next / 0x100000000;
}

function randomInt(seedRef, min, max) {
  const low = Math.min(min, max);
  const high = Math.max(min, max);
  if (high <= low) {
    return low;
  }
  return low + Math.floor(rollSeed(seedRef) * (high - low + 1));
}

function pickWeighted(seedRef, entries) {
  const weightedEntries = (Array.isArray(entries) ? entries : [])
    .map((entry) => ({ ...entry, weight: Math.max(0, Number(entry.weight) || 0) }))
    .filter((entry) => entry.weight > 0);
  if (weightedEntries.length === 0) {
    return null;
  }
  const totalWeight = weightedEntries.reduce((sum, entry) => sum + entry.weight, 0);
  let cursor = rollSeed(seedRef) * totalWeight;
  for (const entry of weightedEntries) {
    cursor -= entry.weight;
    if (cursor <= 0) {
      return entry;
    }
  }
  return weightedEntries[weightedEntries.length - 1];
}

function pickWeightedForPuzzle(activePuzzle, entries) {
  const weightedEntries = (Array.isArray(entries) ? entries : [])
    .map((entry) => ({ ...entry, weight: Math.max(0, Number(entry.weight) || 0) }))
    .filter((entry) => entry.weight > 0);
  if (weightedEntries.length === 0) {
    return null;
  }
  const totalWeight = weightedEntries.reduce((sum, entry) => sum + entry.weight, 0);
  let cursor = rollPuzzle(activePuzzle) * totalWeight;
  for (const entry of weightedEntries) {
    cursor -= entry.weight;
    if (cursor <= 0) {
      return entry;
    }
  }
  return weightedEntries[weightedEntries.length - 1];
}

export function createLabyrinthSystem({
  state,
  resourceManager,
  eventBus,
  balance,
  registerCollectionDiscovery
}) {
  const labyrinthBalance = balance?.labyrinth || {};
  const unlockNodeId = typeof labyrinthBalance.unlockNodeId === "string" && labyrinthBalance.unlockNodeId.trim()
    ? labyrinthBalance.unlockNodeId.trim()
    : "labyrinthKeystone";
  const currencyId = typeof labyrinthBalance.currencyId === "string" && labyrinthBalance.currencyId.trim()
    ? labyrinthBalance.currencyId.trim()
    : "glyphDust";
  const collectionSourceId = typeof labyrinthBalance.collectionSourceId === "string" && labyrinthBalance.collectionSourceId.trim()
    ? labyrinthBalance.collectionSourceId.trim()
    : "labyrinthRelics";

  const generationConfig = labyrinthBalance.generation && typeof labyrinthBalance.generation === "object"
    ? labyrinthBalance.generation
    : {};
  const rewardsConfig = labyrinthBalance.rewards && typeof labyrinthBalance.rewards === "object"
    ? labyrinthBalance.rewards
    : {};

  const minDepth = clampInt(generationConfig.minDepth, 3, 16) || 5;
  const maxDepth = Math.max(minDepth, clampInt(generationConfig.maxDepth, minDepth, 24) || 7);
  const minBranches = clampInt(generationConfig.minBranches, 2, 4) || 2;
  const maxBranches = Math.max(minBranches, clampInt(generationConfig.maxBranches, minBranches, 5) || 3);
  const minConnections = clampInt(generationConfig.minConnections, 1, 2) || 1;
  const maxConnections = Math.max(minConnections, clampInt(generationConfig.maxConnections, minConnections, 3) || 2);

  const baseMatter = clampInt(rewardsConfig.base?.matter, 0, 1_000_000) || 1800;
  const baseFire = clampInt(rewardsConfig.base?.fire, 0, 1_000_000) || 22;
  const baseCurrency = clampInt(rewardsConfig.base?.[currencyId], 0, 1_000_000) || 3;
  const depthMatter = clampInt(rewardsConfig.perDepth?.matter, 0, 1_000_000) || 850;
  const depthFire = clampInt(rewardsConfig.perDepth?.fire, 0, 1_000_000) || 14;
  const depthCurrency = clampInt(rewardsConfig.perDepth?.[currencyId], 0, 1_000_000) || 2;
  const rewardVarianceMin = clamp(Number(rewardsConfig.varianceMin) || 0.82, 0.2, 2);
  const rewardVarianceMax = Math.max(rewardVarianceMin, clamp(Number(rewardsConfig.varianceMax) || 1.24, rewardVarianceMin, 2.5));

  const baseDuration = clamp(Number(rewardsConfig.durationSeconds?.base) || 6, 1, 45);
  const depthDuration = clamp(Number(rewardsConfig.durationSeconds?.perDepth) || 1.3, 0, 12);
  const minDuration = clamp(Number(rewardsConfig.durationSeconds?.min) || 4, 0.5, 45);
  const maxDuration = Math.max(minDuration, clamp(Number(rewardsConfig.durationSeconds?.max) || 18, minDuration, 90));

  const collectibleChanceBase = clamp(Number(labyrinthBalance.collectibleChanceBase) || 0.05, 0, 0.6);
  const collectibleChancePerDepth = clamp(Number(labyrinthBalance.collectibleChancePerDepth) || 0.015, 0, 0.12);

  const fallbackNodeTypes = {
    stable: {
      label: "Stable Thread",
      weight: 30,
      rewardMultiplier: 0.95,
      durationMultiplier: 0.9,
      riskDelta: -0.02,
      collectibleChanceBonus: 0
    },
    surge: {
      label: "Surge Channel",
      weight: 24,
      rewardMultiplier: 1.1,
      durationMultiplier: 1,
      riskDelta: 0.02,
      collectibleChanceBonus: 0.01
    },
    cache: {
      label: "Cache Pocket",
      weight: 20,
      rewardMultiplier: 1.2,
      durationMultiplier: 1.06,
      riskDelta: 0.03,
      collectibleChanceBonus: 0.02
    },
    relic: {
      label: "Relic Vault",
      weight: 14,
      rewardMultiplier: 1.05,
      durationMultiplier: 1.12,
      riskDelta: 0.04,
      collectibleChanceBonus: 0.08
    },
    hazard: {
      label: "Fault Crossing",
      weight: 12,
      rewardMultiplier: 1.35,
      durationMultiplier: 1.2,
      riskDelta: 0.08,
      collectibleChanceBonus: 0.03
    }
  };

  const rawNodeTypes = labyrinthBalance.nodeTypes && typeof labyrinthBalance.nodeTypes === "object"
    ? labyrinthBalance.nodeTypes
    : {};
  const nodeTypeMap = { ...fallbackNodeTypes };
  Object.entries(rawNodeTypes).forEach(([typeId, rawType]) => {
    if (typeof typeId !== "string" || !typeId.trim() || !rawType || typeof rawType !== "object") {
      return;
    }
    const cleanTypeId = typeId.trim();
    nodeTypeMap[cleanTypeId] = {
      ...(nodeTypeMap[cleanTypeId] || {}),
      ...rawType
    };
  });

  const nodeTypeEntries = Object.entries(nodeTypeMap)
    .map(([typeId, rawType]) => ({
      id: typeId,
      label: typeof rawType.label === "string" && rawType.label.trim()
        ? rawType.label.trim()
        : toTitleToken(typeId),
      weight: Math.max(1, Number(rawType.weight) || 1),
      rewardMultiplier: clamp(Number(rawType.rewardMultiplier) || 1, 0.3, 3),
      durationMultiplier: clamp(Number(rawType.durationMultiplier) || 1, 0.4, 3),
      riskDelta: clamp(Number(rawType.riskDelta) || 0, -0.2, 0.25),
      collectibleChanceBonus: clamp(Number(rawType.collectibleChanceBonus) || 0, -0.25, 0.4)
    }))
    .filter((entry) => entry.weight > 0);

  const fallbackCollectibles = [
    { id: "fractured-needle", name: "Fractured Needle", rarity: "rare", weight: 10 },
    { id: "dustglass-bead", name: "Dustglass Bead", rarity: "semi-rare", weight: 16 },
    { id: "echo-ribbon", name: "Echo Ribbon", rarity: "rare", weight: 12 },
    { id: "drift-seal", name: "Drift Seal", rarity: "epic", weight: 6 }
  ];
  const configuredCollectibles = Array.isArray(labyrinthBalance.collectibles) && labyrinthBalance.collectibles.length > 0
    ? labyrinthBalance.collectibles
    : fallbackCollectibles;
  const collectibleEntries = configuredCollectibles
    .map((entry) => {
      const id = typeof entry?.id === "string" ? entry.id.trim() : "";
      if (!id) {
        return null;
      }
      return {
        id,
        name: typeof entry?.name === "string" && entry.name.trim() ? entry.name.trim() : toTitleToken(id),
        rarity: typeof entry?.rarity === "string" && entry.rarity.trim() ? entry.rarity.trim().toLowerCase() : "rare",
        weight: Math.max(1, Number(entry?.weight) || 1)
      };
    })
    .filter(Boolean);

  function createRewardBundle() {
    return {
      matter: 0,
      fire: 0,
      shards: 0,
      [currencyId]: 0
    };
  }

  function normalizeRewards(rawRewards) {
    const rewards = createRewardBundle();
    rewards.matter = clampInt(rawRewards?.matter, 0, 1_000_000_000);
    rewards.fire = clampInt(rawRewards?.fire, 0, 1_000_000_000);
    rewards.shards = clampInt(rawRewards?.shards, 0, 1_000_000_000);
    rewards[currencyId] = clampInt(rawRewards?.[currencyId], 0, 1_000_000_000);
    return rewards;
  }

  function ensureCurrencyResource() {
    const amount = Number(state.resources[currencyId]);
    if (!Number.isFinite(amount) || amount < 0) {
      state.resources[currencyId] = Math.max(0, Number(amount) || 0);
    }
  }

  function ensureMetaShape(meta) {
    return {
      completedPuzzles: clampInt(meta?.completedPuzzles, 0, 1_000_000_000),
      bestDepth: clampInt(meta?.bestDepth, 0, 999),
      totalNodesResolved: clampInt(meta?.totalNodesResolved, 0, 1_000_000_000),
      totalGlyphDustEarned: clampInt(meta?.totalGlyphDustEarned, 0, 1_000_000_000)
    };
  }

  function getLabyrinthState() {
    if (!state.labyrinth || typeof state.labyrinth !== "object") {
      state.labyrinth = {
        meta: ensureMetaShape({}),
        activePuzzle: null,
        pendingRewards: null,
        unlocks: {}
      };
    }

    const labyrinth = state.labyrinth;
    labyrinth.meta = ensureMetaShape(labyrinth.meta);
    if (!labyrinth.unlocks || typeof labyrinth.unlocks !== "object") {
      labyrinth.unlocks = {};
    }

    if (labyrinth.activePuzzle && typeof labyrinth.activePuzzle === "object") {
      const puzzle = labyrinth.activePuzzle;
      if (!Array.isArray(puzzle.nodesByDepth) || !Number.isFinite(Number(puzzle.depthCount))) {
        labyrinth.activePuzzle = null;
      } else {
        const depthCount = clampInt(puzzle.depthCount, 1, 32);
        puzzle.depthCount = depthCount;
        puzzle.currentDepth = clampInt(puzzle.currentDepth, 0, depthCount);
        puzzle.nodesByDepth = puzzle.nodesByDepth.slice(0, depthCount).map((depthNodes, depthIndex) => {
          const nodes = Array.isArray(depthNodes) ? depthNodes : [];
          return nodes.map((node, index) => {
            const id = typeof node?.id === "string" && node.id.trim()
              ? node.id.trim()
              : `d${depthIndex}n${index}`;
            const reward = normalizeRewards(node?.reward || {});
            const connections = Array.isArray(node?.connections)
              ? node.connections.filter((targetId) => typeof targetId === "string" && targetId.trim())
              : [];
            return {
              id,
              depth: depthIndex,
              index,
              type: typeof node?.type === "string" && node.type.trim() ? node.type.trim() : "stable",
              label: typeof node?.label === "string" && node.label.trim() ? node.label.trim() : toTitleToken(node?.type || "stable"),
              reward,
              durationSeconds: clamp(Number(node?.durationSeconds) || 0, minDuration, maxDuration),
              collectibleChance: clamp(Number(node?.collectibleChance) || 0, 0, 0.95),
              riskDelta: clamp(Number(node?.riskDelta) || 0, -0.4, 0.4),
              connections
            };
          });
        });
        puzzle.path = Array.isArray(puzzle.path)
          ? puzzle.path
              .map((step) => {
                const nodeId = typeof step?.nodeId === "string" ? step.nodeId.trim() : "";
                if (!nodeId) {
                  return null;
                }
                return {
                  depth: clampInt(step.depth, 0, depthCount),
                  nodeId,
                  type: typeof step.type === "string" ? step.type : "",
                  label: typeof step.label === "string" ? step.label : nodeId,
                  reward: normalizeRewards(step.reward || {}),
                  collectibleId: typeof step.collectibleId === "string" ? step.collectibleId : "",
                  resolvedAt: clampInt(step.resolvedAt, 0, Number.MAX_SAFE_INTEGER)
                };
              })
              .filter(Boolean)
          : [];
        puzzle.pendingNode = puzzle.pendingNode && typeof puzzle.pendingNode === "object"
          ? {
              nodeId: typeof puzzle.pendingNode.nodeId === "string" ? puzzle.pendingNode.nodeId : "",
              depth: clampInt(puzzle.pendingNode.depth, 0, depthCount),
              elapsedSeconds: clamp(Number(puzzle.pendingNode.elapsedSeconds) || 0, 0, 999999),
              durationSeconds: clamp(Number(puzzle.pendingNode.durationSeconds) || 0, minDuration, maxDuration),
              startedAt: clampInt(puzzle.pendingNode.startedAt, 0, Number.MAX_SAFE_INTEGER)
            }
          : null;
        if (!puzzle.pendingNode?.nodeId) {
          puzzle.pendingNode = null;
        }
        puzzle.totalRewards = normalizeRewards(puzzle.totalRewards || {});
        puzzle.relicDrops = Array.isArray(puzzle.relicDrops)
          ? puzzle.relicDrops
              .map((drop) => {
                const id = typeof drop?.id === "string" ? drop.id.trim() : "";
                if (!id) {
                  return null;
                }
                return {
                  id,
                  name: typeof drop?.name === "string" && drop.name.trim() ? drop.name.trim() : toTitleToken(id),
                  rarity: typeof drop?.rarity === "string" && drop.rarity.trim() ? drop.rarity.trim().toLowerCase() : "rare"
                };
              })
              .filter(Boolean)
          : [];
        puzzle.totalRisk = clamp(Number(puzzle.totalRisk) || 0, -1, 1);
        puzzle.seed = clampInt(puzzle.seed, 0, 0xffffffff);
        puzzle.rngSeed = clampInt(puzzle.rngSeed, 0, 0xffffffff);
        puzzle.id = typeof puzzle.id === "string" && puzzle.id.trim() ? puzzle.id.trim() : `labyrinth-${Date.now().toString(36)}`;
        puzzle.startedAt = clampInt(puzzle.startedAt, 0, Number.MAX_SAFE_INTEGER);
        puzzle.updatedAt = clampInt(puzzle.updatedAt, 0, Number.MAX_SAFE_INTEGER);
      }
    } else {
      labyrinth.activePuzzle = null;
    }

    if (labyrinth.pendingRewards && typeof labyrinth.pendingRewards === "object") {
      const pending = labyrinth.pendingRewards;
      pending.puzzleId = typeof pending.puzzleId === "string" && pending.puzzleId.trim() ? pending.puzzleId.trim() : "";
      pending.depthCount = clampInt(pending.depthCount, 0, 999);
      pending.completedAt = clampInt(pending.completedAt, 0, Number.MAX_SAFE_INTEGER);
      pending.rewards = normalizeRewards(pending.rewards || {});
      pending.relicDrops = Array.isArray(pending.relicDrops)
        ? pending.relicDrops
            .map((drop) => {
              const id = typeof drop?.id === "string" ? drop.id.trim() : "";
              if (!id) {
                return null;
              }
              return {
                id,
                name: typeof drop?.name === "string" && drop.name.trim() ? drop.name.trim() : toTitleToken(id),
                rarity: typeof drop?.rarity === "string" && drop.rarity.trim() ? drop.rarity.trim().toLowerCase() : "rare"
              };
            })
            .filter(Boolean)
        : [];
      pending.path = Array.isArray(pending.path)
        ? pending.path
            .map((step) => {
              const nodeId = typeof step?.nodeId === "string" ? step.nodeId.trim() : "";
              if (!nodeId) {
                return null;
              }
              return {
                depth: clampInt(step.depth, 0, 999),
                nodeId,
                type: typeof step.type === "string" ? step.type : "",
                label: typeof step.label === "string" ? step.label : nodeId,
                reward: normalizeRewards(step.reward || {}),
                collectibleId: typeof step.collectibleId === "string" ? step.collectibleId : "",
                resolvedAt: clampInt(step.resolvedAt, 0, Number.MAX_SAFE_INTEGER)
              };
            })
            .filter(Boolean)
        : [];
    } else {
      labyrinth.pendingRewards = null;
    }

    ensureCurrencyResource();
    return labyrinth;
  }

  function isUnlocked() {
    return !unlockNodeId || Boolean(state.ascensionTree?.[unlockNodeId]);
  }

  function findNode(activePuzzle, nodeId) {
    for (const depthNodes of activePuzzle.nodesByDepth || []) {
      for (const node of depthNodes || []) {
        if (node.id === nodeId) {
          return node;
        }
      }
    }
    return null;
  }

  function getAvailableChoices(activePuzzle) {
    if (!activePuzzle || activePuzzle.currentDepth >= activePuzzle.depthCount) {
      return [];
    }
    const depthNodes = Array.isArray(activePuzzle.nodesByDepth?.[activePuzzle.currentDepth])
      ? activePuzzle.nodesByDepth[activePuzzle.currentDepth]
      : [];
    if (activePuzzle.currentDepth === 0) {
      return [...depthNodes];
    }
    const previousStep = activePuzzle.path[activePuzzle.path.length - 1];
    if (!previousStep) {
      return [...depthNodes];
    }
    const previousNode = findNode(activePuzzle, previousStep.nodeId);
    const allowed = new Set(Array.isArray(previousNode?.connections) ? previousNode.connections : []);
    const filtered = depthNodes.filter((node) => allowed.has(node.id));
    return filtered.length > 0 ? filtered : [...depthNodes];
  }

  function createNode(seedRef, depth, index) {
    const type = pickWeighted(seedRef, nodeTypeEntries) || nodeTypeEntries[0] || {
      id: "stable",
      label: "Stable Thread",
      rewardMultiplier: 1,
      durationMultiplier: 1,
      riskDelta: 0,
      collectibleChanceBonus: 0
    };

    const variance = rewardVarianceMin + (rewardVarianceMax - rewardVarianceMin) * rollSeed(seedRef);
    const matter = clampInt((baseMatter + depthMatter * depth) * type.rewardMultiplier * variance, 0, 1_000_000_000);
    const fire = clampInt((baseFire + depthFire * depth) * type.rewardMultiplier * variance, 0, 1_000_000_000);
    const currencyGain = clampInt((baseCurrency + depthCurrency * depth) * type.rewardMultiplier * variance, 0, 1_000_000_000);
    const durationSeconds = clamp((baseDuration + depthDuration * depth) * type.durationMultiplier, minDuration, maxDuration);
    const collectibleChance = clamp(
      collectibleChanceBase + (collectibleChancePerDepth * depth) + type.collectibleChanceBonus,
      0,
      0.95
    );

    return {
      id: `d${depth}n${index}`,
      depth,
      index,
      type: type.id,
      label: type.label,
      reward: {
        matter,
        fire,
        shards: 0,
        [currencyId]: currencyGain
      },
      durationSeconds,
      collectibleChance,
      riskDelta: type.riskDelta,
      connections: []
    };
  }

  function buildConnections(seedRef, nodesByDepth) {
    for (let depth = 0; depth < nodesByDepth.length - 1; depth += 1) {
      const currentNodes = nodesByDepth[depth];
      const nextNodes = nodesByDepth[depth + 1];
      const inboundCount = new Map(nextNodes.map((node) => [node.id, 0]));

      currentNodes.forEach((node) => {
        const desiredConnections = randomInt(seedRef, minConnections, maxConnections);
        const selected = new Set();
        const safetyLimit = Math.max(6, nextNodes.length * 4);
        let attempts = 0;

        while (selected.size < desiredConnections && attempts < safetyLimit) {
          attempts += 1;
          const nextNode = nextNodes[randomInt(seedRef, 0, nextNodes.length - 1)];
          if (!nextNode) {
            continue;
          }
          selected.add(nextNode.id);
        }

        if (selected.size === 0 && nextNodes.length > 0) {
          const fallbackNode = nextNodes[randomInt(seedRef, 0, nextNodes.length - 1)];
          if (fallbackNode) {
            selected.add(fallbackNode.id);
          }
        }

        node.connections = Array.from(selected);
        node.connections.forEach((targetId) => {
          inboundCount.set(targetId, (inboundCount.get(targetId) || 0) + 1);
        });
      });

      nextNodes.forEach((nextNode) => {
        const inbound = inboundCount.get(nextNode.id) || 0;
        if (inbound > 0 || currentNodes.length === 0) {
          return;
        }
        const sourceNode = currentNodes[randomInt(seedRef, 0, currentNodes.length - 1)];
        if (!sourceNode) {
          return;
        }
        if (!sourceNode.connections.includes(nextNode.id)) {
          sourceNode.connections.push(nextNode.id);
        }
      });
    }
  }

  function createPuzzle(seed = createSeed()) {
    const seedRef = { value: seed >>> 0 };
    const depthCount = randomInt(seedRef, minDepth, maxDepth);
    const nodesByDepth = [];

    for (let depth = 0; depth < depthCount; depth += 1) {
      const branchCount = randomInt(seedRef, minBranches, maxBranches);
      const depthNodes = [];
      for (let index = 0; index < branchCount; index += 1) {
        depthNodes.push(createNode(seedRef, depth, index));
      }
      nodesByDepth.push(depthNodes);
    }

    buildConnections(seedRef, nodesByDepth);

    const now = Date.now();
    return {
      id: `labyrinth-${now.toString(36)}-${Math.floor(Math.random() * 1e5).toString(36)}`,
      seed,
      rngSeed: seedRef.value,
      depthCount,
      currentDepth: 0,
      nodesByDepth,
      path: [],
      pendingNode: null,
      totalRewards: createRewardBundle(),
      relicDrops: [],
      totalRisk: 0,
      startedAt: now,
      updatedAt: now
    };
  }

  function finalizeActivePuzzle(activePuzzle) {
    const labyrinth = getLabyrinthState();
    const rewards = normalizeRewards(activePuzzle.totalRewards || {});
    const relicDrops = Array.isArray(activePuzzle.relicDrops)
      ? activePuzzle.relicDrops.map((drop) => ({ ...drop }))
      : [];

    const summary = {
      puzzleId: activePuzzle.id,
      depthCount: activePuzzle.depthCount,
      completedAt: Date.now(),
      rewards,
      relicDrops,
      path: (activePuzzle.path || []).map((step) => ({
        depth: step.depth,
        nodeId: step.nodeId,
        type: step.type,
        label: step.label,
        reward: normalizeRewards(step.reward || {}),
        collectibleId: step.collectibleId || "",
        resolvedAt: step.resolvedAt || Date.now()
      }))
    };

    labyrinth.meta.completedPuzzles += 1;
    labyrinth.meta.bestDepth = Math.max(labyrinth.meta.bestDepth, activePuzzle.depthCount || 0);
    labyrinth.meta.totalNodesResolved += (activePuzzle.path || []).length;
    labyrinth.pendingRewards = summary;
    labyrinth.activePuzzle = null;

    eventBus.emit("labyrinth:complete", {
      puzzleId: summary.puzzleId,
      depthCount: summary.depthCount,
      rewards: summary.rewards,
      relicDrops: summary.relicDrops
    });

    return {
      ok: true,
      completed: true,
      summary
    };
  }

  function startPuzzle(options = {}) {
    if (!isUnlocked()) {
      return { ok: false, reason: "Unlock Leyline Labyrinth Keystone in Ascend first." };
    }

    const labyrinth = getLabyrinthState();
    if (labyrinth.activePuzzle) {
      return { ok: false, reason: "A labyrinth puzzle is already active." };
    }
    if (labyrinth.pendingRewards) {
      return { ok: false, reason: "Claim current labyrinth rewards first." };
    }

    const requestedSeed = clampInt(options.seed, 0, 0xffffffff);
    const seed = requestedSeed > 0 ? requestedSeed : createSeed();
    const puzzle = createPuzzle(seed);
    labyrinth.activePuzzle = puzzle;

    eventBus.emit("labyrinth:start", {
      puzzleId: puzzle.id,
      seed: puzzle.seed,
      depthCount: puzzle.depthCount
    });

    return {
      ok: true,
      puzzleId: puzzle.id,
      depthCount: puzzle.depthCount
    };
  }

  function choosePath(nodeId) {
    const labyrinth = getLabyrinthState();
    const activePuzzle = labyrinth.activePuzzle;
    if (!activePuzzle) {
      return { ok: false, reason: "No active labyrinth puzzle." };
    }
    if (activePuzzle.pendingNode) {
      return { ok: false, reason: "Current thread is still stabilizing." };
    }

    const cleanNodeId = typeof nodeId === "string" ? nodeId.trim() : "";
    if (!cleanNodeId) {
      return { ok: false, reason: "Invalid path choice." };
    }

    const availableChoices = getAvailableChoices(activePuzzle);
    const selectedNode = availableChoices.find((entry) => entry.id === cleanNodeId);
    if (!selectedNode) {
      return { ok: false, reason: "Selected route is not reachable." };
    }

    activePuzzle.pendingNode = {
      nodeId: selectedNode.id,
      depth: selectedNode.depth,
      elapsedSeconds: 0,
      durationSeconds: selectedNode.durationSeconds,
      startedAt: Date.now()
    };
    activePuzzle.updatedAt = Date.now();

    eventBus.emit("labyrinth:pathChosen", {
      puzzleId: activePuzzle.id,
      depth: selectedNode.depth,
      nodeId: selectedNode.id,
      nodeType: selectedNode.type
    });

    return {
      ok: true,
      node: {
        id: selectedNode.id,
        label: selectedNode.label,
        type: selectedNode.type,
        durationSeconds: selectedNode.durationSeconds
      }
    };
  }

  function resolveNode(options = {}) {
    const labyrinth = getLabyrinthState();
    const activePuzzle = labyrinth.activePuzzle;
    if (!activePuzzle) {
      return { ok: false, reason: "No active labyrinth puzzle." };
    }

    const pendingNode = activePuzzle.pendingNode;
    if (!pendingNode) {
      return { ok: false, reason: "No active thread to resolve." };
    }

    const force = Boolean(options.force);
    const elapsedSeconds = clamp(Number(pendingNode.elapsedSeconds) || 0, 0, 999999);
    const durationSeconds = Math.max(minDuration, Number(pendingNode.durationSeconds) || minDuration);
    if (!force && elapsedSeconds + 1e-9 < durationSeconds) {
      return {
        ok: false,
        reason: "Thread is still stabilizing.",
        remainingSeconds: Math.max(0, durationSeconds - elapsedSeconds)
      };
    }

    const node = findNode(activePuzzle, pendingNode.nodeId);
    if (!node) {
      activePuzzle.pendingNode = null;
      return { ok: false, reason: "Thread data missing. Choose another route." };
    }

    const nodeReward = normalizeRewards(node.reward || {});
    activePuzzle.totalRewards.matter += nodeReward.matter;
    activePuzzle.totalRewards.fire += nodeReward.fire;
    activePuzzle.totalRewards.shards += nodeReward.shards;
    activePuzzle.totalRewards[currencyId] += nodeReward[currencyId];
    activePuzzle.totalRisk = clamp((Number(activePuzzle.totalRisk) || 0) + (Number(node.riskDelta) || 0), -1, 1);

    let relicDrop = null;
    const boostedDropChance = clamp(
      (Number(node.collectibleChance) || 0) + Math.max(0, activePuzzle.totalRisk) * 0.08,
      0,
      0.95
    );
    if (collectibleEntries.length > 0 && rollPuzzle(activePuzzle) <= boostedDropChance) {
      const pickedCollectible = pickWeightedForPuzzle(activePuzzle, collectibleEntries);
      if (pickedCollectible) {
        relicDrop = {
          id: pickedCollectible.id,
          name: pickedCollectible.name,
          rarity: pickedCollectible.rarity
        };
        activePuzzle.relicDrops.push(relicDrop);
        eventBus.emit("labyrinth:drop", {
          puzzleId: activePuzzle.id,
          nodeId: node.id,
          depth: node.depth,
          itemId: relicDrop.id,
          name: relicDrop.name,
          rarity: relicDrop.rarity
        });
      }
    }

    const step = {
      depth: node.depth,
      nodeId: node.id,
      type: node.type,
      label: node.label,
      reward: nodeReward,
      collectibleId: relicDrop?.id || "",
      resolvedAt: Date.now()
    };

    activePuzzle.path.push(step);
    activePuzzle.currentDepth += 1;
    activePuzzle.pendingNode = null;
    activePuzzle.updatedAt = Date.now();

    eventBus.emit("labyrinth:nodeResolved", {
      puzzleId: activePuzzle.id,
      nodeId: node.id,
      depth: node.depth,
      reward: nodeReward,
      collectibleId: relicDrop?.id || ""
    });

    if (activePuzzle.currentDepth >= activePuzzle.depthCount) {
      return finalizeActivePuzzle(activePuzzle);
    }

    return {
      ok: true,
      completed: false,
      step,
      nextDepth: activePuzzle.currentDepth
    };
  }

  function advance(dtSeconds, speedMultiplier = 1) {
    const labyrinth = getLabyrinthState();
    const activePuzzle = labyrinth.activePuzzle;
    if (!activePuzzle || !activePuzzle.pendingNode) {
      return { advanced: false };
    }

    const delta = Math.max(0, Number(dtSeconds) || 0) * Math.max(0, Number(speedMultiplier) || 0);
    if (delta <= 0) {
      return { advanced: false };
    }

    activePuzzle.pendingNode.elapsedSeconds = Math.min(
      activePuzzle.pendingNode.durationSeconds,
      (Number(activePuzzle.pendingNode.elapsedSeconds) || 0) + delta
    );
    activePuzzle.updatedAt = Date.now();

    if (activePuzzle.pendingNode.elapsedSeconds + 1e-9 < activePuzzle.pendingNode.durationSeconds) {
      return {
        advanced: true,
        resolved: false,
        pendingNode: {
          ...activePuzzle.pendingNode,
          remainingSeconds: Math.max(0, activePuzzle.pendingNode.durationSeconds - activePuzzle.pendingNode.elapsedSeconds)
        }
      };
    }

    const result = resolveNode({ force: true });
    return {
      advanced: true,
      resolved: true,
      result
    };
  }

  function claimRewards() {
    const labyrinth = getLabyrinthState();
    const pending = labyrinth.pendingRewards;
    if (!pending) {
      return { ok: false, reason: "No labyrinth rewards to claim." };
    }

    const rewards = normalizeRewards(pending.rewards || {});
    resourceManager.add("matter", rewards.matter);
    resourceManager.add("fire", rewards.fire);
    resourceManager.add("shards", rewards.shards);
    resourceManager.add(currencyId, rewards[currencyId]);
    labyrinth.meta.totalGlyphDustEarned += rewards[currencyId];

    const relicDrops = Array.isArray(pending.relicDrops)
      ? pending.relicDrops.map((drop) => ({ ...drop }))
      : [];

    let discoveries = 0;
    if (typeof registerCollectionDiscovery === "function") {
      relicDrops.forEach((drop) => {
        const discovery = registerCollectionDiscovery(collectionSourceId, drop.id, {
          name: drop.name,
          rarity: drop.rarity,
          discoveredAt: pending.completedAt || Date.now()
        });
        if (discovery?.ok && discovery.discovered) {
          discoveries += 1;
        }
      });
    }

    labyrinth.pendingRewards = null;

    eventBus.emit("labyrinth:claim", {
      rewards,
      relicDrops,
      discoveries
    });

    return {
      ok: true,
      rewards,
      relicDrops,
      discoveries
    };
  }

  function getActivePuzzleView(activePuzzle) {
    if (!activePuzzle) {
      return null;
    }

    const availableChoices = getAvailableChoices(activePuzzle);
    const availableChoiceIds = new Set(availableChoices.map((node) => node.id));
    const resolvedNodeIds = new Set((activePuzzle.path || []).map((step) => step.nodeId));
    const pendingNodeId = activePuzzle.pendingNode?.nodeId || "";

    const board = (activePuzzle.nodesByDepth || []).map((depthNodes, depth) => ({
      depth,
      nodes: (Array.isArray(depthNodes) ? depthNodes : []).map((node) => ({
        id: node.id,
        type: node.type,
        label: node.label,
        reward: normalizeRewards(node.reward || {}),
        durationSeconds: clamp(Number(node.durationSeconds) || 0, minDuration, maxDuration),
        collectibleChance: clamp(Number(node.collectibleChance) || 0, 0, 0.95),
        connections: Array.isArray(node.connections) ? [...node.connections] : [],
        reachable: !activePuzzle.pendingNode && depth === activePuzzle.currentDepth && availableChoiceIds.has(node.id),
        resolved: resolvedNodeIds.has(node.id),
        pending: pendingNodeId === node.id
      }))
    }));

    const pendingNode = activePuzzle.pendingNode
      ? {
          ...activePuzzle.pendingNode,
          elapsedSeconds: clamp(Number(activePuzzle.pendingNode.elapsedSeconds) || 0, 0, 999999),
          durationSeconds: clamp(Number(activePuzzle.pendingNode.durationSeconds) || 0, minDuration, maxDuration),
          remainingSeconds: Math.max(
            0,
            (Number(activePuzzle.pendingNode.durationSeconds) || 0) - (Number(activePuzzle.pendingNode.elapsedSeconds) || 0)
          )
        }
      : null;

    return {
      id: activePuzzle.id,
      seed: activePuzzle.seed,
      depthCount: activePuzzle.depthCount,
      currentDepth: activePuzzle.currentDepth,
      progressFraction: activePuzzle.depthCount > 0 ? activePuzzle.currentDepth / activePuzzle.depthCount : 0,
      totalRisk: clamp(Number(activePuzzle.totalRisk) || 0, -1, 1),
      totalRewards: normalizeRewards(activePuzzle.totalRewards || {}),
      relicDrops: (activePuzzle.relicDrops || []).map((drop) => ({ ...drop })),
      pendingNode,
      availableChoices: availableChoices.map((node) => ({
        id: node.id,
        depth: node.depth,
        type: node.type,
        label: node.label,
        reward: normalizeRewards(node.reward || {}),
        durationSeconds: clamp(Number(node.durationSeconds) || 0, minDuration, maxDuration),
        collectibleChance: clamp(Number(node.collectibleChance) || 0, 0, 0.95),
        connections: Array.isArray(node.connections) ? [...node.connections] : []
      })),
      path: (activePuzzle.path || []).map((step) => ({
        depth: step.depth,
        nodeId: step.nodeId,
        type: step.type,
        label: step.label,
        reward: normalizeRewards(step.reward || {}),
        collectibleId: step.collectibleId || "",
        resolvedAt: step.resolvedAt || 0
      })),
      board,
      startedAt: activePuzzle.startedAt,
      updatedAt: activePuzzle.updatedAt
    };
  }

  function getStatus() {
    const labyrinth = getLabyrinthState();
    return {
      unlockNodeId,
      unlocked: isUnlocked(),
      currencyId,
      collectionSourceId,
      meta: { ...labyrinth.meta },
      activePuzzle: getActivePuzzleView(labyrinth.activePuzzle),
      pendingRewards: labyrinth.pendingRewards
        ? {
            puzzleId: labyrinth.pendingRewards.puzzleId,
            depthCount: labyrinth.pendingRewards.depthCount,
            completedAt: labyrinth.pendingRewards.completedAt,
            rewards: normalizeRewards(labyrinth.pendingRewards.rewards || {}),
            relicDrops: (labyrinth.pendingRewards.relicDrops || []).map((drop) => ({ ...drop })),
            path: (labyrinth.pendingRewards.path || []).map((step) => ({
              depth: step.depth,
              nodeId: step.nodeId,
              type: step.type,
              label: step.label,
              reward: normalizeRewards(step.reward || {}),
              collectibleId: step.collectibleId || "",
              resolvedAt: step.resolvedAt || 0
            }))
          }
        : null
    };
  }

  function handleAscendReset() {
    const labyrinth = getLabyrinthState();
    labyrinth.activePuzzle = null;
    labyrinth.pendingRewards = null;
  }

  return {
    getStatus,
    startPuzzle,
    choosePath,
    resolveNode,
    claimRewards,
    advance,
    handleAscendReset
  };
}

import { ascendCost, ascendShardGainFromResources, generatorCost } from "../engine/formulas.js";
import { researchCost } from "../game/researchSystem.js";

function formatNumber(value) {
  if (!Number.isFinite(value)) {
    return "∞";
  }
  const rounded = Math.round(value * 100) / 100;
  const abs = Math.abs(rounded);
  if (abs >= 1_000_000_000) {
    return rounded.toExponential(2).replace("e+", "e");
  }
  if (rounded >= 1_000_000) {
    return `${(rounded / 1_000_000).toFixed(2)}M`;
  }
  if (rounded >= 1_000) {
    return `${(rounded / 1_000).toFixed(2)}K`;
  }
  return rounded.toFixed(2);
}

function formatScaledNumber(value, scale) {
  const scaled = value * scale;
  if (Number.isInteger(scaled)) {
    return String(scaled);
  }
  return scaled.toFixed(2).replace(/\.00$/, "");
}

function scaleDescription(text, scale) {
  if (!scale || scale === 1) {
    return text;
  }
  return text.replace(/-?\d+(?:\.\d+)?/g, (match) => {
    const value = Number(match);
    if (!Number.isFinite(value)) {
      return match;
    }
    return formatScaledNumber(value, scale);
  });
}

function formatDuration(totalSeconds) {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(seconds / 60);
  const rem = seconds % 60;
  return `${minutes}:${String(rem).padStart(2, "0")}`;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function createRenderer({ appEl, state, balance, generatorDefs, formulas, systems, saveSlots }) {
  const ui = {
    notice: "",
    good: false,
    activeTab: "upgrades",
    isBound: false,
    panelEl: null,
    pinnedEl: null,
    ascendView: null,
    expeditionsView: "runs",
    fleetFocusSlot: "hull",
    draggingPartId: "",
    dragHoverSlot: "",
    lastExpeditionSignature: "",
    scrollPositions: {
      upgrades: 0,
      research: 0,
      expeditions: 0
    }
  };

  const refs = {};

  function setNotice(text, good = false) {
    ui.notice = text;
    ui.good = good;
  }

  function actionButton(label, className, action, disabled = false) {
    return `<button class="${className}" data-action="${action}" ${disabled ? "disabled" : ""}>${label}</button>`;
  }

  function formatCost(cost) {
    if (!cost) {
      return "Free";
    }
    const matter = Math.max(0, Number(cost.matter) || 0);
    const fire = Math.max(0, Number(cost.fire) || 0);
    const shards = Math.max(0, Number(cost.shards) || 0);
    const intel = Math.max(0, Number(cost.intel) || 0);
    const parts = [`${formatNumber(matter)} Matter`, `${formatNumber(fire)} Fire`];
    if (intel > 0) {
      parts.push(`${formatNumber(intel)} Intel`);
    }
    if (shards > 0) {
      parts.push(`${formatNumber(shards)} Shards`);
    }
    return parts.join(" | ");
  }

  function formatPartEffects(effects) {
    return Object.entries(effects || {})
      .map(([key, value]) => `${key} ${value >= 0 ? "+" : ""}${(Number(value) * 100).toFixed(1)}%`)
      .join(" | ");
  }

  function buildLayout() {
    const slotOptions = saveSlots
      ? saveSlots.slots
          .map((slot) => {
            const selected = slot.id === saveSlots.activeSlotId ? "selected" : "";
            return `<option value="${slot.id}" ${selected}>${slot.label}</option>`;
          })
          .join("")
      : "";

    appEl.innerHTML = `
      <section class="titlebar">
        <h1>Dimensional Alchemy</h1>
        <div class="subtitle">A cosmic lab idle prototype. First implementation slice with layered progression.</div>

        ${saveSlots ? `
        <div class="save-bar">
          <label class="kv" for="save-slot">Save Slot</label>
          <select id="save-slot" data-action="save-slot">
            ${slotOptions}
          </select>
          <button class="ghost" data-action="save-reset">Reset Slot</button>
        </div>
        ` : ""}

        <div class="resource-grid">
          <div class="resource-card resource-card--matter">
            <div class="label">Matter</div>
            <div class="value" id="matter-value">0</div>
            <div class="hint" id="transmute-yield">+1 Matter</div>
            <div class="action">${actionButton("Transmute", "primary", "transmute")}</div>
          </div>
          <div class="resource-card resource-card--fire">
            <div class="label">Fire Essence</div>
            <div class="value" id="fire-value">0</div>
            <div class="hint" id="convert-yield">100 Matter -> 1 Fire</div>
            <div class="action">${actionButton("Convert", "secondary", "convert")}</div>
          </div>
          <div class="resource-card resource-card--ascend">
            <div class="label">Ascension Shards</div>
            <div class="value" id="shards-value">0</div>
            <div class="hint" id="ascend-gain">Projected gain: +0 Shards</div>
            <div class="action">${actionButton("Ascend", "ghost", "ascend")}</div>
          </div>
          <div class="resource-card resource-card--intel">
            <div class="label">Expedition Intel</div>
            <div class="value" id="intel-value">0</div>
            <div class="hint">Used for expedition launches and ship upgrades</div>
            <div class="action">${actionButton("Expeditions", "secondary", "tab:expeditions")}</div>
          </div>
          <div class="resource-card resource-card--prod">
            <div class="label">Production Multiplier</div>
            <div class="value" id="prod-multiplier">x1.00</div>
            <div class="hint">Total output bonus</div>
            <div class="hint" id="rate-value">0/s Matter | 0/s Fire</div>
          </div>
        </div>
      </section>

      <section class="tabbar">
        ${actionButton("Upgrades", "ghost tab", "tab:upgrades")}
        ${actionButton("Research", "ghost tab", "tab:research")}
        ${actionButton("Expeditions", "ghost tab", "tab:expeditions")}
        ${actionButton("Ascend", "ghost tab", "tab:ascend")}
      </section>

      <section class="main-grid" id="main-grid">
        <article class="panel" id="pinned-panel"></article>

        <article class="panel" id="dynamic-panel"></article>
      </section>
    `;

    refs.matter = appEl.querySelector("#matter-value");
    refs.fire = appEl.querySelector("#fire-value");
    refs.shards = appEl.querySelector("#shards-value");
    refs.intel = appEl.querySelector("#intel-value");
    refs.prodMultiplier = appEl.querySelector("#prod-multiplier");
    refs.mainGrid = appEl.querySelector("#main-grid");
    ui.pinnedEl = appEl.querySelector("#pinned-panel");
    refs.saveSlot = appEl.querySelector("#save-slot");
    refs.saveReset = appEl.querySelector("[data-action='save-reset']");
    ui.panelEl = appEl.querySelector("#dynamic-panel");
  }

  function renderPinnedPanel(rates) {
    return `
      ${renderOverviewPanel(rates)}
      <div class="notice" id="notice"></div>
    `;
  }

  function cachePinnedRefs() {
    refs.transmuteYield = appEl.querySelector("#transmute-yield");
    refs.convertYield = appEl.querySelector("#convert-yield");
    refs.ascendGain = appEl.querySelector("#ascend-gain");
    refs.rate = appEl.querySelector("#rate-value");
    refs.notice = appEl.querySelector("#notice");
    refs.convertButton = appEl.querySelector('button[data-action="convert"]');
    refs.ascendButton = appEl.querySelector('button[data-action="ascend"]');
  }

  function renderOverviewPanel(rates) {
    const generatorRows = Object.values(generatorDefs)
      .map((def) => {
        const level = state.generators[def.id] || 0;
        const cost = generatorCost(def, level, state.perks.generatorCostGrowthMultiplier);
        const resourceMultiplier = def.resource === "matter" ? state.perks.matterRateMultiplier : state.perks.fireRateMultiplier;
        const effectiveRate = def.baseRate * state.perks.productionMultiplier * resourceMultiplier;

        return `
          <div class="row">
            <div>
              <div><strong>${def.name}</strong> Lv.${level}</div>
              <div class="kv">+${formatNumber(effectiveRate)}/s ${def.resource} | Cost ${formatNumber(cost)} ${def.costResource}</div>
            </div>
            ${actionButton("Buy", "ghost", `buy:${def.id}`)}
          </div>
        `;
      })
      .join("");

    return `
      <h2>Generators</h2>
      ${generatorRows}
      <div class="row">
        <div class="muted">Hint</div>
        <div class="kv">Buy generators to automate income.</div>
      </div>
    `;
  }

  function renderUpgradesPanel() {
    const rows = balance.upgradeOrder
      .map((upgradeId) => balance.upgrades[upgradeId])
      .filter(Boolean)
      .map((def) => {
        const tier = systems.upgrades.getTier(def.id);
        const maxTier = systems.upgrades.getMaxTier(def.id);
        const maxed = tier >= maxTier;
        const unlocked = systems.upgrades.isUnlocked(def.id);
        const cost = systems.upgrades.getCost(def.id);
        const affordable = (state.resources[def.costResource] || 0) >= cost;
        const unlockInfo = systems.upgrades.getUnlockInfo(def.id);
        const missing = Math.max(0, unlockInfo.requiredTotal - unlockInfo.currentTotal);

        if (!unlocked) {
          return `
            <div class="row">
              <div>
                <div><strong>${def.name}</strong></div>
                <div class="kv">Need ${missing} total tiers to unlock</div>
              </div>
            </div>
          `;
        }

        const disabled = maxed;

        let status = maxed ? "Maxed" : `Lv.${tier}/${maxTier}`;

        const description = scaleDescription(def.description, balance.upgradePower || 1);

        return `
          <div class="row">
            <div>
              <div><strong>${def.name}</strong></div>
              <div class="kv">${description}</div>
              <div class="kv">${status}${maxed ? "" : ` | Next: ${formatNumber(cost)} ${def.costResource}`}</div>
            </div>
            ${actionButton(maxed ? "Max" : "Buy Tier", "ghost", `upgrade:${def.id}`, disabled)}
          </div>
        `;
      })
      .join("");

    return `
      <h2>Upgrades</h2>
      <div class="scroll-panel">${rows}</div>
    `;
  }

  function renderResearchPanel() {
    const rows = balance.researchOrder
      .map((researchId) => balance.research[researchId])
      .filter(Boolean)
      .map((def) => {
        const level = state.research[def.id] || 0;
        const maxed = level >= def.maxLevel;
        const unlocked = systems.research.isUnlocked(def.id);
        const nextCost = systems.research.getCost(def.id);
        const affordable = (state.resources[def.costResource] || 0) >= nextCost;
        const disabled = maxed || !unlocked;
        const unlockInfo = systems.research.getUnlockInfo(def.id);
        const missing = Math.max(0, unlockInfo.requiredTotal - unlockInfo.currentTotal);

        if (!unlocked) {
          return `
            <div class="row">
              <div>
                <div><strong>${def.name}</strong></div>
                <div class="kv">Need ${missing} prior researches at Lv.1</div>
              </div>
            </div>
          `;
        }

        let status = maxed ? "Maxed" : `Lv.${level}/${def.maxLevel}`;

        return `
          <div class="row">
            <div>
              <div><strong>${def.name}</strong></div>
              <div class="kv">${def.description}</div>
              <div class="kv">${status}${maxed ? "" : ` | Next: ${formatNumber(nextCost)} ${def.costResource}`}</div>
            </div>
            ${actionButton(maxed ? "Max" : "Research", "ghost", `research:${def.id}`, disabled)}
          </div>
        `;
      })
      .join("");

    return `
      <h2>Research</h2>
      <div class="scroll-panel">${rows}</div>
    `;
  }

  function renderAscendPanel() {
    const nodeWidth = 140;
    const nodeHeight = 140;
    const gap = -5;
    const width = nodeWidth + gap;
    const height = nodeHeight * 0.75 + gap;
    const nodes = systems.ascendTree.nodes
      .map((node) => {
        const owned = systems.ascendTree.hasNode(node.id);
        const unlocked = systems.ascendTree.isUnlocked(node.id);
        const affordable = state.resources.shards >= node.cost;

        const classList = ["hex-node"];
        if (owned) {
          classList.push("owned");
        } else if (!unlocked) {
          classList.push("locked");
        }

        const x = width * (node.q + node.r / 2);
        const y = height * node.r;
        const style = `style="--x:${x.toFixed(1)}px; --y:${y.toFixed(1)}px;"`;
        const disabled = owned || !unlocked;

        const description = unlocked ? node.description : "Unknown effect";
        const title = unlocked ? node.description : "Unknown effect";
        const costLine = unlocked ? `<div class="hex-meta">${node.cost} shards</div>` : "";

        return `
          <button class="${classList.join(" ")}" data-action="ascend:${node.id}" ${style} ${disabled ? "disabled" : ""} title="${title}">
            <div class="hex-title">${node.name}</div>
            ${costLine}
            <div class="hex-meta">${description}</div>
          </button>
        `;
      })
      .join("");

    return `
      <h2>Ascension Grid</h2>
      <div class="muted">Spend shards to unlock permanent hex nodes. Unlocks must connect to an owned node.</div>
      <div class="hex-viewport" data-ascend-viewport>
        <div class="hex-stage" data-ascend-stage>
          <div class="hex-grid">${nodes}</div>
        </div>
      </div>
    `;
  }

  function getZoneStyleForShip(shipDef, slot) {
    const fallback = {
      hull: { left: 20, top: 72 },
      sail: { left: 44, top: 24 },
      anchor: { left: 78, top: 76 },
      net: { left: 62, top: 48 }
    };
    const configured = shipDef?.visual?.zones?.[slot] || {};
    const left = Number.isFinite(Number(configured.left)) ? Number(configured.left) : fallback[slot].left;
    const top = Number.isFinite(Number(configured.top)) ? Number(configured.top) : fallback[slot].top;
    return `style="left:${left}%; top:${top}%;"`;
  }

  function renderShipGraphic(shipStatus, selectedShipId, selectedShipState, selectedShipDef, selectedSlot, partDefs) {
    const visual = selectedShipDef.visual || {};
    const assetPath = typeof visual.asset === "string" && visual.asset.length > 0 ? visual.asset : "";
    const mastCount = Math.max(1, Math.min(3, Math.floor(Number(visual.mastCount) || 1)));
    const mastOffsets = mastCount === 1
      ? [46]
      : mastCount === 2
        ? [40, 56]
        : [34, 50, 66];
    const palette = visual.palette || {};
    const paletteStyle = [
      palette.hullStart ? `--ship-hull-start:${palette.hullStart};` : "",
      palette.hullEnd ? `--ship-hull-end:${palette.hullEnd};` : "",
      palette.sailTop ? `--ship-sail-top:${palette.sailTop};` : "",
      palette.sailBottom ? `--ship-sail-bottom:${palette.sailBottom};` : "",
      palette.waterTop ? `--ship-water-top:${palette.waterTop};` : "",
      palette.waterBottom ? `--ship-water-bottom:${palette.waterBottom};` : ""
    ].join("");
    const zones = ["hull", "sail", "anchor", "net"]
      .map((slot) => {
        const active = selectedSlot === slot ? " active" : "";
        const label = slot[0].toUpperCase() + slot.slice(1);
        const equippedId = selectedShipState.equippedParts?.[slot];
        const equippedPart = equippedId && partDefs[equippedId] ? partDefs[equippedId] : null;
        const equippedName = equippedPart ? equippedPart.name : "None";
        const effectsText = equippedPart ? formatPartEffects(equippedPart.effects || {}) : "Drop compatible part here";
        const zoneStyle = getZoneStyleForShip(selectedShipDef, slot);
        return `
          <button class="ship-zone${active}" data-action="ship:focus:${slot}" data-slot="${slot}" data-ship-id="${selectedShipId}" ${zoneStyle}>
            <strong>${label}</strong>
            <span>${equippedName}</span>
            <span class="ship-zone-meta">${effectsText || "No stat modifiers."}</span>
          </button>
        `;
      })
      .join("");
    const masts = mastOffsets
      .map((offset) => `<div class="ship-layer ship-layer--mast" style="left:${offset}%;"></div>`)
      .join("");

    const theme = selectedShipDef.visual?.theme || selectedShipId || "raft";
    const artMarkup = assetPath
      ? `<img class="ship-asset" src="${assetPath}" alt="${selectedShipDef.name || selectedShipId} profile">`
      : `
        <div class="ship-waterline"></div>
        <div class="ship-hull"></div>
        ${masts}
        <div class="ship-layer ship-layer--sails"></div>
      `;
    return `
      <div class="ship-graphic ship-graphic--${theme}" style="${paletteStyle}">
        ${artMarkup}
        ${zones}
      </div>
    `;
  }

  function renderFleetDockPanel() {
    const shipStatus = systems.ships.getStatus();
    const shipDefs = shipStatus.shipDefs || {};
    const ships = shipStatus.ships || {};
    const facilityDefs = shipStatus.facilityDefs || {};

    const selectedShipId = shipStatus.selectedShip;
    const selectedShipState = ships[selectedShipId] || {};
    const selectedShipDef = shipDefs[selectedShipId] || {};
    const selectedShipStats = systems.ships.getShipStats(selectedShipId) || null;

    const shipCards = Object.values(shipDefs)
      .map((def) => {
        const ship = ships[def.id] || {};
        const acquired = Boolean(ship.acquired);
        const selected = def.id === selectedShipId;
        const unlock = systems.ships.isShipUnlockMet(def.id);
        const classNames = ["ship-card"];
        if (selected) {
          classNames.push("active");
        }
        if (!acquired) {
          classNames.push("locked");
        }
        const action = acquired ? `ship:select:${def.id}` : `ship:buy:${def.id}`;
        const actionText = acquired ? (selected ? "Selected" : "Select") : "Buy";
        const disabled = acquired ? selected : !unlock.ok;

        return `
          <div class="ship-card-wrap">
            <div class="${classNames.join(" ")}">
              <div><strong>${def.name}</strong></div>
              <div class="kv">Base: Speed x${(def.baseStats?.speedMultiplier || 1).toFixed(2)} | Risk Mit +${((def.baseStats?.riskMitigation || 0) * 100).toFixed(1)}%</div>
              <div class="kv">Yield x${(def.baseStats?.yieldMultiplier || 1).toFixed(2)} | Rare x${(def.baseStats?.rareDropWeight || 1).toFixed(2)}</div>
              ${acquired ? "<div class=\"kv\">Owned</div>" : `<div class="kv">Cost: ${formatCost(def.purchaseCost)}</div>`}
              ${!acquired && !unlock.ok ? `<div class="kv">${unlock.reason}</div>` : ""}
              ${actionButton(actionText, acquired ? "ghost" : "secondary", action, disabled)}
            </div>
          </div>
        `;
      })
      .join("");

    const facilityRows = Object.entries(facilityDefs)
      .map(([facilityId, def]) => {
        const level = Math.max(0, Math.floor(Number(selectedShipState.facilities?.[facilityId]) || 0));
        const maxLevel = def.maxLevel || 0;
        const maxed = level >= maxLevel;
        const nextCost = def.levelCosts?.[level];
        const disabled = maxed || !selectedShipState.acquired;
        const effectParts = [];
        if (def.effectsPerLevel?.speedMultiplier) {
          effectParts.push(`+${(def.effectsPerLevel.speedMultiplier * 100).toFixed(1)}% speed/lv`);
        }
        if (def.effectsPerLevel?.yieldMultiplier) {
          effectParts.push(`+${(def.effectsPerLevel.yieldMultiplier * 100).toFixed(1)}% yield/lv`);
        }
        if (def.effectsPerLevel?.riskMitigation) {
          effectParts.push(`+${(def.effectsPerLevel.riskMitigation * 100).toFixed(1)}% risk mit/lv`);
        }
        if (def.effectsPerLevel?.penaltyDampening) {
          effectParts.push(`+${(def.effectsPerLevel.penaltyDampening * 100).toFixed(1)}% penalty damp/lv`);
        }
        if (def.effectsPerLevel?.rareDropWeight) {
          effectParts.push(`+${(def.effectsPerLevel.rareDropWeight * 100).toFixed(1)}% rare weight/lv`);
        }

        return `
          <div class="row">
            <div>
              <div><strong>${def.label}</strong> Lv.${level}/${maxLevel}</div>
              <div class="kv">${effectParts.join(" | ")}</div>
              <div class="kv">${maxed ? "Maxed" : `Next cost: ${formatCost(nextCost)}`}</div>
            </div>
            ${actionButton("Upgrade", "ghost", `ship:upgrade:${selectedShipId}:${facilityId}`, disabled)}
          </div>
        `;
      })
      .join("");
    const blueprintRows = Object.entries(shipStatus.blueprintInventory || {})
      .filter(([, count]) => Number(count) > 0)
      .map(([id, count]) => `<div class="kv">${id} x${count}</div>`)
      .join("");

    return `
      <h2>Fleet Dock</h2>
      <div class="fleet-layout">
        <section class="fleet-left">
          <div class="ship-cards">${shipCards}</div>
          <div class="kv">Selected: <strong>${selectedShipDef.name || selectedShipId}</strong>${selectedShipStats ? ` | Speed x${selectedShipStats.speedMultiplier.toFixed(2)} | Risk Mit +${(selectedShipStats.riskMitigation * 100).toFixed(1)}% | Yield x${selectedShipStats.yieldMultiplier.toFixed(2)} | Rare x${selectedShipStats.rareDropWeight.toFixed(2)}` : ""}</div>
          <div class="kv">Use the Ships subtab for interactive slot management and part inventory.</div>
        </section>
        <section class="fleet-right">
          <h3>Facility Upgrades</h3>
          <div class="scroll-panel">${facilityRows}</div>
          <h3>Blueprint Ledger</h3>
          <div class="inventory-list">${blueprintRows || "<div class=\"kv\">No blueprints discovered yet.</div>"}</div>
        </section>
      </div>
    `;
  }

  function renderShipGuiPanel() {
    const shipStatus = systems.ships.getStatus();
    const shipDefs = shipStatus.shipDefs || {};
    const ships = shipStatus.ships || {};
    const partDefs = shipStatus.partDefs || {};

    const selectedShipId = shipStatus.selectedShip;
    const selectedShipState = ships[selectedShipId] || {};
    const selectedShipDef = shipDefs[selectedShipId] || {};
    const selectedShipStats = systems.ships.getShipStats(selectedShipId) || null;
    const selectedSlot = ui.fleetFocusSlot;
    const equippedPartCounts = shipStatus.equippedPartCounts || {};
    const allPartItems = Object.entries(shipStatus.partInventory || {})
      .filter(([, count]) => Number(count) > 0)
      .map(([partId, count]) => {
        const def = partDefs[partId];
        if (!def) {
          return null;
        }
        const equippedCount = Number(equippedPartCounts[partId]) || 0;
        const availableCount = Math.max(0, Number(count) - equippedCount);
        return {
          partId,
          count: Number(count),
          equippedCount,
          availableCount,
          def,
          compatibleWithSelectedShip: !def.shipId || def.shipId === selectedShipId,
          compatibleWithFocusSlot: def.slot === selectedSlot
        };
      })
      .filter((item) => item && item.compatibleWithSelectedShip)
      .sort((a, b) => {
        const rarityWeight = { "semi-rare": 1, rare: 2, epic: 3 };
        if (a.def.slot !== b.def.slot) {
          return String(a.def.slot).localeCompare(String(b.def.slot));
        }
        const rarityDiff = (rarityWeight[a.def.rarity] || 0) - (rarityWeight[b.def.rarity] || 0);
        if (rarityDiff !== 0) {
          return rarityDiff;
        }
        return String(a.def.name || a.partId).localeCompare(String(b.def.name || b.partId));
      });

    const inventoryRows = allPartItems.length > 0
      ? allPartItems.map((item) => {
        const encoded = encodeURIComponent(item.partId);
        const effectText = formatPartEffects(item.def.effects || {});
        const rarity = item.def.rarity || "rare";
        const canEquipByCount = item.availableCount > 0 || selectedShipState.equippedParts?.[selectedSlot] === item.partId;
        const canEquipByFilter = item.compatibleWithSelectedShip;
        const canEquip = canEquipByCount && canEquipByFilter;
        const equippedBadge = item.equippedCount > 0 ? `<span class="chip">Equipped ${item.equippedCount}</span>` : "";
        const shipBadge = item.def.shipId ? `<span class="chip chip--ship">${item.def.shipId}</span>` : "";
        return `
          <div class="inventory-item inventory-item--part" draggable="true" data-part-id="${item.partId}" data-slot="${item.def.slot}" data-ship-id="${selectedShipId}">
            <div>
              <div><strong>${item.def.name}</strong> x${item.count} <span class="kv">(${item.availableCount} free)</span></div>
              <div class="chip-row"><span class="chip chip--rarity">${rarity}</span><span class="chip">${item.def.slot}</span>${shipBadge}${equippedBadge}</div>
              <div class="kv">${effectText || "No stat modifiers."}</div>
            </div>
            ${actionButton("Equip", "secondary compact", `ship:equip:${selectedShipId}:${item.def.slot}:${encoded}`, !canEquip)}
          </div>
        `;
      }).join("")
      : "<div class=\"kv\">No compatible parts available for this ship yet.</div>";

    return `
      <h2>Ships</h2>
      <div class="ship-gui-layout">
        <section class="ship-gui-main">
          ${renderShipGraphic(shipStatus, selectedShipId, selectedShipState, selectedShipDef, selectedSlot, partDefs)}
          <div class="kv">${selectedShipDef.name || selectedShipId} | Speed x${selectedShipStats ? selectedShipStats.speedMultiplier.toFixed(2) : "1.00"} | Risk Mit +${selectedShipStats ? (selectedShipStats.riskMitigation * 100).toFixed(1) : "0.0"}% | Yield x${selectedShipStats ? selectedShipStats.yieldMultiplier.toFixed(2) : "1.00"} | Rare x${selectedShipStats ? selectedShipStats.rareDropWeight.toFixed(2) : "1.00"}</div>
        </section>
        <section class="ship-gui-inventory">
          <div class="inventory-header">
            <h3>Part Inventory</h3>
            <div class="kv">Sorted by slot, rarity, and name. Drag to a slot or press Equip on a card.</div>
          </div>
          <div class="inventory-list inventory-list--parts">${inventoryRows}</div>
        </section>
      </div>
    `;
  }

  function renderExpeditionsPanel() {
    const expeditionStatus = systems.expeditions.getStatus();
    const unlockNodeId = expeditionStatus.unlockNodeId;
    const unlockNodeOwned = unlockNodeId ? systems.ascendTree.hasNode(unlockNodeId) : true;
    const shipStats = expeditionStatus.selectedShipStats;
    const shipLine = expeditionStatus.selectedShip
      ? `<div class="kv">Ship: ${expeditionStatus.selectedShip.toUpperCase()}${shipStats ? ` | Speed x${shipStats.speedMultiplier.toFixed(2)} | Risk Mit +${(shipStats.riskMitigation * 100).toFixed(1)}% | Yield x${shipStats.yieldMultiplier.toFixed(2)}` : ""}</div>`
      : "<div class=\"kv\">No ship selected.</div>";
    const autoMode = expeditionStatus.autoRouteMode || "manual";
    const subTabs = `
      <div class="expedition-subtabs">
        ${actionButton("Runs", `ghost ${ui.expeditionsView === "runs" ? "active" : ""}`, "expedition:view:runs")}
        ${actionButton("Fleet Dock", `ghost ${ui.expeditionsView === "fleet" ? "active" : ""}`, "expedition:view:fleet")}
        ${actionButton("Ships", `ghost ${ui.expeditionsView === "ship" ? "active" : ""}`, "expedition:view:ship")}
      </div>
    `;

    if (ui.expeditionsView === "fleet") {
      return `${subTabs}${renderFleetDockPanel()}`;
    }

    if (ui.expeditionsView === "ship") {
      return `${subTabs}${renderShipGuiPanel()}`;
    }

    const metaRows = `
      <div class="row">
        <div class="kv"><strong>Intel:</strong> ${formatNumber(expeditionStatus.meta.intel || 0)} | <strong>Completed Runs:</strong> ${formatNumber(expeditionStatus.meta.completedRuns || 0)} | <strong>Failed Runs:</strong> ${formatNumber(expeditionStatus.meta.failedRuns || 0)} | <strong>Best Band:</strong> ${formatNumber(expeditionStatus.meta.bestBand || 0)}</div>
      </div>
    `;

    if (!unlockNodeOwned) {
      return `
        ${subTabs}
        <h2>Prestige Expeditions</h2>
        ${shipLine}
        <div class="muted">Expeditions are prestige-first content. Unlock <strong>Expedition Keystone</strong> in Ascend to begin.</div>
        ${metaRows}
      `;
    }

    if (expeditionStatus.pendingRewards) {
      const pending = expeditionStatus.pendingRewards;
      const rewards = pending.rewards || {};
      const outcome = pending.success ? "Success" : "Failure";
      const routeSummary = (pending.routeHistory || [])
        .map((step) => step.name)
        .join(" -> ");
      const encounterSummary = (pending.encounters || [])
        .slice(-2)
        .map((entry) => `${entry.name} (${entry.success ? "stabilized" : "breach"})`)
        .join(" | ");
      const dropSummary = (pending.drops || [])
        .map((drop) => drop.name)
        .join(" | ");
      return `
        ${subTabs}
        <h2>Prestige Expeditions</h2>
        ${shipLine}
        <div class="row">
          <div>
            <div><strong>${pending.bandName}</strong> resolved: ${outcome}</div>
            <div class="kv">Claim: +${formatNumber(rewards.matter || 0)} Matter, +${formatNumber(rewards.fire || 0)} Fire, +${formatNumber(rewards.intel || 0)} Intel</div>
            ${routeSummary ? `<div class="kv">Route: ${routeSummary}</div>` : ""}
            ${encounterSummary ? `<div class="kv">Encounters: ${encounterSummary}</div>` : ""}
            ${dropSummary ? `<div class="kv">Rare Finds: ${dropSummary}</div>` : ""}
          </div>
          ${actionButton("Claim Rewards", "primary", "expedition:claim")}
        </div>
        ${metaRows}
      `;
    }

    if (expeditionStatus.activeRun) {
      const run = expeditionStatus.activeRun;
      const segmentProgressRaw = run.segmentDurationSeconds > 0
        ? run.segmentElapsedSeconds / run.segmentDurationSeconds
        : 0;
      const segmentProgress = Math.max(0, Math.min(1, segmentProgressRaw));
      const completedStages = run.awaitingChoice ? run.stageIndex : run.stageIndex + segmentProgress;
      const totalProgressRaw = run.stageCount > 0 ? completedStages / run.stageCount : 0;
      const progress = Math.max(0, Math.min(100, totalProgressRaw * 100));
      const band = expeditionStatus.bands.find((item) => item.id === run.bandId);
      const shipRiskMitigation = run.ship?.stats?.riskMitigation || 0;
      const totalMitigation = clamp((state.perks.expeditionRiskMitigation || 0) + shipRiskMitigation, 0, 0.8);
      const currentRisk = clamp((band?.risk || 0) + (run.modifiers?.riskDelta || 0), 0.04, 0.98);
      const mitigatedRisk = currentRisk * (1 - totalMitigation);
      const routeRows = (run.routeHistory || [])
        .slice(-3)
        .map((item) => `<div class="kv">Stage ${item.stage}: ${item.name}</div>`)
        .join("");
      const encounterRows = (run.encounterLog || [])
        .slice(-2)
        .map((entry) => `<div class="kv">${entry.name}: ${entry.success ? "stabilized" : "breach"}</div>`)
        .join("");
      const dropRows = (run.pendingDrops || [])
        .slice(-2)
        .map((drop) => `<div class="kv">Rare find secured: ${drop.name}</div>`)
        .join("");

      const choicePanel = run.awaitingChoice
        ? `
          <div class="row">
            <div>
              <div><strong>Route Decision Required</strong></div>
              <div class="kv">Choose a branch for stage ${Math.min(run.stageIndex + 1, run.stageCount)}.</div>
            </div>
          </div>
          <div class="scroll-panel">
            ${(run.pendingChoices || [])
              .map((choice) => {
                const risk = Number(choice.riskDelta) || 0;
                const yieldDelta = Number(choice.yieldDelta) || 0;
                const riskText = `${risk >= 0 ? "+" : ""}${(risk * 100).toFixed(1)}% risk`;
                const yieldText = `${yieldDelta >= 0 ? "+" : ""}${(yieldDelta * 100).toFixed(1)}% yield`;
                const projectedRisk = clamp(currentRisk + risk, 0.04, 0.98);
                const projectedMitigatedRisk = projectedRisk * (1 - totalMitigation);
                const variance = choice.stageVarianceSummary;
                const varianceLine = variance
                  ? `<div class="kv">Stage variance: risk ${(variance.riskDelta >= 0 ? "+" : "")}${(variance.riskDelta * 100).toFixed(1)}%, yield ${(variance.yieldDelta >= 0 ? "+" : "")}${(variance.yieldDelta * 100).toFixed(1)}%, speed x${Number(variance.speedMultiplier || 1).toFixed(2)}, intel ${(Number(variance.intelFlat || 0) >= 0 ? "+" : "")}${Math.round(Number(variance.intelFlat || 0))}</div>`
                  : "";
                const routeLine = choice.encounterPool
                  ? `<div class="kv">Encounter profile: ${choice.encounterPool}</div>`
                  : "";
                const lockLine = choice.unlocked
                  ? ""
                  : `<div class="kv">${choice.lockReason || "Locked by prestige requirements."}</div>`;
                return `
                  <div class="row">
                    <div>
                      <div><strong>${choice.name}</strong></div>
                      <div class="kv">${choice.description || ""}</div>
                      <div class="kv">${riskText} | ${yieldText}</div>
                      <div class="kv">Projected risk: ${(projectedRisk * 100).toFixed(1)}% (mitigated ${(projectedMitigatedRisk * 100).toFixed(1)}%)</div>
                      ${varianceLine}
                      ${routeLine}
                      ${lockLine}
                    </div>
                    ${actionButton("Commit", "secondary", `expedition:route:${choice.id}`, !choice.unlocked)}
                  </div>
                `;
              })
              .join("")}
          </div>
        `
        : "";

      return `
        ${subTabs}
        <h2>Prestige Expeditions</h2>
        ${shipLine}
        <div class="row">
          <div>
            <div><strong>${band?.name || run.bandId}</strong> in progress</div>
            <div class="kv" id="expedition-stage-text">Stage ${Math.min(run.stageIndex + 1, run.stageCount)} / ${run.stageCount} | ${progress.toFixed(1)}% total</div>
            <div class="kv" id="expedition-segment-text">Segment: ${formatDuration(run.segmentElapsedSeconds || 0)} / ${formatDuration(run.segmentDurationSeconds || 0)}</div>
            <div class="kv">Current risk: ${(currentRisk * 100).toFixed(1)}% (mitigated ${(mitigatedRisk * 100).toFixed(1)}%)</div>
            <div class="kv">Route mode: ${run.autoRouteMode || autoMode}</div>
            ${routeRows}
            ${encounterRows}
            ${dropRows}
          </div>
          ${actionButton("Abandon", "ghost", "expedition:abandon")}
        </div>
        <div class="expedition-progress"><span id="expedition-progress-fill" style="width:${Math.max(2, progress).toFixed(1)}%"></span></div>
        ${choicePanel}
        ${metaRows}
      `;
    }

    const bandRows = expeditionStatus.bands
      .map((band) => {
        const cost = band.cost || {};
        const disabled = !band.unlock.ok;
        const requirements = disabled ? `<div class="kv">${band.unlock.reason}</div>` : "";
        return `
          <div class="row">
            <div>
              <div><strong>Band ${band.rank}: ${band.name}</strong></div>
              <div class="kv">${band.description}</div>
              <div class="kv">Cost: ${formatNumber(cost.matter || 0)} Matter | ${formatNumber(cost.fire || 0)} Fire | ${formatNumber(cost.intel || 0)} Intel</div>
              <div class="kv">Intel Pressure Fee: ${formatNumber(band.intelLaunchCost || 0)} Intel</div>
              <div class="kv">Duration: ${formatDuration(band.durationSeconds || 0)} | Risk: ${((band.risk || 0) * 100).toFixed(1)}%</div>
              <div class="kv">Stages: ${Math.max(1, band.stageCount || 1)} | Branching route decisions each stage</div>
              ${requirements}
            </div>
            <div class="expedition-launch-actions">
              ${actionButton("Launch", "ghost", `expedition:start:${band.id}`, disabled)}
              ${actionButton("Auto", "secondary", `expedition:auto:${band.id}`, disabled)}
            </div>
          </div>
        `;
      })
      .join("");

    return `
      ${subTabs}
      <h2>Prestige Expeditions</h2>
      ${shipLine}
      <div class="muted">Launch a run, wait for resolution, then claim rewards. Ascension nodes control your depth and safety.</div>
      <div class="scroll-panel">${bandRows}${metaRows}</div>
    `;
  }

  function renderTabPanel(rates) {
    if (ui.activeTab === "upgrades") {
      return renderUpgradesPanel();
    }
    if (ui.activeTab === "research") {
      return renderResearchPanel();
    }
    if (ui.activeTab === "expeditions") {
      return renderExpeditionsPanel();
    }
    if (ui.activeTab === "ascend") {
      return renderAscendPanel();
    }
    return renderUpgradesPanel();
  }

  function applyTabActiveState() {
    appEl.querySelectorAll("button[data-action^='tab:']").forEach((el) => {
      const action = el.getAttribute("data-action");
      const isActive = action === `tab:${ui.activeTab}`;
      el.classList.toggle("active", isActive);
    });
  }

  function renderPanel() {
    const rates = formulas.productionPerSecond(state, generatorDefs);
    const isAscendTab = ui.activeTab === "ascend";
    const isExpeditionsTab = ui.activeTab === "expeditions";
    const isFullWidthTab = isAscendTab || isExpeditionsTab;
    if (ui.panelEl && (ui.activeTab === "upgrades" || ui.activeTab === "research" || ui.activeTab === "expeditions")) {
      const currentScroll = ui.panelEl.querySelector(".scroll-panel");
      if (currentScroll) {
        ui.scrollPositions[ui.activeTab] = currentScroll.scrollTop;
      }
    }
    if (ui.pinnedEl) {
      ui.pinnedEl.innerHTML = renderPinnedPanel(rates);
      cachePinnedRefs();
    }
    ui.panelEl.innerHTML = renderTabPanel(rates);
    applyTabActiveState();
    if (ui.panelEl && (ui.activeTab === "upgrades" || ui.activeTab === "research" || ui.activeTab === "expeditions")) {
      const nextScroll = ui.panelEl.querySelector(".scroll-panel");
      if (nextScroll) {
        nextScroll.scrollTop = ui.scrollPositions[ui.activeTab] || 0;
      }
    }
    refs.mainGrid.classList.toggle("full-width-mode", isFullWidthTab);
    refs.mainGrid.classList.toggle("expeditions-mode", isExpeditionsTab);
    if (isAscendTab) {
      refs.mainGrid.classList.add("ascend-mode");
      setupAscendInteractions();
    } else {
      refs.mainGrid.classList.remove("ascend-mode");
    }
    ui.lastExpeditionSignature = getExpeditionRenderSignature();
  }

  function getExpeditionRenderSignature() {
    const status = systems.expeditions.getStatus();
    const run = status.activeRun;
    const pending = status.pendingRewards;
    return [
      ui.expeditionsView,
      status.selectedShip || "",
      run ? "active" : "inactive",
      run?.bandId || "",
      run?.stageIndex ?? -1,
      run?.awaitingChoice ? 1 : 0,
      run?.pendingChoices?.length ?? 0,
      run?.routeHistory?.length ?? 0,
      run?.encounterLog?.length ?? 0,
      run?.pendingDrops?.length ?? 0,
      pending ? "pending" : "no-pending",
      pending?.drops?.length ?? 0
    ].join("|");
  }

  function refreshExpeditionLiveState() {
    if (ui.activeTab !== "expeditions" || ui.expeditionsView !== "runs") {
      return;
    }
    const status = systems.expeditions.getStatus();
    const run = status.activeRun;
    if (!run || run.awaitingChoice) {
      return;
    }

    const segmentProgressRaw = run.segmentDurationSeconds > 0
      ? run.segmentElapsedSeconds / run.segmentDurationSeconds
      : 0;
    const segmentProgress = Math.max(0, Math.min(1, segmentProgressRaw));
    const completedStages = run.stageIndex + segmentProgress;
    const totalProgressRaw = run.stageCount > 0 ? completedStages / run.stageCount : 0;
    const progress = Math.max(0, Math.min(100, totalProgressRaw * 100));

    const stageEl = ui.panelEl.querySelector("#expedition-stage-text");
    const segmentEl = ui.panelEl.querySelector("#expedition-segment-text");
    const progressEl = ui.panelEl.querySelector("#expedition-progress-fill");

    if (stageEl) {
      stageEl.textContent = `Stage ${Math.min(run.stageIndex + 1, run.stageCount)} / ${run.stageCount} | ${progress.toFixed(1)}% total`;
    }
    if (segmentEl) {
      segmentEl.textContent = `Segment: ${formatDuration(run.segmentElapsedSeconds || 0)} / ${formatDuration(run.segmentDurationSeconds || 0)}`;
    }
    if (progressEl) {
      progressEl.style.width = `${Math.max(2, progress).toFixed(1)}%`;
    }
  }

  function setupAscendInteractions() {
    const viewport = ui.panelEl.querySelector("[data-ascend-viewport]");
    const stage = ui.panelEl.querySelector("[data-ascend-stage]");
    if (!viewport || !stage) {
      return;
    }

    if (!ui.ascendView) {
      ui.ascendView = {
        scale: 1,
        minScale: 0.6,
        maxScale: 1.8,
        x: 0,
        y: 0,
        dragging: false,
        panning: false,
        startX: 0,
        startY: 0,
        baseX: 0,
        baseY: 0,
        suppressClick: false
      };
    }

    const view = ui.ascendView;

    function updateTransform() {
      stage.style.setProperty("--pan-x", `${view.x.toFixed(1)}px`);
      stage.style.setProperty("--pan-y", `${view.y.toFixed(1)}px`);
      stage.style.setProperty("--zoom", view.scale.toFixed(3));
    }

    updateTransform();

    if (viewport.dataset.bound === "true") {
      return;
    }
    viewport.dataset.bound = "true";

    viewport.addEventListener("wheel", (event) => {
      event.preventDefault();
      const delta = event.deltaY;
      const nextScale = clamp(view.scale * (delta > 0 ? 0.9 : 1.1), view.minScale, view.maxScale);
      if (nextScale === view.scale) {
        return;
      }

      const rect = viewport.getBoundingClientRect();
      const cx = event.clientX - rect.left - rect.width / 2;
      const cy = event.clientY - rect.top - rect.height / 2;
      const ratio = nextScale / view.scale;

      view.x = cx - (cx - view.x) * ratio;
      view.y = cy - (cy - view.y) * ratio;
      view.scale = nextScale;
      updateTransform();
    }, { passive: false });

    viewport.addEventListener("pointerdown", (event) => {
      const button = event.target.closest("button");
      if (button && !(button.classList.contains("owned") || button.classList.contains("locked"))) {
        return;
      }
      view.dragging = true;
      view.panning = false;
      view.startX = event.clientX;
      view.startY = event.clientY;
      view.baseX = view.x;
      view.baseY = view.y;
      viewport.setPointerCapture(event.pointerId);
    });

    viewport.addEventListener("pointermove", (event) => {
      if (!view.dragging) {
        return;
      }
      const dx = event.clientX - view.startX;
      const dy = event.clientY - view.startY;
      if (!view.panning && (Math.abs(dx) > 4 || Math.abs(dy) > 4)) {
        view.panning = true;
        viewport.classList.add("dragging");
      }
      if (!view.panning) {
        return;
      }
      view.x = view.baseX + dx;
      view.y = view.baseY + dy;
      updateTransform();
    });

    function endPan(event) {
      if (!view.dragging) {
        return;
      }
      view.dragging = false;
      viewport.classList.remove("dragging");
      if (view.panning) {
        view.suppressClick = true;
        setTimeout(() => {
          view.suppressClick = false;
        }, 50);
      }
      view.panning = false;
      if (event?.pointerId) {
        viewport.releasePointerCapture(event.pointerId);
      }
    }

    viewport.addEventListener("pointerup", endPan);
    viewport.addEventListener("pointercancel", endPan);
    viewport.addEventListener("pointerleave", endPan);
  }

  function bindEvents() {
    if (ui.isBound) {
      return;
    }
    appEl.addEventListener("click", (event) => {
      const target = event.target.closest("button[data-action]");
      if (!target || target.disabled) {
        return;
      }
      if (ui.activeTab === "ascend" && ui.ascendView?.suppressClick) {
        return;
      }
      const action = target.getAttribute("data-action") || "";

      if (action === "transmute") {
        systems.actions.manualTransmute();
        setNotice("Matter transmuted.", true);
        if (ui.activeTab !== "overview") {
          renderPanel();
        }
      } else if (action === "convert") {
        const result = systems.actions.convertMatterToFire();
        setNotice(result.ok ? "Conversion successful." : result.reason, result.ok);
        if (ui.activeTab !== "overview") {
          renderPanel();
        }
      } else if (action === "ascend") {
        const result = systems.actions.ascend();
        setNotice(result.ok ? `Ascension complete. +${result.gain} shards.` : result.reason, result.ok);
        renderPanel();
      } else if (action.startsWith("buy:")) {
        const generatorId = action.split(":")[1];
        const result = systems.generators.buy(generatorId);
        setNotice(result.ok ? "Generator purchased." : result.reason, result.ok);
        renderPanel();
      } else if (action.startsWith("upgrade:")) {
        const upgradeId = action.split(":")[1];
        const result = systems.upgrades.buy(upgradeId);
        setNotice(result.ok ? "Upgrade purchased." : result.reason, result.ok);
        renderPanel();
      } else if (action.startsWith("research:")) {
        const researchId = action.split(":")[1];
        const result = systems.research.levelUp(researchId);
        setNotice(result.ok ? "Research advanced." : result.reason, result.ok);
        renderPanel();
      } else if (action.startsWith("tab:")) {
        ui.activeTab = action.split(":")[1];
        if (ui.activeTab === "expeditions" && !ui.expeditionsView) {
          ui.expeditionsView = "runs";
        }
        renderPanel();
      } else if (action.startsWith("expedition:view:")) {
        ui.expeditionsView = action.split(":")[2] || "runs";
        renderPanel();
      } else if (action.startsWith("expedition:auto:")) {
        const bandId = action.split(":")[2] || "";
        const selectedMode = systems.expeditions.getStatus().autoRouteMode || "manual";
        const modeToUse = selectedMode === "manual" ? "balanced" : selectedMode;
        const modeResult = systems.expeditions.setAutoRouteMode(modeToUse);
        if (!modeResult.ok) {
          setNotice(modeResult.reason || "Unable to set auto mode.", false);
          renderPanel();
          return;
        }
        const result = systems.expeditions.start(bandId);
        setNotice(result.ok ? `Auto expedition launched (${modeResult.mode}).` : result.reason, result.ok);
        renderPanel();
      } else if (action.startsWith("expedition:mode:")) {
        const mode = action.split(":")[2] || "manual";
        const result = systems.expeditions.setAutoRouteMode(mode);
        setNotice(result.ok ? `Route mode set to ${result.mode}.` : (result.reason || "Unable to set route mode."), result.ok);
        renderPanel();
      } else if (action.startsWith("expedition:start:")) {
        const bandId = action.split(":")[2];
        const result = systems.expeditions.start(bandId);
        setNotice(result.ok ? "Expedition launched." : result.reason, result.ok);
        renderPanel();
      } else if (action === "expedition:claim") {
        const result = systems.expeditions.claim();
        const dropCount = Array.isArray(result.drops) ? result.drops.length : 0;
        const claimNotice = result.ok
          ? (dropCount > 0 ? `Expedition rewards claimed. ${dropCount} rare find(s) secured.` : "Expedition rewards claimed.")
          : result.reason;
        setNotice(claimNotice, result.ok);
        renderPanel();
      } else if (action === "expedition:abandon") {
        const result = systems.expeditions.abandon();
        setNotice(result.ok ? "Expedition abandoned." : result.reason, result.ok);
        renderPanel();
      } else if (action.startsWith("expedition:route:")) {
        const choiceId = action.split(":")[2];
        const result = systems.expeditions.chooseRoute(choiceId);
        const notice = result.ok
          ? (result.encounter ? `Route locked. Encounter: ${result.encounter.name}.` : "Route locked.")
          : result.reason;
        setNotice(notice, result.ok);
        renderPanel();
      } else if (action.startsWith("ship:select:")) {
        const shipId = action.split(":")[2];
        const result = systems.ships.selectShip(shipId);
        setNotice(result.ok ? "Ship selected." : result.reason, result.ok);
        renderPanel();
      } else if (action.startsWith("ship:buy:")) {
        const shipId = action.split(":")[2];
        const result = systems.ships.buyShip(shipId);
        setNotice(result.ok ? "Ship purchased." : result.reason, result.ok);
        renderPanel();
      } else if (action.startsWith("ship:focus:")) {
        ui.fleetFocusSlot = action.split(":")[2] || "hull";
        ui.dragHoverSlot = "";
        renderPanel();
      } else if (action.startsWith("ship:upgrade:")) {
        const shipId = action.split(":")[2];
        const facilityId = action.split(":")[3];
        const result = systems.ships.upgradeFacility(shipId, facilityId);
        setNotice(result.ok ? "Facility upgraded." : result.reason, result.ok);
        renderPanel();
      } else if (action.startsWith("ship:equip:")) {
        const shipId = action.split(":")[2];
        const slotId = action.split(":")[3];
        const encodedPartId = action.split(":")[4] || "";
        const partId = decodeURIComponent(encodedPartId);
        const result = systems.ships.equipPart(shipId, slotId, partId);
        setNotice(result.ok ? "Part equipped." : result.reason, result.ok);
        renderPanel();
      } else if (action.startsWith("ship:unequip:")) {
        const shipId = action.split(":")[2];
        const slotId = action.split(":")[3];
        const result = systems.ships.unequipPart(shipId, slotId);
        setNotice(result.ok ? "Part unequipped." : result.reason, result.ok);
        renderPanel();
      } else if (action.startsWith("ascend:")) {
        const nodeId = action.split(":")[1];
        const result = systems.ascendTree.buy(nodeId);
        setNotice(result.ok ? "Ascension node unlocked." : result.reason, result.ok);
        renderPanel();
      } else if (action === "save-reset" && saveSlots) {
        saveSlots.onReset(saveSlots.activeSlotId);
      }

      refreshHud();
    });

    function clearShipDropTargets() {
      appEl.querySelectorAll(".ship-zone.drop-target, .ship-zone.drop-invalid").forEach((zoneEl) => {
        zoneEl.classList.remove("drop-target", "drop-invalid");
      });
    }

    function getDraggedPartDef() {
      if (!ui.draggingPartId) {
        return null;
      }
      return systems.ships.getStatus().partDefs?.[ui.draggingPartId] || null;
    }

    appEl.addEventListener("dragstart", (event) => {
      const itemEl = event.target.closest(".inventory-item[data-part-id]");
      if (!itemEl) {
        return;
      }
      ui.draggingPartId = itemEl.dataset.partId || "";
      const sourceShipId = itemEl.dataset.shipId || systems.ships.getStatus().selectedShip;
      const payload = JSON.stringify({
        partId: ui.draggingPartId,
        slotId: itemEl.dataset.slot || "",
        shipId: sourceShipId
      });
      event.dataTransfer?.setData("text/plain", payload);
      event.dataTransfer.effectAllowed = "move";
      itemEl.classList.add("dragging");
    });

    appEl.addEventListener("dragend", (event) => {
      const itemEl = event.target.closest(".inventory-item.dragging");
      if (itemEl) {
        itemEl.classList.remove("dragging");
      }
      ui.draggingPartId = "";
      ui.dragHoverSlot = "";
      clearShipDropTargets();
    });

    appEl.addEventListener("dragover", (event) => {
      const zoneEl = event.target.closest(".ship-zone[data-slot]");
      if (!zoneEl || !ui.draggingPartId) {
        return;
      }
      const partDef = getDraggedPartDef();
      const slotId = zoneEl.dataset.slot || "";
      const shipId = zoneEl.dataset.shipId || systems.ships.getStatus().selectedShip;
      const compatible = Boolean(partDef) && partDef.slot === slotId && (!partDef.shipId || partDef.shipId === shipId);
      ui.dragHoverSlot = slotId;
      clearShipDropTargets();
      zoneEl.classList.add(compatible ? "drop-target" : "drop-invalid");
      if (compatible) {
        event.preventDefault();
      }
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = compatible ? "move" : "none";
      }
    });

    appEl.addEventListener("dragleave", (event) => {
      const zoneEl = event.target.closest(".ship-zone[data-slot]");
      if (!zoneEl) {
        return;
      }
      ui.dragHoverSlot = "";
      zoneEl.classList.remove("drop-target", "drop-invalid");
    });

    appEl.addEventListener("drop", (event) => {
      const zoneEl = event.target.closest(".ship-zone[data-slot]");
      if (!zoneEl) {
        return;
      }
      event.preventDefault();
      let payload = null;
      const rawData = event.dataTransfer?.getData("text/plain") || "";
      if (rawData) {
        try {
          payload = JSON.parse(rawData);
        } catch {
          payload = null;
        }
      }

      const partId = payload?.partId || ui.draggingPartId;
      const shipId = zoneEl.dataset.shipId || payload?.shipId || systems.ships.getStatus().selectedShip;
      const slotId = zoneEl.dataset.slot || "";
      const partDef = systems.ships.getStatus().partDefs?.[partId] || null;
      clearShipDropTargets();
      ui.draggingPartId = "";
      ui.dragHoverSlot = "";

      if (!partId || !shipId || !slotId) {
        return;
      }

      if (!partDef) {
        setNotice("Unknown part selected.", false);
        return;
      }
      if (partDef.slot !== slotId) {
        setNotice(`That part fits ${partDef.slot}, not ${slotId}.`, false);
        return;
      }
      if (partDef.shipId && partDef.shipId !== shipId) {
        setNotice(`That part is restricted to ${partDef.shipId}.`, false);
        return;
      }

      const result = systems.ships.equipPart(shipId, slotId, partId);
      setNotice(result.ok ? "Part equipped." : result.reason, result.ok);
      renderPanel();
      refreshHud();
    });

    if (refs.saveSlot && saveSlots) {
      refs.saveSlot.addEventListener("change", (event) => {
        const value = event.target.value;
        saveSlots.onSelect(value);
      });
    }
    ui.isBound = true;
  }

  function start() {
    buildLayout();
    bindEvents();
    renderPanel();
    refreshHud();
  }

  function refreshHud() {
    const rates = formulas.productionPerSecond(state, generatorDefs);
    const ascendGain = Math.max(1, ascendShardGainFromResources(state));
    const ascendCostValues = ascendCost(state);

    refs.matter.textContent = formatNumber(state.resources.matter);
    refs.fire.textContent = formatNumber(state.resources.fire);
    refs.shards.textContent = formatNumber(state.resources.shards);
    refs.intel.textContent = formatNumber(state.expeditions?.meta?.intel || 0);
    refs.prodMultiplier.textContent = `x${state.perks.productionMultiplier.toFixed(2)}`;

    const clickBase = (balance.baseClickMatter + state.perks.clickMatterBonus) * state.perks.clickMultiplier;
    const clickFire = state.perks.clickFireBonus;
    const clickFireText = clickFire > 0 ? ` +${formatNumber(clickFire)} Fire` : "";
    refs.transmuteYield.textContent = `+${formatNumber(clickBase)} Matter${clickFireText}`;
    const conversionBase = balance.elementConversionCost * state.perks.conversionCostMultiplier;
    const conversionCost = Math.max(1, Math.floor(conversionBase - state.perks.conversionCostFlatReduction));
    const conversionOut = (1 + state.perks.conversionFireBonus) * state.perks.conversionYieldMultiplier;
    refs.convertYield.textContent = `${formatNumber(conversionCost)} Matter -> ${formatNumber(conversionOut)} Fire`;
    refs.ascendGain.textContent = `Cost: ${formatNumber(ascendCostValues.matterCost)} Matter + ${formatNumber(ascendCostValues.fireCost)} Fire | Gain: +${formatNumber(ascendGain)} Shards`;
    refs.rate.textContent = `${formatNumber(rates.matter)}/s Matter | ${formatNumber(rates.fire)}/s Fire`;

    refs.convertButton.disabled = state.resources.matter < conversionCost;
    refs.ascendButton.disabled =
      state.resources.matter < ascendCostValues.matterCost ||
      state.resources.fire < ascendCostValues.fireCost;

    refs.notice.textContent = ui.notice;
    refs.notice.classList.toggle("good", ui.good);

    if (ui.activeTab === "expeditions") {
      const nextSignature = getExpeditionRenderSignature();
      if (nextSignature !== ui.lastExpeditionSignature) {
        ui.lastExpeditionSignature = nextSignature;
        renderPanel();
      } else {
        refreshExpeditionLiveState();
      }
    }
  }

  return { start, setNotice, refreshHud };
}

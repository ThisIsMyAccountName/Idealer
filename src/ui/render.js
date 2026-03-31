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

export function createRenderer({ appEl, state, balance, generatorDefs, formulas, systems, saveSlots }) {
  const ui = {
    notice: "",
    good: false,
    activeTab: "upgrades",
    isBound: false,
    panelEl: null,
    pinnedEl: null,
    ascendView: null,
    scrollPositions: {
      upgrades: 0,
      research: 0
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
    refs.prodMultiplier = appEl.querySelector("#prod-multiplier");
    refs.mainGrid = appEl.querySelector("#main-grid");
    ui.pinnedEl = appEl.querySelector("#pinned-panel");
    refs.saveSlot = appEl.querySelector("#save-slot");
    refs.saveReset = appEl.querySelector("[data-action='save-reset']");
    ui.panelEl = appEl.querySelector("#dynamic-panel");
  }

  function renderPinnedPanel(rates) {
    return `
      <h2>Overview</h2>
      <div class="notice" id="notice"></div>
      ${renderOverviewPanel(rates)}
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

  function renderTabPanel(rates) {
    if (ui.activeTab === "upgrades") {
      return renderUpgradesPanel();
    }
    if (ui.activeTab === "research") {
      return renderResearchPanel();
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
    if (ui.panelEl && (ui.activeTab === "upgrades" || ui.activeTab === "research")) {
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
    if (ui.panelEl && (ui.activeTab === "upgrades" || ui.activeTab === "research")) {
      const nextScroll = ui.panelEl.querySelector(".scroll-panel");
      if (nextScroll) {
        nextScroll.scrollTop = ui.scrollPositions[ui.activeTab] || 0;
      }
    }
    if (ui.activeTab === "ascend") {
      refs.mainGrid.classList.add("ascend-mode");
      setupAscendInteractions();
    } else {
      refs.mainGrid.classList.remove("ascend-mode");
    }
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
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
  }

  return { start, setNotice, refreshHud };
}

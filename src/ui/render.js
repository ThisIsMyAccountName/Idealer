import { generatorCost, prestigeShardGain } from "../engine/formulas.js";
import { researchCost } from "../game/researchSystem.js";

function formatNumber(value) {
  if (value >= 1_000_000_000) {
    return `${(value / 1_000_000_000).toFixed(2)}B`;
  }
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(2)}M`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(2)}K`;
  }
  return value.toFixed(2);
}

export function createRenderer({ appEl, state, balance, generatorDefs, formulas, systems }) {
  const ui = {
    notice: "",
    good: false,
    activeTab: "overview",
    isBound: false,
    dirty: true,
    rafId: null,
    lastRenderAt: 0
  };

  function setNotice(text, good = false) {
    ui.notice = text;
    ui.good = good;
  }

  function actionButton(label, className, action, disabled = false) {
    return `<button class="${className}" data-action="${action}" ${disabled ? "disabled" : ""}>${label}</button>`;
  }

  function renderOverviewPanel(rates) {
    const generatorRows = Object.values(generatorDefs)
      .map((def) => {
        const level = state.generators[def.id] || 0;
        const cost = generatorCost(def, level);
        const canBuy = (state.resources[def.costResource] || 0) >= cost;
        const resourceMultiplier = def.resource === "matter" ? state.perks.matterRateMultiplier : state.perks.fireRateMultiplier;
        const effectiveRate = def.baseRate * state.perks.productionMultiplier * resourceMultiplier;

        return `
          <div class="row">
            <div>
              <div><strong>${def.name}</strong> Lv.${level}</div>
              <div class="kv">+${formatNumber(effectiveRate)}/s ${def.resource} | Cost ${formatNumber(cost)} ${def.costResource}</div>
            </div>
            ${actionButton("Buy", "ghost", `buy:${def.id}`, !canBuy)}
          </div>
        `;
      })
      .join("");

    return `
      <article class="panel">
        <h2>Generators</h2>
        ${generatorRows}
        <div class="row">
          <div class="muted">Current rates</div>
          <div class="kv">${formatNumber(rates.matter)}/s Matter | ${formatNumber(rates.fire)}/s Fire</div>
        </div>
      </article>
    `;
  }

  function renderUpgradesPanel() {
    const rows = Object.values(balance.upgrades)
      .map((def) => {
        const owned = Boolean(state.upgrades[def.id]);
        const unlocked = systems.upgrades.isUnlocked(def.id);
        const affordable = (state.resources[def.costResource] || 0) >= def.cost;
        const disabled = owned || !unlocked || !affordable;

        let status = "Available";
        if (owned) {
          status = "Purchased";
        } else if (!unlocked) {
          status = "Locked";
        } else if (!affordable) {
          status = `Need ${formatNumber(def.cost)} ${def.costResource}`;
        }

        return `
          <div class="row">
            <div>
              <div><strong>${def.name}</strong></div>
              <div class="kv">${def.description}</div>
              <div class="kv">Cost: ${formatNumber(def.cost)} ${def.costResource} | ${status}</div>
            </div>
            ${actionButton(owned ? "Owned" : "Buy", "ghost", `upgrade:${def.id}`, disabled)}
          </div>
        `;
      })
      .join("");

    return `
      <article class="panel">
        <h2>Upgrades</h2>
        ${rows}
      </article>
    `;
  }

  function renderResearchPanel() {
    const rows = Object.values(balance.research)
      .map((def) => {
        const level = state.research[def.id] || 0;
        const maxed = level >= def.maxLevel;
        const unlocked = systems.research.isUnlocked(def.id);
        const nextCost = researchCost(def, level);
        const affordable = (state.resources[def.costResource] || 0) >= nextCost;
        const disabled = maxed || !unlocked || !affordable;

        let status = `Lv.${level}/${def.maxLevel}`;
        if (!unlocked) {
          status = "Locked";
        } else if (maxed) {
          status = "Maxed";
        } else if (!affordable) {
          status = `Need ${formatNumber(nextCost)} ${def.costResource}`;
        }

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
      <article class="panel">
        <h2>Research</h2>
        ${rows}
      </article>
    `;
  }

  function renderTabPanel(rates) {
    if (ui.activeTab === "upgrades") {
      return renderUpgradesPanel();
    }
    if (ui.activeTab === "research") {
      return renderResearchPanel();
    }
    return renderOverviewPanel(rates);
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
      const action = target.getAttribute("data-action") || "";

      if (action === "transmute") {
        systems.actions.manualTransmute();
        setNotice("Matter transmuted.", true);
      } else if (action === "convert") {
        const result = systems.actions.convertMatterToFire();
        setNotice(result.ok ? "Conversion successful." : result.reason, result.ok);
      } else if (action === "ascend") {
        const result = systems.actions.ascend();
        setNotice(result.ok ? `Ascension complete. +${result.gain} shards.` : result.reason, result.ok);
      } else if (action.startsWith("buy:")) {
        const generatorId = action.split(":")[1];
        const result = systems.generators.buy(generatorId);
        setNotice(result.ok ? "Generator purchased." : result.reason, result.ok);
      } else if (action.startsWith("upgrade:")) {
        const upgradeId = action.split(":")[1];
        const result = systems.upgrades.buy(upgradeId);
        setNotice(result.ok ? "Upgrade purchased." : result.reason, result.ok);
      } else if (action.startsWith("research:")) {
        const researchId = action.split(":")[1];
        const result = systems.research.levelUp(researchId);
        setNotice(result.ok ? "Research advanced." : result.reason, result.ok);
      } else if (action.startsWith("tab:")) {
        ui.activeTab = action.split(":")[1];
      }

      invalidate();
    });
    ui.isBound = true;
  }

  function frame(ts) {
    if (ui.dirty && ts - ui.lastRenderAt >= balance.minRenderIntervalMs) {
      render();
      ui.dirty = false;
      ui.lastRenderAt = ts;
    }
    ui.rafId = window.requestAnimationFrame(frame);
  }

  function start() {
    bindEvents();
    if (!ui.rafId) {
      ui.rafId = window.requestAnimationFrame(frame);
    }
    invalidate();
  }

  function invalidate() {
    ui.dirty = true;
  }

  function render() {
    const rates = formulas.productionPerSecond(state, generatorDefs);
    const ascendGain = prestigeShardGain(state);

    appEl.innerHTML = `
      <section class="titlebar">
        <h1>Dimensional Alchemy</h1>
        <div class="subtitle">A cosmic lab idle prototype. First implementation slice with layered progression.</div>

        <div class="resource-grid">
          <div class="resource-card"><div class="label">Matter</div><div class="value">${formatNumber(state.resources.matter)}</div></div>
          <div class="resource-card"><div class="label">Fire Essence</div><div class="value">${formatNumber(state.resources.fire)}</div></div>
          <div class="resource-card"><div class="label">Ascension Shards</div><div class="value">${formatNumber(state.resources.shards)}</div></div>
          <div class="resource-card"><div class="label">Production Multiplier</div><div class="value">x${state.perks.productionMultiplier.toFixed(2)}</div></div>
        </div>
      </section>

      <section class="tabbar">
        ${actionButton("Overview", `ghost tab ${ui.activeTab === "overview" ? "active" : ""}`, "tab:overview")}
        ${actionButton("Upgrades", `ghost tab ${ui.activeTab === "upgrades" ? "active" : ""}`, "tab:upgrades")}
        ${actionButton("Research", `ghost tab ${ui.activeTab === "research" ? "active" : ""}`, "tab:research")}
      </section>

      <section class="main-grid">
        <article class="panel">
          <h2>Lab Actions</h2>
          <div class="row">
            <div>
              <div><strong>Transmute Matter</strong></div>
              <div class="kv">+${balance.baseClickMatter + state.perks.clickMatterBonus} Matter</div>
            </div>
            ${actionButton("Transmute", "primary", "transmute")}
          </div>

          <div class="row">
            <div>
              <div><strong>Convert to Fire Essence</strong></div>
              <div class="kv">${balance.elementConversionCost} Matter -> ${1 + state.perks.conversionFireBonus} Fire</div>
            </div>
            ${actionButton("Convert", "secondary", "convert", state.resources.matter < balance.elementConversionCost)}
          </div>

          <div class="row">
            <div>
              <div><strong>Ascend</strong></div>
              <div class="kv">Projected gain: +${ascendGain} Shards</div>
            </div>
            ${actionButton("Ascend", "ghost", "ascend", ascendGain < 1)}
          </div>

          <div class="notice ${ui.good ? "good" : ""}">${ui.notice}</div>
        </article>

        ${renderTabPanel(rates)}
      </section>
    `;
  }

  return { render, setNotice, invalidate, start };
}

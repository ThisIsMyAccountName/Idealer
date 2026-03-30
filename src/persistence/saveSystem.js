import { sanitizeState } from "../engine/gameState.js";

const SAVE_KEY = "dimensional-alchemy-save";

export function loadState() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) {
      return null;
    }
    return sanitizeState(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function saveState(state) {
  const payload = {
    ...state,
    meta: {
      ...state.meta,
      lastSavedAt: Date.now()
    }
  };
  localStorage.setItem(SAVE_KEY, JSON.stringify(payload));
}

export function applyOfflineProgress(state, balance, resourceManager, generatorDefs, formulas) {
  const now = Date.now();
  const elapsedMs = Math.max(0, now - (state.meta.lastSavedAt || now));
  const elapsedSeconds = elapsedMs / 1000;
  if (elapsedSeconds < 1) {
    state.meta.lastTickAt = now;
    return { elapsedSeconds: 0, matterGain: 0, fireGain: 0 };
  }

  const rates = formulas.productionPerSecond(state, generatorDefs);
  const multiplier = balance.offlineEfficiency;
  const matterGain = rates.matter * elapsedSeconds * multiplier;
  const fireGain = rates.fire * elapsedSeconds * multiplier;

  resourceManager.add("matter", matterGain);
  resourceManager.add("fire", fireGain);
  state.meta.lastTickAt = now;

  return { elapsedSeconds, matterGain, fireGain };
}

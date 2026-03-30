export function isUnlockMet(state, unlock) {
  if (!unlock || !unlock.type) {
    return true;
  }

  if (unlock.type === "matterSeen") {
    return state.lifetime.matterSeen >= unlock.value;
  }
  if (unlock.type === "fireSeen") {
    return state.lifetime.fireSeen >= unlock.value;
  }
  if (unlock.type === "ascensions") {
    return state.lifetime.totalAscensions >= unlock.value;
  }
  return true;
}

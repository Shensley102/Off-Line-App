import { loadState, loadSelector } from "./state.js";
import { renderAllSwitches } from "./render.js";
import { updateStatus } from "./status.js";
import { bindToggles } from "./toggles.js";
import { bindSelector } from "./selector.js";
import { registerSW } from "./pwa.js";

const state = loadState();

// IMPORTANT: initialize selector before first updateStatus() (prevents TDZ / undefined)
const selectorRef = { current: loadSelector() };

function init() {
  renderAllSwitches(state);

  // Ensure selector needle matches persisted selector
  bindSelector(state, selectorRef);

  // Bind toggle hotspots
  bindToggles(state, () => selectorRef.current);

  // First status paint
  updateStatus(state, selectorRef.current);

  // PWA
  registerSW();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}

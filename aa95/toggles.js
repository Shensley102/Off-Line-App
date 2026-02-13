import { TOGGLE_IDS } from "./config.js";
import { emit } from "./events.js";
import { renderSwitch } from "./render.js";
import { updateStatus } from "./status.js";
import { saveState } from "./state.js";

const TOGGLE_ONLY = new Set(TOGGLE_IDS.filter(id => id !== "selector_knob"));

export function bindToggles(state, getSelector) {
  TOGGLE_IDS.forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;

    // The selector knob is handled by selector.js
    if (id === "selector_knob") return;

    el.addEventListener("pointerup", (e) => {
      e.preventDefault();
      e.stopPropagation();

      state[id] = !state[id];
      renderSwitch(id, !!state[id]);
      saveState(state);
      emit({ type: "toggle", id, value: !!state[id] });
      updateStatus(state, getSelector());
    }, { passive: false });
  });
}

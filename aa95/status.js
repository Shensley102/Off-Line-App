import { setText } from "./dom.js";

export function updateStatus(state, currentSelector) {
  setText("statSelector", currentSelector);

  const rxMap = {
    com1_toggle: "COM1",
    com2_toggle: "COM2",
    fm1_toggle: "FM1",
    fm2_toggle: "FM2",
    aux_toggle: "AUX",
  };

  const activeRx = Object.entries(rxMap)
    .filter(([id]) => !!state[id])
    .map(([, label]) => label)
    .join(", ");

  setText("statRx", activeRx || "None");
  setText("statAdf",  state.adf_toggle ? "ON" : "OFF");
  setText("statDplr", state.dplr_toggle ? "ON" : "OFF");
  setText("statPat",  state.pat_toggle ? "ON" : "OFF");
  setText("statIso",  state.iso_emr ? "ON" : "OFF");
  setText("statKey",  state.key_toggle ? "ON" : "OFF");
}

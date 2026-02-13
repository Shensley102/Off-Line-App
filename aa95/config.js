export const PANEL_VIEWBOX = { width: 940, height: 314 };
export const TOGGLE_IDS = [
  "com1_toggle",
  "com2_toggle",
  "fm1_toggle",
  "fm2_toggle",
  "aux_toggle",
  "adf_toggle",
  "dplr_toggle",
  "pat_toggle",
  "iso_emr",
  "key_toggle"
];
export const DEFAULT_STATE = {
  "com1_toggle": true,
  "com2_toggle": true,
  "fm1_toggle": true,
  "fm2_toggle": true,
  "aux_toggle": true,
  "adf_toggle": true,
  "dplr_toggle": true,
  "pat_toggle": true,
  "iso_emr": false,
  "key_toggle": true
};
export const DETENTS = [
  { name: "COM1", deg: -120 },
  { name: "FM",   deg: -40  },
  { name: "AUX",  deg:  40  },
  { name: "PA",   deg:  120 },
];
// Selector center in viewBox coordinates (tuned for current SVG)
export const SELECTOR_CENTER = { x: 470, y: 215 };
export const NEEDLE_RADIUS = 90;

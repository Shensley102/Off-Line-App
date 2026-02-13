export function $id(id) {
  return /** @type {HTMLElement|null} */ (document.getElementById(id));
}

export function getPanelSvg() {
  // Most resilient: the AA95 page has exactly one panel SVG.
  return /** @type {SVGSVGElement|null} */ (document.querySelector(".panel svg") || document.querySelector("svg"));
}

export function setText(id, text) {
  const el = $id(id);
  if (el) el.textContent = text;
}

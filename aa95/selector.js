import { DETENTS, SELECTOR_CENTER, PANEL_VIEWBOX, NEEDLE_RADIUS } from "./config.js";
import { emit } from "./events.js";
import { updateStatus } from "./status.js";
import { saveSelector } from "./state.js";

function angleDeg(x, y) {
  return Math.atan2(y - SELECTOR_CENTER.y, x - SELECTOR_CENTER.x) * 180 / Math.PI;
}

function nearestDetentIndex(a) {
  let best = 0, d = 999;
  DETENTS.forEach((s, i) => {
    const diff = Math.abs(a - s.deg);
    if (diff < d) { d = diff; best = i; }
  });
  return best;
}

function clientToViewBox(svgEl, clientX, clientY) {
  const r = svgEl.getBoundingClientRect();
  const x = (clientX - r.left) * (PANEL_VIEWBOX.width / r.width);
  const y = (clientY - r.top)  * (PANEL_VIEWBOX.height / r.height);
  return { x, y };
}

export function bindSelector(state, selectorRef) {
  const knob = document.getElementById("selector_knob");
  const needle = document.getElementById("needle");
  const svg = document.querySelector(".panel svg") || document.querySelector("svg");

  if (!knob || !needle || !svg) return;

  let dragging = false;
  let activePointerId = null;

  function applyDetent(i) {
    const step = DETENTS[i].name;
    selectorRef.current = step;
    saveSelector(step);

    const rad = DETENTS[i].deg * Math.PI / 180;
    const x2  = SELECTOR_CENTER.x + Math.cos(rad) * NEEDLE_RADIUS;
    const y2  = SELECTOR_CENTER.y + Math.sin(rad) * NEEDLE_RADIUS;

    needle.setAttribute("x2", String(x2));
    needle.setAttribute("y2", String(y2));

    emit({ type: "selector", step });
    updateStatus(state, selectorRef.current);
  }

  function handleMove(clientX, clientY) {
    const { x, y } = clientToViewBox(svg, clientX, clientY);
    const a = angleDeg(x, y);
    const i = nearestDetentIndex(a);
    applyDetent(i);
  }

  knob.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragging = true;
    activePointerId = e.pointerId;
    knob.setPointerCapture(activePointerId);
    handleMove(e.clientX, e.clientY);
  }, { passive: false });

  knob.addEventListener("pointermove", (e) => {
    if (!dragging || e.pointerId !== activePointerId) return;
    handleMove(e.clientX, e.clientY);
  });

  function end(e) {
    if (e.pointerId !== activePointerId) return;
    dragging = false;
    try { knob.releasePointerCapture(activePointerId); } catch {}
    activePointerId = null;
  }

  knob.addEventListener("pointerup", end);
  knob.addEventListener("pointercancel", end);


  // Initial needle position (matches persisted selector)
  const initialIndex = Math.max(0, DETENTS.findIndex(d => d.name === selectorRef.current));
  applyDetent(initialIndex === -1 ? 0 : initialIndex);

}

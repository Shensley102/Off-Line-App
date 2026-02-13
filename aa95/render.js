import { TOGGLE_IDS } from "./config.js";
import { toggleMotion } from "./toggleMotion.js";

export function renderAllSwitches(state) {
  TOGGLE_IDS.forEach(id => renderSwitch(id, !!state[id]));
}

export function renderSwitch(id, on) {
  // Convention: on=true means lever UP (base-photo position)
  const m = toggleMotion[id] || { dx: 0, dy: 0, rot: 0 };

  const bgDown = document.getElementById(`bgDown_${id}`);
  const leverUp = document.getElementById(`leverUp_${id}`);
  const leverDown = document.getElementById(`leverDown_${id}`);

  if (!leverUp || !leverDown) return;

  const fwd = `translate(${m.dx.toFixed(2)}px, ${m.dy.toFixed(2)}px) rotate(${m.rot.toFixed(2)}deg)`;
  const inv = `translate(${-m.dx.toFixed(2)}px, ${-m.dy.toFixed(2)}px) rotate(${-m.rot.toFixed(2)}deg)`;

  if (on) {
    if (bgDown) bgDown.style.opacity = "0";
    leverUp.style.opacity = "1";
    leverUp.style.transform = "translate(0px, 0px) rotate(0deg)";
    leverDown.style.opacity = "0";
    leverDown.style.transform = inv;
  } else {
    if (bgDown) bgDown.style.opacity = "1";
    leverUp.style.opacity = "0";
    leverUp.style.transform = fwd;
    leverDown.style.opacity = "1";
    leverDown.style.transform = "translate(0px, 0px) rotate(0deg)";
  }
}

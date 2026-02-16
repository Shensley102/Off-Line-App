// aa95/index.js
// AA95 vector control panel interactions (no external deps)

const SVG_PATH = new URL('./aa95-panel.svg', import.meta.url).pathname;

const state = {
  // top audio selects (match ids in SVG)
  com1_toggle: true,
  com2_toggle: true,
  fm1_toggle: true,
  fm2_toggle: true,
  aux_toggle: true,

  // other controls
  pat_toggle: false,
  key_toggle: false,
  so_toggle: false,
  iso_emr: 'ISO',        // ISO | EMR
  selector: 'COM1',      // COM1 | COM2 | FM1 | FM2 | AUX | PA
  rx_vol: 0.5,           // 0..1
  ics_vol: 0.5,          // 0..1
  vox: 0.5,              // 0..1
};

// --- mount SVG into the page -------------------------------------------------
async function loadPanel() {
  const container = document.getElementById('panel-container');
  if (!container) throw new Error('Missing #panel-container in aa95.html');

  const res = await fetch(SVG_PATH, { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to load SVG: ' + res.status);
  const svgText = await res.text();

  container.innerHTML = svgText;

  const svg = container.querySelector('svg');
  if (!svg) throw new Error('SVG did not mount');
  svg.setAttribute('width', '100%');
  svg.setAttribute('height', '100%');

  wireUp(svg);
}

function qs(svg, sel) {
  const el = svg.querySelector(sel);
  if (!el) throw new Error('Missing SVG element: ' + sel);
  return el;
}

// --- UI helpers --------------------------------------------------------------
function setOpacity(el, v) { el.style.opacity = String(v); }
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

function updateReadout(svg) {
  const s = svg.getElementById('readout_selector');
  const i = svg.getElementById('readout_iso');
  if (s) s.textContent = state.selector;
  if (i) i.textContent = state.iso_emr;
}

function toggleLever(svg, id, isOn) {
  const up = svg.getElementById(id + '_leverUp');
  const down = svg.getElementById(id + '_leverDown');
  const bg = svg.getElementById(id + '_bgDown');
  if (up) setOpacity(up, isOn ? 1 : 0);
  if (down) setOpacity(down, isOn ? 0 : 1);
  if (bg) setOpacity(bg, isOn ? 0 : 0.35);
}

function toggleGlowOnly(svg, id, isOn) {
  const bg = svg.getElementById(id + '_bgDown');
  if (bg) setOpacity(bg, isOn ? 0.35 : 0);
}

function setKnob(svg, pointerId, value01) {
  // value01 0..1 maps to -135..+135 degrees
  const deg = -135 + value01 * 270;
  const pointer = svg.getElementById(pointerId);
  if (!pointer) return;
  pointer.style.transformOrigin = 'center';
  pointer.style.transformBox = 'fill-box';
  pointer.style.transform = `rotate(${deg}deg)`;
}

function setSelector(svg, name) {
  state.selector = name;

  const map = {
    COM1: -120,
    COM2: -60,
    FM1: -10,
    FM2: 35,
    AUX: 75,
    PA: 120,
  };

  const deg = map[name] ?? -120;
  const pointer = qs(svg, '#selector_pointer');
  pointer.style.transformOrigin = 'center';
  pointer.style.transformBox = 'fill-box';
  pointer.style.transform = `rotate(${deg}deg)`;

  const text = svg.getElementById('selector_text');
  if (text) text.textContent = name;
  updateReadout(svg);
}

function setTxLight(svg) {
  // crude but useful: TX light on if any top audio switch is ON
  const on = !!(state.com1_toggle || state.com2_toggle || state.fm1_toggle || state.fm2_toggle || state.aux_toggle);
  const el = svg.getElementById('tx_light_on');
  if (el) setOpacity(el, on ? 0.9 : 0.15);
}

function setIso(svg) {
  const t = svg.getElementById('iso_emr_text');
  if (t) t.textContent = state.iso_emr;
  const bg = svg.getElementById('iso_emr_toggle_bgDown');
  if (bg) setOpacity(bg, state.iso_emr === 'EMR' ? 0.35 : 0);
  updateReadout(svg);
}

// --- drag handling -----------------------------------------------------------
function makeKnobDraggable(svg, groupId, getValue, setValue, pointerId) {
  const group = qs(svg, '#' + groupId);
  const hot = group.querySelector('.hot') || group;
  let dragging = false;

  const onDown = (e) => {
    e.preventDefault();
    dragging = true;
    hot.setPointerCapture?.(e.pointerId);
  };

  const onMove = (e) => {
    if (!dragging) return;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return;
    const p = pt.matrixTransform(ctm.inverse());

    // compute angle from center of group
    const bbox = group.getBBox();
    const cx = bbox.x + bbox.width / 2;
    const cy = bbox.y + bbox.height / 2;
    const dx = p.x - cx;
    const dy = p.y - cy;
    let ang = Math.atan2(dy, dx) * 180 / Math.PI; // -180..180, 0 = +x
    // convert so 0 is up
    ang = ang + 90;
    // normalize to -180..180
    if (ang > 180) ang -= 360;

    // map -135..+135 to 0..1
    const v = clamp((ang + 135) / 270, 0, 1);
    setValue(v);
    setKnob(svg, pointerId, v);
  };

  const onUp = (e) => {
    dragging = false;
    try { hot.releasePointerCapture?.(e.pointerId); } catch {}
  };

  hot.addEventListener('pointerdown', onDown);
  hot.addEventListener('pointermove', onMove);
  hot.addEventListener('pointerup', onUp);
  hot.addEventListener('pointercancel', onUp);

  // init
  const v0 = getValue();
  setKnob(svg, pointerId, v0);
}

function makeSelectorDraggable(svg) {
  const group = qs(svg, '#selector_knob');
  const hot = group.querySelector('.hot') || group;
  let dragging = false;

  const positions = [
    { name: 'COM1', deg: -120 },
    { name: 'COM2', deg: -60 },
    { name: 'FM1',  deg: -10 },
    { name: 'FM2',  deg: 35 },
    { name: 'AUX',  deg: 75 },
    { name: 'PA',   deg: 120 },
  ];

  const onDown = (e) => { dragging = true; hot.setPointerCapture?.(e.pointerId); };
  const onMove = (e) => {
    if (!dragging) return;

    const pt = svg.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return;
    const p = pt.matrixTransform(ctm.inverse());

    const bbox = group.getBBox();
    const cx = bbox.x + bbox.width / 2;
    const cy = bbox.y + bbox.height / 2;
    const dx = p.x - cx;
    const dy = p.y - cy;

    let ang = Math.atan2(dy, dx) * 180 / Math.PI; // 0 = +x
    ang = ang + 90;
    if (ang > 180) ang -= 360;

    // snap to nearest position by deg distance
    let best = positions[0];
    let bestD = 999;
    for (const pos of positions) {
      const d = Math.abs(ang - pos.deg);
      if (d < bestD) { best = pos; bestD = d; }
    }
    setSelector(svg, best.name);
  };
  const onUp = (e) => { dragging = false; try { hot.releasePointerCapture?.(e.pointerId); } catch {} };

  hot.addEventListener('pointerdown', onDown);
  hot.addEventListener('pointermove', onMove);
  hot.addEventListener('pointerup', onUp);
  hot.addEventListener('pointercancel', onUp);

  // also allow click cycle
  hot.addEventListener('click', () => {
    const idx = positions.findIndex(p => p.name === state.selector);
    const next = positions[(idx + 1) % positions.length];
    setSelector(svg, next.name);
  });

  setSelector(svg, state.selector);
}

// --- wiring ------------------------------------------------------------------
function wireToggle(svg, id) {
  const g = qs(svg, '#' + id);
  g.addEventListener('click', () => {
    state[id] = !state[id];
    toggleLever(svg, id, state[id]);
    setTxLight(svg);
  });
  toggleLever(svg, id, state[id]);
}

function wireSmallToggle(svg, id, key) {
  const g = qs(svg, '#' + id);
  g.addEventListener('click', () => {
    state[key] = !state[key];
    toggleGlowOnly(svg, id, state[key]);
  });
  toggleGlowOnly(svg, id, state[key]);
}

function wireUp(svg) {
  // top row
  wireToggle(svg, 'com1_toggle');
  wireToggle(svg, 'com2_toggle');
  wireToggle(svg, 'fm1_toggle');
  wireToggle(svg, 'fm2_toggle');
  wireToggle(svg, 'aux_toggle');

  // small toggles/buttons
  wireSmallToggle(svg, 'pat_toggle', 'pat_toggle');
  wireSmallToggle(svg, 'key_toggle', 'key_toggle');

  // SO is a pushbutton; treat as toggle for now
  const so = qs(svg, '#so_toggle');
  so.addEventListener('click', () => {
    state.so_toggle = !state.so_toggle;
    so.style.opacity = state.so_toggle ? '1' : '0.6';
  });

  // ISO/EMR cycles
  const iso = qs(svg, '#iso_emr');
  iso.addEventListener('click', () => {
    state.iso_emr = (state.iso_emr === 'ISO') ? 'EMR' : 'ISO';
    setIso(svg);
  });
  setIso(svg);

  // momentary ICS CALL (visual press)
  const call = qs(svg, '#ics_call');
  call.addEventListener('pointerdown', () => call.style.transform = 'scale(0.98)');
  const unpress = () => call.style.transform = '';
  call.addEventListener('pointerup', unpress);
  call.addEventListener('pointercancel', unpress);
  call.addEventListener('pointerleave', unpress);

  // selector
  makeSelectorDraggable(svg);

  // knobs (drag)
  makeKnobDraggable(svg, 'rx_vol_knob', () => state.rx_vol, (v) => state.rx_vol = v, 'rx_vol_pointer');
  makeKnobDraggable(svg, 'ics_vol_knob', () => state.ics_vol, (v) => state.ics_vol = v, 'ics_vol_pointer');
  makeKnobDraggable(svg, 'vox_knob', () => state.vox, (v) => state.vox = v, 'vox_pointer');

  // TX + PLT lights default on/off
  setTxLight(svg);
  const plt = svg.getElementById('plt_light_on');
  if (plt) setOpacity(plt, 0.85);

  updateReadout(svg);
}

loadPanel().catch((err) => {
  console.error(err);
  const el = document.getElementById('panel-container');
  if (el) el.innerHTML = `<pre style="color:#ffb4b4;white-space:pre-wrap;">AA95 panel failed to load\n\n${String(err)}</pre>`;
});

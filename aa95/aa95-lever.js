/*!
 * aa95-lever.js
 * SVG + Spring Physics lever renderer for AA95 Audio Control Panel
 *
 * v3 — Photoreal lever update:
 *   • Perpendicular dome cap (hemisphere shading) — fixes the "flat oval" OFF state.
 *     Cap is a child of the rotor with rotateX(90°), so it composes with the spring
 *     rotation. At OFF the cap faces the viewer; at ON it's nearly edge-on.
 *   • Warmer ivory body palette (shifted toward aged-cream).
 *   • Narrower, brighter specular stripe (peak alpha 0.50, ~10% wide).
 *   • Slimmer proportions (radio width 33→30; standard 26→24).
 *   • Chrome collar on the .nut element (applied via JS — HTML untouched).
 *
 * Behavior unchanged: SPRING constants, ANGLE.on/off, CANT, MutationObserver,
 * registry, prefers-reduced-motion handling.
 *
 *   <script src="/aa95/aa95-lever.js" defer></script>
 */
(function () {
  'use strict';

  // ── Spring constants (unchanged) ──────────────────────────────────────────
  const SPRING = {
    stiffness : 480,
    damping   : 22,
    mass      : 1.0,
    threshold : 0.004
  };

  // ── Toggle angle targets (unchanged) ─────────────────────────────────────
  const ANGLE = { on: -50, off: -80 };

  // ── Fixed presentation cant (unchanged) ───────────────────────────────────
  const CANT = { radio: -10, standard: -8, small: -6 };

  const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const NS = 'http://www.w3.org/2000/svg';

  let _n = 0;
  const uid = () => 'aa95lv' + (++_n);

  // ── Slimmer geometry ──────────────────────────────────────────────────────
  // Was: standard w26, radio w33, small w11.
  // Reference levers are slimmer relative to height — narrowed by ~10%.
  const SIZE_CFG = {
    standard : { w: 24, h: 55, topW: 20, botW: 16, topR: 10, bot: 34, ml: -12 },
    radio    : { w: 30, h: 69, topW: 26, botW: 20, topR: 13, bot: 43, ml: -15 },
    small    : { w: 10, h: 21, topW:  8, botW:  6, topR:  4, bot: 14, ml: -5  }
  };

  // ── Warmer ivory palette + dedicated dome-cap colors ─────────────────────
  const PALETTE = {
    ivory : {
      bodyStops : [
        [0,   '#6a5a48'],
        [18,  '#a89882'],
        [38,  '#e0d0b0'],
        [50,  '#f4e8c8'],   // brightest lit peak
        [62,  '#d4c4a0'],
        [80,  '#a89478'],
        [100, '#6a5a48'],
      ],
      capCenter : '#f6ecd0',
      capMid    : '#d4c4a0',
      capDark   : '#7a6a52',
      capRim    : '#3a3025',
      specColor : '255,245,220',
    },
    red : {
      bodyStops : [
        [0,   '#4a0e0e'],
        [18,  '#8e2424'],
        [38,  '#d44848'],
        [50,  '#ec5e5e'],
        [62,  '#b03838'],
        [80,  '#7a1c1c'],
        [100, '#4a0e0e'],
      ],
      capCenter : '#f48080',
      capMid    : '#c44040',
      capDark   : '#5a1010',
      capRim    : '#280505',
      specColor : '255,210,210',
    },
    orange : {
      bodyStops : [
        [0,   '#4a2410'],
        [18,  '#8e4818'],
        [38,  '#d48038'],
        [50,  '#ee9648'],
        [62,  '#b06828'],
        [80,  '#7a4018'],
        [100, '#4a2410'],
      ],
      capCenter : '#f6a858',
      capMid    : '#c47020',
      capDark   : '#5a2c10',
      capRim    : '#2a1408',
      specColor : '255,228,180',
    }
  };

  // ── SVG element helper ────────────────────────────────────────────────────
  function el(tag, attrs) {
    const e = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    return e;
  }

  // ── Cylinder path — full capsule, rounded top AND bottom ─────────────────
  function cylinderPath(g) {
    const { w, h, topW, topR } = g;
    const cx = w / 2;
    const tl = (w - topW) / 2;
    const tr = tl + topW;

    return [
      `M ${tl},${topR}`,
      `Q ${tl},0 ${cx},0`,
      `Q ${tr},0 ${tr},${topR}`,
      `L ${tr},${h - topR}`,
      `Q ${tr},${h} ${cx},${h}`,
      `Q ${tl},${h} ${tl},${h - topR}`,
      `Z`
    ].join(' ');
  }

  // ── Build body horizontal gradient ────────────────────────────────────────
  function buildBodyGrad(defs, gradId, bodyStops) {
    const grad = el('linearGradient', {
      id: gradId, x1: '0%', y1: '0%', x2: '100%', y2: '0%'
    });
    bodyStops.forEach(([pct, col]) =>
      grad.appendChild(el('stop', { offset: pct + '%', 'stop-color': col }))
    );
    defs.appendChild(grad);
  }

  // ── NEW: Build dome cap (perpendicular disc with hemisphere shading) ─────
  // The cap is a flat circular SVG disc that we rotate 90° about X, making it
  // sit horizontally on top of the cylinder body. Because it's a child of the
  // rotor, the rotor's rotateX composes with the cap's rotateX — so:
  //   • At ON  (rotor=-50°): cap world angle = -50 + 90 =  40° (mostly edge-on)
  //   • At OFF (rotor=-80°): cap world angle = -80 + 90 =  10° (faces viewer)
  // Hemisphere illusion comes from the radial gradient — bright spot upper-left.
  function buildCap(g, p, id) {
    const D     = g.topW;
    const r     = D / 2;
    const cx    = D / 2;
    const cy    = D / 2;

    const gradId = id + 'cd';
    const rimId  = id + 'cr';
    const sc     = p.specColor;

    // Wrapper div — positioned so its CENTER is exactly at the top of the body.
    const cap = document.createElement('div');
    Object.assign(cap.style, {
      position           : 'absolute',
      width              : D + 'px',
      height             : D + 'px',
      left               : ((g.w - D) / 2) + 'px',
      top                : (-D / 2) + 'px',
      transformOrigin    : '50% 50%',
      transform          : 'rotateX(90deg)',
      backfaceVisibility : 'visible',
      pointerEvents      : 'none',
    });

    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', `0 0 ${D} ${D}`);
    svg.setAttribute('width',    D);
    svg.setAttribute('height',   D);
    Object.assign(svg.style, {
      display  : 'block',
      overflow : 'visible'
    });

    const defs = document.createElementNS(NS, 'defs');

    // Hemisphere shading: bright peak upper-left, fading to dark lower-right rim
    const domeGrad = el('radialGradient', {
      id : gradId,
      cx : '32%',
      cy : '28%',
      r  : '78%',
      fx : '26%',
      fy : '20%'
    });
    domeGrad.appendChild(el('stop', { offset: '0%',   'stop-color': `rgba(${sc},0.95)` }));
    domeGrad.appendChild(el('stop', { offset: '12%',  'stop-color': p.capCenter }));
    domeGrad.appendChild(el('stop', { offset: '45%',  'stop-color': p.capMid }));
    domeGrad.appendChild(el('stop', { offset: '88%',  'stop-color': p.capDark }));
    domeGrad.appendChild(el('stop', { offset: '100%', 'stop-color': p.capRim }));
    defs.appendChild(domeGrad);

    // Subtle inner shadow ring (ambient occlusion at the rim)
    const rimGrad = el('radialGradient', {
      id : rimId,
      cx : '50%',
      cy : '50%',
      r  : '50%'
    });
    rimGrad.appendChild(el('stop', { offset: '85%',  'stop-color': 'rgba(0,0,0,0)' }));
    rimGrad.appendChild(el('stop', { offset: '100%', 'stop-color': 'rgba(0,0,0,0.32)' }));
    defs.appendChild(rimGrad);

    svg.appendChild(defs);

    // Main dome face
    svg.appendChild(el('circle', {
      cx: cx, cy: cy, r: r,
      fill: `url(#${gradId})`
    }));

    // Rim shadow overlay (subtle vignette at the perimeter)
    svg.appendChild(el('circle', {
      cx: cx, cy: cy, r: r,
      fill: `url(#${rimId})`
    }));

    // Bright tiny specular hotspot
    svg.appendChild(el('ellipse', {
      cx: D * 0.30,
      cy: D * 0.22,
      rx: D * 0.13,
      ry: D * 0.085,
      fill: 'rgba(255,255,255,0.55)'
    }));

    // Crisp dark outline for definition
    svg.appendChild(el('circle', {
      cx: cx, cy: cy, r: r - 0.4,
      fill: 'none',
      stroke: 'rgba(0,0,0,0.55)',
      'stroke-width': '0.7'
    }));

    cap.appendChild(svg);
    return cap;
  }

  // ── Build one lever assembly ───────────────────────────────────────────────
  function buildSVG(size, colorKey, id) {
    const g       = SIZE_CFG[size];
    const p       = PALETTE[colorKey] || PALETTE.ivory;
    const cantDeg = CANT[size] || CANT.standard;
    const pathD   = cylinderPath(g);

    const clipId      = id + 'cl';
    const bodyId      = id + 'b';
    const hiId        = id + 'h';
    const specId      = id + 's';
    const endCapTopId = id + 'ect';
    const endCapBotId = id + 'ecb';

    // ── Outer cant wrapper ────────────────────────────────────────────────
    const wrapper = document.createElement('div');
    Object.assign(wrapper.style, {
      position       : 'absolute',
      bottom         : g.bot + 'px',
      left           : '50%',
      marginLeft     : g.ml + 'px',
      width          : g.w  + 'px',
      height         : g.h  + 'px',
      transformOrigin: '50% 99%',
      transformStyle : 'preserve-3d',
      transform      : `rotateY(${cantDeg}deg)`,
      zIndex         : '5',
      pointerEvents  : 'none'
    });

    // ── 3D Rotor — receives rotateX from spring ───────────────────────────
    const rotor = document.createElement('div');
    Object.assign(rotor.style, {
      position       : 'absolute',
      top            : '0',
      left           : '0',
      width          : g.w + 'px',
      height         : g.h + 'px',
      transformOrigin: '50% 99%',
      transformStyle : 'preserve-3d',
      willChange     : 'transform',
    });

    // ── Body SVG (single solid plane — cap handles the OFF-state 3D read) ─
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', `0 0 ${g.w} ${g.h}`);
    svg.setAttribute('width',    g.w);
    svg.setAttribute('height',   g.h);
    Object.assign(svg.style, {
      position           : 'absolute',
      top                : '0',
      left               : '0',
      display            : 'block',
      backfaceVisibility : 'hidden',
      overflow           : 'visible'
    });

    const defs = document.createElementNS(NS, 'defs');

    const clipEl = document.createElementNS(NS, 'clipPath');
    clipEl.setAttribute('id', clipId);
    clipEl.appendChild(el('path', { d: pathD }));
    defs.appendChild(clipEl);

    buildBodyGrad(defs, bodyId, p.bodyStops);

    // Radial top highlight (full height, illuminates upper portion of cylinder)
    const hiGrad = el('radialGradient', {
      id            : hiId,
      gradientUnits : 'userSpaceOnUse',
      cx            : g.w * 0.36,
      cy            : (g.h * 0.18).toFixed(1),
      r             : (g.w * 0.70).toFixed(1),
      fx            : g.w * 0.30,
      fy            : (g.h * 0.06).toFixed(1)
    });
    hiGrad.appendChild(el('stop', { offset: '0%',   'stop-color': `rgba(${p.specColor},0.55)` }));
    hiGrad.appendChild(el('stop', { offset: '100%', 'stop-color': `rgba(${p.specColor},0)` }));
    defs.appendChild(hiGrad);

    // ── Narrower, brighter specular stripe ───────────────────────────────
    // base offsets [35, 42, 47, 53, 62] — peak alpha 0.50 (was 0.28 over 30–74)
    const sc = p.specColor;
    const specGrad = el('linearGradient', {
      id: specId, x1: '0%', y1: '0%', x2: '100%', y2: '0%'
    });
    const specDef = [
      { o:   0, c: `rgba(${sc},0)`    },
      { o:  35, c: `rgba(${sc},0)`    },
      { o:  42, c: `rgba(${sc},0.18)` },
      { o:  47, c: `rgba(${sc},0.50)` },
      { o:  53, c: `rgba(${sc},0.18)` },
      { o:  62, c: `rgba(${sc},0)`    },
      { o: 100, c: `rgba(${sc},0)`    }
    ];
    const specStopEls = specDef.map(d => {
      const s = el('stop', { offset: d.o + '%', 'stop-color': d.c });
      specGrad.appendChild(s);
      return s;
    });
    defs.appendChild(specGrad);

    // Top end-cap shading (visible when body is angled; supplements the dome cap)
    const endCapTop = el('radialGradient', {
      id: endCapTopId,
      gradientUnits: 'userSpaceOnUse',
      cx: g.w / 2,
      cy: g.topR,
      r: (g.topW * 0.65).toFixed(1)
    });
    endCapTop.appendChild(el('stop', { offset: '0%',   'stop-color': 'rgba(255,255,255,0.32)' }));
    endCapTop.appendChild(el('stop', { offset: '55%',  'stop-color': 'rgba(255,255,255,0.08)' }));
    endCapTop.appendChild(el('stop', { offset: '100%', 'stop-color': 'rgba(0,0,0,0)' }));
    defs.appendChild(endCapTop);

    // Bottom end-cap shadow
    const endCapBot = el('radialGradient', {
      id: endCapBotId,
      gradientUnits: 'userSpaceOnUse',
      cx: g.w / 2,
      cy: g.h - g.topR,
      r: (g.topW * 0.75).toFixed(1)
    });
    endCapBot.appendChild(el('stop', { offset: '0%',   'stop-color': 'rgba(0,0,0,0.28)' }));
    endCapBot.appendChild(el('stop', { offset: '100%', 'stop-color': 'rgba(0,0,0,0)' }));
    defs.appendChild(endCapBot);

    svg.appendChild(defs);

    const cp = `url(#${clipId})`;
    const cw = g.w;
    const ch = g.h;

    // 1. Horizontal body gradient
    svg.appendChild(el('rect', {
      x: 0, y: 0, width: cw, height: ch,
      fill: `url(#${bodyId})`, 'clip-path': cp
    }));

    // 2. Radial top highlight
    svg.appendChild(el('rect', {
      x: 0, y: 0, width: cw, height: ch,
      fill: `url(#${hiId})`, 'clip-path': cp, opacity: '0.70'
    }));

    // 3. Specular stripe (drifts horizontally with rotateX)
    svg.appendChild(el('rect', {
      x: 0, y: 0, width: cw, height: ch,
      fill: `url(#${specId})`, 'clip-path': cp
    }));

    // 4. Edge rim shadows (cylindrical curvature — deeper on the unlit side)
    const rimWLight = Math.max(2, Math.round(cw * 0.13));
    const rimWDark  = Math.max(2, Math.round(cw * 0.20));
    svg.appendChild(el('rect', {
      x: 0, y: 0, width: rimWLight, height: ch,
      fill: 'rgba(0,0,0,0.14)', 'clip-path': cp
    }));
    svg.appendChild(el('rect', {
      x: cw - rimWDark, y: 0, width: rimWDark, height: ch,
      fill: 'rgba(0,0,0,0.28)', 'clip-path': cp
    }));

    // 5. Top end-cap ellipse (subtle dome hint when body is visible)
    const endRx    = (g.topW / 2).toFixed(2);
    const endCx    = (g.w / 2).toFixed(2);
    const endTopCy = g.topR.toFixed(2);
    const endBotCy = (g.h - g.topR).toFixed(2);

    svg.appendChild(el('ellipse', {
      cx: endCx,
      cy: endTopCy,
      rx: endRx,
      ry: (g.topR * 0.95).toFixed(2),
      fill: `url(#${endCapTopId})`,
      'clip-path': cp,
      opacity: '0.72'
    }));

    // 6. Bottom end-cap shadow
    svg.appendChild(el('ellipse', {
      cx: endCx,
      cy: endBotCy,
      rx: endRx,
      ry: (g.topR * 0.95).toFixed(2),
      fill: `url(#${endCapBotId})`,
      'clip-path': cp,
      opacity: '0.62'
    }));

    // 7. Horizon line at top of body (where dome meets cylinder)
    const hlY = g.topR + 0.8;
    svg.appendChild(el('path', {
      d: `M ${(g.w - g.topW) / 2 + 1},${hlY} Q ${g.w / 2},${hlY - 1} ${(g.w + g.topW) / 2 - 1},${hlY}`,
      fill: 'none',
      stroke: 'rgba(0,0,0,0.30)',
      'stroke-width': '0.6',
      'clip-path': cp
    }));

    // 8. Outer silhouette stroke
    svg.appendChild(el('path', {
      d: pathD,
      fill: 'none',
      stroke: 'rgba(0,0,0,0.35)',
      'stroke-width': '0.75'
    }));

    rotor.appendChild(svg);

    // ── NEW: Dome cap — child of rotor, composes with spring rotation ────
    const cap = buildCap(g, p, id);
    rotor.appendChild(cap);

    wrapper.appendChild(rotor);

    return { wrapper, rotor, specStopEls };
  }

  // ── Spring lever class ────────────────────────────────────────────────────
  class SpringLever {
    constructor(rotorEl, specStopEls, isOn) {
      this.rotor     = rotorEl;
      this.specStops = specStopEls;
      this.pos       = isOn ? ANGLE.on : ANGLE.off;
      this.vel       = 0;
      this.target    = this.pos;
      this.raf       = null;
      this.prevTime  = null;
      this._apply();
    }

    flip(isOn) {
      this.target = isOn ? ANGLE.on : ANGLE.off;
      if (REDUCED) {
        this.pos = this.target;
        this.vel = 0;
        this._apply();
        return;
      }
      if (!this.raf) {
        this.prevTime = performance.now();
        this.raf = requestAnimationFrame(t => this._tick(t));
      }
    }

    _tick(now) {
      const dt = Math.min((now - this.prevTime) / 1000, 0.033);
      this.prevTime = now;

      const err   = this.pos - this.target;
      const force = -(SPRING.stiffness * err) - (SPRING.damping * this.vel);

      this.vel += (force / SPRING.mass) * dt;
      this.pos += this.vel * dt;

      this._apply();

      if (Math.abs(err) < SPRING.threshold && Math.abs(this.vel) < SPRING.threshold) {
        this.pos = this.target;
        this.vel = 0;
        this._apply();
        this.raf = null;
        return;
      }

      this.raf = requestAnimationFrame(t => this._tick(t));
    }

    _apply() {
      this.rotor.style.transform = `rotateX(${this.pos.toFixed(3)}deg)`;
      this._updateSpecular();
    }

    _updateSpecular() {
      const t     = (this.pos - ANGLE.on) / (ANGLE.off - ANGLE.on);
      const shift = (t - 0.5) * 8;
      // Updated base offsets to match new tighter specular stripe
      const base  = [35, 42, 47, 53, 62];

      base.forEach((b, i) => {
        const clamped = Math.max(1, Math.min(99, b + shift));
        this.specStops[i + 1].setAttribute('offset', clamped.toFixed(1) + '%');
      });
    }

    destroy() {
      if (this.raf) {
        cancelAnimationFrame(this.raf);
        this.raf = null;
      }
    }
  }

  // ── Determine size / color from DOM ──────────────────────────────────────
  function getSize(assemblyEl) {
    if (assemblyEl.classList.contains('radio')) return 'radio';
    if (assemblyEl.classList.contains('small')) return 'small';
    return 'standard';
  }

  function getColor(componentEl) {
    if (componentEl.classList.contains('red'))    return 'red';
    if (componentEl.classList.contains('orange')) return 'orange';
    return 'ivory';
  }

  // ── NEW: Apply chrome-collar styling to the .nut element from JS ─────────
  // Keeps all visual changes confined to aa95-lever.js (HTML untouched).
  function styleChromeCollar(nutEl, size) {
    // Wider/taller for radio, scaled down for small
    const dims = {
      radio    : { w: 50, h: 24, br: 6 },
      standard : { w: 42, h: 20, br: 5 },
      small    : { w: 18, h: 10, br: 3 },
    }[size] || { w: 42, h: 20, br: 5 };

    Object.assign(nutEl.style, {
      width        : dims.w + 'px',
      height       : dims.h + 'px',
      borderRadius : dims.br + 'px',
      background   :
        // Inner dark socket where the lever pivots
        'radial-gradient(ellipse 14% 38% at 50% 55%, ' +
          '#020202 0%, #1a1a1a 70%, transparent 100%),' +
        // Chrome collar (silver ring) — elliptical, bright top
        'radial-gradient(ellipse 38% 78% at 50% 42%, ' +
          '#9a9a9a 0%, #6e6e6e 38%, #3e3e3e 78%, transparent 100%),' +
        // Dark backing plate
        'linear-gradient(180deg, #2a2a2a 0%, #1a1a1a 100%)',
      boxShadow    :
        '0 4px 6px rgba(0,0,0,0.78),' +
        'inset 0 1px 0 rgba(255,255,255,0.10),' +
        'inset 0 -2px 3px rgba(0,0,0,0.60)'
    });

    // Override the empty ::before that the original CSS hides
    // (no-op — CSS already has opacity:0 on .nut::before)
  }

  // ── Build all levers and register spring instances ────────────────────────
  function init() {
    const registry = {};
    document.querySelectorAll('.assembly-toggle').forEach(assembly => {
      const component = assembly.closest('.component.toggle');
      if (!component) return;

      const id    = uid();
      const size  = getSize(assembly);
      const color = getColor(component);
      const isOn  = component.getAttribute('data-active') === 'true';

      // Polish the chrome collar
      const nut = assembly.querySelector('.nut');
      if (nut) styleChromeCollar(nut, size);

      assembly.querySelector('.lever')?.remove();

      const { wrapper, rotor, specStopEls } = buildSVG(size, color, id);
      assembly.appendChild(wrapper);

      const spring = new SpringLever(rotor, specStopEls, isOn);
      if (component.id) registry[component.id] = spring;
    });
    return registry;
  }

  // ── Watch data-active mutations ───────────────────────────────────────────
  function watch(registry) {
    const obs = new MutationObserver(mutations => {
      for (const m of mutations) {
        if (m.attributeName !== 'data-active') continue;
        const sp = registry[m.target.id];
        if (sp) sp.flip(m.target.getAttribute('data-active') === 'true');
      }
    });

    document.querySelectorAll('.component.toggle[id]').forEach(el => {
      obs.observe(el, { attributes: true });
    });
  }

  // ── Boot ──────────────────────────────────────────────────────────────────
  function boot() {
    const registry = init();
    watch(registry);
    window.AA95Levers = registry;

    console.log(
      `[AA95] v3 levers ready — ${Object.keys(registry).length} instances`,
      '| rotateX: ON', ANGLE.on + '° OFF', ANGLE.off + '°',
      '| dome cap: rotateX(90°) child of rotor',
      '| reduced-motion:', REDUCED
    );
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

})();

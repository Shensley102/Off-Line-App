/*!
 * aa95-lever.js
 * SVG + Spring Physics lever renderer for AA95 Audio Control Panel
 *
 * SOLID CYLINDER FIX:
 * Previously the lever was built from THREE parallel SVG planes — a back face,
 * a mid shell, and a front face — at staggered Z depths to suggest 3D thickness.
 * Parallel flat planes cannot form a continuous cylinder side wall, so the
 * lever read as three stacked discs at high tilt angles (especially near OFF
 * at -80°). Two rectangular overlays compounded the banding:
 *   1. A cap gradient rect clipped to top 40% — hard seam at the 40% line.
 *   2. A bottom occlusion rect covering the bottom 14% — second hard seam.
 *
 * Fix:
 *   - Removed the back face and mid shell — only one SVG plane is rendered.
 *   - Removed the partial-height cap gradient rect (the radial highlight
 *     already produces a lit-top effect with no hard edges).
 *   - Removed the bottom occlusion rect (rim shadows + body gradient handle
 *     cylindrical curvature without it).
 *
 * What remains: a single cylindrical silhouette shaded entirely by smooth
 * full-height gradients (horizontal body shading + radial top highlight +
 * specular band + edge rim shadows + radial end-cap ellipses).
 *
 * Motion, angles, pivot, sizing, and placement are unchanged.
 *
 * Dependencies: none.
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

  // ── Per-size geometry (unchanged) ─────────────────────────────────────────
  const SIZE_CFG = {
    standard : { w: 26, h: 55, topW: 22, botW: 18, topR: 11, bot: 34, ml: -13   },
    radio    : { w: 33, h: 69, topW: 28, botW: 22, topR: 14, bot: 43, ml: -16.5 },
    small    : { w: 11, h: 21, topW:  9, botW:  7, topR:  4, bot: 14, ml: -5.5  }
  };

  // ── Color palettes (capGrad entries retained but unused after fix) ───────
  const PALETTE = {
    ivory : {
      bodyStops : [
        [0,   '#8c7d6e'],
        [18,  '#c0b09e'],
        [42,  '#e8dece'],
        [56,  '#d4c8b4'],
        [78,  '#b8a892'],
        [100, '#8c7d6e'],
      ],
      capGrad   : ['#f5efe3', '#ddd3c0'],
      specColor : '255,248,230',
    },
    red : {
      bodyStops : [
        [0,   '#5a1212'],
        [18,  '#982828'],
        [42,  '#d44848'],
        [56,  '#b43838'],
        [78,  '#882020'],
        [100, '#5a1212'],
      ],
      capGrad   : ['#e86262', '#c03838'],
      specColor : '255,210,210',
    },
    orange : {
      bodyStops : [
        [0,   '#5a2d10'],
        [18,  '#985018'],
        [42,  '#d48038'],
        [56,  '#b86828'],
        [78,  '#8a4818'],
        [100, '#5a2d10'],
      ],
      capGrad   : ['#e88840', '#c26020'],
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

  // ── Build body gradient into SVG defs ─────────────────────────────────────
  function buildBodyGrad(defs, gradId, bodyStops) {
    const grad = el('linearGradient', {
      id: gradId, x1: '0%', y1: '0%', x2: '100%', y2: '0%'
    });
    bodyStops.forEach(([pct, col]) =>
      grad.appendChild(el('stop', { offset: pct + '%', 'stop-color': col }))
    );
    defs.appendChild(grad);
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

    // ── Single solid SVG face — no parallel depth planes ─────────────────
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

    // ── Clip path that defines the silhouette ────────────────────────────
    const clipEl = document.createElementNS(NS, 'clipPath');
    clipEl.setAttribute('id', clipId);
    clipEl.appendChild(el('path', { d: pathD }));
    defs.appendChild(clipEl);

    // ── Horizontal body gradient (cylinder side shading) ─────────────────
    buildBodyGrad(defs, bodyId, p.bodyStops);

    // ── Radial top highlight (the "lit dome" effect) ─────────────────────
    const hiGrad = el('radialGradient', {
      id            : hiId,
      gradientUnits : 'userSpaceOnUse',
      cx            : g.w / 2,
      cy            : (g.h * 0.22).toFixed(1),
      r             : (g.w * 0.62).toFixed(1),
      fx            : g.w / 2,
      fy            : (g.h * 0.08).toFixed(1)
    });
    hiGrad.appendChild(el('stop', { offset: '0%',   'stop-color': `rgba(${p.specColor},0.50)` }));
    hiGrad.appendChild(el('stop', { offset: '100%', 'stop-color': `rgba(${p.specColor},0)` }));
    defs.appendChild(hiGrad);

    // ── Specular band (drifts horizontally with rotation) ─────────────────
    const sc = p.specColor;
    const specGrad = el('linearGradient', {
      id: specId, x1: '0%', y1: '0%', x2: '100%', y2: '0%'
    });
    const specDef = [
      { o:  0,  c: `rgba(${sc},0)`    },
      { o: 30,  c: `rgba(${sc},0)`    },
      { o: 44,  c: `rgba(${sc},0.12)` },
      { o: 52,  c: `rgba(${sc},0.28)` },
      { o: 60,  c: `rgba(${sc},0.10)` },
      { o: 74,  c: `rgba(${sc},0)`    },
      { o: 100, c: `rgba(${sc},0)`    }
    ];
    const specStopEls = specDef.map(d => {
      const s = el('stop', { offset: d.o + '%', 'stop-color': d.c });
      specGrad.appendChild(s);
      return s;
    });
    defs.appendChild(specGrad);

    // ── Top end cap (lit) ────────────────────────────────────────────────
    const endCapTop = el('radialGradient', {
      id: endCapTopId,
      gradientUnits: 'userSpaceOnUse',
      cx: g.w / 2,
      cy: g.topR,
      r: (g.topW * 0.65).toFixed(1)
    });
    endCapTop.appendChild(el('stop', { offset: '0%',   'stop-color': 'rgba(255,255,255,0.36)' }));
    endCapTop.appendChild(el('stop', { offset: '55%',  'stop-color': 'rgba(255,255,255,0.10)' }));
    endCapTop.appendChild(el('stop', { offset: '100%', 'stop-color': 'rgba(0,0,0,0)' }));
    defs.appendChild(endCapTop);

    // ── Bottom end cap (shadowed) ────────────────────────────────────────
    const endCapBot = el('radialGradient', {
      id: endCapBotId,
      gradientUnits: 'userSpaceOnUse',
      cx: g.w / 2,
      cy: g.h - g.topR,
      r: (g.topW * 0.75).toFixed(1)
    });
    endCapBot.appendChild(el('stop', { offset: '0%',   'stop-color': 'rgba(0,0,0,0.22)' }));
    endCapBot.appendChild(el('stop', { offset: '100%', 'stop-color': 'rgba(0,0,0,0)' }));
    defs.appendChild(endCapBot);

    svg.appendChild(defs);

    const cp = `url(#${clipId})`;
    const cw = g.w;
    const ch = g.h;

    // ── 1. Horizontal body gradient (full height) ────────────────────────
    svg.appendChild(el('rect', {
      x: 0, y: 0, width: cw, height: ch,
      fill: `url(#${bodyId})`, 'clip-path': cp
    }));

    // ── 2. Radial top highlight (full height) ────────────────────────────
    svg.appendChild(el('rect', {
      x: 0, y: 0, width: cw, height: ch,
      fill: `url(#${hiId})`, 'clip-path': cp, opacity: '0.62'
    }));

    // ── 3. Specular band (full height — drifts with rotateX) ─────────────
    svg.appendChild(el('rect', {
      x: 0, y: 0, width: cw, height: ch,
      fill: `url(#${specId})`, 'clip-path': cp
    }));

    // ── 4. Edge rim shadows for cylindrical curvature ────────────────────
    const rimW = Math.max(2, Math.round(cw * 0.16));
    svg.appendChild(el('rect', {
      x: 0, y: 0, width: rimW, height: ch,
      fill: 'rgba(0,0,0,0.18)', 'clip-path': cp
    }));
    svg.appendChild(el('rect', {
      x: cw - rimW, y: 0, width: rimW, height: ch,
      fill: 'rgba(0,0,0,0.18)', 'clip-path': cp
    }));

    // ── 5. Center light strip (subtle reflective sheen) ──────────────────
    const centerW = Math.max(2, Math.round(cw * 0.18));
    svg.appendChild(el('rect', {
      x: ((cw - centerW) / 2).toFixed(2),
      y: 0,
      width: centerW,
      height: ch,
      fill: 'rgba(255,255,255,0.08)',
      'clip-path': cp
    }));

    // ── 6. End cap ellipses ──────────────────────────────────────────────
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
      opacity: '0.76'
    }));

    svg.appendChild(el('ellipse', {
      cx: endCx,
      cy: endBotCy,
      rx: endRx,
      ry: (g.topR * 0.95).toFixed(2),
      fill: `url(#${endCapBotId})`,
      'clip-path': cp,
      opacity: '0.62'
    }));

    // ── 7. Outer silhouette stroke ───────────────────────────────────────
    svg.appendChild(el('path', {
      d: pathD,
      fill: 'none',
      stroke: 'rgba(0,0,0,0.30)',
      'stroke-width': '0.75'
    }));

    rotor.appendChild(svg);
    wrapper.appendChild(rotor);

    return { wrapper, rotor, specStopEls };
  }

  // ── Spring lever class (unchanged) ────────────────────────────────────────
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
      const base  = [30, 44, 52, 60, 74];

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
      `[AA95] Spring levers ready — ${Object.keys(registry).length} instances`,
      '| rotateX: ON', ANGLE.on + '° OFF', ANGLE.off + '°',
      '| throw:', Math.abs(ANGLE.off - ANGLE.on) + '°',
      '| solid single-face cylinder (no stacked-disc artifacts)',
      '| reduced-motion:', REDUCED
    );
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

})();

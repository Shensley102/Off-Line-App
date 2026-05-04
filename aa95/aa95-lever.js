/*!
 * aa95-lever.js
 * SVG + Spring Physics lever renderer for AA95 Audio Control Panel
 *
 * What this does:
 *   - Replaces every .lever CSS div with a hand-built SVG bat-handle lever
 *   - Drives rotation with a real spring physics loop (requestAnimationFrame)
 *   - Shifts the specular highlight band as the lever angle changes
 *   - Watches data-active attribute mutations → no changes to existing JS needed
 *
 * Dependencies: none. Drop next to aa95.html and add:
 *   <script src="/aa95/aa95-lever.js" defer></script>
 */
(function () {
  'use strict';

  // ── Spring constants ──────────────────────────────────────────────────────
  const SPRING = {
    stiffness : 480,
    damping   : 22,
    mass      : 1.0,
    threshold : 0.004
  };

  // ── Toggle angle targets ──────────────────────────────────────────────────
  const ANGLE = {
    on  : -50,
    off : -80
  };

  // ── Fixed presentation cant ───────────────────────────────────────────────
  const CANT = {
    radio    : -10,
    standard :  -8,
    small    :  -6
  };

  // ── Reduced-motion preference ─────────────────────────────────────────────
  const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ── SVG namespace ─────────────────────────────────────────────────────────
  const NS = 'http://www.w3.org/2000/svg';

  // ── Unique gradient/clip ID factory ──────────────────────────────────────
  let _n = 0;
  const uid = () => 'aa95lv' + (++_n);

  // ── Per-size geometry ─────────────────────────────────────────────────────
  // topW is used as the cylinder diameter — straight sides, no taper.
  const SIZE_CFG = {
    standard : { w: 26, h: 55, topW: 22, botW: 18, topR: 11, bot: 34, ml: -13   },
    radio    : { w: 33, h: 69, topW: 28, botW: 22, topR: 14, bot: 43, ml: -16.5 },
    small    : { w: 11, h: 21, topW:  9, botW:  7, topR:  4, bot: 14, ml: -5.5  }
  };

  // ── Color palettes ────────────────────────────────────────────────────────
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
      capGrad  : ['#f5efe3', '#ddd3c0'],
      specColor: '255,248,230',
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
      capGrad  : ['#e86262', '#c03838'],
      specColor: '255,210,210',
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
      capGrad  : ['#e88840', '#c26020'],
      specColor: '255,228,180',
    }
  };

  // ── SVG element helper ────────────────────────────────────────────────────
  function el(tag, attrs) {
    const e = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    return e;
  }

  // ── ORIGINAL bat-handle path (kept for reference — not used) ──────────────
  // To restore: replace cylinderPath(g) with batPath(g) in buildSVG()
  /*
  function batPath(g) {
    const { w, h, topW, botW, topR } = g;
    const cx = w / 2;
    const tl = (w - topW) / 2;
    const tr = tl + topW;
    const bl = (w - botW) / 2;
    const br = bl + botW;
    const ts = (h * 0.48).toFixed(2);
    const te = (h * 0.62).toFixed(2);
    return [
      `M ${tl},${topR}`,
      `Q ${tl},0 ${cx},0`,
      `Q ${tr},0 ${tr},${topR}`,
      `C ${tr},${ts} ${br},${te} ${br},${h}`,
      `L ${bl},${h}`,
      `C ${bl},${te} ${tl},${ts} ${tl},${topR}`,
      `Z`
    ].join(' ');
  }
  */

  // ── Cylinder path ─────────────────────────────────────────────────────────
  // Straight vertical sides using topW as the consistent diameter.
  // Rounded dome crown (same topR as before).
  // Flat base flush at y = h.
  // To revert to bat-handle: replace cylinderPath(g) with batPath(g) in buildSVG()
  // and uncomment batPath() above.
  function cylinderPath(g) {
    const { w, h, topW, topR } = g;
    const cx = w / 2;
    const tl = (w - topW) / 2;   // left edge — constant all the way down
    const tr = tl + topW;         // right edge — constant all the way down

    return [
      `M ${tl},${topR}`,
      `Q ${tl},0 ${cx},0`,         // left half of dome arc
      `Q ${tr},0 ${tr},${topR}`,   // right half of dome arc
      `L ${tr},${h}`,              // right side — perfectly straight
      `L ${tl},${h}`,              // flat base
      `L ${tl},${topR}`,           // left side — perfectly straight
      `Z`
    ].join(' ');
  }

  // ── Build one SVG lever + its cant wrapper ────────────────────────────────
  function buildSVG(size, colorKey, id) {
    const g       = SIZE_CFG[size];
    const p       = PALETTE[colorKey] || PALETTE.ivory;
    const cantDeg = CANT[size] || CANT.standard;
    const pathD   = cylinderPath(g);   // ← swap to batPath(g) to revert

    const clipId = id + 'cl';
    const bodyId = id + 'b';
    const capId  = id + 'c';
    const hiId   = id + 'h';
    const specId = id + 's';

    // ── Outer cant wrapper ────────────────────────────────────────────────────
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

    // ── Inner SVG ─────────────────────────────────────────────────────────────
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', `0 0 ${g.w} ${g.h}`);
    svg.setAttribute('width',    g.w);
    svg.setAttribute('height',   g.h);
    Object.assign(svg.style, {
      display            : 'block',
      transformOrigin    : '50% 99%',
      transformStyle     : 'preserve-3d',
      willChange         : 'transform',
      backfaceVisibility : 'hidden',
      overflow           : 'visible'
    });

    const defs = document.createElementNS(NS, 'defs');

    // ── ClipPath: cylinder silhouette ─────────────────────────────────────────
    const clipEl = document.createElementNS(NS, 'clipPath');
    clipEl.setAttribute('id', clipId);
    clipEl.appendChild(el('path', { d: pathD }));
    defs.appendChild(clipEl);

    // ── Body gradient: left→right cylindrical shading ─────────────────────────
    const bodyGrad = el('linearGradient', {
      id: bodyId, x1: '0%', y1: '0%', x2: '100%', y2: '0%'
    });
    p.bodyStops.forEach(([pct, col]) =>
      bodyGrad.appendChild(el('stop', { offset: pct + '%', 'stop-color': col }))
    );
    defs.appendChild(bodyGrad);

    // ── Cap gradient: dome tip brightening ────────────────────────────────────
    const capGrad = el('linearGradient', {
      id: capId, x1: '0%', y1: '0%', x2: '0%', y2: '100%'
    });
    capGrad.appendChild(el('stop', { offset:   '0%', 'stop-color': p.capGrad[0] }));
    capGrad.appendChild(el('stop', { offset: '100%', 'stop-color': p.capGrad[1] }));
    defs.appendChild(capGrad);

    // ── Plastic radial highlight ──────────────────────────────────────────────
    const hiGrad = el('radialGradient', {
      id            : hiId,
      gradientUnits : 'userSpaceOnUse',
      cx            : g.w / 2,
      cy            : (g.h * 0.22).toFixed(1),
      r             : (g.w * 0.62).toFixed(1),
      fx            : g.w / 2,
      fy            : (g.h * 0.08).toFixed(1)
    });
    hiGrad.appendChild(el('stop', { offset:   '0%', 'stop-color': `rgba(${p.specColor},0.50)` }));
    hiGrad.appendChild(el('stop', { offset: '100%', 'stop-color': `rgba(${p.specColor},0)`    }));
    defs.appendChild(hiGrad);

    // ── Specular band: movable angle-responsive highlight ─────────────────────
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

    svg.appendChild(defs);

    const cp = `url(#${clipId})`;
    const cw = g.w;
    const ch = g.h;

    // ── Layer 1: Base body (cylindrical gradient) ──────────────────────────────
    svg.appendChild(el('rect', {
      x: 0, y: 0, width: cw, height: ch,
      fill: `url(#${bodyId})`,
      'clip-path': cp
    }));

    // ── Layer 2: Dome cap brightening ─────────────────────────────────────────
    svg.appendChild(el('rect', {
      x: 0, y: 0, width: cw, height: (ch * 0.38).toFixed(1),
      fill: `url(#${capId})`,
      'clip-path': cp,
      opacity: '0.75'
    }));

    // ── Layer 3: Plastic radial highlight ─────────────────────────────────────
    svg.appendChild(el('rect', {
      x: 0, y: 0, width: cw, height: ch,
      fill: `url(#${hiId})`,
      'clip-path': cp,
      opacity: '0.60'
    }));

    // ── Layer 4: Movable specular band ────────────────────────────────────────
    svg.appendChild(el('rect', {
      x: 0, y: 0, width: cw, height: ch,
      fill: `url(#${specId})`,
      'clip-path': cp
    }));

    // ── Layer 5: Left rim shadow ───────────────────────────────────────────────
    const rimW = Math.max(2, Math.round(cw * 0.16));
    svg.appendChild(el('rect', {
      x: 0, y: 0, width: rimW, height: ch,
      fill: 'rgba(0,0,0,0.20)',
      'clip-path': cp
    }));

    // ── Layer 6: Right rim shadow ──────────────────────────────────────────────
    svg.appendChild(el('rect', {
      x: cw - rimW, y: 0, width: rimW, height: ch,
      fill: 'rgba(0,0,0,0.13)',
      'clip-path': cp
    }));

    // ── Layer 7: Base occlusion ───────────────────────────────────────────────
    const occH = Math.max(4, Math.round(ch * 0.15));
    svg.appendChild(el('rect', {
      x: 1, y: ch - occH, width: cw - 2, height: occH,
      rx: 2, ry: 2,
      fill: 'rgba(0,0,0,0.38)',
      'clip-path': cp
    }));

    // ── Layer 8: Silhouette outline ───────────────────────────────────────────
    svg.appendChild(el('path', {
      d: pathD,
      fill: 'none',
      stroke: 'rgba(0,0,0,0.30)',
      'stroke-width': '0.75'
    }));

    wrapper.appendChild(svg);
    return { wrapper, svg, specStopEls };
  }

  // ── Spring lever class ────────────────────────────────────────────────────
  class SpringLever {
    constructor(svgEl, specStopEls, isOn) {
      this.el        = svgEl;
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
      this.vel   += (force / SPRING.mass) * dt;
      this.pos   += this.vel * dt;

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
      this.el.style.transform = `rotateX(${this.pos.toFixed(3)}deg)`;
      this._updateSpecular();
    }

    _updateSpecular() {
      const t = (this.pos - ANGLE.on) / (ANGLE.off - ANGLE.on);
      const shift = (t - 0.5) * 8;
      const base  = [30, 44, 52, 60, 74];
      const stops = this.specStops;
      base.forEach((b, i) => {
        const clamped = Math.max(1, Math.min(99, b + shift));
        stops[i + 1].setAttribute('offset', clamped.toFixed(1) + '%');
      });
    }

    destroy() {
      if (this.raf) { cancelAnimationFrame(this.raf); this.raf = null; }
    }
  }

  // ── Determine size / color from DOM context ───────────────────────────────
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

      const { wrapper, svg, specStopEls } = buildSVG(size, color, id);
      assembly.appendChild(wrapper);

      const spring = new SpringLever(svg, specStopEls, isOn);
      if (component.id) registry[component.id] = spring;
    });

    return registry;
  }

  // ── Watch data-active mutations, relay to springs ─────────────────────────
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
      '| cant: radio', CANT.radio + '° standard', CANT.standard + '° small', CANT.small + '°',
      '| reduced-motion:', REDUCED
    );
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

})();

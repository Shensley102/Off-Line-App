/*!
 * aa95-lever.js
 * SVG + Spring Physics lever renderer for AA95 Audio Control Panel
 *
 * v11 — single-piece cylindrical bat-handle lever.
 *   Keeps the existing movement, spring physics, ON/OFF angles, pivot,
 *   positioning, sizing, and click behavior unchanged.
 *
 *   Visual change:
 *   - No translated duplicate depth faces.
 *   - One SVG handle body only.
 *   - Stronger barrel shading from base to tip.
 *   - Oval rounded tip cap.
 *   - Soft socket/base shadow where handle enters the nut.
 *
 * Dependencies: none.
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

  // ── Toggle angle targets — unchanged ─────────────────────────────────────
  const ANGLE = { on: -50, off: -80 };

  // ── Fixed presentation cant — unchanged ──────────────────────────────────
  const CANT = { radio: -10, standard: -8, small: -6 };

  const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const NS = 'http://www.w3.org/2000/svg';

  let _n = 0;
  const uid = () => 'aa95lv' + (++_n);

  // ── Per-size geometry — unchanged positioning/sizing ─────────────────────
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
        [16,  '#b5a691'],
        [34,  '#ded3bf'],
        [48,  '#f0eadc'],
        [58,  '#d8cdb9'],
        [76,  '#ad9d87'],
        [100, '#7d6f61'],
      ],
      capGrad   : ['#fff7e7', '#d8cdb9'],
      specColor : '255,248,230',
    },
    red : {
      bodyStops : [
        [0,   '#4c1010'],
        [16,  '#842323'],
        [34,  '#bc3d3d'],
        [48,  '#e05b5b'],
        [58,  '#bd3b3b'],
        [76,  '#842020'],
        [100, '#4c1010'],
      ],
      capGrad   : ['#ff8585', '#b63434'],
      specColor : '255,210,210',
    },
    orange : {
      bodyStops : [
        [0,   '#4e250d'],
        [16,  '#814314'],
        [34,  '#b56625'],
        [48,  '#e18a3d'],
        [58,  '#bd6a28'],
        [76,  '#7c3f14'],
        [100, '#4e250d'],
      ],
      capGrad   : ['#f0a254', '#b75a1e'],
      specColor : '255,228,180',
    }
  };

  // ── SVG element helper ────────────────────────────────────────────────────
  function el(tag, attrs) {
    const e = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    return e;
  }

  // ── Lever body path ───────────────────────────────────────────────────────
  // One continuous handle shape. The bottom is rounded but later softened by
  // the socket shadow, so the handle appears to enter the black nut/collar.
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

  // ── Original bat-handle path preserved for rollback/testing ───────────────
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

  // ── Gradient helpers ──────────────────────────────────────────────────────
  function buildBodyGrad(defs, gradId, bodyStops) {
    const grad = el('linearGradient', {
      id: gradId,
      x1: '0%',
      y1: '0%',
      x2: '100%',
      y2: '0%'
    });

    bodyStops.forEach(([pct, col]) => {
      grad.appendChild(el('stop', {
        offset: pct + '%',
        'stop-color': col
      }));
    });

    defs.appendChild(grad);
  }

  function buildBarrelShade(defs, gradId) {
    const grad = el('linearGradient', {
      id: gradId,
      x1: '0%',
      y1: '0%',
      x2: '100%',
      y2: '0%'
    });

    [
      [0,   'rgba(0,0,0,0.34)'],
      [7,   'rgba(0,0,0,0.25)'],
      [18,  'rgba(0,0,0,0.12)'],
      [31,  'rgba(0,0,0,0.02)'],
      [43,  'rgba(255,255,255,0.06)'],
      [50,  'rgba(255,255,255,0.18)'],
      [56,  'rgba(255,255,255,0.10)'],
      [68,  'rgba(0,0,0,0.03)'],
      [82,  'rgba(0,0,0,0.14)'],
      [93,  'rgba(0,0,0,0.26)'],
      [100, 'rgba(0,0,0,0.34)']
    ].forEach(([pct, col]) => {
      grad.appendChild(el('stop', {
        offset: pct + '%',
        'stop-color': col
      }));
    });

    defs.appendChild(grad);
  }

  // ── Build one lever assembly ──────────────────────────────────────────────
  function buildSVG(size, colorKey, id) {
    const g       = SIZE_CFG[size];
    const p       = PALETTE[colorKey] || PALETTE.ivory;
    const cantDeg = CANT[size] || CANT.standard;
    const pathD   = cylinderPath(g);

    const clipId       = id + 'cl';
    const bodyId       = id + 'b';
    const capId        = id + 'c';
    const broadHiId    = id + 'h';
    const barrelId     = id + 'barrel';
    const specId       = id + 's';
    const tipFaceId    = id + 'tip';
    const tipRimId     = id + 'tiprim';
    const socketId     = id + 'socket';
    const socketBlurId = id + 'socketblur';

    // ── Outer cant wrapper — unchanged ────────────────────────────────────
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

    // ── Rotor receives rotateX from spring physics — unchanged ────────────
    const rotor = document.createElement('div');
    Object.assign(rotor.style, {
      position       : 'absolute',
      top            : '0',
      left           : '0',
      width          : g.w + 'px',
      height         : g.h + 'px',
      transformOrigin: '50% 99%',
      transformStyle : 'preserve-3d',
      willChange     : 'transform'
    });

    // ── Single visible handle SVG ─────────────────────────────────────────
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
      transform          : 'translateZ(0px)',
      overflow           : 'visible'
    });

    const defs = document.createElementNS(NS, 'defs');

    // Clip to one continuous handle silhouette.
    const clipEl = document.createElementNS(NS, 'clipPath');
    clipEl.setAttribute('id', clipId);
    clipEl.appendChild(el('path', { d: pathD }));
    defs.appendChild(clipEl);

    // Main ivory/red/orange body gradient.
    buildBodyGrad(defs, bodyId, p.bodyStops);

    // Upper plastic glow.
    const capGrad = el('linearGradient', {
      id: capId,
      x1: '0%',
      y1: '0%',
      x2: '0%',
      y2: '100%'
    });
    capGrad.appendChild(el('stop', {
      offset: '0%',
      'stop-color': p.capGrad[0]
    }));
    capGrad.appendChild(el('stop', {
      offset: '100%',
      'stop-color': p.capGrad[1]
    }));
    defs.appendChild(capGrad);

    // Broad highlight that makes plastic look less flat.
    const broadHi = el('radialGradient', {
      id            : broadHiId,
      gradientUnits : 'userSpaceOnUse',
      cx            : (g.w * 0.44).toFixed(1),
      cy            : (g.h * 0.25).toFixed(1),
      r             : (g.w * 0.78).toFixed(1),
      fx            : (g.w * 0.42).toFixed(1),
      fy            : (g.h * 0.08).toFixed(1)
    });
    broadHi.appendChild(el('stop', {
      offset: '0%',
      'stop-color': `rgba(${p.specColor},0.42)`
    }));
    broadHi.appendChild(el('stop', {
      offset: '62%',
      'stop-color': `rgba(${p.specColor},0.10)`
    }));
    broadHi.appendChild(el('stop', {
      offset: '100%',
      'stop-color': `rgba(${p.specColor},0)`
    }));
    defs.appendChild(broadHi);

    // Strong side-to-side cylinder shading.
    buildBarrelShade(defs, barrelId);

    // Moving narrow specular band.
    const sc = p.specColor;
    const specGrad = el('linearGradient', {
      id: specId,
      x1: '0%',
      y1: '0%',
      x2: '100%',
      y2: '0%'
    });

    const specDef = [
      { o:  0,  c: `rgba(${sc},0)`    },
      { o: 36,  c: `rgba(${sc},0)`    },
      { o: 46,  c: `rgba(${sc},0.10)` },
      { o: 51,  c: `rgba(${sc},0.34)` },
      { o: 56,  c: `rgba(${sc},0.12)` },
      { o: 66,  c: `rgba(${sc},0)`    },
      { o: 100, c: `rgba(${sc},0)`    }
    ];

    const specStopEls = specDef.map(d => {
      const s = el('stop', {
        offset: d.o + '%',
        'stop-color': d.c
      });
      specGrad.appendChild(s);
      return s;
    });
    defs.appendChild(specGrad);

    // Tip face radial gradient — this creates the real oval cap cue.
    const tipFaceGrad = el('radialGradient', {
      id: tipFaceId,
      gradientUnits: 'userSpaceOnUse',
      cx: (g.w * 0.43).toFixed(1),
      cy: (g.topR * 0.72).toFixed(1),
      r:  (g.topW * 0.62).toFixed(1),
      fx: (g.w * 0.36).toFixed(1),
      fy: (g.topR * 0.44).toFixed(1)
    });
    tipFaceGrad.appendChild(el('stop', {
      offset: '0%',
      'stop-color': `rgba(${p.specColor},0.58)`
    }));
    tipFaceGrad.appendChild(el('stop', {
      offset: '42%',
      'stop-color': `rgba(${p.specColor},0.22)`
    }));
    tipFaceGrad.appendChild(el('stop', {
      offset: '78%',
      'stop-color': 'rgba(0,0,0,0.08)'
    }));
    tipFaceGrad.appendChild(el('stop', {
      offset: '100%',
      'stop-color': 'rgba(0,0,0,0.20)'
    }));
    defs.appendChild(tipFaceGrad);

    // Tip rim gradient — darker lower edge, lighter upper edge.
    const tipRimGrad = el('linearGradient', {
      id: tipRimId,
      x1: '0%',
      y1: '0%',
      x2: '0%',
      y2: '100%'
    });
    tipRimGrad.appendChild(el('stop', {
      offset: '0%',
      'stop-color': 'rgba(255,255,255,0.28)'
    }));
    tipRimGrad.appendChild(el('stop', {
      offset: '54%',
      'stop-color': 'rgba(0,0,0,0.06)'
    }));
    tipRimGrad.appendChild(el('stop', {
      offset: '100%',
      'stop-color': 'rgba(0,0,0,0.30)'
    }));
    defs.appendChild(tipRimGrad);

    // Socket/base shadow gradient — soft shadow where handle enters nut.
    const socketGrad = el('radialGradient', {
      id: socketId,
      gradientUnits: 'userSpaceOnUse',
      cx: g.w / 2,
      cy: (g.h - g.topR * 0.32).toFixed(1),
      r:  (g.topW * 0.62).toFixed(1)
    });
    socketGrad.appendChild(el('stop', {
      offset: '0%',
      'stop-color': 'rgba(0,0,0,0.34)'
    }));
    socketGrad.appendChild(el('stop', {
      offset: '58%',
      'stop-color': 'rgba(0,0,0,0.18)'
    }));
    socketGrad.appendChild(el('stop', {
      offset: '100%',
      'stop-color': 'rgba(0,0,0,0)'
    }));
    defs.appendChild(socketGrad);

    // Optional blur for socket shadow.
    const socketFilter = el('filter', {
      id: socketBlurId,
      x: '-20%',
      y: '-20%',
      width: '140%',
      height: '140%'
    });
    socketFilter.appendChild(el('feGaussianBlur', {
      stdDeviation: size === 'small' ? '0.35' : '0.7'
    }));
    defs.appendChild(socketFilter);

    svg.appendChild(defs);

    const cp = `url(#${clipId})`;
    const cw = g.w;
    const ch = g.h;

    // ── Paint stack: still one SVG body, no separated translated faces ─────

    // 1. Main continuous plastic body.
    svg.appendChild(el('rect', {
      x: 0,
      y: 0,
      width: cw,
      height: ch,
      fill: `url(#${bodyId})`,
      'clip-path': cp
    }));

    // 2. Upper glow.
    svg.appendChild(el('rect', {
      x: 0,
      y: 0,
      width: cw,
      height: (ch * 0.38).toFixed(1),
      fill: `url(#${capId})`,
      'clip-path': cp,
      opacity: '0.58'
    }));

    // 3. Broad plastic highlight.
    svg.appendChild(el('rect', {
      x: 0,
      y: 0,
      width: cw,
      height: ch,
      fill: `url(#${broadHiId})`,
      'clip-path': cp,
      opacity: '0.72'
    }));

    // 4. Tube/barrel shading from base to tip.
    svg.appendChild(el('rect', {
      x: 0,
      y: 0,
      width: cw,
      height: ch,
      fill: `url(#${barrelId})`,
      'clip-path': cp
    }));

    // 5. Angle-responsive narrow specular band.
    svg.appendChild(el('rect', {
      x: 0,
      y: 0,
      width: cw,
      height: ch,
      fill: `url(#${specId})`,
      'clip-path': cp
    }));

    // 6. Soft socket shadow at base.
    const socketH = Math.max(5, Math.round(ch * 0.22));
    svg.appendChild(el('ellipse', {
      cx: (cw / 2).toFixed(2),
      cy: (ch - socketH * 0.28).toFixed(2),
      rx: (g.topW * 0.48).toFixed(2),
      ry: (socketH * 0.42).toFixed(2),
      fill: `url(#${socketId})`,
      'clip-path': cp,
      filter: `url(#${socketBlurId})`,
      opacity: '0.78'
    }));

    // 7. Tip oval face. This is the biggest cylinder cue.
    const tipCx = (g.w / 2).toFixed(2);
    const tipCy = (g.topR * 0.78).toFixed(2);
    const tipRx = (g.topW * 0.46).toFixed(2);
    const tipRy = (g.topR * 0.58).toFixed(2);

    svg.appendChild(el('ellipse', {
      cx: tipCx,
      cy: tipCy,
      rx: tipRx,
      ry: tipRy,
      fill: `url(#${tipFaceId})`,
      'clip-path': cp,
      opacity: '0.90'
    }));

    // 8. Tip rim stroke/fill overlay.
    svg.appendChild(el('ellipse', {
      cx: tipCx,
      cy: tipCy,
      rx: tipRx,
      ry: tipRy,
      fill: 'none',
      stroke: `url(#${tipRimId})`,
      'stroke-width': size === 'small' ? '0.45' : '0.85',
      'clip-path': cp,
      opacity: '0.80'
    }));

    // 9. Tiny tip hotspot, slightly off-center like the real examples.
    svg.appendChild(el('ellipse', {
      cx: (g.w * 0.38).toFixed(2),
      cy: (g.topR * 0.52).toFixed(2),
      rx: Math.max(0.7, g.topW * 0.12).toFixed(2),
      ry: Math.max(0.5, g.topR * 0.10).toFixed(2),
      fill: `rgba(${p.specColor},0.30)`,
      'clip-path': cp,
      opacity: '0.72'
    }));

    // 10. Subtle silhouette outline.
    svg.appendChild(el('path', {
      d: pathD,
      fill: 'none',
      stroke: 'rgba(0,0,0,0.26)',
      'stroke-width': size === 'small' ? '0.45' : '0.75'
    }));

    rotor.appendChild(svg);
    wrapper.appendChild(rotor);

    return { wrapper, rotor, specStopEls };
  }

  // ── Spring lever class — unchanged behavior ───────────────────────────────
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
      const shift = (t - 0.5) * 7;
      const base  = [36, 46, 51, 56, 66];

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
        if (sp) {
          sp.flip(m.target.getAttribute('data-active') === 'true');
        }
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
      '| body: single SVG cylindrical bat-handle',
      '| reduced-motion:', REDUCED
    );
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

})();

/*!
 * aa95-lever.js
 * SVG + Spring Physics lever renderer for AA95 Audio Control Panel
 *
 * v12 — one-piece cylindrical lever rendering pass.
 *   Keeps the existing motion, spring physics, ON/OFF angles, pivot,
 *   positioning, sizing, and click behavior unchanged.
 *
 *   Visual goals:
 *   - One visible handle body only (no stacked depth faces)
 *   - Less "flat paper" look in OFF position
 *   - More tube-like silhouette
 *   - Stronger barrel shading
 *   - More convincing oval tip face
 *   - Softer socket/base seating shadow
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

  // ── Per-size geometry — unchanged placement/sizing values ────────────────
  const SIZE_CFG = {
    standard : { w: 26, h: 55, topW: 22, botW: 17, topR: 10, bot: 34, ml: -13   },
    radio    : { w: 33, h: 69, topW: 28, botW: 21, topR: 13, bot: 43, ml: -16.5 },
    small    : { w: 11, h: 21, topW:  9, botW:  6, topR:  4, bot: 14, ml: -5.5  }
  };

  // ── Color palettes ────────────────────────────────────────────────────────
  const PALETTE = {
    ivory : {
      bodyStops : [
        [0,   '#7f7164'],
        [16,  '#b7a993'],
        [33,  '#ddd2be'],
        [46,  '#f6efe0'],
        [58,  '#ddd1bd'],
        [77,  '#aa9a84'],
        [100, '#786b5f'],
      ],
      capGrad   : ['#fff8ea', '#d8ccb8'],
      specColor : '255,248,230',
    },
    red : {
      bodyStops : [
        [0,   '#4e1111'],
        [16,  '#892525'],
        [33,  '#bf4040'],
        [46,  '#e46262'],
        [58,  '#bf4040'],
        [77,  '#822121'],
        [100, '#4b1010'],
      ],
      capGrad   : ['#ff8c8c', '#c13a3a'],
      specColor : '255,210,210',
    },
    orange : {
      bodyStops : [
        [0,   '#54280f'],
        [16,  '#8c4918'],
        [33,  '#c26f2e'],
        [46,  '#ea9547'],
        [58,  '#c46f2c'],
        [77,  '#854416'],
        [100, '#54280f'],
      ],
      capGrad   : ['#ffb066', '#c76621'],
      specColor : '255,228,180',
    }
  };

  // ── SVG element helper ────────────────────────────────────────────────────
  function el(tag, attrs) {
    const e = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    return e;
  }

  // ── Tube-like handle silhouette ───────────────────────────────────────────
  // Rounded tip, mostly straight shaft, and a slightly reduced lower end that
  // tucks into the socket visually. This helps the OFF position read more like
  // a cylinder emerging from a collar, not a flat pill shape.
  function handlePath(g) {
    const { w, h, topW, botW, topR } = g;
    const cx = w / 2;

    const tl = (w - topW) / 2;
    const tr = tl + topW;

    const bl = (w - botW) / 2;
    const br = bl + botW;

    const neckY = +(h * 0.68).toFixed(2);
    const flareY = +(h * 0.86).toFixed(2);

    return [
      `M ${tl},${topR}`,
      `Q ${tl},0 ${cx},0`,
      `Q ${tr},0 ${tr},${topR}`,
      `C ${tr},${neckY} ${br},${flareY} ${br},${h}`,
      `L ${bl},${h}`,
      `C ${bl},${flareY} ${tl},${neckY} ${tl},${topR}`,
      `Z`
    ].join(' ');
  }

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
      [0,   'rgba(0,0,0,0.38)'],
      [8,   'rgba(0,0,0,0.28)'],
      [18,  'rgba(0,0,0,0.14)'],
      [30,  'rgba(0,0,0,0.03)'],
      [42,  'rgba(255,255,255,0.06)'],
      [49,  'rgba(255,255,255,0.22)'],
      [54,  'rgba(255,255,255,0.11)'],
      [64,  'rgba(255,255,255,0.03)'],
      [78,  'rgba(0,0,0,0.08)'],
      [90,  'rgba(0,0,0,0.20)'],
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
    const pathD   = handlePath(g);

    const clipId       = id + 'cl';
    const bodyId       = id + 'b';
    const capId        = id + 'c';
    const broadHiId    = id + 'h';
    const barrelId     = id + 'barrel';
    const specId       = id + 's';
    const tipFaceId    = id + 'tip';
    const tipRimId     = id + 'tiprim';
    const tipShadowId  = id + 'tipshadow';
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

    // Clip all paint to the one handle silhouette.
    const clipEl = document.createElementNS(NS, 'clipPath');
    clipEl.setAttribute('id', clipId);
    clipEl.appendChild(el('path', { d: pathD }));
    defs.appendChild(clipEl);

    buildBodyGrad(defs, bodyId, p.bodyStops);

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

    const broadHi = el('radialGradient', {
      id            : broadHiId,
      gradientUnits : 'userSpaceOnUse',
      cx            : (g.w * 0.43).toFixed(1),
      cy            : (g.h * 0.24).toFixed(1),
      r             : (g.w * 0.88).toFixed(1),
      fx            : (g.w * 0.40).toFixed(1),
      fy            : (g.h * 0.08).toFixed(1)
    });
    broadHi.appendChild(el('stop', {
      offset: '0%',
      'stop-color': `rgba(${p.specColor},0.40)`
    }));
    broadHi.appendChild(el('stop', {
      offset: '58%',
      'stop-color': `rgba(${p.specColor},0.10)`
    }));
    broadHi.appendChild(el('stop', {
      offset: '100%',
      'stop-color': `rgba(${p.specColor},0)`
    }));
    defs.appendChild(broadHi);

    buildBarrelShade(defs, barrelId);

    // Narrow angle-responsive specular highlight.
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
      { o: 39,  c: `rgba(${sc},0)`    },
      { o: 47,  c: `rgba(${sc},0.10)` },
      { o: 51,  c: `rgba(${sc},0.38)` },
      { o: 55,  c: `rgba(${sc},0.12)` },
      { o: 63,  c: `rgba(${sc},0)`    },
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

    // Tip face / end cap cue.
    const tipFaceGrad = el('radialGradient', {
      id: tipFaceId,
      gradientUnits: 'userSpaceOnUse',
      cx: (g.w * 0.42).toFixed(1),
      cy: (g.topR * 0.72).toFixed(1),
      r:  (g.topW * 0.62).toFixed(1),
      fx: (g.w * 0.36).toFixed(1),
      fy: (g.topR * 0.42).toFixed(1)
    });
    tipFaceGrad.appendChild(el('stop', {
      offset: '0%',
      'stop-color': `rgba(${p.specColor},0.62)`
    }));
    tipFaceGrad.appendChild(el('stop', {
      offset: '42%',
      'stop-color': `rgba(${p.specColor},0.24)`
    }));
    tipFaceGrad.appendChild(el('stop', {
      offset: '76%',
      'stop-color': 'rgba(0,0,0,0.10)'
    }));
    tipFaceGrad.appendChild(el('stop', {
      offset: '100%',
      'stop-color': 'rgba(0,0,0,0.22)'
    }));
    defs.appendChild(tipFaceGrad);

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
      offset: '55%',
      'stop-color': 'rgba(0,0,0,0.06)'
    }));
    tipRimGrad.appendChild(el('stop', {
      offset: '100%',
      'stop-color': 'rgba(0,0,0,0.34)'
    }));
    defs.appendChild(tipRimGrad);

    const tipShadowGrad = el('radialGradient', {
      id: tipShadowId,
      gradientUnits: 'userSpaceOnUse',
      cx: g.w / 2,
      cy: (g.topR * 1.10).toFixed(1),
      r: (g.topW * 0.68).toFixed(1)
    });
    tipShadowGrad.appendChild(el('stop', {
      offset: '0%',
      'stop-color': 'rgba(0,0,0,0.10)'
    }));
    tipShadowGrad.appendChild(el('stop', {
      offset: '100%',
      'stop-color': 'rgba(0,0,0,0)'
    }));
    defs.appendChild(tipShadowGrad);

    const socketGrad = el('radialGradient', {
      id: socketId,
      gradientUnits: 'userSpaceOnUse',
      cx: g.w / 2,
      cy: (g.h - g.topR * 0.12).toFixed(1),
      r: (g.topW * 0.78).toFixed(1)
    });
    socketGrad.appendChild(el('stop', {
      offset: '0%',
      'stop-color': 'rgba(0,0,0,0.44)'
    }));
    socketGrad.appendChild(el('stop', {
      offset: '54%',
      'stop-color': 'rgba(0,0,0,0.20)'
    }));
    socketGrad.appendChild(el('stop', {
      offset: '100%',
      'stop-color': 'rgba(0,0,0,0)'
    }));
    defs.appendChild(socketGrad);

    const socketFilter = el('filter', {
      id: socketBlurId,
      x: '-25%',
      y: '-25%',
      width: '150%',
      height: '150%'
    });
    socketFilter.appendChild(el('feGaussianBlur', {
      stdDeviation: size === 'small' ? '0.30' : '0.65'
    }));
    defs.appendChild(socketFilter);

    svg.appendChild(defs);

    const cp = `url(#${clipId})`;
    const cw = g.w;
    const ch = g.h;

    // ── Paint stack: one body, no translated depth faces ──────────────────

    // 1) Main body fill.
    svg.appendChild(el('rect', {
      x: 0, y: 0, width: cw, height: ch,
      fill: `url(#${bodyId})`,
      'clip-path': cp
    }));

    // 2) Soft upper glow.
    svg.appendChild(el('rect', {
      x: 0, y: 0, width: cw, height: (ch * 0.38).toFixed(1),
      fill: `url(#${capId})`,
      'clip-path': cp,
      opacity: '0.55'
    }));

    // 3) Broad plastic highlight.
    svg.appendChild(el('rect', {
      x: 0, y: 0, width: cw, height: ch,
      fill: `url(#${broadHiId})`,
      'clip-path': cp,
      opacity: '0.70'
    }));

    // 4) Barrel shading to sell the cylindrical body.
    svg.appendChild(el('rect', {
      x: 0, y: 0, width: cw, height: ch,
      fill: `url(#${barrelId})`,
      'clip-path': cp
    }));

    // 5) Narrow moving specular stripe.
    svg.appendChild(el('rect', {
      x: 0, y: 0, width: cw, height: ch,
      fill: `url(#${specId})`,
      'clip-path': cp
    }));

    // 6) Slight darkening behind the tip to stop the top from reading flat.
    svg.appendChild(el('ellipse', {
      cx: (cw / 2).toFixed(2),
      cy: (g.topR * 0.95).toFixed(2),
      rx: (g.topW * 0.48).toFixed(2),
      ry: (g.topR * 0.42).toFixed(2),
      fill: `url(#${tipShadowId})`,
      'clip-path': cp,
      opacity: '0.75'
    }));

    // 7) Socket/base shadow so the lower end looks seated in the collar.
    const socketH = Math.max(5, Math.round(ch * 0.20));
    svg.appendChild(el('ellipse', {
      cx: (cw / 2).toFixed(2),
      cy: (ch - socketH * 0.12).toFixed(2),
      rx: (g.botW * 0.46).toFixed(2),
      ry: (socketH * 0.45).toFixed(2),
      fill: `url(#${socketId})`,
      'clip-path': cp,
      filter: `url(#${socketBlurId})`,
      opacity: '0.88'
    }));

    // 8) Oval tip face.
    const tipCx = (g.w / 2).toFixed(2);
    const tipCy = (g.topR * 0.80).toFixed(2);
    const tipRx = (g.topW * 0.45).toFixed(2);
    const tipRy = (g.topR * 0.56).toFixed(2);

    svg.appendChild(el('ellipse', {
      cx: tipCx,
      cy: tipCy,
      rx: tipRx,
      ry: tipRy,
      fill: `url(#${tipFaceId})`,
      'clip-path': cp,
      opacity: '0.92'
    }));

    // 9) Tip rim stroke.
    svg.appendChild(el('ellipse', {
      cx: tipCx,
      cy: tipCy,
      rx: tipRx,
      ry: tipRy,
      fill: 'none',
      stroke: `url(#${tipRimId})`,
      'stroke-width': size === 'small' ? '0.42' : '0.82',
      'clip-path': cp,
      opacity: '0.82'
    }));

    // 10) Small off-center hotspot on tip.
    svg.appendChild(el('ellipse', {
      cx: (g.w * 0.38).toFixed(2),
      cy: (g.topR * 0.50).toFixed(2),
      rx: Math.max(0.7, g.topW * 0.11).toFixed(2),
      ry: Math.max(0.45, g.topR * 0.10).toFixed(2),
      fill: `rgba(${p.specColor},0.34)`,
      'clip-path': cp,
      opacity: '0.70'
    }));

    // 11) Subtle silhouette outline.
    svg.appendChild(el('path', {
      d: pathD,
      fill: 'none',
      stroke: 'rgba(0,0,0,0.24)',
      'stroke-width': size === 'small' ? '0.42' : '0.72'
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
      const shift = (t - 0.5) * 6.5;
      const base  = [39, 47, 51, 55, 63];

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
      '| body: one SVG cylindrical tube shading',
      '| reduced-motion:', REDUCED
    );
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

})();

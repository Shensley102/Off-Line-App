/*!
 * aa95-lever.js
 * SVG + Spring Physics lever renderer for AA95 Audio Control Panel
 *
 * v13 — paint-mockup-inspired lever construction.
 *   Keeps motion/angles/pivot/placement unchanged.
 *
 *   Visual structure:
 *   - one SVG lever assembly
 *   - shaft body
 *   - rear depth/shadow wedge
 *   - front circular cap
 *   - cap highlight
 *   - socket/base shadow
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
    standard : { w: 26, h: 55, topW: 20, botW: 15, topR: 10, bot: 34, ml: -13   },
    radio    : { w: 33, h: 69, topW: 25, botW: 19, topR: 13, bot: 43, ml: -16.5 },
    small    : { w: 11, h: 21, topW:  8, botW:  6, topR:  4, bot: 14, ml: -5.5  }
  };

  // ── Color palettes ────────────────────────────────────────────────────────
  const PALETTE = {
    ivory : {
      bodyStops : [
        [0,   '#7c6f62'],
        [18,  '#b9ab95'],
        [40,  '#e4dac8'],
        [54,  '#f5eee0'],
        [70,  '#d2c6b2'],
        [86,  '#a79781'],
        [100, '#7b6e61'],
      ],
      capGrad   : ['#fff8ea', '#d8ccb8'],
      specColor : '255,248,230',
      wedgeDark : 'rgba(80,70,58,0.75)',
      wedgeLite : 'rgba(155,140,118,0.35)'
    },
    red : {
      bodyStops : [
        [0,   '#511111'],
        [18,  '#8b2828'],
        [40,  '#c64747'],
        [54,  '#e66a6a'],
        [70,  '#b83c3c'],
        [86,  '#7d1f1f'],
        [100, '#4f1010'],
      ],
      capGrad   : ['#ff8a8a', '#c23d3d'],
      specColor : '255,210,210',
      wedgeDark : 'rgba(70,10,10,0.72)',
      wedgeLite : 'rgba(150,60,60,0.34)'
    },
    orange : {
      bodyStops : [
        [0,   '#582b10'],
        [18,  '#91501c'],
        [40,  '#cb7834'],
        [54,  '#ee9d54'],
        [70,  '#bf6b27'],
        [86,  '#864515'],
        [100, '#56290f'],
      ],
      capGrad   : ['#ffb46d', '#cb6c28'],
      specColor : '255,228,180',
      wedgeDark : 'rgba(92,45,10,0.72)',
      wedgeLite : 'rgba(190,120,55,0.30)'
    }
  };

  // ── SVG helper ────────────────────────────────────────────────────────────
  function el(tag, attrs) {
    const e = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    return e;
  }

  // ── Body path: tube shaft behind the front cap ────────────────────────────
  function shaftPath(g) {
    const { w, h, topW, botW, topR } = g;

    const topY = +(topR * 0.72).toFixed(2);
    const botY = h;

    const tl = (w - topW) / 2;
    const tr = tl + topW;

    const bl = (w - botW) / 2;
    const br = bl + botW;

    const midY1 = +(h * 0.36).toFixed(2);
    const midY2 = +(h * 0.72).toFixed(2);

    return [
      `M ${tl},${topY}`,
      `Q ${tl},${topY - 1} ${(w / 2).toFixed(2)},${topY - 1}`,
      `Q ${tr},${topY - 1} ${tr},${topY}`,
      `C ${tr},${midY1} ${br},${midY2} ${br},${botY}`,
      `L ${bl},${botY}`,
      `C ${bl},${midY2} ${tl},${midY1} ${tl},${topY}`,
      `Z`
    ].join(' ');
  }

  // ── Rear wedge path: small dark depth wedge near the back/base ───────────
  function rearWedgePath(g) {
    const { w, h, topW, botW, topR } = g;

    const bodyTr = (w - topW) / 2 + topW;
    const bodyBr = (w - botW) / 2 + botW;

    const x1 = +(bodyTr - Math.max(1.2, w * 0.10)).toFixed(2);
    const y1 = +(topR * 1.35).toFixed(2);

    const x2 = +(w - 0.8).toFixed(2);
    const y2 = +(h * 0.52).toFixed(2);

    const x3 = +(bodyBr - Math.max(0.8, w * 0.05)).toFixed(2);
    const y3 = +(h * 0.76).toFixed(2);

    const x4 = +(bodyTr - Math.max(1.6, w * 0.16)).toFixed(2);
    const y4 = +(h * 0.48).toFixed(2);

    return [
      `M ${x1},${y1}`,
      `L ${x2},${y2}`,
      `L ${x3},${y3}`,
      `L ${x4},${y4}`,
      `Z`
    ].join(' ');
  }

  // ── Gradient helper ───────────────────────────────────────────────────────
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

  function buildBarrelGrad(defs, gradId) {
    const grad = el('linearGradient', {
      id: gradId,
      x1: '0%',
      y1: '0%',
      x2: '100%',
      y2: '0%'
    });

    [
      [0,   'rgba(0,0,0,0.34)'],
      [10,  'rgba(0,0,0,0.22)'],
      [22,  'rgba(0,0,0,0.10)'],
      [36,  'rgba(255,255,255,0.02)'],
      [48,  'rgba(255,255,255,0.18)'],
      [54,  'rgba(255,255,255,0.11)'],
      [66,  'rgba(0,0,0,0.03)'],
      [82,  'rgba(0,0,0,0.16)'],
      [100, 'rgba(0,0,0,0.30)']
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

    const shaftD = shaftPath(g);
    const wedgeD = rearWedgePath(g);

    const shaftClipId   = id + 'shaftclip';
    const bodyId        = id + 'body';
    const capGlowId     = id + 'capglow';
    const broadHiId     = id + 'broadhi';
    const barrelId      = id + 'barrel';
    const specId        = id + 'spec';
    const wedgeId       = id + 'wedge';
    const tipFaceId     = id + 'tipface';
    const tipRimId      = id + 'tiprim';
    const socketId      = id + 'socket';
    const socketBlurId  = id + 'socketblur';

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

    // ── Single visible lever SVG ─────────────────────────────────────────
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', `0 0 ${g.w} ${g.h}`);
    svg.setAttribute('width', g.w);
    svg.setAttribute('height', g.h);

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

    // Clip for shaft-only shading.
    const shaftClip = document.createElementNS(NS, 'clipPath');
    shaftClip.setAttribute('id', shaftClipId);
    shaftClip.appendChild(el('path', { d: shaftD }));
    defs.appendChild(shaftClip);

    // Shaft body gradient.
    buildBodyGrad(defs, bodyId, p.bodyStops);

    // Gentle upper glow.
    const capGlow = el('linearGradient', {
      id: capGlowId,
      x1: '0%',
      y1: '0%',
      x2: '0%',
      y2: '100%'
    });
    capGlow.appendChild(el('stop', {
      offset: '0%',
      'stop-color': p.capGrad[0]
    }));
    capGlow.appendChild(el('stop', {
      offset: '100%',
      'stop-color': p.capGrad[1]
    }));
    defs.appendChild(capGlow);

    // Broad plastic highlight.
    const broadHi = el('radialGradient', {
      id            : broadHiId,
      gradientUnits : 'userSpaceOnUse',
      cx            : (g.w * 0.42).toFixed(1),
      cy            : (g.h * 0.22).toFixed(1),
      r             : (g.w * 0.85).toFixed(1),
      fx            : (g.w * 0.38).toFixed(1),
      fy            : (g.h * 0.08).toFixed(1)
    });
    broadHi.appendChild(el('stop', {
      offset: '0%',
      'stop-color': `rgba(${p.specColor},0.40)`
    }));
    broadHi.appendChild(el('stop', {
      offset: '62%',
      'stop-color': `rgba(${p.specColor},0.08)`
    }));
    broadHi.appendChild(el('stop', {
      offset: '100%',
      'stop-color': `rgba(${p.specColor},0)`
    }));
    defs.appendChild(broadHi);

    // Barrel/tube shading.
    buildBarrelGrad(defs, barrelId);

    // Moving specular stripe.
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
      { o: 38,  c: `rgba(${sc},0)`    },
      { o: 46,  c: `rgba(${sc},0.10)` },
      { o: 50,  c: `rgba(${sc},0.36)` },
      { o: 55,  c: `rgba(${sc},0.10)` },
      { o: 64,  c: `rgba(${sc},0)`    },
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

    // Rear wedge gradient.
    const wedgeGrad = el('linearGradient', {
      id: wedgeId,
      x1: '0%',
      y1: '0%',
      x2: '100%',
      y2: '100%'
    });
    wedgeGrad.appendChild(el('stop', {
      offset: '0%',
      'stop-color': p.wedgeLite
    }));
    wedgeGrad.appendChild(el('stop', {
      offset: '100%',
      'stop-color': p.wedgeDark
    }));
    defs.appendChild(wedgeGrad);

    // Front cap gradient.
    const tipFaceGrad = el('radialGradient', {
      id: tipFaceId,
      gradientUnits: 'userSpaceOnUse',
      cx: (g.w * 0.36).toFixed(1),
      cy: (g.topR * 0.55).toFixed(1),
      r:  (g.topW * 0.70).toFixed(1),
      fx: (g.w * 0.31).toFixed(1),
      fy: (g.topR * 0.38).toFixed(1)
    });
    tipFaceGrad.appendChild(el('stop', {
      offset: '0%',
      'stop-color': `rgba(${p.specColor},0.70)`
    }));
    tipFaceGrad.appendChild(el('stop', {
      offset: '38%',
      'stop-color': `rgba(${p.specColor},0.28)`
    }));
    tipFaceGrad.appendChild(el('stop', {
      offset: '72%',
      'stop-color': 'rgba(0,0,0,0.08)'
    }));
    tipFaceGrad.appendChild(el('stop', {
      offset: '100%',
      'stop-color': 'rgba(0,0,0,0.22)'
    }));
    defs.appendChild(tipFaceGrad);

    // Tip rim gradient.
    const tipRimGrad = el('linearGradient', {
      id: tipRimId,
      x1: '0%',
      y1: '0%',
      x2: '0%',
      y2: '100%'
    });
    tipRimGrad.appendChild(el('stop', {
      offset: '0%',
      'stop-color': 'rgba(255,255,255,0.24)'
    }));
    tipRimGrad.appendChild(el('stop', {
      offset: '58%',
      'stop-color': 'rgba(0,0,0,0.04)'
    }));
    tipRimGrad.appendChild(el('stop', {
      offset: '100%',
      'stop-color': 'rgba(0,0,0,0.32)'
    }));
    defs.appendChild(tipRimGrad);

    // Socket/base shadow.
    const socketGrad = el('radialGradient', {
      id: socketId,
      gradientUnits: 'userSpaceOnUse',
      cx: g.w / 2,
      cy: (g.h - g.topR * 0.1).toFixed(1),
      r: (g.botW * 0.95).toFixed(1)
    });
    socketGrad.appendChild(el('stop', {
      offset: '0%',
      'stop-color': 'rgba(0,0,0,0.46)'
    }));
    socketGrad.appendChild(el('stop', {
      offset: '55%',
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
      stdDeviation: size === 'small' ? '0.28' : '0.62'
    }));
    defs.appendChild(socketFilter);

    svg.appendChild(defs);

    const shaftCP = `url(#${shaftClipId})`;
    const cw = g.w;
    const ch = g.h;

    // ── Paint order ────────────────────────────────────────────────────────
    // back wedge -> shaft -> front cap -> cap hotspot -> socket shadow

    // 1) Rear depth wedge
    svg.appendChild(el('path', {
      d: wedgeD,
      fill: `url(#${wedgeId})`,
      opacity: '0.92'
    }));

    // 2) Shaft main body
    svg.appendChild(el('rect', {
      x: 0, y: 0, width: cw, height: ch,
      fill: `url(#${bodyId})`,
      'clip-path': shaftCP
    }));

    // 3) Shaft upper glow
    svg.appendChild(el('rect', {
      x: 0, y: 0, width: cw, height: (ch * 0.38).toFixed(1),
      fill: `url(#${capGlowId})`,
      'clip-path': shaftCP,
      opacity: '0.50'
    }));

    // 4) Broad body highlight
    svg.appendChild(el('rect', {
      x: 0, y: 0, width: cw, height: ch,
      fill: `url(#${broadHiId})`,
      'clip-path': shaftCP,
      opacity: '0.66'
    }));

    // 5) Barrel shading
    svg.appendChild(el('rect', {
      x: 0, y: 0, width: cw, height: ch,
      fill: `url(#${barrelId})`,
      'clip-path': shaftCP
    }));

    // 6) Moving specular stripe
    svg.appendChild(el('rect', {
      x: 0, y: 0, width: cw, height: ch,
      fill: `url(#${specId})`,
      'clip-path': shaftCP
    }));

    // 7) Front circular end cap
    const tipCx = (g.w / 2).toFixed(2);
    const tipCy = (g.topR * 0.92).toFixed(2);
    const tipRx = (g.topW * 0.47).toFixed(2);
    const tipRy = (g.topR * 0.78).toFixed(2);

    svg.appendChild(el('ellipse', {
      cx: tipCx,
      cy: tipCy,
      rx: tipRx,
      ry: tipRy,
      fill: `url(#${tipFaceId})`,
      opacity: '0.96'
    }));

    // 8) Cap rim
    svg.appendChild(el('ellipse', {
      cx: tipCx,
      cy: tipCy,
      rx: tipRx,
      ry: tipRy,
      fill: 'none',
      stroke: `url(#${tipRimId})`,
      'stroke-width': size === 'small' ? '0.40' : '0.80',
      opacity: '0.84'
    }));

    // 9) Cap hotspot
    svg.appendChild(el('ellipse', {
      cx: (g.w * 0.38).toFixed(2),
      cy: (g.topR * 0.62).toFixed(2),
      rx: Math.max(0.7, g.topW * 0.12).toFixed(2),
      ry: Math.max(0.5, g.topR * 0.12).toFixed(2),
      fill: `rgba(${p.specColor},0.34)`,
      opacity: '0.74'
    }));

    // 10) Soft socket/base shadow
    const sockRx = (g.botW * 0.44).toFixed(2);
    const sockRy = Math.max(1.1, g.topR * 0.34).toFixed(2);
    svg.appendChild(el('ellipse', {
      cx: (cw / 2).toFixed(2),
      cy: (ch - g.topR * 0.06).toFixed(2),
      rx: sockRx,
      ry: sockRy,
      fill: `url(#${socketId})`,
      filter: `url(#${socketBlurId})`,
      opacity: '0.88'
    }));

    // 11) subtle shaft outline
    svg.appendChild(el('path', {
      d: shaftD,
      fill: 'none',
      stroke: 'rgba(0,0,0,0.20)',
      'stroke-width': size === 'small' ? '0.38' : '0.65'
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
      const base  = [38, 46, 50, 55, 64];

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
      '| body: cap + shaft + rear wedge',
      '| reduced-motion:', REDUCED
    );
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

})();

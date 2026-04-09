/*!
 * aa95-lever.js
 * SVG + Spring Physics lever renderer for AA95 Audio Control Panel
 *
 * What this does:
 *   - Replaces every .lever CSS div with a hand-built SVG cylinder
 *   - Drives rotation with a real spring physics loop (requestAnimationFrame)
 *   - Shifts the specular highlight band as the lever angle changes
 *   - Watches data-active attribute mutations → no changes to existing JS needed
 *
 * Dependencies: none. Drop next to aa95.html and add:
 *   <script src="aa95-lever.js" defer></script>
 */
(function () {
  'use strict';

  // ── Spring constants ──────────────────────────────────────────────────────
  // Tuned for a heavy mil-spec toggle: snappy snap, slight overshoot, quick settle
  const SPRING = {
    stiffness : 480,   // N·m / rad  — higher = faster snap
    damping   : 22,    // N·m·s/rad  — higher = less bounce
    mass      : 1.0,
    threshold : 0.004  // deg / deg·s⁻¹ — stop condition
  };

  // ── Toggle angle targets ──────────────────────────────────────────────────
  const ANGLE = {
    on  : -11,   // rotateX — lever leans back  (ON / UP)
    off :   9    // rotateX — lever leans forward (OFF / DOWN)
  };

  // ── Reduced-motion preference ─────────────────────────────────────────────
  const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ── SVG namespace ─────────────────────────────────────────────────────────
  const NS = 'http://www.w3.org/2000/svg';

  // ── Unique gradient ID factory ────────────────────────────────────────────
  let _n = 0;
  const uid = () => 'aa95lv' + (++_n);

  // ── Per-size geometry ─────────────────────────────────────────────────────
  const SIZE_CFG = {
    standard : { w: 26, h: 55, rx: 13, capRy: 3.5, bot: 34, ml: -13   },
    radio    : { w: 33, h: 69, rx: 16, capRy: 4.5, bot: 43, ml: -16.5 },
    small    : { w: 11, h: 21, rx:  6, capRy: 2.0, bot: 14, ml: -5.5  }
  };

  // ── Color palettes ────────────────────────────────────────────────────────
  // Each palette: body[6 stops left→right], cap fill, top-face highlight
  const PALETTE = {
    silver : {
      body : ['#6a6a6a','#b8b8b8','#f6f6f6','#dcdcdc','#969696','#6a6a6a'],
      cap  : '#cccccc',
      capHi: '#e8e8e8'
    },
    red : {
      body : ['#5f1010','#b52626','#ff5d5d','#db3838','#991919','#5f1010'],
      cap  : '#bb3333',
      capHi: '#ee6666'
    },
    orange : {
      body : ['#643510','#b96821','#ffab57','#de8530','#9b5519','#643510'],
      cap  : '#bb6622',
      capHi: '#ffaa55'
    }
  };

  // ── SVG element helper ────────────────────────────────────────────────────
  function el(tag, attrs) {
    const e = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    return e;
  }

  // ── Build one SVG lever ───────────────────────────────────────────────────
  function buildSVG(size, color, id) {
    const g = SIZE_CFG[size];
    const p = PALETTE[color] || PALETTE.silver;

    const bodyGradId = id + 'b';
    const specGradId = id + 's';
    const capGradId  = id + 'c';

    // ── root ──
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', `0 0 ${g.w} ${g.h}`);
    svg.setAttribute('width',   g.w);
    svg.setAttribute('height',  g.h);
    Object.assign(svg.style, {
      position        : 'absolute',
      bottom          : g.bot + 'px',
      left            : '50%',
      marginLeft      : g.ml + 'px',
      zIndex          : '5',
      overflow        : 'visible',
      transformOrigin : '50% 99%',
      willChange      : 'transform',
      backfaceVisibility : 'hidden',
      display         : 'block'
    });

    // ── defs ──
    const defs = document.createElementNS(NS, 'defs');

    // Body gradient — 6-stop cylindrical simulation (dark edge → bright center → dark edge)
    const bodyGrad = el('linearGradient', { id: bodyGradId, x1:'0%', y1:'0%', x2:'100%', y2:'0%' });
    [
      [0,   p.body[0]],
      [18,  p.body[1]],
      [42,  p.body[2]],
      [56,  p.body[3]],
      [78,  p.body[4]],
      [100, p.body[5]]
    ].forEach(([pct, col]) =>
      bodyGrad.appendChild(el('stop', { offset: pct + '%', 'stop-color': col }))
    );

    // Cap gradient — top ellipse, subtle radial-ish highlight via linear
    const capGrad = el('linearGradient', { id: capGradId, x1:'30%', y1:'0%', x2:'70%', y2:'100%' });
    capGrad.appendChild(el('stop', { offset: '0%',   'stop-color': p.capHi }));
    capGrad.appendChild(el('stop', { offset: '100%', 'stop-color': p.cap   }));

    // Specular gradient — 7 stops; indices 1-5 are shifted by JS each frame
    const specGrad = el('linearGradient', { id: specGradId, x1:'0%', y1:'0%', x2:'100%', y2:'0%' });
    const specDef = [
      { o:  0,  c: 'rgba(255,255,255,0)'    },  // [0] fixed
      { o: 34,  c: 'rgba(255,255,255,0)'    },  // [1] movable
      { o: 46,  c: 'rgba(255,255,255,0.22)' },  // [2] movable
      { o: 53,  c: 'rgba(255,255,255,0.50)' },  // [3] movable — peak
      { o: 60,  c: 'rgba(255,255,255,0.18)' },  // [4] movable
      { o: 72,  c: 'rgba(255,255,255,0)'    },  // [5] movable
      { o: 100, c: 'rgba(255,255,255,0)'    }   // [6] fixed
    ];
    const specStopEls = specDef.map(d => {
      const s = el('stop', { offset: d.o + '%', 'stop-color': d.c });
      specGrad.appendChild(s);
      return s;
    });

    defs.appendChild(bodyGrad);
    defs.appendChild(capGrad);
    defs.appendChild(specGrad);
    svg.appendChild(defs);

    // ── layers (back to front) ────────────────────────────────────────────

    // 1. Main body
    svg.appendChild(el('rect', {
      x: 0, y: 0, width: g.w, height: g.h,
      rx: g.rx, ry: g.rx,
      fill: `url(#${bodyGradId})`
    }));

    // 2. Specular highlight band (shifts left/right with angle)
    svg.appendChild(el('rect', {
      x: 0, y: 0, width: g.w, height: g.h,
      rx: g.rx, ry: g.rx,
      fill: `url(#${specGradId})`
    }));

    // 3. Top cap ellipse — the rounded crown of the lever
    svg.appendChild(el('ellipse', {
      cx: g.w / 2,
      cy: g.capRy * 0.7,
      rx: g.w / 2 - 0.5,
      ry: g.capRy,
      fill: `url(#${capGradId})`
    }));

    // 4. Left-edge depth shadow
    svg.appendChild(el('rect', {
      x: 0, y: 0, width: 4, height: g.h,
      rx: g.rx, ry: g.rx,
      fill: 'rgba(0,0,0,0.14)'
    }));

    // 5. Right-edge depth shadow (slightly lighter — ambient bounce)
    svg.appendChild(el('rect', {
      x: g.w - 4, y: 0, width: 4, height: g.h,
      rx: g.rx, ry: g.rx,
      fill: 'rgba(0,0,0,0.09)'
    }));

    // 6. Base vignette — occlusion where lever enters nut
    svg.appendChild(el('rect', {
      x: 2, y: g.h - 10, width: g.w - 4, height: 10,
      rx: 4, ry: 4,
      fill: 'rgba(0,0,0,0.25)'
    }));

    return { svg, specStopEls };
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
      this._apply();  // set initial transform
    }

    // Called when data-active changes
    flip(isOn) {
      this.target = isOn ? ANGLE.on : ANGLE.off;

      if (REDUCED) {
        this.pos = this.target;
        this.vel = 0;
        this._apply();
        return;
      }

      // If already animating, just update target — tick loop picks it up
      if (!this.raf) {
        this.prevTime = performance.now();
        this.raf = requestAnimationFrame(t => this._tick(t));
      }
    }

    _tick(now) {
      const dt = Math.min((now - this.prevTime) / 1000, 0.033); // cap 33ms
      this.prevTime = now;

      // Hooke's law + viscous damping
      const err   = this.pos - this.target;
      const force = -(SPRING.stiffness * err) - (SPRING.damping * this.vel);
      this.vel   += (force / SPRING.mass) * dt;
      this.pos   += this.vel * dt;

      this._apply();

      // Settle check
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
      // Set 3D rotation — perspective context comes from parent .assembly-toggle
      this.el.style.transform = `rotateX(${this.pos.toFixed(3)}deg)`;
      this._updateSpecular();
    }

    _updateSpecular() {
      // Map current angle to a 0–1 blend: 0 = fully ON, 1 = fully OFF
      const t = (this.pos - ANGLE.on) / (ANGLE.off - ANGLE.on);

      // Shift the specular band ±6% based on angle
      // ON: highlight drifts slightly left (light catches front face)
      // OFF: highlight drifts slightly right (light catches back face)
      const shift = (t - 0.5) * 12;

      // Base offsets for movable stops [1]–[5]
      const base = [34, 46, 53, 60, 72];
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
    return 'silver';
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

      // Remove any leftover CSS lever div
      assembly.querySelector('.lever')?.remove();

      // Build SVG, attach to assembly
      const { svg, specStopEls } = buildSVG(size, color, id);
      assembly.appendChild(svg);

      // Create spring, keyed by component ID
      const spring = new SpringLever(svg, specStopEls, isOn);
      if (component.id) registry[component.id] = spring;
    });

    return registry;
  }

  // ── Watch data-active mutations, relay to springs ─────────────────────────
  // This decouples lever.js from aa95.html's existing click/state logic entirely.
  // The existing JS toggles data-active → MutationObserver fires → spring flips.
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

    // Expose on window for debugging / external access
    window.AA95Levers = registry;
    console.log(
      `[AA95] Spring levers ready — ${Object.keys(registry).length} instances`,
      '| reduced-motion:', REDUCED
    );
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

})();

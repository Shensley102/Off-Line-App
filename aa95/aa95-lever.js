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
  // Tuned for a heavy mil-spec toggle: snappy snap, slight overshoot, quick settle
  const SPRING = {
    stiffness : 480,   // N·m / rad  — higher = faster snap
    damping   : 22,    // N·m·s/rad  — higher = less bounce
    mass      : 1.0,
    threshold : 0.004  // deg / deg·s⁻¹ — stop condition
  };

  // ── Toggle angle targets ──────────────────────────────────────────────────
  // OFF = 0°  → lever face-on to viewer, 90° from faceplate (pointing straight out)
  // ON  = -30° → lever tilted back 30°, 60° from faceplate
  // Total throw: 30° arc — matches physical MS25306-series geometry
  const ANGLE = {
    on  : -30,   // rotateX — lever tilts back (ON / UP)
    off :   0    // rotateX — lever face-on to viewer (OFF / DOWN)
  };

  // ── Fixed presentation cant ───────────────────────────────────────────────
  // WHY THIS EXISTS:
  //   When the lever is at OFF (rotateX 0°) it points straight at the viewer.
  //   On a flat screen this causes foreshortening — the lever looks like a disc
  //   and the 30° throw is hard to read. A small rotateY applied to an OUTER
  //   wrapper slightly rotates the whole assembly left so the viewer can see
  //   the lever's depth and motion without changing the physical throw at all.
  //
  // WHY rotateY IS SEPARATE FROM rotateX:
  //   Combining them into one transform string on the SVG would make the
  //   spring math interact with the cant angle every frame, causing drift and
  //   an incorrect effective pivot axis. Keeping rotateY on an outer wrapper
  //   means the transforms stack as: [cant in world space] → [spring throw
  //   in lever-local space]. Each is independent and stable.
  //
  // HOW TO ADJUST:
  //   Change the values below. Negative = cant left (lever face opens toward
  //   the left/viewer's right). Start subtle — more than ±15° looks wrong.
  const CANT = {
    radio    : -10,   // deg — large radio toggle levers (COM1/COM2/FM1/FM2/AUX)
    standard :  -8,   // deg — standard toggles (ISO/EMR, ICS MIC)
    small    :  -6    // deg — small toggles (PAT, KEY)
  };

  // ── Reduced-motion preference ─────────────────────────────────────────────
  const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ── SVG namespace ─────────────────────────────────────────────────────────
  const NS = 'http://www.w3.org/2000/svg';

  // ── Unique gradient/clip ID factory ──────────────────────────────────────
  let _n = 0;
  const uid = () => 'aa95lv' + (++_n);

  // ── Per-size geometry ─────────────────────────────────────────────────────
  // w, h     — SVG canvas size in px
  // topW     — lever width at the dome (widest point, near top)
  // botW     — lever width at the base (narrowest, where it enters the nut)
  // topR     — dome radius: larger = more bulbous rounded tip, smaller = flatter crown
  // bot, ml  — bottom/margin-left positioning within the .assembly-toggle stage
  //
  // Tune topW/botW ratio to change how tapered the bat handle looks.
  // Tune topR to change how round the tip dome is.
  const SIZE_CFG = {
    standard : { w: 26, h: 55, topW: 22, botW: 18, topR: 11, bot: 34, ml: -13   },
    radio    : { w: 33, h: 69, topW: 28, botW: 22, topR: 14, bot: 43, ml: -16.5 },
    small    : { w: 11, h: 21, topW:  9, botW:  7, topR:  4, bot: 14, ml: -5.5  }
  };

  // ── Color palettes ────────────────────────────────────────────────────────
  // bodyStops : [[pct, color], ...] — left→right gradient, simulates rounded form
  //             Tune these colors to adjust warm/cool balance or apparent age.
  //             More yellow-tan = older/worn. More neutral gray = newer.
  // capGrad   : [topColor, bottomColor] — dome tip top→bottom gradient
  //             Tune to change how bright the dome crown reads.
  // specColor : 'R,G,B' — base color for all specular/highlight layers
  //             Tune to push the plastic sheen warmer or cooler.
  const PALETTE = {

    // ── Ivory / cream ────────────────────────────────────────────────────────
    // Matches real AA95 bat-handle phenolic/nylon material — warm, slightly aged.
    // To make it look newer/cleaner: shift bodyStops center toward #f0ece0.
    // To make it look more worn: shift center toward #c8b898.
    ivory : {
      bodyStops : [
        [0,   '#8c7d6e'],   // deep warm shadow — left edge
        [18,  '#c0b09e'],   // mid-shadow
        [42,  '#e8dece'],   // main body — warm cream center
        [56,  '#d4c8b4'],   // mid-light right
        [78,  '#b8a892'],   // shadow right
        [100, '#8c7d6e'],   // deep shadow — right edge
      ],
      capGrad  : ['#f5efe3', '#ddd3c0'],   // dome: very light ivory → cream
      specColor: '255,248,230',             // warm cream-white specular
    },

    // ── Red ──────────────────────────────────────────────────────────────────
    // ISO/EMR lever. Same bat-handle material treatment, red-tinted.
    // Tune bodyStops center ([42]) to adjust red saturation.
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

    // ── Orange ───────────────────────────────────────────────────────────────
    // ICS MIC lever. Same material, orange-tinted.
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

  // ── Bat-handle path ───────────────────────────────────────────────────────
  // Returns an SVG path 'd' string describing the lever silhouette.
  //
  // Shape anatomy:
  //   Dome top  — two quadratic beziers meeting at the crown (cx, 0):
  //               Q tl,0 → cx,0 then Q tr,0 → tr,topR forms a smooth rounded tip.
  //   Sides     — cubic beziers tapering from topW at the dome to botW at the base.
  //               Control points at taperStart / taperEnd govern the taper timing:
  //                 taperStart (h*0.48): where the straight upper body ends
  //                 taperEnd   (h*0.62): where the taper finishes into the shaft
  //               Adjust these fractions to change the bat-handle feel:
  //                 lower taperStart → taper starts sooner (dramatic bottle shape)
  //                 higher taperEnd  → taper completes later (straighter, cylindrical)
  //   Flat base — sits flush with the nut at y = h
  function batPath(g) {
    const { w, h, topW, botW, topR } = g;
    const cx = w / 2;
    const tl = (w - topW) / 2;         // top-left x (dome edge)
    const tr = tl + topW;               // top-right x (dome edge)
    const bl = (w - botW) / 2;         // bottom-left x (base edge)
    const br = bl + botW;               // bottom-right x (base edge)
    const ts = (h * 0.48).toFixed(2);  // taper start — upper body → shaft
    const te = (h * 0.62).toFixed(2);  // taper end   — shaft reaches base width

    return [
      `M ${tl},${topR}`,
      `Q ${tl},0 ${cx},0`,               // left half of dome arc
      `Q ${tr},0 ${tr},${topR}`,         // right half of dome arc
      `C ${tr},${ts} ${br},${te} ${br},${h}`,    // right side: dome → base
      `L ${bl},${h}`,                    // flat base
      `C ${bl},${te} ${tl},${ts} ${tl},${topR}`, // left side: base → dome
      `Z`
    ].join(' ');
  }

  // ── Build one SVG lever + its cant wrapper ────────────────────────────────
  // Returns { wrapper, svg, specStopEls }
  //   wrapper     — outer div with fixed rotateY cant; append to .assembly-toggle
  //   svg         — inner SVG; SpringLever drives rotateX on this element
  //   specStopEls — 7-element array; [1]–[5] are shifted each animation frame
  function buildSVG(size, colorKey, id) {
    const g       = SIZE_CFG[size];
    const p       = PALETTE[colorKey] || PALETTE.ivory;
    const cantDeg = CANT[size] || CANT.standard;
    const pathD   = batPath(g);

    const clipId = id + 'cl';
    const bodyId = id + 'b';
    const capId  = id + 'c';
    const hiId   = id + 'h';
    const specId = id + 's';

    // ── Outer cant wrapper ────────────────────────────────────────────────────
    // Owns the absolute positioning (same bottom/left/marginLeft as the old SVG).
    // Applies a fixed rotateY presentation cant — never touched by the spring.
    // transform-style: preserve-3d required so the inner SVG's rotateX composes
    // correctly within the perspective context of the parent .assembly-toggle.
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
    // SpringLever animates rotateX here every frame.
    // The wrapper's rotateY is fixed at build time — both transforms are independent.
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

    // ── ClipPath: bat silhouette ──────────────────────────────────────────────
    // All fill layers are clipped to this shape.
    // Change batPath() parameters (via SIZE_CFG) to reshape all layers at once.
    const clipEl = document.createElementNS(NS, 'clipPath');
    clipEl.setAttribute('id', clipId);
    clipEl.appendChild(el('path', { d: pathD }));
    defs.appendChild(clipEl);

    // ── Body gradient: left→right cylindrical shading ─────────────────────────
    // Simulates light from slightly left-of-center on a rounded surface.
    // Tune: bodyStops colors in PALETTE for material warmth and saturation.
    const bodyGrad = el('linearGradient', {
      id: bodyId, x1: '0%', y1: '0%', x2: '100%', y2: '0%'
    });
    p.bodyStops.forEach(([pct, col]) =>
      bodyGrad.appendChild(el('stop', { offset: pct + '%', 'stop-color': col }))
    );
    defs.appendChild(bodyGrad);

    // ── Cap gradient: dome tip brightening ────────────────────────────────────
    // Applied to the top ~38% of lever height (Layer 2 below).
    // Makes the crown read lighter than the body — gives the tip a lifted look.
    // Tune: capGrad colors in PALETTE, and Layer 2 opacity below.
    const capGrad = el('linearGradient', {
      id: capId, x1: '0%', y1: '0%', x2: '0%', y2: '100%'
    });
    capGrad.appendChild(el('stop', { offset:   '0%', 'stop-color': p.capGrad[0] }));
    capGrad.appendChild(el('stop', { offset: '100%', 'stop-color': p.capGrad[1] }));
    defs.appendChild(capGrad);

    // ── Plastic radial highlight ──────────────────────────────────────────────
    // Soft oval glow in the upper body — simulates overhead/ambient light on a
    // semi-matte plastic surface. This is the main thing that keeps the lever
    // from reading as chrome.
    // Tune: cy (glow center height, as fraction of h),
    //       r  (spread, as fraction of w),
    //       Layer 3 opacity below.
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
    // 7 stops; [0] and [6] are fixed. [1]–[5] are shifted by _updateSpecular().
    // Peak opacity 0.28 (vs old chrome version's 0.50) — this is the main
    // "less reflective" tuning. Wider band + lower peak = semi-matte plastic.
    // Tune: the 0.28 value at stop [3] for more or less surface sheen.
    //       specColor in PALETTE for highlight warmth.
    const sc = p.specColor;
    const specGrad = el('linearGradient', {
      id: specId, x1: '0%', y1: '0%', x2: '100%', y2: '0%'
    });
    const specDef = [
      { o:  0,  c: `rgba(${sc},0)`    },  // [0] fixed  — left transparent edge
      { o: 30,  c: `rgba(${sc},0)`    },  // [1] movable
      { o: 44,  c: `rgba(${sc},0.12)` },  // [2] movable — soft shoulder
      { o: 52,  c: `rgba(${sc},0.28)` },  // [3] movable — peak (tune opacity here)
      { o: 60,  c: `rgba(${sc},0.10)` },  // [4] movable — soft shoulder
      { o: 74,  c: `rgba(${sc},0)`    },  // [5] movable
      { o: 100, c: `rgba(${sc},0)`    }   // [6] fixed  — right transparent edge
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

    // ── Layer 1: Base body (warm ivory cylindrical gradient) ──────────────────
    svg.appendChild(el('rect', {
      x: 0, y: 0, width: cw, height: ch,
      fill: `url(#${bodyId})`,
      'clip-path': cp
    }));

    // ── Layer 2: Dome cap brightening (top ~38% of lever) ─────────────────────
    // Tune: the 0.38 fraction and opacity (0.75) to change how bright the crown is.
    svg.appendChild(el('rect', {
      x: 0, y: 0, width: cw, height: (ch * 0.38).toFixed(1),
      fill: `url(#${capId})`,
      'clip-path': cp,
      opacity: '0.75'
    }));

    // ── Layer 3: Plastic radial highlight (soft center glow) ──────────────────
    // Tune: opacity (0.60) — lower = more matte, higher = more glossy plastic.
    svg.appendChild(el('rect', {
      x: 0, y: 0, width: cw, height: ch,
      fill: `url(#${hiId})`,
      'clip-path': cp,
      opacity: '0.60'
    }));

    // ── Layer 4: Movable specular band (angle-responsive) ─────────────────────
    // Shifts ±4% with lever angle (see _updateSpecular). Subtle by design.
    svg.appendChild(el('rect', {
      x: 0, y: 0, width: cw, height: ch,
      fill: `url(#${specId})`,
      'clip-path': cp
    }));

    // ── Layer 5: Left rim shadow ───────────────────────────────────────────────
    // Darkens the left edge — simulates shadow on the rim of a rounded form.
    // Tune: width fraction (0.16) and fill opacity.
    const rimW = Math.max(2, Math.round(cw * 0.16));
    svg.appendChild(el('rect', {
      x: 0, y: 0, width: rimW, height: ch,
      fill: 'rgba(0,0,0,0.20)',
      'clip-path': cp
    }));

    // ── Layer 6: Right rim shadow (slightly lighter — ambient bounce from panel)
    svg.appendChild(el('rect', {
      x: cw - rimW, y: 0, width: rimW, height: ch,
      fill: 'rgba(0,0,0,0.13)',
      'clip-path': cp
    }));

    // ── Layer 7: Base occlusion (where lever emerges from the nut) ────────────
    // Dark shadow at the very bottom — gives a sense the lever is mounted in depth.
    // Tune: height fraction (0.15) and fill opacity (0.38).
    const occH = Math.max(4, Math.round(ch * 0.15));
    svg.appendChild(el('rect', {
      x: 1, y: ch - occH, width: cw - 2, height: occH,
      rx: 2, ry: 2,
      fill: 'rgba(0,0,0,0.38)',
      'clip-path': cp
    }));

    // ── Layer 8: Silhouette outline ───────────────────────────────────────────
    // Thin dark stroke helps the lever read against the dark panel surface.
    // Tune: stroke-width (0.75) — set to 0 to remove entirely.
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
      // Animate only rotateX on the inner SVG.
      // The outer wrapper's rotateY cant is set once at build time and never
      // touched here — the two transforms are fully independent and stable.
      this.el.style.transform = `rotateX(${this.pos.toFixed(3)}deg)`;
      this._updateSpecular();
    }

    _updateSpecular() {
      // Map current angle → 0–1 blend: 0 = fully ON (tilted back), 1 = fully OFF
      const t = (this.pos - ANGLE.on) / (ANGLE.off - ANGLE.on);

      // Shift specular band ±4% based on angle.
      // Reduced from ±6% (old chrome version) — subtler, more matte response.
      // Tune: multiply factor (8) — larger = more angle-responsive sheen,
      //       smaller = flatter / more matte response to angle change.
      const shift = (t - 0.5) * 8;

      // Base offsets for movable stops [1]–[5] — must match specDef in buildSVG
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

  // Returns palette key. 'ivory' is the default — matches real AA95 bat handles.
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

      // Remove any leftover CSS lever div
      assembly.querySelector('.lever')?.remove();

      // Build SVG + cant wrapper; attach wrapper to the assembly.
      // The wrapper owns absolute positioning; the SVG animates inside it.
      const { wrapper, svg, specStopEls } = buildSVG(size, color, id);
      assembly.appendChild(wrapper);

      // Spring instance keyed by component ID.
      // References only the inner SVG — rotateX only, nothing else changes.
      const spring = new SpringLever(svg, specStopEls, isOn);
      if (component.id) registry[component.id] = spring;
    });

    return registry;
  }

  // ── Watch data-active mutations, relay to springs ─────────────────────────
  // Fully decoupled from aa95.html's click/state logic.
  // Existing JS toggles data-active → MutationObserver fires → spring flips.
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
      '| angles: ON', ANGLE.on + '° OFF', ANGLE.off + '°',
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

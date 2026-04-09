# CLAUDE.md — Off-Line-App

AI assistant guide for the **Off-Line-App** repository. Covers structure,
conventions, and development workflows.

---

## Project Overview

An **offline-capable Progressive Web App (PWA)** that simulates aviation radio
equipment with interactive UIs. There is no backend, no build step, and no
runtime dependencies — the entire application is static HTML, CSS, and vanilla
JavaScript.

**Live simulators:**
- **RC-9100** — Technisonic dual-band radio control head
- **AA95** — Audio Control Panel (SVG + spring physics synthetic renderer)

---

## Repository Layout

```
Off-Line-App/
├── index.html              # PWA home / launcher page
├── rc9100.html             # RC-9100 radio simulator (inline CSS + JS)
├── sw.js                   # Service worker — versioned, offline-first cache
├── manifest.json           # PWA manifest (name, icons, theme colours)
├── codeplug.json           # Radio channel / zone configuration data
├── vercel.json             # Deployment: URL rewrites + cache headers
├── package.json            # Dev dependency: sharp (icon generation only)
├── generate-icons.js       # One-time script: SVG → PNG icon set
├── icons/                  # PWA icon PNG set (16 px – 512 px)
└── aa95/                   # AA95 Audio Control Panel sub-app
    ├── aa95.html           # Panel layout, inline CSS, inline JS controller
    └── aa95-lever.js       # SVG + spring physics lever renderer (external module)
```

---

## Technology Stack

| Layer | Choice |
|---|---|
| Language | Vanilla JavaScript (ES2020+), HTML5, CSS3 |
| Framework | None — no React, Vue, Angular, etc. |
| Build tool | None — no Webpack, Vite, Rollup |
| Styling | Plain CSS with variables, Grid, Flexbox |
| Animation | JS spring physics (requestAnimationFrame) + CSS transitions |
| Offline | Service Worker (cache-first for assets, network-first for HTML) |
| Deployment | Vercel (auto-deploy on push) |
| Dev dependency | `sharp` (icon PNG generation only, not shipped) |

---

## URL Routing

Routing is handled entirely by `vercel.json` rewrites (no client-side router):

| URL | File served |
|---|---|
| `/` | `index.html` |
| `/radio` | `rc9100.html` |
| `/control-panel` | `aa95/aa95.html` |

---

## Service Worker (`sw.js`)

- **Version constant** at the top of the file — increment `CACHE_NAME` whenever
  you want to bust the cache and force clients to fetch fresh assets.
- Strategy: navigation requests use **network-first**; static assets use
  **cache-first**.
- Cache key format: `radio-sim-v<N>`.
- `sw.js` and all `*.html` files are served with `no-cache` headers (see
  `vercel.json`) so the browser always fetches the latest service worker.

**When to bump the version:**
Bump the version suffix in `CACHE_NAME` after any change to cached assets
(JS modules, icons) to ensure existing users get the update.

---

## The AA95 Sub-App (`aa95/`)

### Architecture

The panel is a fully synthetic CSS/SVG simulation — no background photo, no
image assets. All visual components are drawn with CSS gradients, SVG elements,
and DOM manipulation.

```
aa95/
  aa95.html        ← Panel shell: layout, inline CSS, inline JS controller
  aa95-lever.js    ← External module: SVG lever builder + spring physics engine
```

### `aa95.html` — Key Concepts

- **Self-contained** — all panel CSS and controller JS are inline. The only
  external dependency is `aa95-lever.js` loaded via `<script src defer>`.
- **State** lives in a `panelState` object (plain JS). The `syncState()`
  function reads from `panelState` and writes `data-active` attributes to the
  DOM. CSS selectors key off these attributes for visual state changes.
- **Toggles** are `.component.toggle` elements identified by `id`. Clicking
  toggles `panelState[id]` and calls `updateIndicators()` → `syncState()`.
- **Knob rotation** uses mouse drag and wheel events. Pointer delta drives a
  value change; the value maps to a CSS `rotate()` transform on the pointer
  element.
- **Selector knob** snaps to 6 discrete detent positions. Snapping logic lives
  in `setSelAngle(angle, snap)`.
- **Master Check** sequence runs a timed startup simulation with sequential
  status-text updates and LED flash.

### `aa95-lever.js` — Key Concepts

This module replaces the CSS div lever approach with a proper SVG cylinder
driven by real spring physics.

- **`buildSVG(size, color, id)`** — constructs a layered SVG for each lever
  size (`standard`, `radio`, `small`) and color (`silver`, `red`, `orange`).
  Layers: body gradient → specular overlay → top cap ellipse → edge shadows →
  base vignette.
- **`SpringLever` class** — owns one `requestAnimationFrame` loop per lever.
  Each frame applies Hooke's law + viscous damping to compute position, then
  writes `rotateX(Xdeg)` to the SVG element's style. Loop stops when settled.
- **`_updateSpecular()`** — shifts 5 movable SVG gradient stops ±6% as the
  lever angle changes, so the specular highlight band drifts realistically with
  rotation.
- **`MutationObserver`** watches `data-active` on every `.component.toggle[id]`
  element. When the panel JS changes state, the observer fires and calls
  `spring.flip(isOn)`. No changes to `aa95.html`'s JS are required.
- **`prefers-reduced-motion`** — checked at boot. If true, all flips snap
  immediately with no animation.

### Spring Constants (in `aa95-lever.js`)

```javascript
const SPRING = { stiffness: 480, damping: 22, mass: 1.0, threshold: 0.004 };
const ANGLE  = { on: -11, off: 9 };  // rotateX degrees
```

Tuning guide:
- `stiffness` ↑ = faster snap, more overshoot
- `damping` ↑ = less bounce, quicker settle
- `ANGLE.on / ANGLE.off` — the physical throw of the lever in degrees

### 3D Stage

`.assembly-toggle` has `perspective: 2600px` and `transform-style: preserve-3d`.
The SVG lever is a direct child; `rotateX()` applied by JS uses this perspective
context to produce the 3D tilt effect. 2600px = subtle, realistic depth.
Lower values produce more exaggerated fish-eye distortion.

---

## RC-9100 Radio (`rc9100.html`)

- Entirely self-contained — CSS and JavaScript are **inline** inside the HTML
  file (no external `.js` or `.css` imports).
- Channel data is inlined directly in the script (not loaded via `fetch` from
  `codeplug.json` — the JSON file exists as a standalone reference copy).
- The LCD displays update reactively through direct DOM manipulation.
- Volume knobs use scroll-wheel and drag interactions.

---

## `codeplug.json`

Defines the radio's channel and zone structure. Top-level keys:

```json
{
  "band1": { "name": "VHF", "zones": [ ... ] },
  "band2": { "name": "UHF/800", "zones": [ ... ] }
}
```

Zones contain arrays of channel objects `{ "name": "CHANNEL NAME" }`.

---

## PWA Manifest (`manifest.json`)

- `name`: Aviation Simulators
- `short_name`: AvSim
- `start_url`: `/`
- `display`: `standalone`
- Theme colour: `#101010` (dark)
- Icons cover 16 px – 512 px. Regenerate with `npm run generate-icons` if the
  source SVG changes.

---

## Development Workflow

### Local dev server

No build step is required. Serve files with any static server:

```bash
python3 -m http.server 8000
# or
npx serve .
```

Then open `http://localhost:8000`.

### Service worker in dev

Disable the service worker or use DevTools → Application → Service Workers →
"Bypass for network" to avoid stale-cache confusion during development.

### Icon generation (one-time / as-needed)

```bash
npm install          # installs sharp
npm run generate-icons
```

This regenerates all PNGs in `icons/` from the source SVG.

### No linter, no formatter, no test runner

There are no automated checks. Keep code consistent with the surrounding style:
- 2-space indentation
- Single quotes in JavaScript
- `const` / `let`; never `var`
- Descriptive variable names (hardware component naming mirrors the real panel)

---

## Deployment

Vercel deploys automatically on every push to `master`. No manual deploy step.

Cache header policy (`vercel.json`):

| Path | Cache |
|---|---|
| `sw.js`, `*.html` | `no-cache` (always fetch) |
| `/aa95/*.js` | `no-cache` (always fetch — actively developed) |
| `icons/**` | `max-age=31536000, immutable` |
| `manifest.json` | `max-age=86400` (24 h) |

---

## Code Conventions

### HTML
- Use `data-*` attributes for state; avoid toggling classes for binary on/off.
- IDs use `kebab-case` for panel elements, `snake_case` for legacy panel JS
  compatibility.
- Toggle `<div>`s use `class="component toggle"` plus a unique `id`.

### CSS
- Define colours and layout sizes as CSS custom properties (`--var-name`) at
  `:root` or component scope.
- Animation: the lever uses JS spring physics via `aa95-lever.js`. All other
  transitions use CSS `transition` on state-driven properties.
- Knob rotation is expressed as `rotate(Xdeg)` set via inline style from JS.

### JavaScript
- No external libraries at runtime — keep it that way.
- `aa95.html` uses simple `document.getElementById` wrapped in `const $ = id =>`.
- Event listeners: `addEventListener` preferred; `onclick` used in `aa95.html`
  for brevity on simple toggle handlers.
- Prefer `const` for everything that does not need reassignment.
- Mouse events used in `aa95.html`; pointer events preferred for new code.

---

## Key Things to Know Before Editing

1. **No build step** — changes to HTML/CSS/JS are immediately live after a
   browser refresh (with SW bypassed).
2. **Service worker caching** — if assets seem stale, bump the version suffix
   in `CACHE_NAME` in `sw.js`.
3. **AA95 coordinates** — the panel uses a fixed 940 × 314 internal coordinate
   system. All `left`/`top`/`right`/`bottom` positioning on `.component`
   elements is relative to this space.
4. **Lever module is decoupled** — `aa95-lever.js` communicates only through
   `MutationObserver` on `data-active`. Editing the panel JS does not require
   touching the lever module, and vice versa.
5. **Inline code in `rc9100.html`** — CSS and JS inside `rc9100.html` are
   intentionally inline; don't extract them unless there's a clear reason.
6. **Vercel rewrites** — adding a new page requires a new rewrite entry in
   `vercel.json`.
7. **No npm packages at runtime** — `devDependencies` in `package.json` exist
   only for the icon-generation script and are never bundled or shipped.

---

## Branch Strategy

- `master` — production; Vercel deploys from here.
- Feature work on descriptive branches; merge to `master` via PR.

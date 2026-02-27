# CLAUDE.md — Off-Line-App

AI assistant guide for the **Off-Line-App** repository. Covers structure,
conventions, and development workflows.

---

## Project Overview

An **offline-capable Progressive Web App (PWA)** that simulates aviation radio
equipment with photo-realistic UIs. There is no backend, no build step, and no
runtime dependencies — the entire application is static HTML, CSS, and vanilla
JavaScript.

**Live simulators:**
- **RC-9100** — Technisonic dual-band radio control head
- **AA95** — Audio Control Panel (photo-cutout based)

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
├── aa95/                   # AA95 Audio Control Panel sub-app
│   ├── aa95.html           # Panel layout + SVG leader lines
│   ├── panel.js            # Full panel controller (~2 500 lines)
│   ├── styles.css          # Animations, hotspot positioning
│   └── assests/            # Photo cutouts (41 .webp images)
└── README_refactor.md      # Deployment & refactor notes
```

---

## Technology Stack

| Layer | Choice |
|---|---|
| Language | Vanilla JavaScript (ES2020+), HTML5, CSS3 |
| Framework | None — no React, Vue, Angular, etc. |
| Build tool | None — no Webpack, Vite, Rollup |
| Styling | Plain CSS with variables, Grid, Flexbox, clamp() |
| Animation | CSS transitions + transforms; data-attribute-driven state |
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

- **Version constant** at the top of the file — increment it whenever you want
  to bust the cache and force clients to fetch fresh assets.
- Strategy: navigation requests use **network-first**; static assets use
  **cache-first**.
- Cache key format: `offline-app-v<N>`.
- `sw.js` and all `*.html` files are served with `no-cache` headers (see
  `vercel.json`) so the browser always fetches the latest service worker.

**When to bump the version:**
Bump `CACHE_VERSION` in `sw.js` after any change to cached assets (images,
CSS, JS) to ensure existing users get the update.

---

## The AA95 Sub-App (`aa95/`)

This is the most complex part of the codebase.

### Architecture

The panel renders a real hardware photo as the background image. Interactive
elements are positioned on top using CSS absolute positioning relative to an
aspect-ratio container (940 × 314).

```
aa95.html               ← layout shell + SVG connector lines
  └── panel.js          ← all controller logic (loaded as <script src>)
  └── styles.css        ← transitions, hotspot sizing, knob animations
  └── assests/*.webp    ← cutout PNGs/WebPs for individual hardware pieces
```

### `panel.js` — Key Concepts

- **DOM utilities** at the top: `$(sel)`, `$$(sel)`, `$id(id)` — always use
  these instead of `document.querySelector` directly.
- **State** lives on HTML `data-*` attributes (e.g. `data-active`, `data-angle`).
  CSS selectors key off these attributes for visual state (no class toggling for
  binary state).
- **Knob rotation** is driven by a pointer-capture drag pattern:
  `pointerdown` → set capture → track `pointermove` angle → update
  `data-angle` → CSS `rotate(Xdeg)` transform reads the data attribute via
  inline style.
- **Selector knob** snaps to discrete detent positions (6 positions). Snapping
  math lives in the `snapToDetent()` helper.
- **Toggle switches** have two visual states managed via `data-active="true|false"`.
- **Master Check** sequence runs a timed startup simulation with sequential
  status-text updates.

### SVG Leader Lines (`aa95.html`)

`<svg>` sits as an overlay layer between the background photo and the cutout
elements. Each `<line>` or `<polyline>` draws a connector from a label to a
hardware component.

- Coordinates are in the same 940 × 314 viewBox as the panel.
- When moving a hotspot, update both the CSS `left/top` positioning **and**
  the corresponding SVG line endpoint.
- Lines are grouped with comments (`<!-- COM1 -->`, `<!-- FM2 -->`, etc.).

---

## RC-9100 Radio (`rc9100.html`)

- Entirely self-contained — CSS and JavaScript are **inline** inside the HTML
  file (no external `.js` or `.css` imports).
- Channel data is loaded from `codeplug.json` at runtime via `fetch()`.
- The LCD displays update reactively through direct DOM manipulation.
- Volume knobs use the same pointer-capture drag pattern as AA95.

---

## `codeplug.json`

Defines the radio's channel and zone structure. Top-level keys:

```json
{
  "zones": [ ... ],    // Array of zone objects
  "channels": [ ... ]  // Array of channel objects with freq, mode, etc.
}
```

Channels are referenced by index from the zone definitions.

---

## PWA Manifest (`manifest.json`)

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
| `icons/**` | `max-age=31536000, immutable` |
| `aa95/**` (assets) | `max-age=31536000, immutable` |
| `manifest.json` | `max-age=86400` (24 h) |

---

## Code Conventions

### HTML
- Use `data-*` attributes for state; avoid toggling classes for binary on/off.
- IDs use `kebab-case`.
- Hotspot `<div>`s inside the panel container use `class="hotspot"` plus a
  unique `id`.

### CSS
- Define colours and layout sizes as CSS custom properties (`--var-name`) at
  the `:root` or component scope.
- Animation: prefer `transition` on state-driven properties; use `transform`
  and `opacity` for performance.
- Knob rotation is expressed as `rotate(calc(var(--angle) * 1deg))` driven by
  an inline `style` set from JavaScript.

### JavaScript
- No external libraries at runtime — keep it that way.
- DOM queries: always use `$()`, `$$()`, or `$id()` from the utility block.
- Event listeners: `addEventListener` only; no inline `onclick=`.
- Prefer `const` for everything that does not need reassignment.
- Pointer events (`pointerdown`, `pointermove`, `pointerup`) for all drag/knob
  interactions — do not use mouse events.
- `setPointerCapture` / `releasePointerCapture` for drag operations so the
  pointer is not lost when it leaves the element.

---

## Key Things to Know Before Editing

1. **No build step** — changes to HTML/CSS/JS are immediately live after a
   browser refresh.
2. **Service worker caching** — if assets seem stale, bump `CACHE_VERSION` in
   `sw.js`.
3. **AA95 coordinates** — the panel uses a fixed 940 × 314 internal coordinate
   system. All positioning (CSS `left`/`top` as percentages, SVG coordinates)
   must be consistent with this ratio.
4. **Inline code in rc9100.html** — CSS and JS inside `rc9100.html` are
   intentionally inline; don't extract them unless there's a clear reason.
5. **Image format** — hardware cutouts are `.webp`; do not replace with `.png`
   unless targeting environments without WebP support.
6. **Vercel rewrites** — adding a new page requires a new rewrite entry in
   `vercel.json`.
7. **No npm packages at runtime** — `devDependencies` in `package.json` exist
   only for the icon-generation script and are never bundled.

---

## Branch Strategy

- `master` — production; Vercel deploys from here.
- Feature work on descriptive branches; merge to `master` via PR.

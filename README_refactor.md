# AA95 Refactor Drop-in

## What to copy into your repo
- Replace `aa95.html` (new version removes inline JS and loads modular JS)
- Copy the folder `app/aa95/` (new modules)
- Replace `sw.js` (versioned cache + better update behavior)
- Replace `vercel.json` (prevents stale SW/HTML caching on Vercel)

## Local test
Open `aa95.html` through a local server (recommended) so the SW can install:
- `python3 -m http.server 8000`
- visit http://localhost:8000/aa95.html

## Vercel
After deploying, do one hard refresh once. After that, updates should apply reliably.

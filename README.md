# Aviation Simulators PWA

A Progressive Web App featuring interactive aviation equipment simulators for training and reference.

## Simulators

### RC-9100 Dual-Band Radio
Interactive simulation of the Technisonic RC-9100 dual-band radio control head.
- **Dual-Band Display**: Simultaneous Band 1 (VHF) and Band 2 (UHF) channel information
- **Interactive Knob**: Click to cycle modes (CHAN → ZONE → VOL), scroll to adjust values
- **Channel Navigation**: MUP/MDN buttons and knob control for channel selection
- **Band Toggle**: Switch active band with the BAND button
- **Full Codeplug**: VHF (3 zones) and UHF/800 (40 zones) with real channel names

### AA95-729 Audio Control Panel
Interactive simulation of the NAT AA95-729 aircraft audio selector panel.
- **RX Toggle Switches**: COM1, COM2, FM1, FM2, AUX/PA, ADF, DPLR, OFF
- **Audio Routing Diagram**: Visual routing lines showing signal path to COM1 selector
- **COM1 Selector Knob**: NORMAL/LIVE/VOX positions
- **ICS Controls**: ICS CALL button, ICS VOX knob, ICS volume
- **TX Controls**: ISO/EMR toggle, TX toggle, LIVE indicator LED
- **Additional Controls**: MUSIC toggle, PAT ON toggle, PLT/ISO toggles

## Project Structure

```
aviation-simulators/
├── index.html          # Landing page (simulator selection)
├── rc9100.html         # RC-9100 Radio Simulator
├── aa95.html           # AA95 Audio Panel Simulator
├── manifest.json       # PWA manifest
├── sw.js               # Service worker for offline support
├── vercel.json         # Vercel deployment configuration
├── codeplug.json       # RC-9100 channel/zone configuration
├── icons/              # PWA icons (various sizes)
├── generate-icons.js   # Icon generation script
├── package.json
└── README.md
```

## Features

- **Offline Support**: Full PWA functionality for offline use
- **Installable**: Can be installed as a standalone app on mobile and desktop
- **Responsive**: Works on phones, tablets, and desktop browsers
- **No Dependencies**: Pure HTML/CSS/JavaScript, no build step required

## Deployment

### Deploy to Vercel

1. Push this repository to GitHub
2. Connect your GitHub repository to Vercel
3. Deploy with default settings (no build command needed)

Or use the Vercel CLI:

```bash
npm install -g vercel
vercel
```

### Local Development

Simply open `index.html` in a browser, or serve it with any static server:

```bash
npx serve .
```

## PWA Update Behavior

The app uses a "cache new updates upon opening" strategy:
- Browser checks service worker on page load
- Service worker updates cache safely in background
- Next reload uses new assets

Cache version is managed in `sw.js` via `CACHE_NAME`.

## Regenerating Icons

If you modify `icons/icon.svg`, regenerate the PNG icons:

```bash
npm install
npm run generate-icons
```

## License

MIT

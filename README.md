# RC-9100 Simulator

A Progressive Web App (PWA) simulation of the Technisonic RC-9100 dual-band radio control head.

## Features

- **Dual-Band Display**: Simultaneous Band 1 (VHF) and Band 2 (UHF) channel information
- **Interactive Knob**: Click to cycle modes (CHAN → ZONE → VOL), scroll to adjust values
- **Channel Navigation**: MUP/MDN buttons and knob control for channel selection
- **Band Toggle**: Switch active band with the BAND button (triangle indicator shows active band)
- **Zone Control**: Adjust zones with ZnUp/ZnDn buttons
- **Mute Toggle**: Quick mute with the Mute button
- **Brightness Control**: BRT/DIM buttons for display brightness
- **Offline Support**: Full PWA functionality for offline use
- **Installable**: Can be installed as a standalone app on mobile and desktop

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

## Project Structure

```
rc9100-simulator/
├── index.html          # Main application
├── manifest.json       # PWA manifest
├── sw.js              # Service worker for offline support
├── vercel.json        # Vercel deployment configuration
├── icons/             # PWA icons (various sizes)
│   ├── icon.svg       # Source SVG icon
│   ├── icon-16.png
│   ├── icon-32.png
│   ├── icon-72.png
│   ├── icon-96.png
│   ├── icon-128.png
│   ├── icon-144.png
│   ├── icon-152.png
│   ├── icon-192.png
│   ├── icon-384.png
│   └── icon-512.png
├── generate-icons.js  # Icon generation script
├── package.json
└── README.md
```

## Regenerating Icons

If you modify `icons/icon.svg`, regenerate the PNG icons:

```bash
npm install
npm run generate-icons
```

## Controls

| Button | Function |
|--------|----------|
| HOME | Reset to CHAN mode |
| BAND | Toggle active band (VHF/UHF) |
| MUP/MDN | Change channel in active band |
| ZnUp/ZnDn | Adjust zone number |
| Mute | Toggle mute |
| BRT/DIM | Adjust brightness |
| Knob Click | Cycle: CHAN → ZONE → VOL |
| Knob Scroll | Adjust current mode value |

## Codeplug Configuration

The simulator includes a sample codeplug with VHF and UHF channels. To customize, edit the `codeplug` object in `index.html`.

## License

MIT

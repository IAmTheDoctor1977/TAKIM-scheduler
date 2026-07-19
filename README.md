# Kitchen Queue

A weekly pickleball scheduler: mark who's free, auto-generate the lineup for each day, and track the court-pass payment rotation. Data is saved in your browser (localStorage), so it persists between visits on the same device/browser.

## Run it locally

```bash
npm install
npm run dev
```

Then open the local URL it prints (usually http://localhost:5173).

## Build for production

```bash
npm run build
```

Output goes to `dist/`.

## Deploy for free with GitHub Pages

```bash
npm install --save-dev gh-pages
```

Add to `package.json` scripts:
```json
"deploy": "npm run build && gh-pages -d dist"
```

Then:
```bash
npm run deploy
```

Turn on Pages in your repo's Settings → Pages → set source to the `gh-pages` branch.

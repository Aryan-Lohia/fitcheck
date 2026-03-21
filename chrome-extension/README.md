# FitCheck Chrome extension

Adds a **Run Fit Check** floating button on **Myntra** and **Ajio** product detail pages. When you confirm, it opens your FitCheck app in a new tab at `/dashboard?import=<current page URL>`. The web app imports the product (if you are signed in) or sends you through login first, then completes the import.

## Privacy

- The extension only injects UI on `https://www.myntra.com/*` and `https://www.ajio.com/*`.
- **No** product URL is sent anywhere until you click **Continue** in the dialog. Then only a normal browser navigation to your configured FitCheck origin happens (same as pasting the link in the app).

## Configure the app URL

1. Copy `.env.example` to `.env`.
2. Set `VITE_FITCHECK_APP_ORIGIN` to your deployed origin, **no trailing slash** (for example `https://app.example.com`).
3. Rebuild.

```bash
cp .env.example .env
# edit .env
npm run build
```

Default when unset is `http://localhost:3000` (local FitCheck dev server).

## Build

```bash
npm install
npm run build
```

Output is in **`dist/`**. Load it in Chrome:

1. `chrome://extensions`
2. Enable **Developer mode**
3. **Load unpacked** → select the `dist` folder

## Chrome Web Store

1. Run `npm run build` with production `VITE_FITCHECK_APP_ORIGIN` in `.env`.
2. Zip the **contents** of `dist/` (so `manifest.json` is at the root of the zip), not the `dist` folder name itself.
3. In the [Developer Dashboard](https://chrome.google.com/webstore/devconsole), create an item and upload the zip.

**Host permissions:** The extension requests access only to `www.myntra.com` and `www.ajio.com` so the content script can run on those pages. State that in the store listing and the privacy questionnaire.

**Single purpose:** Help users send the current PDP URL to FitCheck for import.

## Development

- `npm run check` — TypeScript check.
- Icons are generated with `sharp` in `npm run generate-icons` (runs automatically before `build`). Replace files under `icons/` with branded assets before a public release if you prefer.

## PDP detection

- **Myntra:** path ends with `/<numeric-id>/buy` (standard PDP URL).
- **Ajio:** path contains `/p/` with a product segment.

Listing/search URLs do not show the button.

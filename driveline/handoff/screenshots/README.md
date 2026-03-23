# Client screenshots (DriveLine)

PNG exports of each main page for presentations or sign‑off.

## Generate automatically (recommended)

1. **Start the app** (development server):

   ```bash
   npm start
   ```

2. **Install Chromium for Playwright** (one time per machine):

   ```bash
   npx playwright install chromium
   ```

3. In another terminal, from the `driveline` folder:

   ```bash
   npm run screenshots:client
   ```

Images are written here as `01-home.png`, `02-used-cars.png`, etc.

**Layout:** captures use a **1920×1080** laptop viewport, desktop Chrome user-agent, **`prefers-reduced-motion: reduce`**, and **no cookie banner** (consent is pre-set in localStorage). After each load, any `.reveal-init` blocks get `.reveal-visible` so scroll-reveal sections are not left invisible (that used to show as a huge empty band on full-page home screenshots in headless Chrome).

To capture a **deployed** preview instead of localhost:

```bash
BASE_URL=https://your-site.example.com npm run screenshots:client
```

## Manual option (no Playwright)

1. Open the site in Chrome.
2. Visit each route (Home, Cars, Vans, a vehicle detail, Finance, …).
3. **Full page:** DevTools → `Cmd+Shift+P` → “Capture full size screenshot”.
4. Or use an extension such as “GoFullPage”.

---

If vehicle `10370` is missing in your local data, change the ID in `scripts/capture-client-screenshots.mjs` to any valid stock ID from your feed.

# DriveLine Car Sales: project context for coding agents

Read this before changing anything. It records how the site works, how it is tested and
deployed, and the rules the owner (Saeed) expects. Last updated 2026-11-25.

## 1. What this is

- **Live site:** https://drivelinecarsales.co.uk. A used-car dealer website for DriveLine Car Sales in Peterborough, UK.
- **Repository:** GitHub `saeedmurrad/driveline`, branch `main`.
  - The git root is `/Users/saeedmurrad/StudioProjects/cursor`.
  - The app lives in **`driveline/`**. Run every npm command from there.
- **Deploys:** every push to `main` deploys to GitHub Pages through `.github/workflows/deploy-github-pages.yml` (at the git root). There is no staging site, so whatever you push is live within about 2 minutes.
- **Stock:** the cars come from the dealer's adverts on fengatecarsales.co.uk (stock API). They are fetched by script and baked into `src/app/data/vehicles.data.ts`.
- **Folders that are not the app** (ignore them):
  - `../divinebytes/` (another project)
  - `dist/` (build output)
  - `platform/` and `data/platform` (an older multi-dealer platform mode, not used by the live site)
  - `.claude/`

## 2. Stack

- **Front end:** Angular 21. Zoneless, signals, standalone components, `@defer`, `afterNextRender`. Tailwind CSS, with themes driven by CSS variables.
- **Build:** server-side prerender to static files (`npm run build:gh-pages`). After building, copy `dist/driveline/browser/index.csr.html` to `404.html`; CI does this too.
  - Hydration is on, so the first browser render must match the prerendered HTML. That is why state from localStorage (theme, saved cars, alerts) loads in `afterNextRender`.
- **Installable app (PWA):** `@angular/service-worker`, configured in `ngsw-config.json`. Pages use the "freshness" strategy. `PwaService` handles install, the offline notice and update reloads.
- **Firebase** (project `driveline-car-sales`), loaded lazily, used for two things only:
  - **Firestore `leads/`:** every enquiry form saves here, and staff see them in `/hub`. Who may read them is set in `firestore.rules`, through the `staff/{uid}` list.
  - **Firestore `stats/`:** anonymous daily visit counts, with no cookies.
  - **Firebase Auth:** staff sign-in to `/hub`.
- **Cloudflare worker:** `workers/dvla-ves-proxy/`, live at https://driveline-dvla-ves-proxy.snatechltd.workers.dev, on Cloudflare account snatechltd@gmail.com. It handles:
  - `POST /`: DVLA Vehicle Enquiry Service lookup.
  - `GET /mot/{reg}`: DVSA MOT history, cached for 12 hours.
  - `GET /health`: reports which services are set up.
  - `POST /push/*`: alerts (web push), in `push.js`. Sign-ups are stored in the KV namespace `PUSH_KV`.
  - Only the DriveLine site may call it from a browser; other origins get 403.

## 3. Main parts of the site

**Pages** (`src/app/pages/`): home, cars and vans list, car page (`vehicle/:id`), finance, warranty, sell your car, part exchange, MOT check (`mot-check`), reviews, contact, FAQ, delivery, saved, compare, make pages (`used-cars/:make`), legal pages, and the staff hub (`/hub`).

**Themes** (`ThemeService`, `src/styles.css`). These are three different designs, not just colour sets:
- **Default:** rose/stone.
- **Prestige:** editorial look. It has its own home page in `pages/home/prestige/` with a WebGL hero film, and its own fonts (Archivo, Inter, JetBrains Mono).
- **Forecourt:** motorsport look, charcoal and signal red. It has its own home page in `pages/home/forecourt/` with a showcase slider, ticker, finder, timeline and finance tabs, and its own fonts (Barlow Condensed and Barlow).

How themes are switched:
- `html[data-theme]` holds the theme, and the choice is saved under the `dlTheme` localStorage key.
- An inline script in `index.html` applies it before the first paint.
- `data-theme-only="…"` and `data-theme-hide="…"` take space-separated theme lists.
- **Default must not change** unless the task is explicitly about Default.

**Car page features:**
- Gallery
- Finance calculator (illustrative HP: 9.9% APR, no deposit, 36/48/60 months; see `utils/finance-display.ts`)
- Running costs
- MOT history tab
- Official DVLA/DVSA records panel
- Delivery check
- Test drive, reserve and video viewing requests (no payment is taken)
- Part exchange form with a reg lookup
- Print sheet with QR code
- Price alert button

**Stock list:**
- Filters, including **max per month** (`maxMonthly`, kept in the page address).
- Compare tray and saved cars.
- New-arrival alert button for the search in force.

**Alerts** (live since 2026-11-24):
- `AlertsService` and `components/shared/alert-button` handle the site side; the worker's `push.js` sends the notifications.
- **Visitors:** a price drop on a car they follow, or a new arrival that matches a saved search.
- **Staff:** "Turn on alerts" in the hub gives that device a notification for every new enquiry. The notification shows the type only, never customer details.
- **Customer alerts only go out when someone runs `npm run alerts:send`** after a stock sync has been committed and deployed. It compares the last two commits of `vehicles.data.ts`, and the worker never announces the same sync twice.
- On iPhone and iPad, alerts work only when the site is installed to the Home Screen.

**Stock sync:** `npm run sync:stock` runs fetch, then price history (genuine "Reduced" labels), DVLA/DVSA verification, photo filtering, tagging and optimising, share images and the sitemap. It is manual. Then commit and push.
- 29 adverts show a mileage lower than the last MOT reading. The owner is fixing them at source; the site shows the official reading as information.

## 4. Commands (run in `driveline/`)

```bash
npm ci
npx ng serve                                  # dev server
npx ng test --watch=false                     # unit tests (47)
npm run test:worker                           # Cloudflare worker tests (21)
npm run build:gh-pages && cp dist/driveline/browser/index.csr.html dist/driveline/browser/404.html
node scripts/serve-dist.mjs                   # serve the build like GitHub Pages on :4310
```

## 5. Testing before EVERY deploy (the owner insists on this)

Build, serve on port 4310, then run all of these. Use Chrome **and** WebKit (Safari's engine); desktop Chrome's phone mode misses iPhone problems.

- **Unit tests:** `npx ng test --watch=false`, and `npm run test:worker` if the worker changed.
- **Layout:** `node scripts/layout-audit.mjs` with `ENGINE=webkit`, run for each `THEME=` (empty, `prestige`, `forecourt`). Covers 22 pages and 9 widths from 360 to 2560.
- **Accessibility:** `node scripts/a11y-check.mjs` for each `THEME=`. It must report 0 issues.
- **Pop-ups and forms:** `node scripts/interaction-audit.mjs` for each `SITE_THEME=`. Include short screens with `WIDTHS=360x560,844x390`, because the phone menu must scroll inside itself. **Any global CSS change needs this audit too.**
- **End to end:** `scripts/e2e-site-check.mjs` (129 checks), run against the Firebase emulators so no test enquiry reaches the live database:
  ```bash
  export JAVA_HOME=/opt/homebrew/opt/openjdk@21 PATH="/opt/homebrew/opt/openjdk@21/bin:$PATH"
  npx firebase emulators:exec --config firebase.alt-ports.json --only auth,firestore --project driveline-car-sales \
    "FIRESTORE_EMULATOR_HOST=127.0.0.1:8380 FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9399 node scripts/e2e-site-check.mjs"
  ```
  Use `firebase.alt-ports.json` when ports 8080 or 9099 are taken by another project's emulators. Never stop those emulators.
- **Installable app:** `npm run test:pwa` (42 checks: install, offline, update). Every other script blocks the service worker on purpose.
- **Default theme unchanged:** `scripts/style-snapshot.mjs --diff` proves Default looks the same.
- **Alerts:** `scripts/alerts-check.mjs` sends real notifications in a visible Chrome window against a local copy of the worker (`scripts/local-push-worker.mjs`, which reads `workers/dvla-ves-proxy/.dev.vars`). After a deploy, `scripts/alerts-live-check.mjs` checks the live site and removes its own test sign-up.
- **MOT band, MOT check page and "Look up" button:** these only render in a build where `dvlaLookupUrl` is set.
  1. Temporarily point `src/environments/environment.github-pages.ts` at `http://127.0.0.1:4320`.
  2. Build to `dist/e2e-vehicle-check`, then restore the file.
  3. Serve the build on 4311 and `scripts/mock-vehicle-apis.mjs` on 4320.
  4. Run `scripts/e2e-vehicle-check.mjs` with `BASE_URL=http://127.0.0.1:4311`.

  Without this, audits on the normal build report "scope not found: app-vehicle-check-band"; that report is expected.

After pushing, watch the deploy with `gh run watch`, then check the live site (for example `BASE_URL=https://drivelinecarsales.co.uk` with the layout audit or the budget and alerts checks).

## 6. Deploying

- **Website:** commit in `driveline/`, then push to `main`. The GitHub account is `saeedmurrad`:
  ```bash
  T=$(gh auth token --user saeedmurrad)
  git push "https://x-access-token:${T}@github.com/saeedmurrad/driveline.git" HEAD:main
  ```
  CI injects the worker URL (secret `DVLA_LOOKUP_URL`) and checks `/health` before turning on the lookup button.
- **Worker:** run `npx wrangler deploy` in `workers/dvla-ves-proxy/` (Cloudflare account snatechltd@gmail.com).
  - Its secrets are `DVLA_API_KEY`, `MOT_CLIENT_ID`, `MOT_CLIENT_SECRET`, `MOT_TOKEN_URL`, `MOT_API_KEY`, `VAPID_PRIVATE_JWK` and `PUSH_ADMIN_KEY`. They live only on Cloudflare; never put them in the repo or print them.
  - Check it with `curl -H "Origin: https://drivelinecarsales.co.uk" https://driveline-dvla-ves-proxy.snatechltd.workers.dev/health`, which should return `{"dvla":true,"mot":true,"push":true}`.
  - The DVSA MOT key must be used at least every 90 days; the live car pages do that.
- **Firestore rules:** `npm run deploy:rules`. The Firebase account is saeedmurrad@gmail.com.
- **Local secret files** (git-ignored; **never delete them**):
  - `.env.push-admin.local`: the admin key for `alerts:send`.
  - `workers/dvla-ves-proxy/.env.vapid-private.local`: the alert signing key. Making a new pair switches off alerts for everyone who signed up.
  - `workers/dvla-ves-proxy/.dev.vars`: local worker secrets.

## 7. Rules from the owner (must follow)

- **Never delete any of Saeed's data without asking first and getting an explicit "yes"** for that specific deletion: files, folders, database records, branches, commits and cloud resources. That includes `rm`, `git reset --hard`, `git clean`, `git checkout -- .`, force-push and overwriting without a backup. Testing is no exception: never wipe or overwrite real data.
- **Never send test enquiries or forms to the live database.** Use the emulators.
- **Never commit these:**
  - `scripts/firebase-deploy-apphosting.sh` (local edits)
  - `.firebaseignore`, `.claude/`, `STOCK-CHECK-REPORT.md`
  - anything in `../divinebytes/`
  - `../TECHNICAL_INTERVIEW_PREP_200_PLUS_QA.md`
  - any secret file
- **A "theme" or "redesign" means a different design:** its own components, section layouts, image treatment and animations, built with DriveLine's real content. A recolour with new fonts is not a theme. Never invent numbers, reviews or claims.
- **Test everything before saying it is done, and verify on the live site after deploying.** Report test failures honestly.
- **Keep load low on the Mac:** at most two test streams at once and no multi-agent swarms. Heavy parallel runs have frozen it before. Shut down any iOS simulator you boot.
- **Saeed writes in Hindi/Urdu/English.** Reply in plain English with short progress updates during long work; long silence annoys him.
- **Deposit amounts, refund terms, finance wording, price promises or guarantees** must be approved by the dealer before going live (FCA and consumer-law sensitive).

## 8. Open items and ideas (not built)

- **Paid reservation with a refundable deposit:** needs a Stripe account plus the owner's amount and refund terms.
- **Finance eligibility (soft search):** needs the dealer's finance broker tool and FCA number. The FCA number is still missing from the site.
- **Instant part-exchange price:** needs a paid valuation data service.
- **Live Google review score:** needs a Google API key.
- **Automatic stock sync on a timer,** which could also run `alerts:send` automatically.
- **Buying guides and a blog** for local search traffic, plus pages for paint protection, extended warranty and sale-or-return if the dealer offers them.
- **Email alerts for enquiries** (staff get push notifications only today); this would need an email-sending account.
- **Presentation plan for the owner:** a Claude artifact at https://claude.ai/artifact/McqWAFQQKMyDomMAQRmTh3 (private to Saeed).

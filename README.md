# Cursor workspace

This repository contains the **DriveLine** dealership website (Angular).

## DriveLine app

```bash
cd driveline
npm install
npm start
```

See **[driveline/README.md](driveline/README.md)** for build commands, DVLA registration lookup setup, and deployment notes.

## Remote

Pushed to: `https://github.com/saeedmurrad/driveline.git`

## GitHub Pages

After each push to **`main`**, [`.github/workflows/deploy-github-pages.yml`](.github/workflows/deploy-github-pages.yml) builds the Angular app and deploys the static **`browser`** output.

1. In the GitHub repo: **Settings → Pages → Build and deployment → Source**: choose **GitHub Actions**.
2. Live site (project page): **`https://saeedmurrad.github.io/driveline/`**

Notes:

- This is a **static** deploy (no Node SSR). Client-side routing uses a copied **`404.html`** (same as `index.html`).
- **DVLA registration lookup** stays disabled on Pages unless you add a proxy URL in [`driveline/src/environments/environment.prod.ts`](driveline/src/environments/environment.prod.ts).

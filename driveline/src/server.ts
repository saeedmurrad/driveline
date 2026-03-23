import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express from 'express';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/** Load repo-root `.env` when running SSR (`node dist/.../server.mjs` from project root). */
function loadRepoDotEnv(): void {
  try {
    const envPath = join(process.cwd(), '.env');
    if (!existsSync(envPath)) return;
    const raw = readFileSync(envPath, 'utf8');
    for (const line of raw.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      let val = trimmed.slice(eq + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (process.env[key] === undefined) {
        process.env[key] = val;
      }
    }
  } catch {
    /* ignore missing or unreadable .env */
  }
}

loadRepoDotEnv();

const DVLA_VES_URL =
  'https://driver-vehicle-licensing.api.gov.uk/vehicle-enquiry/v1/vehicles';

const browserDistFolder = join(import.meta.dirname, '../browser');

const app = express();
const angularApp = new AngularNodeAppEngine();

app.use(express.json({ limit: '24kb' }));

/**
 * Server-side proxy for [DVLA Vehicle Enquiry Service](https://developer-portal.driver-vehicle-licensing.api.gov.uk/apis/vehicle-enquiry-service/vehicle-enquiry-service-description.html).
 * Uses `x-api-key` from the incoming request (from `environment.dvlaApiKey` in the app) and/or
 * `DVLA_API_KEY` in `.env` / the environment.
 */
app.post('/api/dvla-vehicle', async (req, res) => {
  const headerKey = req.headers['x-api-key'];
  const fromClient =
    (typeof headerKey === 'string' && headerKey.trim()) ||
    (Array.isArray(headerKey) && headerKey[0]?.trim()) ||
    '';
  const apiKey = fromClient || process.env['DVLA_API_KEY']?.trim();
  if (!apiKey) {
    res.status(503).json({
      errors: [
        {
          status: '503',
          title: 'Service unavailable',
          detail:
            'DVLA key missing. Set dvlaApiKey in environment and/or DVLA_API_KEY in .env.',
        },
      ],
    });
    return;
  }

  const reg = req.body?.registrationNumber;
  if (typeof reg !== 'string' || !reg.trim()) {
    res.status(400).json({
      errors: [
        {
          status: '400',
          title: 'Bad request',
          detail: 'Body must include registrationNumber (string).',
        },
      ],
    });
    return;
  }

  const registrationNumber = reg.replace(/\s+/g, '').toUpperCase();

  try {
    const upstream = await fetch(DVLA_VES_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'x-api-key': apiKey,
      },
      body: JSON.stringify({ registrationNumber }),
    });

    const text = await upstream.text();
    const ct = upstream.headers.get('content-type') || 'application/json';
    res.status(upstream.status).type(ct).send(text);
  } catch {
    res.status(502).json({
      errors: [
        {
          status: '502',
          title: 'Bad gateway',
          detail: 'Could not reach DVLA Vehicle Enquiry Service.',
        },
      ],
    });
  }
});

/**
 * Serve static files from /browser
 */
app.use(
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: false,
    redirect: false,
  }),
);

/**
 * Handle all other requests by rendering the Angular application.
 */
app.use((req, res, next) => {
  angularApp
    .handle(req)
    .then((response) =>
      response ? writeResponseToNodeResponse(response, res) : next(),
    )
    .catch(next);
});

/**
 * Start the server if this module is the main entry point, or it is ran via PM2.
 * The server listens on the port defined by the `PORT` environment variable, or defaults to 4000.
 */
if (isMainModule(import.meta.url) || process.env['pm_id']) {
  const port = process.env['PORT'] || 4000;
  app.listen(port, (error) => {
    if (error) {
      throw error;
    }

    console.log(`Node Express server listening on http://localhost:${port}`);
  });
}

/**
 * Request handler used by the Angular CLI (for dev-server and during build) or Firebase Cloud Functions.
 */
export const reqHandler = createNodeRequestHandler(app);

/**
 * Cloudflare Worker: proxy Vehicle Enquiry Service so GitHub Pages (or any static site)
 * can call DVLA without browser CORS blocking.
 *
 * Deploy: wrangler deploy (set DVLA_API_KEY in worker secrets OR forward client x-api-key)
 * @see https://developer-portal.driver-vehicle-licensing.api.gov.uk/
 */

const UPSTREAM =
  'https://driver-vehicle-licensing.api.gov.uk/vehicle-enquiry/v1/vehicles';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, HEAD, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Accept, x-api-key',
  'Access-Control-Max-Age': '86400',
};

/** Browsers (and “open URL”) use GET — DVLA only accepts POST via this proxy. */
const GET_INFO = JSON.stringify({
  ok: true,
  service: 'DVLA Vehicle Enquiry CORS proxy',
  message:
    'This endpoint is for POST requests only (same as the DVLA API). Opening it in a tab sends GET, which does not call DVLA.',
  usage: {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': 'Your DVLA API key (or set DVLA_API_KEY on the worker)',
    },
    body: { registrationNumber: 'AB12CDE' },
  },
});

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    if (request.method === 'GET') {
      return new Response(GET_INFO, {
        status: 200,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json; charset=utf-8' },
      });
    }

    if (request.method === 'HEAD') {
      return new Response(null, {
        status: 200,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ errors: [{ title: 'Method not allowed' }] }), {
        status: 405,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    const fromClient = request.headers.get('x-api-key');
    const apiKey =
      (fromClient && fromClient.trim()) || env.DVLA_API_KEY?.trim() || '';

    if (!apiKey) {
      return new Response(
        JSON.stringify({
          errors: [
            {
              status: '503',
              title: 'Service unavailable',
              detail: 'DVLA API key missing on worker (set DVLA_API_KEY secret or send x-api-key).',
            },
          ],
        }),
        {
          status: 503,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        },
      );
    }

    const body = await request.text();

    try {
      const upstream = await fetch(UPSTREAM, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'x-api-key': apiKey,
        },
        body,
      });

      const text = await upstream.text();
      const ct = upstream.headers.get('content-type') || 'application/json';

      return new Response(text, {
        status: upstream.status,
        headers: {
          ...CORS_HEADERS,
          'Content-Type': ct,
        },
      });
    } catch {
      return new Response(
        JSON.stringify({
          errors: [
            {
              status: '502',
              title: 'Bad gateway',
              detail: 'Could not reach DVLA Vehicle Enquiry Service.',
            },
          ],
        }),
        {
          status: 502,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        },
      );
    }
  },
};

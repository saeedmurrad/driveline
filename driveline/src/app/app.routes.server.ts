import { RenderMode, ServerRoute } from '@angular/ssr';
import { environment } from '../environments/environment';
import { VEHICLES } from './data/vehicles.data';
import { makeSlug } from './utils/make-slug';

export const serverRoutes: ServerRoute[] = [
  // Static (GitHub Pages) builds bake stock into the app, so every vehicle gets a real,
  // crawlable page. Platform builds load stock from the API at runtime instead.
  environment.useStaticData
    ? {
        path: 'vehicle/:id',
        renderMode: RenderMode.Prerender,
        getPrerenderParams: async () => VEHICLES.map((v) => ({ id: v.id })),
      }
    : {
        path: 'vehicle/:id',
        renderMode: RenderMode.Client,
      },
  {
    path: 'used-cars/:make',
    renderMode: RenderMode.Prerender,
    getPrerenderParams: async () =>
      [...new Set(VEHICLES.filter((v) => v.status !== 'sold').map((v) => makeSlug(v.make)))].map((make) => ({ make })),
  },
  {
    path: 'legal/:page',
    renderMode: RenderMode.Prerender,
    getPrerenderParams: async () => [
      { page: 'privacy-policy' },
      { page: 'cookie-policy' },
      { page: 'disclaimer' },
      { page: 'sitemap' },
    ],
  },
  // Staff area: rendered in the browser only (sign-in state, live data).
  { path: 'hub', renderMode: RenderMode.Client },
  { path: 'hub/**', renderMode: RenderMode.Client },
  {
    path: '**',
    renderMode: RenderMode.Prerender,
  },
];

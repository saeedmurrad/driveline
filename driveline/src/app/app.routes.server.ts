import { RenderMode, ServerRoute } from '@angular/ssr';
import { environment } from '../environments/environment';
import { VEHICLES } from './data/vehicles.data';

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

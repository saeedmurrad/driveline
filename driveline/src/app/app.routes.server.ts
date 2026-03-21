import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  {
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
  {
    path: '**',
    renderMode: RenderMode.Prerender,
  },
];

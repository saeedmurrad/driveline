import { Routes } from '@angular/router';
import { hubAuthGuard, hubGuestGuard } from './guards/hub-auth.guard';
import { environment } from '../environments/environment';

/** Static (GitHub Pages) site: /hub is the DriveLine enquiries inbox on Firebase. */
const leadsHub: Routes[number] = {
  path: 'hub',
  children: [
    {
      path: '',
      loadComponent: () =>
        import('./pages/hub/hub-leads/hub-leads').then((m) => m.HubLeadsComponent),
      data: { seo: { title: 'Hub | DriveLine', description: 'DriveLine staff area.' } },
    },
    { path: '**', redirectTo: '' },
  ],
};

export const routes: Routes = [
  environment.firebase ? leadsHub : {
    path: 'hub',
    children: [
      {
        path: 'login',
        loadComponent: () =>
          import('./pages/hub/hub-login/hub-login').then((m) => m.HubLoginComponent),
        canActivate: [hubGuestGuard],
      },
      {
        path: '',
        loadComponent: () =>
          import('./pages/hub/hub-shell/hub-shell').then((m) => m.HubShellComponent),
        canActivate: [hubAuthGuard],
        children: [
          { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
          {
            path: 'dashboard',
            loadComponent: () =>
              import('./pages/hub/hub-dashboard/hub-dashboard').then(
                (m) => m.HubDashboardComponent,
              ),
          },
          {
            path: 'site',
            loadComponent: () =>
              import('./pages/hub/hub-site/hub-site').then((m) => m.HubSiteComponent),
          },
          {
            path: 'stock',
            loadComponent: () =>
              import('./pages/hub/hub-stock/hub-stock').then((m) => m.HubStockComponent),
          },
          {
            path: 'enquiries',
            loadComponent: () =>
              import('./pages/hub/hub-enquiries/hub-enquiries').then(
                (m) => m.HubEnquiriesComponent,
              ),
          },
          {
            path: 'dealers',
            loadComponent: () =>
              import('./pages/hub/hub-dealers/hub-dealers').then(
                (m) => m.HubDealersComponent,
              ),
          },
        ],
      },
    ],
  },
  {
    path: '',
    loadComponent: () =>
      import('./pages/home/home').then((m) => m.HomeComponent),
    data: {
      seo: {
        titleKey: 'home',
        descriptionKey: 'home',
      },
    },
  },
  {
    path: 'cars',
    loadComponent: () =>
      import('./pages/vehicles/vehicles').then((m) => m.VehiclesComponent),
    data: {
      category: 'car',
      seo: { titleKey: 'cars', descriptionKey: 'cars' },
    },
  },
  {
    path: 'vans',
    loadComponent: () =>
      import('./pages/vehicles/vehicles').then((m) => m.VehiclesComponent),
    data: {
      category: 'van',
      seo: { titleKey: 'vans', descriptionKey: 'vans' },
    },
  },
  {
    path: 'vehicle/:id',
    loadComponent: () =>
      import('./pages/vehicle-detail/vehicle-detail').then(
        (m) => m.VehicleDetailComponent,
      ),
    data: {
      seo: { titleKey: 'vehicle', descriptionKey: 'vehicle', managed: true },
    },
  },
  {
    path: 'finance',
    loadComponent: () =>
      import('./pages/finance/finance').then((m) => m.FinanceComponent),
    data: {
      seo: { titleKey: 'finance', descriptionKey: 'finance' },
    },
  },
  {
    path: 'warranty',
    loadComponent: () =>
      import('./pages/warranty/warranty').then((m) => m.WarrantyComponent),
    data: {
      seo: { titleKey: 'warranty', descriptionKey: 'warranty' },
    },
  },
  {
    path: 'sell-your-car',
    loadComponent: () =>
      import('./pages/sell-your-car/sell-your-car').then(
        (m) => m.SellYourCarComponent,
      ),
    data: {
      seo: { titleKey: 'sell', descriptionKey: 'sell' },
    },
  },
  {
    path: 'reviews',
    loadComponent: () =>
      import('./pages/reviews/reviews').then((m) => m.ReviewsComponent),
    data: {
      seo: { titleKey: 'reviews', descriptionKey: 'reviews' },
    },
  },
  {
    path: 'contact',
    loadComponent: () =>
      import('./pages/contact/contact').then((m) => m.ContactComponent),
    data: {
      seo: { titleKey: 'contact', descriptionKey: 'contact' },
    },
  },
  {
    path: 'saved',
    loadComponent: () => import('./pages/saved/saved').then((m) => m.SavedComponent),
    data: {
      seo: {
        title: 'Saved vehicles | DriveLine',
        description: 'The vehicles you have saved at DriveLine Car Sales, Peterborough.',
      },
    },
  },
  {
    path: 'compare',
    loadComponent: () => import('./pages/compare/compare').then((m) => m.CompareComponent),
    data: {
      seo: {
        title: 'Compare vehicles | DriveLine',
        description: 'Compare used cars and vans from DriveLine side by side: price, mileage, economy, tax and more.',
      },
    },
  },
  {
    path: 'faq',
    loadComponent: () => import('./pages/info/faq').then((m) => m.FaqComponent),
    data: {
      seo: {
        title: 'FAQ: buying, finance, warranty and delivery | DriveLine',
        description: 'Answers to common questions about buying a used car or van from DriveLine in Peterborough: reserving, test drives, finance, warranty, part exchange and delivery.',
      },
    },
  },
  {
    path: 'mot-check',
    loadComponent: () => import('./pages/vehicle-check/vehicle-check').then((m) => m.VehicleCheckComponent),
    data: {
      seo: {
        title: 'Free MOT history check and DVLA vehicle details | DriveLine',
        description: 'Check any UK vehicle free: full MOT history with advisories and mileage record from the DVSA, plus tax, MOT status and official DVLA details. Instant, no sign-up.',
      },
    },
  },
  {
    path: 'delivery',
    loadComponent: () => import('./pages/info/delivery').then((m) => m.DeliveryComponent),
    data: {
      seo: {
        title: 'UK delivery and video viewings | DriveLine',
        description: 'Buy a used car from DriveLine without visiting: video viewing on WhatsApp or FaceTime, reserve with no online payment, and delivery across the UK.',
      },
    },
  },
  {
    path: 'part-exchange',
    loadComponent: () => import('./pages/info/part-exchange').then((m) => m.PartExchangeInfoComponent),
    data: {
      seo: {
        title: 'How part exchange works | DriveLine',
        description: 'Part exchange your car at DriveLine, Peterborough: a fair valuation, put it against your next car, and we can collect it from you.',
      },
    },
  },
  {
    path: 'used-cars/:make',
    loadComponent: () => import('./pages/makes/make-page').then((m) => m.MakePageComponent),
    data: { seo: { managed: true } },
  },
  {
    path: 'legal/:page',
    loadComponent: () =>
      import('./pages/legal/legal').then((m) => m.LegalComponent),
    data: {
      seo: { titleKey: 'legal', descriptionKey: 'legal' },
    },
  },
  {
    path: '**',
    redirectTo: '',
  },
];

import { Routes } from '@angular/router';
import { hubAuthGuard, hubGuestGuard } from './guards/hub-auth.guard';

export const routes: Routes = [
  {
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
      seo: { titleKey: 'vehicle', descriptionKey: 'vehicle' },
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

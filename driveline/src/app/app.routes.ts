import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/home/home').then((m) => m.HomeComponent),
  },
  {
    path: 'cars',
    loadComponent: () =>
      import('./pages/vehicles/vehicles').then((m) => m.VehiclesComponent),
    data: { category: 'car' },
  },
  {
    path: 'vans',
    loadComponent: () =>
      import('./pages/vehicles/vehicles').then((m) => m.VehiclesComponent),
    data: { category: 'van' },
  },
  {
    path: 'vehicle/:id',
    loadComponent: () =>
      import('./pages/vehicle-detail/vehicle-detail').then(
        (m) => m.VehicleDetailComponent
      ),
  },
  {
    path: 'finance',
    loadComponent: () =>
      import('./pages/finance/finance').then((m) => m.FinanceComponent),
  },
  {
    path: 'warranty',
    loadComponent: () =>
      import('./pages/warranty/warranty').then((m) => m.WarrantyComponent),
  },
  {
    path: 'sell-your-car',
    loadComponent: () =>
      import('./pages/sell-your-car/sell-your-car').then(
        (m) => m.SellYourCarComponent
      ),
  },
  {
    path: 'reviews',
    loadComponent: () =>
      import('./pages/reviews/reviews').then((m) => m.ReviewsComponent),
  },
  {
    path: 'contact',
    loadComponent: () =>
      import('./pages/contact/contact').then((m) => m.ContactComponent),
  },
  {
    path: 'legal/:page',
    loadComponent: () =>
      import('./pages/legal/legal').then((m) => m.LegalComponent),
  },
  {
    path: '**',
    redirectTo: '',
  },
];

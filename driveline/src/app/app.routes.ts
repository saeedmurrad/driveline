import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/home/home').then((m) => m.HomeComponent),
    data: {
      seo: {
        title: 'Used Cars & Vans in Peterborough | DriveLine Car Sales',
        description:
          'Browse quality used cars and vans in Peterborough. DriveLine offers finance, part exchange, warranties, and nationwide delivery.',
      },
    },
  },
  {
    path: 'cars',
    loadComponent: () =>
      import('./pages/vehicles/vehicles').then((m) => m.VehiclesComponent),
    data: {
      category: 'car',
      seo: {
        title: 'Used Cars for Sale in Peterborough | DriveLine',
        description:
          'View inspected used cars for sale in Peterborough at DriveLine. Competitive prices, finance options, and warranty included.',
      },
    },
  },
  {
    path: 'vans',
    loadComponent: () =>
      import('./pages/vehicles/vehicles').then((m) => m.VehiclesComponent),
    data: {
      category: 'van',
      seo: {
        title: 'Used Vans for Sale in Peterborough | DriveLine',
        description:
          'Explore quality used vans in Peterborough from DriveLine. Business-ready stock with finance and warranty options.',
      },
    },
  },
  {
    path: 'vehicle/:id',
    loadComponent: () =>
      import('./pages/vehicle-detail/vehicle-detail').then(
        (m) => m.VehicleDetailComponent
      ),
    data: {
      seo: {
        title: 'Used Vehicle Details | DriveLine Car Sales',
        description:
          'View full used vehicle specifications, images, finance examples, and enquiry options at DriveLine Car Sales.',
      },
    },
  },
  {
    path: 'finance',
    loadComponent: () =>
      import('./pages/finance/finance').then((m) => m.FinanceComponent),
    data: {
      seo: {
        title: 'Car Finance in Peterborough | DriveLine Car Sales',
        description:
          'Apply for used car and van finance in Peterborough with DriveLine. Flexible finance packages and quick decisions.',
      },
    },
  },
  {
    path: 'warranty',
    loadComponent: () =>
      import('./pages/warranty/warranty').then((m) => m.WarrantyComponent),
    data: {
      seo: {
        title: 'Used Car Warranty | DriveLine Car Sales',
        description:
          'Learn about DriveLine warranty cover for used cars and vans. Buy with confidence and after-sales support.',
      },
    },
  },
  {
    path: 'sell-your-car',
    loadComponent: () =>
      import('./pages/sell-your-car/sell-your-car').then(
        (m) => m.SellYourCarComponent
      ),
    data: {
      seo: {
        title: 'Sell Your Car in Peterborough | DriveLine',
        description:
          'Get a competitive valuation to sell or part-exchange your car in Peterborough with DriveLine Car Sales.',
      },
    },
  },
  {
    path: 'reviews',
    loadComponent: () =>
      import('./pages/reviews/reviews').then((m) => m.ReviewsComponent),
    data: {
      seo: {
        title: 'Customer Reviews | DriveLine Car Sales',
        description:
          'Read verified customer reviews for DriveLine Car Sales in Peterborough and see why buyers recommend us.',
      },
    },
  },
  {
    path: 'contact',
    loadComponent: () =>
      import('./pages/contact/contact').then((m) => m.ContactComponent),
    data: {
      seo: {
        title: 'Contact DriveLine Car Sales Peterborough',
        description:
          'Contact DriveLine Car Sales in Peterborough for used car and van enquiries, finance help, and test drives.',
      },
    },
  },
  {
    path: 'legal/:page',
    loadComponent: () =>
      import('./pages/legal/legal').then((m) => m.LegalComponent),
    data: {
      seo: {
        title: 'Legal Information | DriveLine Car Sales',
        description:
          'Read DriveLine Car Sales legal pages including privacy policy, cookies, disclaimer, and site information.',
      },
    },
  },
  {
    path: '**',
    redirectTo: '',
  },
];

/**
 * Demo dealers for DivineBytes platform.
 * DriveLine (drivelinecarsales.co.uk) stock loads from `src/app/data/vehicles.data.ts`.
 */

import { loadDrivelineVehicles } from './seed/driveline-stock.mjs';
import { drivelineReviews } from './seed/driveline-reviews.mjs';

const defaultHours = [
  { day: 'Monday', open: '09:00', close: '18:00' },
  { day: 'Tuesday', open: '09:00', close: '18:00' },
  { day: 'Wednesday', open: '09:00', close: '18:00' },
  { day: 'Thursday', open: '09:00', close: '18:00' },
  { day: 'Friday', open: '09:00', close: '18:00' },
  { day: 'Saturday', open: '09:00', close: '17:00' },
  { day: 'Sunday', open: 'Closed', close: '' },
];

/** @param {string} id @param {string} slug @param {string} name @param {string} email @param {{ primary: string, accent: string }} colors */
function makeDealer(id, slug, name, email, colors) {
  const now = new Date().toISOString();
  return {
    id,
    slug,
    name,
    tagline: 'Quality used cars and vans with finance and warranty options.',
    theme: 'driveline',
    colors,
    customDomains: [],
    subdomain: slug,
    plan: 'growth',
    pageFlags: {
      finance: true,
      warranty: true,
      sellYourCar: true,
      reviews: true,
    },
    financeDisclaimer:
      'Finance subject to status. Figures are illustrative only.',
    business: {
      name,
      tagline: 'Quality used cars and vans with finance and warranty options.',
      address: {
        line1: '12 Motor Trade Way',
        line2: '',
        town: slug === 'demo' ? 'Peterborough' : 'Cambridge',
        county: 'Cambridgeshire',
        postcode: slug === 'demo' ? 'PE1 1AA' : 'CB1 2AB',
      },
      phone: '01733 100200',
      mobile: '07700 900123',
      email,
      social: {
        facebook: 'https://www.facebook.com/',
        x: 'https://x.com/',
        instagram: 'https://www.instagram.com/',
      },
      openingHours: defaultHours,
      bankHolidayNote: 'Open bank holidays by appointment.',
    },
    createdAt: now,
    updatedAt: now,
  };
}

/** @returns {import('./store.mjs').PlatformSnapshot} */
export function buildSeedSnapshot() {
  const now = new Date().toISOString();

  const driveline = {
    id: 'dealer_driveline',
    slug: 'driveline',
    name: 'DriveLine',
    tagline:
      'Quality, affordable, and reliable used car, van, and 4x4 sales.',
    theme: 'driveline',
    colors: { primary: '#2563eb', accent: '#f97316' },
    customDomains: [
      'drivelinecarsales.co.uk',
      'www.drivelinecarsales.co.uk',
    ],
    subdomain: 'driveline',
    plan: 'pro',
    pageFlags: {
      finance: true,
      warranty: true,
      sellYourCar: true,
      reviews: true,
    },
    financeDisclaimer:
      'Finance subject to status. Figures are illustrative only.',
    business: {
      name: 'DriveLine',
      tagline:
        'Quality, affordable, and reliable used car, van, and 4x4 sales.',
      address: {
        line1: 'Vision House',
        line2: '193 Fengate',
        town: 'Peterborough',
        county: 'Cambridgeshire',
        postcode: 'PE1 5BH',
      },
      phone: '01733 563559',
      mobile: '07423 374244',
      email: 'sales@drivelinecarsales.co.uk',
      social: {
        facebook: 'https://www.facebook.com/',
        x: 'https://x.com/',
        instagram: 'https://www.instagram.com/',
      },
      openingHours: [
        { day: 'Monday', open: '09:00', close: '18:00' },
        { day: 'Tuesday', open: '09:00', close: '18:00' },
        { day: 'Wednesday', open: '09:00', close: '18:00' },
        { day: 'Thursday', open: '09:00', close: '18:00' },
        { day: 'Friday', open: '09:00', close: '18:00' },
        { day: 'Saturday', open: '09:00', close: '18:00' },
        { day: 'Sunday', open: '10:00', close: '16:00' },
      ],
      bankHolidayNote: 'Open bank holidays. Other times by appointment.',
    },
    createdAt: now,
    updatedAt: now,
  };

  const demo = makeDealer(
    'dealer_demo',
    'demo',
    'Demo Motors',
    'sales@demomotors.example',
    { primary: '#2563eb', accent: '#f97316' },
  );
  const acme = makeDealer(
    'dealer_acme',
    'acme',
    'Acme Car Sales',
    'enquiries@acmecars.example',
    { primary: '#059669', accent: '#dc2626' },
  );

  /** @type {Record<string, unknown>[]} */
  let drivelineStock = [];
  try {
    drivelineStock = loadDrivelineVehicles('dealer_driveline');
  } catch (err) {
    console.warn(
      '[seed] DriveLine stock not loaded — run npm run sync:stock first.',
      err instanceof Error ? err.message : err,
    );
  }

  const vehicles = [
    ...drivelineStock,
    {
      id: 'demo-v1',
      dealerId: 'dealer_demo',
      status: 'live',
      make: 'Ford',
      model: 'Focus',
      derivative: '1.0 EcoBoost Titanium',
      year: 2021,
      price: 12995,
      monthlyPrice: 249,
      mileage: 28400,
      transmission: 'Manual',
      fuelType: 'Petrol',
      engineSize: 1.0,
      doors: 5,
      colour: 'Blue',
      bodyType: 'Hatchback',
      category: 'car',
      description:
        'One owner from new, full service history, great spec including sat nav and rear parking sensors.',
      features: ['Sat Nav', 'Parking Sensors', 'Bluetooth', 'Cruise Control'],
      images: [],
      thumbnailImage: '',
      previousOwners: 1,
      motExpiry: '2026-11-01',
      serviceHistory: 'Full',
      isFeatured: true,
      dateAdded: '2026-03-01',
    },
    {
      id: 'demo-v2',
      dealerId: 'dealer_demo',
      status: 'live',
      make: 'Volkswagen',
      model: 'Transporter',
      derivative: '2.0 TDI Highline',
      year: 2020,
      price: 24995,
      monthlyPrice: 419,
      mileage: 52100,
      transmission: 'Manual',
      fuelType: 'Diesel',
      engineSize: 2.0,
      doors: 4,
      colour: 'White',
      bodyType: 'Panel Van',
      category: 'van',
      description: 'High spec LWB van, ideal for trades. One former keeper.',
      features: ['Air Con', 'Reversing Camera', 'Cruise Control'],
      images: [],
      thumbnailImage: '',
      previousOwners: 1,
      motExpiry: '2026-08-15',
      serviceHistory: 'Full',
      dateAdded: '2026-02-20',
    },
    {
      id: 'acme-v1',
      dealerId: 'dealer_acme',
      status: 'live',
      make: 'BMW',
      model: '3 Series',
      derivative: '320d M Sport',
      year: 2019,
      price: 18995,
      monthlyPrice: 329,
      mileage: 41200,
      transmission: 'Automatic',
      fuelType: 'Diesel',
      engineSize: 2.0,
      doors: 4,
      colour: 'Black',
      bodyType: 'Saloon',
      category: 'car',
      description: 'M Sport pack, low mileage, immaculate condition.',
      features: ['Leather', 'LED Headlights', 'Parking Sensors'],
      images: [],
      thumbnailImage: '',
      previousOwners: 2,
      motExpiry: '2026-06-01',
      serviceHistory: 'Full',
      isFeatured: true,
      dateAdded: '2026-03-10',
    },
  ];

  const reviews = [
    ...drivelineReviews.map((r) => ({
      ...r,
      dealerId: 'dealer_driveline',
    })),
    {
      id: 'demo-r1',
      dealerId: 'dealer_demo',
      author: 'James T',
      date: '2026-01-12',
      rating: 5,
      title: 'Excellent service',
      body: 'Friendly team, fair price, and the car was exactly as described.',
      source: 'Google',
      verified: true,
    },
  ];

  return {
    dealers: [driveline, demo, acme],
    vehicles,
    reviews,
    enquiries: [],
    users: [
      {
        uid: 'user_platform_admin',
        email: 'admin@divinebytes.local',
        dealerId: null,
        role: 'platform_admin',
        passwordHash: 'admin123',
      },
      {
        uid: 'user_driveline_admin',
        email: 'driveline@divinebytes.local',
        dealerId: 'dealer_driveline',
        role: 'dealer_admin',
        passwordHash: 'driveline123',
      },
      {
        uid: 'user_demo_admin',
        email: 'demo@divinebytes.local',
        dealerId: 'dealer_demo',
        role: 'dealer_admin',
        passwordHash: 'demo123',
      },
    ],
  };
}

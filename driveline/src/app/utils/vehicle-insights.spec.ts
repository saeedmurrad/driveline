import type { Vehicle } from '../models/vehicle.model';
import {
  euroStandard,
  financeIllustration,
  meetsUlezStandard,
  milesBetween,
  runningCosts,
  similarVehicles,
} from './vehicle-insights';

const base: Vehicle = {
  id: '1',
  make: 'Nissan',
  model: 'Juke',
  derivative: '1.6 Tekna XTRON Euro 6 5dr',
  year: 2018,
  price: 7950,
  mileage: 59000,
  transmission: 'Automatic',
  fuelType: 'Petrol',
  engineSize: 1.6,
  doors: 5,
  colour: 'Blue',
  bodyType: 'SUV',
  category: 'car',
  description: '',
  features: [],
  images: [],
  thumbnailImage: '',
  previousOwners: 1,
  motExpiry: '',
  serviceHistory: 'Full',
  dateAdded: '2025-01-01',
};

describe('vehicle insights', () => {
  it('reads the Euro standard from the derivative', () => {
    expect(euroStandard(base)).toBe(6);
    expect(euroStandard({ ...base, derivative: '1.4 SE 5dr' })).toBeUndefined();
  });

  it('applies the ULEZ rules for petrol, diesel and electric', () => {
    expect(meetsUlezStandard({ ...base, derivative: 'Euro 4' })).toBe(true);
    expect(meetsUlezStandard({ ...base, fuelType: 'Diesel', derivative: 'Euro 5' })).toBe(false);
    expect(meetsUlezStandard({ ...base, fuelType: 'Diesel', derivative: 'Euro 6' })).toBe(true);
    expect(meetsUlezStandard({ ...base, fuelType: 'Electric', derivative: '' })).toBe(true);
    expect(meetsUlezStandard({ ...base, derivative: 'no class stated' })).toBe(false);
  });

  it('matches the site-wide 60 month, 0% deposit figure', () => {
    // £7,950 over 60 months at 9.9% APR is shown as £169/mo on the listing card.
    expect(Math.round(financeIllustration(7950, 0, 60)!.monthly)).toBe(169);
  });

  it('reduces the credit by the deposit and totals correctly', () => {
    const q = financeIllustration(9950, 2000, 36)!;
    expect(q.credit).toBe(7950);
    expect(Math.round(q.monthly)).toBe(256);
    expect(Math.round(q.totalPayable)).toBe(Math.round(q.monthly * 36 + 2000));
    expect(financeIllustration(1000, 900, 36)).toBeUndefined();
  });

  it('estimates fuel and tax costs from mpg', () => {
    const c = runningCosts(53, 8000, 142, 200)!;
    expect(Math.round(c.fuelPerYear)).toBe(974);
    expect(Math.round(c.totalPerMonth)).toBe(98);
    expect(runningCosts(undefined, 8000, 142)).toBeUndefined();
  });

  it('measures straight-line miles', () => {
    // Peterborough PE1 5BH to Cambridge CB1 2JD is roughly 30 miles.
    const d = milesBetween({ lat: 52.573, lng: -0.226 }, { lat: 52.2, lng: 0.13 });
    expect(d).toBeGreaterThan(25);
    expect(d).toBeLessThan(35);
  });

  it('suggests similar vehicles without the vehicle itself', () => {
    const others = [
      { ...base, id: '2', price: 8000 },
      { ...base, id: '3', price: 20000, bodyType: 'Saloon', make: 'Audi' },
      { ...base, id: '4', price: 7000, category: 'van' as const },
    ];
    const out = similarVehicles(base, [base, ...others], 2);
    expect(out.map((v) => v.id)).toEqual(['2', '3']);
  });
});

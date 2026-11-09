import type { Vehicle } from '../models/vehicle.model';
import { FINANCE_ILLUSTRATIVE_PARAMS } from './finance-display';

/** Euro emissions standard read from the derivative text, e.g. "… Euro 6 (s/s) 5dr" → 6. */
export function euroStandard(v: Pick<Vehicle, 'derivative' | 'description'>): number | undefined {
  const text = `${v.derivative ?? ''} ${v.description ?? ''}`;
  const m = text.match(/euro\s*([1-6])/i);
  return m ? Number(m[1]) : undefined;
}

/**
 * Meets the ULEZ / Clean Air Zone emissions standard for cars:
 * petrol (incl. hybrids) Euro 4+, diesel Euro 6+, electric always.
 * Only claimed when the Euro standard is stated on the vehicle.
 */
export function meetsUlezStandard(v: Vehicle): boolean {
  if (v.fuelType === 'Electric') return true;
  const euro = euroStandard(v);
  if (euro == null) return false;
  if (v.fuelType === 'Diesel') return euro >= 6;
  return euro >= 4;
}

export const TFL_VEHICLE_CHECKER = 'https://tfl.gov.uk/modes/driving/check-your-vehicle/';
export const GOV_MOT_CHECK = 'https://www.check-mot.service.gov.uk/';

/** UK average pump prices used as editable defaults (pence per litre). */
export const DEFAULT_FUEL_PRICE_PPL: Record<string, number> = {
  Petrol: 136,
  Diesel: 142,
  Hybrid: 136,
  'Plug-in Hybrid': 136,
  Electric: 0,
};

const LITRES_PER_GALLON = 4.54609;

export interface RunningCosts {
  fuelPerYear: number;
  fuelPerMonth: number;
  taxPerYear?: number;
  totalPerMonth: number;
  pencePerMile: number;
}

export function runningCosts(
  mpg: number | undefined,
  milesPerYear: number,
  fuelPencePerLitre: number,
  taxPerYear?: number,
): RunningCosts | undefined {
  if (!mpg || mpg <= 0 || milesPerYear <= 0) return undefined;
  const litres = (milesPerYear / mpg) * LITRES_PER_GALLON;
  const fuelPerYear = (litres * fuelPencePerLitre) / 100;
  const tax = taxPerYear ?? 0;
  return {
    fuelPerYear,
    fuelPerMonth: fuelPerYear / 12,
    taxPerYear,
    totalPerMonth: (fuelPerYear + tax) / 12,
    pencePerMile: (fuelPerYear * 100) / milesPerYear,
  };
}

export interface FinanceIllustration {
  deposit: number;
  credit: number;
  monthly: number;
  totalPayable: number;
  chargeForCredit: number;
  termMonths: number;
  apr: number;
}

/** Hire purchase illustration with a deposit, at the site's representative APR. */
export function financeIllustration(
  cashPrice: number,
  deposit: number,
  termMonths: number,
  apr: number = FINANCE_ILLUSTRATIVE_PARAMS.representativeApr,
): FinanceIllustration | undefined {
  const credit = Math.max(0, cashPrice - deposit);
  if (credit < 500 || termMonths < 1) return undefined;
  const r = apr / 100 / 12;
  const pow = Math.pow(1 + r, termMonths);
  const monthly = r > 0 ? (credit * r * pow) / (pow - 1) : credit / termMonths;
  const totalRepaid = monthly * termMonths;
  return {
    deposit,
    credit,
    monthly,
    totalPayable: totalRepaid + deposit,
    chargeForCredit: totalRepaid - credit,
    termMonths,
    apr,
  };
}

/** Straight-line distance in miles between two lat/lng points. */
export function milesBetween(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 3958.8;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function formatGbp(value: number, pence = false): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: pence ? 2 : 0,
    maximumFractionDigits: pence ? 2 : 0,
  }).format(value);
}

/** Vehicles most like this one: same body type or make, closest in price. */
export function similarVehicles(target: Vehicle, all: Vehicle[], limit = 4): Vehicle[] {
  return all
    .filter((v) => v.id !== target.id)
    .map((v) => {
      let score = Math.abs(v.price - target.price) / Math.max(target.price, 1);
      if (v.bodyType === target.bodyType) score -= 0.5;
      if (v.make === target.make) score -= 0.3;
      if (v.category !== target.category) score += 3;
      return { v, score };
    })
    .sort((a, b) => a.score - b.score)
    .slice(0, limit)
    .map((x) => x.v);
}

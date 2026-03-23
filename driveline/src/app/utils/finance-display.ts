import type { Vehicle } from '../models/vehicle.model';

/**
 * Illustrative HP quote parameters (UK dealer-style listing).
 * Shown with FCA-friendly “representative / subject to status” copy — not a binding offer.
 */
export const FINANCE_ILLUSTRATIVE_PARAMS = {
  termMonths: 48,
  representativeApr: 9.9,
  depositPercent: 10,
} as const;

/** One-line disclaimer for cards / listings */
export const FINANCE_DISCLAIMER_SHORT =
  'Illustrative HP: 48 monthly payments, 10% deposit, 9.9% APR representative. Subject to status & credit check.';

/** Slightly longer line for VDP / finance tab */
export const FINANCE_DISCLAIMER_DETAIL =
  'Example Hire Purchase (HP): 10% deposit, balance over 48 months at 9.9% APR representative. Actual rate and payment depend on your circumstances. Subject to status.';

/**
 * Standard amortising loan monthly payment (HP), rounded to whole pounds.
 */
export function illustrativeMonthlyPayment(cashPrice: number): number | undefined {
  if (!Number.isFinite(cashPrice) || cashPrice < 500) return undefined;
  const { termMonths, representativeApr, depositPercent } = FINANCE_ILLUSTRATIVE_PARAMS;
  const deposit = cashPrice * (depositPercent / 100);
  const principal = Math.max(0, cashPrice - deposit);
  const monthlyRate = representativeApr / 100 / 12;
  const n = termMonths;
  if (monthlyRate <= 0) return Math.round(principal / n);
  const pow = Math.pow(1 + monthlyRate, n);
  const payment = (principal * monthlyRate * pow) / (pow - 1);
  if (!Number.isFinite(payment) || payment <= 0) return undefined;
  return Math.round(payment);
}

/** Prefer dealer/API monthly when present; otherwise illustrative HP. */
export function monthlyPaymentForVehicle(v: Pick<Vehicle, 'price' | 'monthlyPrice'>): number | undefined {
  if (v.monthlyPrice != null && v.monthlyPrice > 0) {
    return Math.round(v.monthlyPrice);
  }
  return illustrativeMonthlyPayment(v.price);
}

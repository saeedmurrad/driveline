import type { Vehicle } from '../models/vehicle.model';

/**
 * Illustrative HP quotes — UK dealer-style, FCA-friendly copy.
 * Zero deposit (full finance on vehicle price), 9.9% APR representative.
 */
export const FINANCE_ILLUSTRATIVE_PARAMS = {
  representativeApr: 9.9,
  /** Full amount financed (no deposit) */
  depositPercent: 0,
  termMonthsOptions: [36, 48, 60] as const,
  /** Lowest monthly payment — used on cards / “from” lines */
  listingHeadlineTermMonths: 60,
} as const;

/** One-line disclaimer for cards / listings */
export const FINANCE_DISCLAIMER_SHORT =
  'Illustrative HP: 0% deposit, 9.9% APR representative. Figure shown is 60 monthly payments (lowest payment). 36 & 48 month options on vehicle page. Subject to status.';

/** Longer copy for VDP / finance tab */
export const FINANCE_DISCLAIMER_DETAIL =
  'Illustrative Hire Purchase (HP): full cash price financed over 36, 48 or 60 months at 9.9% APR representative, with no deposit. Actual rate and payment depend on your circumstances. Subject to status and credit check.';

export type FinanceTermOption = { termMonths: number; monthly: number };

/**
 * Monthly payment for a given term (principal = full cash price when deposit is 0).
 */
export function illustrativeMonthlyPayment(
  cashPrice: number,
  termMonths: number,
): number | undefined {
  if (!Number.isFinite(cashPrice) || cashPrice < 500) return undefined;
  if (!Number.isFinite(termMonths) || termMonths < 1) return undefined;

  const { representativeApr, depositPercent } = FINANCE_ILLUSTRATIVE_PARAMS;
  const deposit = cashPrice * (depositPercent / 100);
  const principal = Math.max(0, cashPrice - deposit);
  const monthlyRate = representativeApr / 100 / 12;
  const n = Math.round(termMonths);
  if (monthlyRate <= 0) return Math.round(principal / n);
  const pow = Math.pow(1 + monthlyRate, n);
  const payment = (principal * monthlyRate * pow) / (pow - 1);
  if (!Number.isFinite(payment) || payment <= 0) return undefined;
  return Math.round(payment);
}

/** 36 / 48 / 60 month rows for calculators and VDP. */
export function financeTermOptionsForPrice(cashPrice: number): FinanceTermOption[] {
  const out: FinanceTermOption[] = [];
  for (const termMonths of FINANCE_ILLUSTRATIVE_PARAMS.termMonthsOptions) {
    const monthly = illustrativeMonthlyPayment(cashPrice, termMonths);
    if (monthly != null) out.push({ termMonths, monthly });
  }
  return out;
}

/**
 * Headline “from £X/mo” on listings — longest term (lowest payment), same rules as calculator.
 * Ignores legacy `monthlyPrice` on the vehicle so figures always match 0% deposit / 9.9% APR illustrative quotes.
 */
export function monthlyPaymentForVehicle(v: Pick<Vehicle, 'price'>): number | undefined {
  return illustrativeMonthlyPayment(
    v.price,
    FINANCE_ILLUSTRATIVE_PARAMS.listingHeadlineTermMonths,
  );
}

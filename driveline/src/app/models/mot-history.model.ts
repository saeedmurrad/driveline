/** One MOT defect / advisory as returned by the vehicle check worker. */
export interface MotDefect {
  text: string;
  dangerous: boolean;
}

/** One MOT test (newest first in MotHistory.tests). */
export interface MotTest {
  /** YYYY-MM-DD */
  date: string;
  result: 'pass' | 'fail';
  expiry: string | null;
  mileage: { value: number; unit: 'mi' | 'km' } | null;
  advisories: MotDefect[];
  minors: MotDefect[];
  failures: MotDefect[];
}

/** Compact DVSA MOT history (see workers/dvla-ves-proxy/worker.js compactMot). */
export interface MotHistory {
  registration: string | null;
  make: string | null;
  model: string | null;
  colour: string | null;
  fuelType: string | null;
  engineSizeCc: number | null;
  firstUsedDate: string | null;
  manufactureYear: string | null;
  motTestDueDate: string | null;
  hasOutstandingRecall: string | null;
  tests: MotTest[];
}

export interface MotSummary {
  tests: number;
  passes: number;
  /** Share of tests passed at the first attempt of each year (0–100). */
  firstTimePassRate: number | null;
  latest: MotTest | null;
  /** Current MOT valid until (from the newest pass). */
  validUntil: string | null;
  /** Newest odometer reading, in miles. */
  lastMiles: { miles: number; date: string } | null;
  /** True when every reading is the same or higher than the one before. */
  mileageConsistent: boolean | null;
  /** Readings oldest → newest for the chart. */
  mileagePoints: { date: string; miles: number }[];
  averageMilesPerYear: number | null;
}

const KM_TO_MI = 0.621371;
const toMiles = (m: { value: number; unit: 'mi' | 'km' }) => Math.round(m.unit === 'km' ? m.value * KM_TO_MI : m.value);

export function summariseMot(h: MotHistory): MotSummary {
  const tests = h.tests ?? [];
  // Oldest first. Dates have no time of day, so on the SAME day a fail comes before the pass (the pass
  // is its retest), then lower mileage first. Otherwise a fail and its retest a mile or two apart read
  // as the mileage "going down", and the retest could count as a first-time pass.
  const rank = (t: MotTest) => (t.result === 'fail' ? 0 : 1);
  const oldestFirst = [...tests].sort(
    (a, b) => a.date.localeCompare(b.date) || rank(a) - rank(b) || (a.mileage ? toMiles(a.mileage) : 0) - (b.mileage ? toMiles(b.mileage) : 0),
  );
  const readings = oldestFirst.filter((t) => t.mileage).map((t) => ({ date: t.date, miles: toMiles(t.mileage!) }));
  // A fail and its retest a few days later are one MOT: keep the later reading.
  const points: { date: string; miles: number }[] = [];
  for (const r of readings) {
    const prev = points.at(-1);
    if (prev && daysBetween(prev.date, r.date) <= 31) points[points.length - 1] = r;
    else points.push(r);
  }

  // A retest after a fail on the same MOT "round" (within 31 days) is not a new year.
  let rounds = 0;
  let firstTime = 0;
  let lastRoundStart: string | null = null;
  for (const t of oldestFirst) {
    const startsRound = !lastRoundStart || daysBetween(lastRoundStart, t.date) > 31;
    if (startsRound) {
      rounds++;
      if (t.result === 'pass') firstTime++;
      lastRoundStart = t.date;
    }
  }

  const latestPass = tests.find((t) => t.result === 'pass') ?? null;
  const first = points[0];
  const last = points.at(-1);
  const years = first && last ? daysBetween(first.date, last.date) / 365.25 : 0;

  return {
    tests: tests.length,
    passes: tests.filter((t) => t.result === 'pass').length,
    firstTimePassRate: rounds ? Math.round((firstTime / rounds) * 100) : null,
    latest: tests[0] ?? null,
    validUntil: latestPass?.expiry ?? null,
    lastMiles: last ? { miles: last.miles, date: last.date } : null,
    // Compared MOT to MOT (a fail + retest within 31 days is one MOT), so a tester noting a mile or
    // two less on a retest is not reported as a mileage problem.
    mileageConsistent: points.length >= 2 ? points.every((p, i) => !i || p.miles >= points[i - 1].miles) : null,
    mileagePoints: points,
    averageMilesPerYear: years >= 1 && first && last ? Math.round((last.miles - first.miles) / years) : null,
  };
}

function daysBetween(a: string, b: string): number {
  return Math.abs(new Date(b).getTime() - new Date(a).getTime()) / 86_400_000;
}

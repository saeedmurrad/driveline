import { summariseMot, type MotHistory, type MotTest } from './mot-history.model';

const t = (date: string, result: 'pass' | 'fail', miles: number | null, extra: Partial<MotTest> = {}): MotTest => ({
  date,
  result,
  expiry: result === 'pass' ? `${Number(date.slice(0, 4)) + 1}${date.slice(4)}` : null,
  mileage: miles == null ? null : { value: miles, unit: 'mi' },
  advisories: [],
  minors: [],
  failures: [],
  ...extra,
});

const base: MotHistory = {
  registration: 'LB15WMA', make: 'MINI', model: 'COUNTRYMAN', colour: 'Green', fuelType: 'Diesel', engineSizeCc: 1995,
  firstUsedDate: '2015-07-21', manufactureYear: '2015', motTestDueDate: null, hasOutstandingRecall: 'No', tests: [],
};

describe('summariseMot', () => {
  it('counts first-time passes per yearly round, ignoring retests', () => {
    const s = summariseMot({
      ...base,
      tests: [t('2025-07-16', 'pass', 86500), t('2025-07-15', 'fail', 86500), t('2024-07-10', 'pass', 79000), t('2023-07-12', 'pass', 70000)],
    });
    expect(s.tests).toBe(4);
    expect(s.firstTimePassRate).toBe(67); // 2 of 3 yearly rounds passed first time
    expect(s.validUntil).toBe('2026-07-16');
    expect(s.lastMiles).toEqual({ miles: 86500, date: '2025-07-16' });
    expect(s.mileageConsistent).toBe(true);
    expect(s.averageMilesPerYear).toBeGreaterThan(8000);
  });

  it('flags mileage that goes down', () => {
    const s = summariseMot({ ...base, tests: [t('2025-07-16', 'pass', 60000), t('2024-07-10', 'pass', 79000)] });
    expect(s.mileageConsistent).toBe(false);
  });

  it('converts km readings and skips unreadable odometers', () => {
    const s = summariseMot({
      ...base,
      tests: [t('2025-07-16', 'pass', null), { ...t('2024-07-10', 'pass', 0), mileage: { value: 100000, unit: 'km' } }],
    });
    expect(s.lastMiles?.miles).toBe(62137);
    expect(s.mileageConsistent).toBeNull(); // one reading only
  });

  it('handles a car with no MOT yet', () => {
    const s = summariseMot({ ...base, motTestDueDate: '2027-03-01', tests: [] });
    expect(s.tests).toBe(0);
    expect(s.latest).toBeNull();
    expect(s.firstTimePassRate).toBeNull();
  });
});

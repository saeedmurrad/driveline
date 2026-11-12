import { advertAgreesWithRecords, mileageInLine, officialRows } from './official-check';
import type { OfficialCheck, Vehicle } from '../models/vehicle.model';

const car = (over: Partial<Vehicle> = {}): Vehicle =>
  ({ id: '1', make: 'Audi', model: 'A6 Avant', derivative: '', year: 2019, price: 10950, mileage: 152000, transmission: 'Automatic', fuelType: 'Diesel', engineSize: 2, doors: 5, colour: 'White', bodyType: 'Estate', category: 'car', description: '', features: [], images: [], thumbnailImage: '', previousOwners: 0, serviceHistory: 'Full', ...over }) as Vehicle;

const record: OfficialCheck = {
  checkedAt: '2026-11-12',
  dvla: { make: 'AUDI', colour: 'WHITE', fuelType: 'DIESEL', year: 2019, firstRegistered: '2019-06', engineCc: 1968 },
  mot: { model: 'A6', tests: 5, passes: 5, firstTimePassRate: 100, validUntil: '2027-06-23', lastMiles: 151652, lastDate: '2026-06-04', mileageConsistent: true, recall: 'No' },
};
const today = new Date('2026-11-12T12:00:00Z');

describe('officialRows', () => {
  it('ticks only what agrees with the records', () => {
    const rows = officialRows(car(), record, today);
    expect(rows.find((r) => r.key === 'identity')).toEqual({ key: 'identity', status: 'match', text: 'Make, colour, fuel and year match the DVLA record' });
    expect(rows.find((r) => r.key === 'engine')?.status).toBe('match');
    expect(rows.find((r) => r.key === 'mot')?.text).toBe('MOT valid until 23 Jun 2027');
    expect(rows.find((r) => r.key === 'mileage')).toEqual({ key: 'mileage', status: 'match', text: 'Advertised mileage is in line with the MOT record (last reading 151,652 miles on 4 Jun 2026)' });
    expect(rows.find((r) => r.key === 'history')?.status).toBe('match');
    expect(rows.find((r) => r.key === 'recall')?.status).toBe('match');
  });

  it('never ticks an advertised mileage below the last MOT reading', () => {
    const v = car({ mileage: 149999 });
    const row = officialRows(v, record, today).find((r) => r.key === 'mileage');
    expect(row).toEqual({ key: 'mileage', status: 'info', text: 'Last MOT reading: 151,652 miles on 4 Jun 2026' });
    expect(mileageInLine(v, record)).toBe(false);
    expect(advertAgreesWithRecords({ ...v, official: record })).toBe(false);
  });

  it('shows the DVLA value where the advert differs, and flags recalls and odd mileage to ask about', () => {
    const o: OfficialCheck = { ...record, dvla: { ...record.dvla, colour: 'GREY' }, mot: { ...record.mot!, recall: 'Yes', mileageConsistent: false } };
    const rows = officialRows(car(), o, today);
    expect(rows.filter((r) => r.key === 'identity').map((r) => r.text)).toEqual(['Make, fuel and year match the DVLA record', 'DVLA records the colour as Grey']);
    expect(rows.find((r) => r.key === 'recall')?.status).toBe('ask');
    expect(rows.find((r) => r.key === 'history')?.status).toBe('ask');
  });

  it('accepts the registration year as the advert year, and handles cars with no MOT yet', () => {
    const o: OfficialCheck = { checkedAt: '2026-11-12', dvla: { make: 'KIA', year: 2023, firstRegistered: '2024-01', fuelType: 'PETROL' }, mot: { tests: 0, passes: 0, firstTimePassRate: null, validUntil: null, dueDate: '2027-01-15', lastMiles: null, lastDate: null, mileageConsistent: null, recall: 'Unknown' } };
    const v = car({ make: 'Kia', year: 2024, fuelType: 'Petrol', official: o });
    expect(officialRows(v, o, today).find((r) => r.key === 'mot')?.text).toBe('Too new for an MOT: first one due 15 Jan 2027');
    expect(advertAgreesWithRecords(v)).toBe(true);
  });

  it('is not "checked" without records', () => {
    expect(advertAgreesWithRecords(car())).toBe(false);
  });
});

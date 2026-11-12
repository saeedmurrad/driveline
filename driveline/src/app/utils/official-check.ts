import type { OfficialCheck, Vehicle } from '../models/vehicle.model';
import type { DvlaVehicleDetails } from '../models/dvla-vehicle.model';
import { summariseMot, type MotHistory } from '../models/mot-history.model';

/**
 * Compares a stock advert with the official DVLA + DVSA records.
 * A row is `match` ONLY when the advert agrees with the record; otherwise the record is
 * shown as plain information (`info`) or as something to ask about (`ask`). Nothing here
 * ever turns a difference into a tick.
 */
export interface OfficialRow {
  key: 'identity' | 'engine' | 'mot' | 'tests' | 'mileage' | 'history' | 'recall';
  status: 'match' | 'info' | 'ask';
  text: string;
}

const norm = (s: unknown) => String(s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
const title = (s: string | undefined) => (s ? s.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase()) : '');
const num = (n: number) => n.toLocaleString('en-GB');

export function formatOfficialDate(ymd: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(ymd ?? '');
  return m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) : '';
}

function sameMake(advert: string, dvla: string): boolean {
  const a = norm(advert), d = norm(dvla);
  return !!a && !!d && (a.startsWith(d.slice(0, 5)) || d.startsWith(a.slice(0, 5)));
}

function sameFuel(advert: string, dvla: string): boolean {
  const a = norm(advert), d = norm(dvla);
  if (a.includes('hybrid') || d.includes('hybrid')) return a.includes('hybrid') && d.includes('hybrid');
  if (a.includes('electric') || d.includes('electric')) return a.includes('electric') && d.includes('electric');
  return a.slice(0, 5) === d.slice(0, 5);
}

function sameColour(advert: string, dvla: string): boolean {
  const a = norm(advert).replace('gray', 'grey'), d = norm(dvla).replace('gray', 'grey');
  return !!a && !!d && (a.includes(d) || d.includes(a));
}

/** Year matches when it is the year of manufacture or the year of first registration. */
function sameYear(advert: number, dvla: NonNullable<OfficialCheck['dvla']>): boolean {
  const reg = Number((dvla.firstRegistered ?? '').slice(0, 4)) || undefined;
  return advert === dvla.year || advert === reg;
}

/** True when the advertised mileage is not below the last reading recorded at an MOT. */
export function mileageInLine(v: Pick<Vehicle, 'mileage'>, o: OfficialCheck | undefined): boolean | null {
  const last = o?.mot?.lastMiles;
  return last == null ? null : v.mileage >= last;
}

export function officialRows(v: Vehicle, o: OfficialCheck, today = new Date()): OfficialRow[] {
  const rows: OfficialRow[] = [];
  const d = o.dvla;
  const m = o.mot;

  if (d) {
    const checks = [
      d.make ? { label: 'make', ok: sameMake(v.make, d.make), value: title(d.make) } : null,
      d.colour ? { label: 'colour', ok: sameColour(v.colour, d.colour), value: title(d.colour) } : null,
      d.fuelType ? { label: 'fuel', ok: sameFuel(v.fuelType, d.fuelType), value: title(d.fuelType) } : null,
      d.year ? { label: 'year', ok: sameYear(v.year, d), value: String(d.year) } : null,
    ].filter((c): c is { label: string; ok: boolean; value: string } => !!c);
    const ok = checks.filter((c) => c.ok);
    const other = checks.filter((c) => !c.ok);
    if (ok.length) {
      const names = ok.map((c) => c.label);
      const list = names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names.at(-1)}` : names[0];
      rows.push({ key: 'identity', status: 'match', text: `${list.charAt(0).toUpperCase()}${list.slice(1)} match${names.length === 1 ? 'es' : ''} the DVLA record` });
    }
    if (other.length) {
      rows.push({ key: 'identity', status: 'info', text: `DVLA records the ${other.map((c) => `${c.label} as ${c.value}`).join(' and the ')}` });
    }
    if (d.engineCc) {
      const litres = (d.engineCc / 1000).toFixed(1);
      const ok = !!v.engineSize && Math.abs(d.engineCc / 1000 - v.engineSize) <= 0.15;
      rows.push({ key: 'engine', status: ok ? 'match' : 'info', text: ok ? `Engine size matches the DVLA record (${num(d.engineCc)} cc)` : `DVLA records the engine as ${num(d.engineCc)} cc (${litres}L)` });
    }
  }

  if (m) {
    const todayYmd = today.toISOString().slice(0, 10);
    if (m.validUntil) {
      const valid = m.validUntil >= todayYmd;
      rows.push({ key: 'mot', status: valid ? 'match' : 'info', text: valid ? `MOT valid until ${formatOfficialDate(m.validUntil)}` : `Last MOT expired ${formatOfficialDate(m.validUntil)}; ask us about a new one` });
    } else if (m.dueDate) {
      rows.push({ key: 'mot', status: 'info', text: `Too new for an MOT: first one due ${formatOfficialDate(m.dueDate)}` });
    }
    if (m.tests > 0) {
      rows.push({ key: 'tests', status: 'info', text: `${m.tests} MOT test${m.tests === 1 ? '' : 's'} on record${m.firstTimePassRate != null ? `, ${m.firstTimePassRate}% passed first time` : ''}` });
    }
    if (m.lastMiles != null) {
      const inLine = v.mileage >= m.lastMiles;
      const reading = `${num(m.lastMiles)} miles on ${formatOfficialDate(m.lastDate)}`;
      rows.push({ key: 'mileage', status: inLine ? 'match' : 'info', text: inLine ? `Advertised mileage is in line with the MOT record (last reading ${reading})` : `Last MOT reading: ${reading}` });
    }
    if (m.mileageConsistent === true) rows.push({ key: 'history', status: 'match', text: 'Mileage goes up at every MOT' });
    else if (m.mileageConsistent === false) rows.push({ key: 'history', status: 'ask', text: 'One MOT reading is lower than an earlier one. Ask us about it' });
    if (m.recall === 'No') rows.push({ key: 'recall', status: 'match', text: 'No outstanding safety recall' });
    else if (m.recall === 'Yes') rows.push({ key: 'recall', status: 'ask', text: 'DVSA shows an outstanding safety recall. Ask us about it' });
  }
  return rows;
}

/**
 * For the card line "DVLA & MOT checked": the records were read and nothing in the advert
 * disagrees with them (make, fuel, year, mileage not below the last MOT, mileage history).
 */
export function advertAgreesWithRecords(v: Vehicle): boolean {
  const o = v.official;
  if (!o || (!o.dvla && !o.mot)) return false;
  const d = o.dvla;
  if (d?.make && !sameMake(v.make, d.make)) return false;
  if (d?.fuelType && !sameFuel(v.fuelType, d.fuelType)) return false;
  if (d?.year && !sameYear(v.year, d)) return false;
  if (mileageInLine(v, o) === false) return false;
  if (o.mot?.mileageConsistent === false) return false;
  return true;
}

/** Same compact record, built in the browser from live lookups (cars synced without a check). */
export function officialFromLive(dvla: DvlaVehicleDetails | null, mot: MotHistory | null, today = new Date()): OfficialCheck | null {
  if (!dvla && !mot) return null;
  const o: OfficialCheck = { checkedAt: today.toISOString().slice(0, 10) };
  if (dvla) {
    o.dvla = {
      make: dvla.make, colour: dvla.colour, fuelType: dvla.fuelType, year: dvla.yearOfManufacture,
      firstRegistered: dvla.monthOfFirstRegistration, engineCc: dvla.engineCapacity, co2: dvla.co2Emissions, euroStatus: dvla.euroStatus,
    };
  }
  if (mot) {
    const s = summariseMot(mot);
    o.mot = {
      model: mot.model, tests: s.tests, passes: s.passes, firstTimePassRate: s.firstTimePassRate, validUntil: s.validUntil, dueDate: mot.motTestDueDate,
      lastMiles: s.lastMiles?.miles ?? null, lastDate: s.lastMiles?.date ?? null, mileageConsistent: s.mileageConsistent, recall: mot.hasOutstandingRecall,
    };
  }
  return o;
}

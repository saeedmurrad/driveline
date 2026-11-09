import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PhotoPendingComponent } from '../../components/shared/photo-pending/photo-pending';
import { COMPARE_LIMIT, GarageService } from '../../services/garage.service';
import type { Vehicle } from '../../models/vehicle.model';
import { monthlyPaymentForVehicle, FINANCE_DISCLAIMER_SHORT } from '../../utils/finance-display';
import { euroStandard, formatGbp, meetsUlezStandard } from '../../utils/vehicle-insights';

type Better = 'low' | 'high' | null;

interface CompareRow {
  label: string;
  value: (v: Vehicle) => string;
  /** Numeric value used to highlight the best vehicle in the row. */
  score?: (v: Vehicle) => number | undefined;
  better?: Better;
}

const num = (n: number | undefined, suffix = '') =>
  n == null || !Number.isFinite(n) ? '—' : `${new Intl.NumberFormat('en-GB').format(n)}${suffix}`;

@Component({
  selector: 'app-compare',
  imports: [RouterLink, PhotoPendingComponent],
  templateUrl: './compare.html',
})
export class CompareComponent {
  protected readonly garage = inject(GarageService);
  protected readonly limit = COMPARE_LIMIT;
  protected readonly disclaimer = FINANCE_DISCLAIMER_SHORT;
  protected readonly formatGbp = formatGbp;

  readonly vehicles = this.garage.compareVehicles;

  readonly rows: CompareRow[] = [
    { label: 'Cash price', value: (v) => formatGbp(v.price), score: (v) => v.price, better: 'low' },
    {
      label: 'Finance from',
      value: (v) => {
        const m = monthlyPaymentForVehicle(v);
        return m ? `${formatGbp(m)}/mo` : '—';
      },
      score: (v) => monthlyPaymentForVehicle(v),
      better: 'low',
    },
    { label: 'Year', value: (v) => String(v.year), score: (v) => v.year, better: 'high' },
    { label: 'Mileage', value: (v) => num(v.mileage, ' miles'), score: (v) => v.mileage, better: 'low' },
    { label: 'Fuel', value: (v) => v.fuelType },
    { label: 'Gearbox', value: (v) => v.transmission },
    { label: 'Engine', value: (v) => (v.engineSize ? `${v.engineSize}L` : '—') },
    { label: 'Power', value: (v) => num(v.bhp, ' bhp'), score: (v) => v.bhp, better: 'high' },
    { label: '0–60 mph', value: (v) => (v.acceleration0To60Seconds ? `${v.acceleration0To60Seconds}s` : '—'), score: (v) => v.acceleration0To60Seconds, better: 'low' },
    { label: 'Economy', value: (v) => num(v.mpg, ' mpg'), score: (v) => v.mpg, better: 'high' },
    { label: 'CO₂', value: (v) => num(v.co2Emissions, ' g/km'), score: (v) => v.co2Emissions, better: 'low' },
    { label: 'Road tax (12 months)', value: (v) => (v.taxRate12Month != null ? formatGbp(v.taxRate12Month) : '—'), score: (v) => v.taxRate12Month, better: 'low' },
    { label: 'ULEZ standard', value: (v) => (meetsUlezStandard(v) ? `Yes (Euro ${euroStandard(v) ?? '—'})` : euroStandard(v) ? `No (Euro ${euroStandard(v)})` : 'Not stated') },
    { label: 'Body', value: (v) => v.bodyType },
    { label: 'Doors / seats', value: (v) => `${v.doors} doors${v.seats ? ` · ${v.seats} seats` : ''}` },
    { label: 'Colour', value: (v) => v.colour },
    { label: 'Previous owners', value: (v) => String(v.previousOwners ?? '—'), score: (v) => v.previousOwners, better: 'low' },
    { label: 'Service history', value: (v) => v.serviceHistory },
    { label: 'Boot (seats up)', value: (v) => num(v.bootSpaceSeatsUpLitres, ' L'), score: (v) => v.bootSpaceSeatsUpLitres, better: 'high' },
  ];

  /** Index of the best vehicle in a row, only when there is a clear winner. */
  best(row: CompareRow): number | null {
    const list = this.vehicles();
    if (!row.score || !row.better || list.length < 2) return null;
    const scores = list.map((v) => row.score!(v));
    const valid = scores.filter((s): s is number => s != null && Number.isFinite(s));
    if (valid.length < 2) return null;
    const target = row.better === 'low' ? Math.min(...valid) : Math.max(...valid);
    const winners = scores.filter((s) => s === target).length;
    return winners === 1 ? scores.indexOf(target) : null;
  }

  readonly emptySlots = computed(() =>
    Array.from({ length: Math.max(0, this.limit - this.vehicles().length) }, (_, i) => i),
  );
}

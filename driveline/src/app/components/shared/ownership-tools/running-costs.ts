import { Component, Input, computed, signal } from '@angular/core';
import type { Vehicle } from '../../../models/vehicle.model';
import { DEFAULT_FUEL_PRICE_PPL, formatGbp, runningCosts } from '../../../utils/vehicle-insights';

@Component({
  selector: 'app-running-costs',
  template: `
    @if (vehicle.fuelType === 'Electric') {
      <p class="text-sm text-stone-600 dark:text-slate-300">Running costs for electric vehicles depend on how you charge. Ask us for typical range and charging figures for this car.</p>
    } @else if (!vehicle.mpg) {
      <p class="text-sm text-stone-600 dark:text-slate-300">We don’t have an official fuel economy figure for this vehicle yet. Ask us and we’ll find it for you.</p>
    } @else {
      <div class="space-y-5">
        <div>
          <div class="flex items-baseline justify-between gap-3">
            <label for="rc-miles" class="text-sm font-semibold text-stone-800 dark:text-slate-100">Miles per year</label>
            <span class="tabular-nums text-sm font-bold text-stone-900 dark:text-white">{{ miles().toLocaleString('en-GB') }}</span>
          </div>
          <input id="rc-miles" type="range" class="range-input mt-2" min="2000" max="30000" step="500"
            [value]="miles()" (input)="miles.set(+$any($event.target).value)" />
          <div class="mt-1 flex justify-between text-[11px] text-stone-400"><span>2,000</span><span>UK average ≈ 7,400</span><span>30,000</span></div>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label for="rc-ppl" class="form-label text-xs">{{ vehicle.fuelType === 'Diesel' ? 'Diesel' : 'Petrol' }} price (pence/litre)</label>
            <input id="rc-ppl" type="number" min="50" max="300" step="1" class="form-input py-2.5 text-sm tabular-nums"
              [value]="ppl()" (input)="ppl.set(+$any($event.target).value || 0)" />
          </div>
          <div class="stat-chip flex flex-col justify-center">
            <p class="tool-kicker">Official economy</p>
            <p class="font-bold tabular-nums text-stone-900 dark:text-white">{{ vehicle.mpg }} mpg</p>
          </div>
        </div>
        @if (costs(); as c) {
          <div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div class="stat-chip"><p class="tool-kicker">Fuel / month</p><p class="text-lg font-bold tabular-nums text-stone-900 dark:text-white">{{ fmt(c.fuelPerMonth) }}</p></div>
            <div class="stat-chip"><p class="tool-kicker">Fuel / year</p><p class="text-lg font-bold tabular-nums text-stone-900 dark:text-white">{{ fmt(c.fuelPerYear) }}</p></div>
            <div class="stat-chip"><p class="tool-kicker">Road tax / year</p><p class="text-lg font-bold tabular-nums text-stone-900 dark:text-white">{{ c.taxPerYear != null ? fmt(c.taxPerYear) : '—' }}</p></div>
            <div class="stat-chip"><p class="tool-kicker">Pence per mile</p><p class="text-lg font-bold tabular-nums text-stone-900 dark:text-white">{{ c.pencePerMile.toFixed(1) }}p</p></div>
          </div>
          <div class="flex items-center justify-between rounded-2xl bg-stone-900 px-5 py-4 text-white dark:bg-white dark:text-stone-900">
            <p class="text-sm font-semibold">Fuel and tax, per month</p>
            <p class="text-2xl font-bold tabular-nums">{{ fmt(c.totalPerMonth) }}</p>
          </div>
        }
        <p class="text-xs text-stone-500 dark:text-slate-400">Estimate based on the official combined economy figure. Real-world economy varies with driving style, load and weather. Insurance and servicing are not included.</p>
      </div>
    }
  `,
})
export class RunningCostsComponent {
  @Input({ required: true }) set vehicleInput(v: Vehicle) {
    this.vehicle = v;
    this.ppl.set(DEFAULT_FUEL_PRICE_PPL[v.fuelType] ?? 136);
    this.mpg.set(v.mpg);
    this.tax.set(v.taxRate12Month);
  }
  vehicle!: Vehicle;

  readonly miles = signal(8000);
  readonly ppl = signal(136);
  private readonly mpg = signal<number | undefined>(undefined);
  private readonly tax = signal<number | undefined>(undefined);
  readonly costs = computed(() => runningCosts(this.mpg(), this.miles(), this.ppl(), this.tax()));
  readonly fmt = (n: number) => formatGbp(n);
}

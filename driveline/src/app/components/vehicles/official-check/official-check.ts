import { Component, PLATFORM_ID, computed, effect, inject, input, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { RouterLink } from '@angular/router';
import { catchError, forkJoin, of } from 'rxjs';
import type { OfficialCheck, Vehicle } from '../../../models/vehicle.model';
import { DvlaVehicleService } from '../../../services/dvla-vehicle.service';
import { formatOfficialDate, officialFromLive, officialRows } from '../../../utils/official-check';

/**
 * "Checked against official records" for a stock car: what the DVLA and DVSA hold for its
 * registration, with a tick ONLY on the points where the advert agrees. Differences are
 * shown as plain facts (for example the last MOT mileage reading), never hidden.
 *
 * The records come from the stock sync (vehicle.official, scripts/verify-stock.mjs). A car
 * synced without them is looked up live in the browser instead, so every car is covered.
 */
@Component({
  selector: 'app-official-check',
  imports: [RouterLink],
  template: `
    @if (record(); as o) {
      <section class="tool-card !p-5 sm:!p-6" aria-labelledby="official-check-title">
        <div class="flex items-start gap-3">
          <span class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300" aria-hidden="true">
            <svg class="h-6 w-6" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>
          </span>
          <div class="min-w-0">
            <h2 id="official-check-title" class="text-lg font-bold leading-tight text-gray-900 dark:text-white">Checked against official records</h2>
            <p class="mt-0.5 text-sm text-gray-600 dark:text-slate-300">DVLA and DVSA records for {{ plate() }}, read on {{ checkedOn() }}.</p>
          </div>
        </div>

        <ul class="mt-4 grid gap-x-6 gap-y-2.5 sm:grid-cols-2">
          @for (row of rows(); track row.key + row.text) {
            <li class="flex items-start gap-2.5 text-sm text-gray-800 dark:text-slate-100">
              @switch (row.status) {
                @case ('match') {
                  <span class="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white" aria-hidden="true">
                    <svg class="h-3 w-3" fill="none" stroke="currentColor" stroke-width="3.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>
                  </span>
                }
                @case ('ask') {
                  <span class="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-500 text-xs font-bold text-white" aria-hidden="true">!</span>
                }
                @default {
                  <span class="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-stone-200 text-xs font-bold text-stone-700 dark:bg-slate-600 dark:text-slate-100" aria-hidden="true">i</span>
                }
              }
              <span>
                <span class="sr-only">{{ row.status === 'match' ? 'Confirmed: ' : row.status === 'ask' ? 'To ask about: ' : 'For information: ' }}</span>{{ row.text }}
              </span>
            </li>
          }
        </ul>

        <a
          routerLink="/mot-check"
          [queryParams]="{ reg: reg() }"
          class="mt-4 inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-rose-700 hover:underline dark:text-rose-300"
        >
          See the full MOT history and DVLA record
          <svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/></svg>
        </a>
      </section>
    }
  `,
  styles: `
    :host {
      display: block;
    }
    :host:empty {
      display: none;
    }
  `,
})
export class OfficialCheckComponent {
  private readonly lookup = inject(DvlaVehicleService);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));

  readonly vehicle = input.required<Vehicle>();
  /** Records looked up live for a car that was synced without them. */
  private readonly live = signal<{ id: string; record: OfficialCheck } | null>(null);

  readonly reg = computed(() => (this.vehicle().registration ?? '').replace(/[^a-z0-9]/gi, '').toUpperCase());
  readonly plate = computed(() => {
    const r = this.reg();
    return /^[A-Z]{2}\d{2}[A-Z]{3}$/.test(r) ? `${r.slice(0, 4)} ${r.slice(4)}` : r;
  });
  readonly record = computed<OfficialCheck | null>(() => {
    const v = this.vehicle();
    if (v.official) return v.official;
    const l = this.live();
    return l && l.id === v.id ? l.record : null;
  });
  readonly rows = computed(() => {
    const o = this.record();
    return o ? officialRows(this.vehicle(), o) : [];
  });
  readonly checkedOn = computed(() => formatOfficialDate(this.record()?.checkedAt));

  constructor() {
    effect(() => {
      const v = this.vehicle();
      const reg = this.reg();
      if (!this.browser || v.official || !reg || v.status === 'sold' || !this.lookup.isAvailable()) return;
      forkJoin({
        dvla: this.lookup.lookupByRegistration(reg).pipe(catchError(() => of(null))),
        mot: this.lookup.motHistory(reg).pipe(catchError(() => of(null))),
      }).subscribe(({ dvla, mot }) => {
        const record = officialFromLive(dvla, mot);
        if (record) this.live.set({ id: v.id, record });
      });
    });
  }
}

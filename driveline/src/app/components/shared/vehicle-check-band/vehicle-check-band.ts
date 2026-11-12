import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DvlaVehicleService } from '../../../services/dvla-vehicle.service';
import { RegSearchComponent } from '../reg-search/reg-search';

/**
 * Site-wide band: "Check any car's MOT history and DVLA record, free" with the number-plate
 * search. Shown on every page (app.html) and mid-way down the home pages. Renders nothing
 * when the vehicle check service is not configured for this build.
 */
@Component({
  selector: 'app-vehicle-check-band',
  imports: [RegSearchComponent, RouterLink],
  template: `
    @if (available) {
      <section class="on-dark relative overflow-hidden bg-stone-900 text-white print:hidden" aria-labelledby="vcb-title">
        <div class="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-rose-500/25 blur-3xl" aria-hidden="true"></div>
        <div class="pointer-events-none absolute -bottom-28 right-0 h-72 w-72 rounded-full bg-orange-500/15 blur-3xl" aria-hidden="true"></div>
        <div class="relative mx-auto grid max-w-7xl gap-6 px-4 py-10 sm:px-6 lg:grid-cols-[1.15fr_1fr] lg:items-center lg:gap-12 lg:px-8 lg:py-12">
          <div>
            <p class="mb-2 text-xs font-bold uppercase tracking-wider text-rose-300">Free vehicle check</p>
            <h2 id="vcb-title" class="theme-title font-display text-2xl font-bold leading-tight tracking-tight sm:text-3xl">
              Check any car’s <span class="title-accent">MOT history</span> and DVLA record
            </h2>
            <p class="mt-3 max-w-xl text-sm leading-relaxed text-white/75 sm:text-base">
              Every MOT test with its advisories, the mileage record, plus tax, MOT status and the official DVLA details. Free, instant and no sign-up.
            </p>
          </div>
          <div>
            <app-reg-search />
            <p class="mt-3 text-xs text-white/60">
              Official data from DVSA and DVLA.
              <a routerLink="/mot-check" class="font-semibold text-white underline decoration-white/40 underline-offset-2 hover:decoration-white">How it works</a>
            </p>
          </div>
        </div>
      </section>
    }
  `,
  styles: `
    :host {
      display: block;
    }
  `,
})
export class VehicleCheckBandComponent {
  readonly available = inject(DvlaVehicleService).isAvailable();
}

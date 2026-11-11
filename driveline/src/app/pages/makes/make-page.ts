import { Component, DOCUMENT, PLATFORM_ID, computed, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs/operators';
import { Meta, Title } from '@angular/platform-browser';
import { VehicleService } from '../../services/vehicle.service';
import { VehicleCardComponent } from '../../components/vehicles/vehicle-card/vehicle-card';
import { PageHeaderComponent } from '../../components/layout/page-header/page-header';
import { FindMeACarComponent } from '../../components/shared/find-me-a-car/find-me-a-car';
import { FINANCE_DISCLAIMER_SHORT } from '../../utils/finance-display';
import { makeSlug } from '../../utils/make-slug';

/** /used-cars/:make: every on-sale vehicle of one make, for buyers and search engines. */
@Component({
  selector: 'app-make-page',
  imports: [RouterLink, VehicleCardComponent, PageHeaderComponent, FindMeACarComponent],
  template: `
    <app-page-header [crumb]="make() || 'Make'" parentLabel="Used cars" parentLink="/cars" [title]="heading()" [lead]="lead()" />

    <div class="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      @if (cars().length) {
        <div class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          @for (v of cars(); track v.id) {
            <app-vehicle-card [vehicle]="v" />
          }
        </div>
        <p class="mt-6 text-xs leading-relaxed text-ink-faint">* {{ financeNote }}</p>
      } @else {
        <div class="rounded-2xl border border-line bg-surface-raised p-10 text-center shadow-card">
          <p class="text-lg font-semibold text-ink">No {{ make() || 'cars of this make' }} in stock right now</p>
          <p class="mt-1 text-ink-muted">Stock changes every week. Tell us what you are after and we'll look out for one.</p>
          <a routerLink="/cars" class="btn-primary mt-5">See all our cars</a>
        </div>
      }

      @if (otherMakes().length) {
        <section class="mt-14" aria-labelledby="makes-h">
          <h2 id="makes-h" class="mb-4 text-lg font-bold text-ink">Browse other makes</h2>
          <ul class="flex flex-wrap gap-2">
            @for (m of otherMakes(); track m.slug) {
              <li><a [routerLink]="['/used-cars', m.slug]" class="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-raised px-3.5 py-2 text-sm font-medium text-ink hover:border-brand hover:link-brand">{{ m.name }} <span class="text-ink-faint">{{ m.count }}</span></a></li>
            }
          </ul>
        </section>
      }

      <div class="mt-14"><app-find-me-a-car /></div>
    </div>
  `,
})
export class MakePageComponent {
  private readonly vehicles = inject(VehicleService);
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  private readonly document = inject(DOCUMENT);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  readonly financeNote = FINANCE_DISCLAIMER_SHORT;

  private readonly slug = toSignal(inject(ActivatedRoute).paramMap.pipe(map((p) => p.get('make') ?? '')), { initialValue: '' });

  readonly cars = computed(() =>
    this.vehicles
      .allStock()
      .filter((v) => makeSlug(v.make) === this.slug())
      .sort((a, b) => Number(!!a.photosPending) - Number(!!b.photosPending) || new Date(b.dateAdded).getTime() - new Date(a.dateAdded).getTime()),
  );
  readonly make = computed(() => this.cars()[0]?.make ?? this.slug().replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()));
  readonly heading = computed(() => `Used ${this.make()} for sale in Peterborough`);
  readonly lead = computed(() => {
    const cars = this.cars();
    if (!cars.length) return '';
    const from = Math.min(...cars.map((c) => c.price));
    const n = cars.length;
    return `${n} used ${this.make()} ${n === 1 ? 'vehicle' : 'vehicles'} in stock at DriveLine, from £${from.toLocaleString('en-GB')}. Every one inspected, with warranty and finance available.`;
  });
  readonly otherMakes = computed(() => {
    const counts = new Map<string, number>();
    for (const v of this.vehicles.allStock()) counts.set(v.make, (counts.get(v.make) ?? 0) + 1);
    return [...counts.entries()]
      .map(([name, count]) => ({ name, count, slug: makeSlug(name) }))
      .filter((m) => m.slug !== this.slug())
      .sort((a, b) => a.name.localeCompare(b.name));
  });

  constructor() {
    // Own title, description and canonical (route data marks this page as managed).
    const t = this.heading() + ' | DriveLine';
    const d = this.lead() || `Used ${this.make()} cars and vans at DriveLine Car Sales, Peterborough.`;
    this.title.setTitle(t);
    this.meta.updateTag({ name: 'description', content: d });
    this.meta.updateTag({ property: 'og:title', content: t });
    this.meta.updateTag({ property: 'og:description', content: d });
    this.meta.updateTag({ name: 'twitter:title', content: t });
    this.meta.updateTag({ name: 'twitter:description', content: d });
    const url = `https://drivelinecarsales.co.uk/used-cars/${this.slug()}/`;
    this.meta.updateTag({ property: 'og:url', content: url });
    let link = this.document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!link) {
      link = this.document.createElement('link');
      link.rel = 'canonical';
      this.document.head.appendChild(link);
    }
    link.href = url;
    if (this.browser && !this.cars().length) this.meta.updateTag({ name: 'robots', content: 'noindex' });
  }
}

import { Component, DestroyRef, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { DatePipe, isPlatformBrowser } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { catchError, forkJoin, of } from 'rxjs';
import { PageHeaderComponent } from '../../components/layout/page-header/page-header';
import { RegSearchComponent, normaliseReg } from '../../components/shared/reg-search/reg-search';
import { MotHistoryComponent } from '../../components/vehicles/mot-history/mot-history';
import { DvlaVehicleService } from '../../services/dvla-vehicle.service';
import { DvlaVehicleDetails } from '../../models/dvla-vehicle.model';
import { MotHistory } from '../../models/mot-history.model';
import { GOV_MOT_CHECK } from '../../utils/vehicle-insights';

type Row = { label: string; value: string };

const titleCase = (s: string | undefined) =>
  s ? s.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase()) : undefined;

/**
 * Free vehicle check for ANY registration: the complete DVLA record (tax, MOT status,
 * emissions, first registration, logbook date…) and the full DVSA MOT history (every test,
 * advisories, mileage record). /mot-check?reg=AB12CDE runs the check straight away, so
 * results can be linked and shared.
 */
@Component({
  selector: 'app-vehicle-check',
  imports: [PageHeaderComponent, RegSearchComponent, MotHistoryComponent, RouterLink, DatePipe],
  template: `
    <app-page-header
      crumb="MOT &amp; vehicle check"
      title="Free MOT history and DVLA check"
      lead="Enter any UK registration to see the official MOT history and DVLA record. Free, instant and no sign-up."
    />

    <div class="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
      <!-- Search -->
      <section class="tool-card !p-5 sm:!p-7" aria-labelledby="vc-search-title">
        <h2 id="vc-search-title" class="text-lg font-bold text-gray-900 dark:text-white">Which vehicle?</h2>
        <p class="mb-4 mt-1 text-sm text-gray-600 dark:text-slate-300">Type the registration exactly as it is on the number plate. Spaces don’t matter.</p>
        @if (available) {
          <div class="max-w-xl">
            <app-reg-search [value]="reg()" [busy]="state() === 'loading'" [navigate]="false" (search)="check($event)" />
          </div>
        } @else {
          <p class="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-950/30 dark:text-amber-100">
            Our vehicle check is not available just now. You can use the official services directly:
            <a [href]="govMot" target="_blank" rel="noopener noreferrer" class="font-semibold underline">MOT history on GOV.UK ↗</a>
            and
            <a [href]="govVes" target="_blank" rel="noopener noreferrer" class="font-semibold underline">vehicle enquiry on GOV.UK ↗</a>.
          </p>
        }
      </section>

      <div class="mt-6" aria-live="polite">
        @switch (state()) {
          @case ('loading') {
            <div class="space-y-4" role="status" aria-label="Checking the vehicle">
              <div class="skeleton h-28 w-full rounded-2xl"></div>
              <div class="skeleton h-56 w-full rounded-2xl"></div>
              <div class="skeleton h-72 w-full rounded-2xl"></div>
            </div>
          }
          @case ('error') {
            <div class="rounded-2xl border border-red-200 bg-red-50 p-5 text-red-900 dark:border-red-800/60 dark:bg-red-950/40 dark:text-red-100" role="alert">
              <p class="font-bold">{{ errorTitle() }}</p>
              <p class="mt-1 text-sm">{{ errorText() }}</p>
            </div>
          }
          @case ('done') {
            <!-- Vehicle summary -->
            <section class="tool-card !p-5 sm:!p-7" aria-labelledby="vc-vehicle-title">
              <div class="flex flex-wrap items-center gap-x-5 gap-y-3">
                <span class="vc-plate" aria-label="Registration {{ reg() }}">{{ plate() }}</span>
                <div class="min-w-0">
                  <h2 id="vc-vehicle-title" class="text-xl font-bold leading-tight text-gray-900 dark:text-white sm:text-2xl">{{ vehicleName() }}</h2>
                  @if (vehicleLine()) {
                    <p class="mt-0.5 text-sm text-gray-600 dark:text-slate-300">{{ vehicleLine() }}</p>
                  }
                </div>
              </div>

              @if (dvla(); as d) {
                <div class="mt-5 grid gap-3 sm:grid-cols-2">
                  <div class="vc-status" [class.ok]="taxOk()" [class.warn]="!taxOk()">
                    <p class="tool-kicker">Vehicle tax</p>
                    <p class="vc-status-value">{{ d.taxStatus || 'Not known' }}</p>
                    @if (d.taxDueDate) {
                      <p class="vc-status-note">{{ taxOk() ? 'Due' : 'Was due' }} {{ d.taxDueDate | date: 'd MMMM y' }}</p>
                    }
                  </div>
                  <div class="vc-status" [class.ok]="motOk()" [class.warn]="!motOk()">
                    <p class="tool-kicker">MOT</p>
                    <p class="vc-status-value">{{ d.motStatus || 'Not known' }}</p>
                    @if (d.motExpiryDate) {
                      <p class="vc-status-note">{{ motOk() ? 'Expires' : 'Expired' }} {{ d.motExpiryDate | date: 'd MMMM y' }}</p>
                    }
                  </div>
                </div>
              }
            </section>

            <!-- Complete DVLA record -->
            @if (dvlaRows().length) {
              <section class="tool-card mt-6 !p-5 sm:!p-7" aria-labelledby="vc-dvla-title">
                <h2 id="vc-dvla-title" class="text-lg font-bold text-gray-900 dark:text-white">DVLA vehicle details</h2>
                <p class="mb-4 mt-1 text-sm text-gray-600 dark:text-slate-300">The official record held by the DVLA for {{ plate() }}.</p>
                <dl class="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  @for (row of dvlaRows(); track row.label) {
                    <div class="stat-chip">
                      <dt class="tool-kicker">{{ row.label }}</dt>
                      <dd class="mt-0.5 font-semibold text-gray-900 dark:text-white">{{ row.value }}</dd>
                    </div>
                  }
                </dl>
              </section>
            } @else {
              <p class="mt-6 rounded-2xl border border-stone-200 bg-white p-5 text-sm text-gray-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                The DVLA record for this registration could not be loaded just now. The MOT history is below.
              </p>
            }

            <!-- Full MOT history -->
            <section class="tool-card mt-6 !p-5 sm:!p-7" aria-labelledby="vc-mot-title">
              <h2 id="vc-mot-title" class="text-lg font-bold text-gray-900 dark:text-white">MOT history</h2>
              <p class="mb-5 mt-1 text-sm text-gray-600 dark:text-slate-300">Every MOT on record from the DVSA, newest first, with the mileage and anything the tester noted.</p>
              <app-mot-history [registration]="reg()" [preloaded]="mot()" />
            </section>

            <!-- What next -->
            <section class="mt-6 grid gap-4 sm:grid-cols-2" aria-label="What next">
              <div class="tool-card !p-5">
                <h2 class="font-bold text-gray-900 dark:text-white">Selling or part-exchanging it?</h2>
                <p class="mt-1 text-sm text-gray-600 dark:text-slate-300">Get a fair valuation from us. It takes about two minutes.</p>
                <a routerLink="/sell-your-car" class="btn-primary mt-4 !px-4 !py-2.5 text-sm">Value my car</a>
              </div>
              <div class="tool-card !p-5">
                <h2 class="font-bold text-gray-900 dark:text-white">Looking for your next car?</h2>
                <p class="mt-1 text-sm text-gray-600 dark:text-slate-300">Every car we sell is inspected and comes with our own warranty.</p>
                <a routerLink="/cars" class="btn-outline mt-4 !px-4 !py-2.5 text-sm">Browse our cars</a>
              </div>
            </section>

            <p class="mt-6 text-xs leading-relaxed text-gray-500 dark:text-slate-400">
              Data comes live from the DVLA Vehicle Enquiry Service and the DVSA MOT History service at the moment you search.
              It is provided for information; always confirm important details before buying a vehicle.
            </p>
          }
          @default {
            <!-- Before a search: what you get -->
            <ul class="grid gap-4 sm:grid-cols-3" aria-label="What the check shows">
              @for (f of features; track f.title) {
                <li class="tool-card !p-5">
                  <h2 class="font-bold text-gray-900 dark:text-white">{{ f.title }}</h2>
                  <p class="mt-1 text-sm leading-relaxed text-gray-600 dark:text-slate-300">{{ f.text }}</p>
                </li>
              }
            </ul>
          }
        }
      </div>
    </div>
  `,
  styles: `
    :host {
      display: block;
    }
    .vc-plate {
      display: inline-flex;
      align-items: center;
      height: 3rem;
      padding: 0 1rem;
      border-radius: 0.6rem;
      background: #ffd814;
      box-shadow: inset 0 0 0 2px #1a1a1a;
      color: #111;
      font-family: var(--dl-font-display);
      font-size: 1.4rem;
      font-weight: 800;
      letter-spacing: 0.08em;
      white-space: nowrap;
    }
    .vc-status {
      border-radius: 0.9rem;
      padding: 0.9rem 1rem;
      border: 1px solid transparent;
    }
    .vc-status.ok {
      background: #ecfdf5;
      border-color: #a7f3d0;
    }
    .vc-status.warn {
      background: #fffbeb;
      border-color: #fde68a;
    }
    .vc-status-value {
      margin-top: 0.15rem;
      font-size: 1.15rem;
      font-weight: 700;
    }
    .vc-status.ok .vc-status-value {
      color: #065f46;
    }
    .vc-status.warn .vc-status-value {
      color: #92400e;
    }
    .vc-status-note {
      font-size: 0.85rem;
      color: #44403c;
    }
    :host-context(html.dark) .vc-status.ok {
      background: rgb(6 78 59 / 0.35);
      border-color: rgb(16 185 129 / 0.4);
    }
    :host-context(html.dark) .vc-status.warn {
      background: rgb(120 53 15 / 0.35);
      border-color: rgb(245 158 11 / 0.4);
    }
    :host-context(html.dark) .vc-status.ok .vc-status-value {
      color: #6ee7b7;
    }
    :host-context(html.dark) .vc-status.warn .vc-status-value {
      color: #fcd34d;
    }
    :host-context(html.dark) .vc-status-note,
    :host-context(html.dark) .vc-status .tool-kicker {
      color: #d6d3d1;
    }
    .vc-status .tool-kicker {
      color: #44403c;
    }
  `,
})
export class VehicleCheckComponent {
  private readonly lookup = inject(DvlaVehicleService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));

  readonly available = this.lookup.isAvailable();
  readonly govMot = GOV_MOT_CHECK;
  readonly govVes = 'https://vehicleenquiry.service.gov.uk/';

  readonly reg = signal('');
  readonly state = signal<'idle' | 'loading' | 'done' | 'error'>('idle');
  readonly dvla = signal<DvlaVehicleDetails | null>(null);
  readonly mot = signal<MotHistory | null>(null);
  readonly errorTitle = signal('');
  readonly errorText = signal('');
  private run = 0;

  readonly features = [
    { title: 'Full MOT history', text: 'Every test on record: pass or fail, the date, the mileage, and each advisory and defect the tester wrote down.' },
    { title: 'Mileage record', text: 'The reading at every MOT on a simple chart, so you can see it rise steadily year after year.' },
    { title: 'Official DVLA record', text: 'Tax and MOT status with their dates, colour, fuel, engine size, CO₂, Euro status, first registration and more.' },
  ];

  /** "AB12CDE" → "AB12 CDE" for display */
  readonly plate = computed(() => {
    const r = this.reg();
    return /^[A-Z]{2}\d{2}[A-Z]{3}$/.test(r) ? `${r.slice(0, 4)} ${r.slice(4)}` : r;
  });

  readonly vehicleName = computed(() => {
    const make = titleCase(this.mot()?.make ?? this.dvla()?.make ?? undefined);
    const model = titleCase(this.mot()?.model ?? undefined);
    return [make, model].filter(Boolean).join(' ') || this.plate();
  });

  readonly vehicleLine = computed(() => {
    const d = this.dvla();
    const m = this.mot();
    const cc = d?.engineCapacity ?? m?.engineSizeCc ?? null;
    return [
      titleCase(d?.colour ?? m?.colour ?? undefined),
      titleCase(d?.fuelType ?? m?.fuelType ?? undefined),
      cc ? `${cc.toLocaleString('en-GB')} cc` : undefined,
      d?.yearOfManufacture ?? m?.manufactureYear ?? undefined,
    ]
      .filter(Boolean)
      .join(' · ');
  });

  readonly taxOk = computed(() => /^taxed$/i.test(this.dvla()?.taxStatus ?? ''));
  readonly motOk = computed(() => /^valid$/i.test(this.dvla()?.motStatus ?? ''));

  readonly dvlaRows = computed<Row[]>(() => {
    const d = this.dvla();
    if (!d) return [];
    const rows: Row[] = [];
    const add = (label: string, value: string | number | undefined | null) => {
      if (value !== undefined && value !== null && value !== '') rows.push({ label, value: String(value) });
    };
    const month = (ym?: string) => {
      const m = /^(\d{4})-(\d{2})$/.exec(ym ?? '');
      return m ? new Date(+m[1], +m[2] - 1, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }) : ym;
    };
    const day = (ymd?: string) => {
      const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd ?? '');
      return m ? new Date(+m[1], +m[2] - 1, +m[3]).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : ymd;
    };
    add('Make', titleCase(d.make));
    add('Colour', titleCase(d.colour));
    add('Fuel type', titleCase(d.fuelType));
    add('Engine size', d.engineCapacity ? `${d.engineCapacity.toLocaleString('en-GB')} cc` : undefined);
    add('Year of manufacture', d.yearOfManufacture);
    add('First registered', month(d.monthOfFirstRegistration));
    add('First registered in the UK', month(d.monthOfFirstDvlaRegistration));
    add('CO₂ emissions', d.co2Emissions != null ? `${d.co2Emissions} g/km` : undefined);
    add('Euro status', d.euroStatus);
    add('Real driving emissions', d.realDrivingEmissions);
    add('Wheel plan', titleCase(d.wheelplan));
    add('Type approval', d.typeApproval);
    add('Revenue weight', d.revenueWeight ? `${d.revenueWeight.toLocaleString('en-GB')} kg` : undefined);
    add('Logbook (V5C) last issued', day(d.dateOfLastV5CIssued));
    add('Marked for export', d.markedForExport === undefined ? undefined : d.markedForExport ? 'Yes' : 'No');
    return rows;
  });

  constructor() {
    this.route.queryParamMap.pipe(takeUntilDestroyed(inject(DestroyRef))).subscribe((params) => {
      const reg = normaliseReg(params.get('reg'));
      if (!reg) {
        this.reg.set('');
        this.state.set('idle');
        return;
      }
      if (reg !== this.reg() || this.state() === 'idle') this.load(reg);
    });
  }

  /** From the search box: put the registration in the address (shareable), then check. */
  check(reg: string): void {
    if (reg === this.reg() && this.state() !== 'idle') {
      this.load(reg);
      return;
    }
    this.router.navigate([], { relativeTo: this.route, queryParams: { reg }, replaceUrl: this.state() === 'idle' && !this.reg() ? false : false });
  }

  private load(reg: string): void {
    this.reg.set(reg);
    if (!this.browser || !this.available) return;
    const run = ++this.run;
    this.state.set('loading');
    forkJoin({
      dvla: this.lookup.lookupByRegistration(reg).pipe(catchError(() => of(null))),
      mot: this.lookup.motHistory(reg).pipe(catchError(() => of(null))),
    }).subscribe(({ dvla, mot }) => {
      if (run !== this.run) return;
      this.dvla.set(dvla);
      this.mot.set(mot);
      if (!dvla && !mot) {
        this.errorTitle.set(`We could not find ${this.plate()}`);
        this.errorText.set('Check the registration and try again. If it is right, the official services may be busy: please try again in a minute.');
        this.state.set('error');
        return;
      }
      this.state.set('done');
    });
  }
}

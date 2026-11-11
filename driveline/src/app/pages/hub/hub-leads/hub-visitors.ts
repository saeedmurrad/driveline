import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { LeadsService, type DayStats } from '../../../services/leads.service';
import { VehicleService } from '../../../services/vehicle.service';
import { PAGE_KEYS, SOURCE_LABELS, londonDay } from '../../../services/visit-stats.service';

interface Row {
  key: string;
  label: string;
  count: number;
  link?: string;
}

const DEVICE_LABELS: Record<string, string> = { mobile: 'Phone', tablet: 'Tablet', desktop: 'Computer' };

/** Visitor numbers for /hub, from the cookie-free daily counts in stats/{day}. */
@Component({
  selector: 'app-hub-visitors',
  imports: [DecimalPipe, RouterLink],
  template: `
    <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div class="flex gap-1.5" role="tablist" aria-label="Period">
        @for (r of ranges; track r.days) {
          <button type="button" role="tab" [attr.aria-selected]="days() === r.days" (click)="setDays(r.days)"
            class="rounded-full px-3.5 py-2 text-sm font-semibold"
            [class]="days() === r.days ? 'bg-stone-900 text-white' : 'bg-white text-stone-600 ring-1 ring-stone-200 hover:bg-stone-50'">{{ r.label }}</button>
        }
      </div>
      <button type="button" (click)="load()" [disabled]="loading()" class="rounded-lg px-3 py-2 text-sm font-medium text-stone-600 hover:bg-stone-200/60 disabled:opacity-50">
        {{ loading() ? 'Loading…' : 'Refresh' }}
      </button>
    </div>

    @if (error()) {
      <p class="mb-4 rounded-lg bg-rose-50 p-3 text-sm text-rose-800 ring-1 ring-rose-200" role="alert">{{ error() }}</p>
    }

    <div class="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
      <div class="rounded-2xl bg-white p-4 ring-1 ring-stone-200">
        <p class="text-xs font-medium text-stone-500">Visits</p>
        <p class="mt-1 text-2xl font-bold tabular-nums">{{ totals().visits | number }}</p>
        <p class="mt-0.5 text-xs text-stone-400">{{ todayVisits() | number }} today</p>
      </div>
      <div class="rounded-2xl bg-white p-4 ring-1 ring-stone-200">
        <p class="text-xs font-medium text-stone-500">Pages viewed</p>
        <p class="mt-1 text-2xl font-bold tabular-nums">{{ totals().views | number }}</p>
        <p class="mt-0.5 text-xs text-stone-400">{{ pagesPerVisit() }} per visit</p>
      </div>
      <div class="rounded-2xl bg-white p-4 ring-1 ring-stone-200">
        <p class="text-xs font-medium text-stone-500">Car pages viewed</p>
        <p class="mt-1 text-2xl font-bold tabular-nums text-rose-700">{{ totals().carViews | number }}</p>
      </div>
      <div class="rounded-2xl bg-white p-4 ring-1 ring-stone-200">
        <p class="text-xs font-medium text-stone-500">On a phone</p>
        <p class="mt-1 text-2xl font-bold tabular-nums">{{ phoneShare() }}%</p>
      </div>
    </div>

    <!-- Visits per day -->
    <section class="mb-5 rounded-2xl bg-white p-5 ring-1 ring-stone-200" aria-label="Visits per day">
      <p class="mb-4 text-sm font-semibold">Visits per day</p>
      <div class="flex h-40 items-end gap-[3px]">
        @for (d of daily(); track d.day) {
          <div class="group relative flex h-full flex-1 flex-col justify-end">
            <div class="w-full rounded-t bg-rose-400 transition-colors group-hover:bg-rose-600"
              [style.height.%]="maxVisits() ? (d.visits / maxVisits()) * 100 : 0" [style.min-height.px]="d.visits ? 2 : 0"></div>
            <span class="pointer-events-none absolute -top-7 left-1/2 z-10 hidden -translate-x-1/2 whitespace-nowrap rounded bg-stone-900 px-2 py-1 text-[11px] text-white group-hover:block">
              {{ d.label }}: {{ d.visits }} visits, {{ d.views }} pages
            </span>
          </div>
        }
      </div>
      <div class="mt-2 flex justify-between text-[11px] text-stone-400">
        <span>{{ daily()[0]?.label }}</span><span>Today</span>
      </div>
    </section>

    <div class="grid gap-4 lg:grid-cols-3">
      <section class="rounded-2xl bg-white p-5 ring-1 ring-stone-200 lg:col-span-2" aria-label="Most viewed cars">
        <p class="mb-3 text-sm font-semibold">Most viewed cars</p>
        @for (r of topCars(); track r.key; let i = $index) {
          <div class="flex items-center gap-3 border-t border-stone-100 py-2 text-sm first:border-0">
            <span class="w-5 text-right tabular-nums text-stone-400">{{ i + 1 }}</span>
            @if (r.link) {
              <a [routerLink]="r.link" target="_blank" class="min-w-0 flex-1 truncate font-medium hover:text-rose-700">{{ r.label }}</a>
            } @else {
              <span class="min-w-0 flex-1 truncate text-stone-500">{{ r.label }}</span>
            }
            <span class="font-semibold tabular-nums">{{ r.count }}</span>
          </div>
        } @empty {
          <p class="text-sm text-stone-500">No car pages viewed yet.</p>
        }
      </section>

      <div class="space-y-4">
        <section class="rounded-2xl bg-white p-5 ring-1 ring-stone-200" aria-label="Where visitors came from">
          <p class="mb-3 text-sm font-semibold">Where visitors came from</p>
          @for (r of sources(); track r.key) {
            <div class="mb-2">
              <div class="flex justify-between text-sm"><span>{{ r.label }}</span><span class="tabular-nums text-stone-500">{{ r.count }}</span></div>
              <div class="mt-1 h-1.5 rounded-full bg-stone-100"><div class="h-full rounded-full bg-rose-400" [style.width.%]="share(r.count, totals().visits)"></div></div>
            </div>
          } @empty {
            <p class="text-sm text-stone-500">No visits yet.</p>
          }
        </section>

        <section class="rounded-2xl bg-white p-5 ring-1 ring-stone-200" aria-label="Pages">
          <p class="mb-3 text-sm font-semibold">Pages</p>
          @for (r of pages(); track r.key) {
            <div class="flex justify-between border-t border-stone-100 py-1.5 text-sm first:border-0"><span>{{ r.label }}</span><span class="tabular-nums text-stone-500">{{ r.count }}</span></div>
          } @empty {
            <p class="text-sm text-stone-500">No pages viewed yet.</p>
          }
        </section>

        <section class="rounded-2xl bg-white p-5 ring-1 ring-stone-200" aria-label="Devices">
          <p class="mb-3 text-sm font-semibold">Devices</p>
          @for (r of devices(); track r.key) {
            <div class="flex justify-between border-t border-stone-100 py-1.5 text-sm first:border-0"><span>{{ r.label }}</span><span class="tabular-nums text-stone-500">{{ share(r.count, totals().visits) }}%</span></div>
          } @empty {
            <p class="text-sm text-stone-500">No visits yet.</p>
          }
        </section>
      </div>
    </div>

    <p class="mt-5 text-xs leading-relaxed text-stone-400">
      Counted without cookies and without identifying anyone. A visit is one opening of the website (the same person on two days counts twice).
      Your own browsing is not counted on browsers where you have signed in to the hub. Counting started on 10 November 2026.
    </p>
  `,
})
export class HubVisitorsComponent implements OnInit {
  private readonly leads = inject(LeadsService);
  private readonly vehicles = inject(VehicleService);

  readonly ranges = [
    { days: 7, label: '7 days' },
    { days: 30, label: '30 days' },
    { days: 90, label: '90 days' },
  ];
  readonly days = signal(7);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  private readonly stats = signal<DayStats[]>([]);

  ngOnInit(): void {
    void this.load();
  }

  setDays(n: number): void {
    this.days.set(n);
    void this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      this.stats.set(await this.leads.loadStats(this.dayKeys()[0]));
    } catch {
      this.error.set('Could not load visitor numbers. Check your connection and try again.');
    } finally {
      this.loading.set(false);
    }
  }

  /** London day ids for the chosen period, oldest first, ending today. */
  private dayKeys(): string[] {
    const out: string[] = [];
    const now = Date.now();
    for (let i = this.days() - 1; i >= 0; i--) out.push(londonDay(new Date(now - i * 86_400_000)));
    return [...new Set(out)];
  }

  readonly daily = computed(() => {
    const byDay = new Map(this.stats().map((s) => [s.day, s]));
    return this.dayKeys().map((day) => {
      const s = byDay.get(day);
      const label = new Date(day + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
      return { day, label, visits: s?.visits ?? 0, views: s?.views ?? 0 };
    });
  });

  private inRange = computed(() => {
    const keys = new Set(this.dayKeys());
    return this.stats().filter((s) => keys.has(s.day));
  });

  private sum(field: 'pages' | 'cars' | 'sources' | 'devices'): Map<string, number> {
    const m = new Map<string, number>();
    for (const s of this.inRange()) for (const [k, v] of Object.entries(s[field])) m.set(k, (m.get(k) ?? 0) + (v as number));
    return m;
  }

  private rows(m: Map<string, number>, label: (k: string) => string): Row[] {
    return [...m.entries()].map(([key, count]) => ({ key, count, label: label(key) })).sort((a, b) => b.count - a.count);
  }

  readonly totals = computed(() => {
    let views = 0;
    let visits = 0;
    let carViews = 0;
    for (const s of this.inRange()) {
      views += s.views;
      visits += s.visits;
      carViews += Object.values(s.cars).reduce((a, b) => a + (b as number), 0);
    }
    return { views, visits, carViews };
  });

  readonly maxVisits = computed(() => Math.max(0, ...this.daily().map((d) => d.visits)));
  readonly todayVisits = computed(() => this.daily().at(-1)?.visits ?? 0);
  readonly pagesPerVisit = computed(() => {
    const t = this.totals();
    return t.visits ? (t.views / t.visits).toFixed(1) : '0';
  });
  readonly phoneShare = computed(() => this.share(this.sum('devices').get('mobile') ?? 0, this.totals().visits));

  readonly topCars = computed(() =>
    this.rows(this.sum('cars'), (id) => {
      const v = this.vehicles.getVehicleById(id);
      return v ? `${v.year} ${v.make} ${v.model} ${v.status === 'sold' ? '(sold)' : ''}` : `Stock ${id} (no longer listed)`;
    })
      .map((r) => ({ ...r, link: this.vehicles.getVehicleById(r.key) ? `/vehicle/${r.key}` : undefined }))
      .slice(0, 15),
  );
  readonly sources = computed(() => this.rows(this.sum('sources'), (k) => SOURCE_LABELS[k] ?? k));
  readonly pages = computed(() => this.rows(this.sum('pages'), (k) => PAGE_KEYS[k] ?? k));
  readonly devices = computed(() => this.rows(this.sum('devices'), (k) => DEVICE_LABELS[k] ?? k));

  share(n: number, total: number): number {
    return total ? Math.round((n / total) * 100) : 0;
  }
}

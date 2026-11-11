import { Component, Input, OnChanges, PLATFORM_ID, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe, isPlatformBrowser } from '@angular/common';
import { DvlaVehicleService } from '../../../services/dvla-vehicle.service';
import { summariseMot, type MotHistory, type MotSummary } from '../../../models/mot-history.model';
import { GOV_MOT_CHECK } from '../../../utils/vehicle-insights';

/**
 * Full MOT history for a stock vehicle, live from DVSA (through the vehicle check
 * worker): validity, first-time pass rate, a mileage check, and every test with its
 * advisories. Shows nothing if the service is not set up or has no record.
 */
@Component({
  selector: 'app-mot-history',
  imports: [DatePipe, DecimalPipe],
  template: `
    @if (state() === 'loading') {
      <div class="space-y-3" role="status" aria-label="Loading MOT history">
        <div class="skeleton h-16 w-full"></div>
        <div class="skeleton h-28 w-full"></div>
      </div>
    } @else if (state() === 'none') {
      <p class="text-sm text-gray-600 dark:text-slate-300">
        We could not load the MOT history just now.
        <a [href]="govLink" target="_blank" rel="noopener noreferrer" class="font-semibold text-rose-700 hover:underline dark:text-rose-300">Check it on GOV.UK ↗</a>
      </p>
    } @else if (history(); as h) {
      @let s = summary()!;
      <div class="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div class="stat-chip">
          <p class="tool-kicker">MOT valid until</p>
          <p class="mt-0.5 font-semibold text-gray-900 dark:text-white">{{ s.validUntil ? (s.validUntil | date: 'd MMM y') : (h.motTestDueDate ? 'First due ' + (h.motTestDueDate | date: 'MMM y') : '—') }}</p>
        </div>
        <div class="stat-chip">
          <p class="tool-kicker">Passed first time</p>
          <p class="mt-0.5 font-semibold text-gray-900 dark:text-white">{{ s.firstTimePassRate != null ? s.firstTimePassRate + '%' : '—' }} <span class="text-xs font-normal text-gray-500 dark:text-slate-400">of {{ s.tests }} tests</span></p>
        </div>
        <div class="stat-chip">
          <p class="tool-kicker">Mileage record</p>
          @if (s.mileageConsistent === true) {
            <p class="mt-0.5 font-semibold text-emerald-700 dark:text-emerald-400">Goes up every test ✓</p>
          } @else if (s.mileageConsistent === false) {
            <p class="mt-0.5 font-semibold text-amber-700 dark:text-amber-400">Ask us about this</p>
          } @else {
            <p class="mt-0.5 font-semibold text-gray-900 dark:text-white">—</p>
          }
        </div>
        <div class="stat-chip">
          <p class="tool-kicker">Safety recall</p>
          <p class="mt-0.5 font-semibold" [class]="h.hasOutstandingRecall === 'Yes' ? 'text-amber-700 dark:text-amber-400' : 'text-gray-900 dark:text-white'">
            {{ h.hasOutstandingRecall === 'Yes' ? 'Outstanding' : h.hasOutstandingRecall === 'No' ? 'None outstanding' : 'Not known' }}
          </p>
        </div>
      </div>

      @if (s.mileagePoints.length >= 2) {
        <div class="mb-5">
          <p class="mb-2 text-sm font-semibold text-gray-900 dark:text-white">
            Mileage at each MOT
            @if (s.averageMilesPerYear) {
              <span class="font-normal text-gray-500 dark:text-slate-400">· about {{ s.averageMilesPerYear | number }} miles a year</span>
            }
          </p>
          <div class="flex h-32 items-end gap-1.5" role="img" [attr.aria-label]="'Mileage rose from ' + (s.mileagePoints[0].miles | number) + ' to ' + (s.mileagePoints[s.mileagePoints.length - 1].miles | number) + ' miles'">
            @for (p of s.mileagePoints; track p.date) {
              <div class="flex h-full min-w-0 flex-1 flex-col justify-end">
                <span class="mb-1 truncate text-center text-[11px] font-semibold tabular-nums text-gray-700 dark:text-slate-200">{{ (p.miles / 1000) | number: '1.0-0' }}k</span>
                <div class="w-full rounded-t bg-rose-300 dark:bg-rose-500/60" [style.height.%]="(p.miles / maxMiles()) * 82"></div>
              </div>
            }
          </div>
          <div class="mt-1 flex gap-1.5 text-[11px] text-gray-500">
            @for (p of s.mileagePoints; track p.date) {
              <span class="min-w-0 flex-1 truncate text-center">{{ p.date | date: 'MMM y' }}</span>
            }
          </div>
        </div>
      }

      <ol class="divide-y divide-stone-200 rounded-xl border border-stone-200 dark:divide-slate-700 dark:border-slate-700">
        @for (t of visibleTests(); track t.date + t.result) {
          <li class="p-3.5">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <div class="flex items-center gap-2">
                <span class="rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide"
                  [class]="t.result === 'pass' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300' : 'bg-rose-100 text-rose-800 dark:bg-rose-900/50 dark:text-rose-300'">{{ t.result === 'pass' ? 'Pass' : 'Fail' }}</span>
                <span class="text-sm font-semibold text-gray-900 dark:text-white">{{ t.date | date: 'd MMM y' }}</span>
              </div>
              <span class="text-sm tabular-nums text-gray-600 dark:text-slate-300">{{ t.mileage ? (t.mileage.value | number) + (t.mileage.unit === 'km' ? ' km' : ' miles') : 'Mileage not read' }}</span>
            </div>
            @if (t.failures.length || t.advisories.length || t.minors.length) {
              <details class="mt-2 text-sm">
                <summary class="cursor-pointer text-xs font-semibold text-gray-600 hover:text-gray-900 dark:text-slate-400 dark:hover:text-white">
                  {{ t.failures.length ? t.failures.length + ' fail item' + (t.failures.length === 1 ? '' : 's') + ' · ' : '' }}{{ t.advisories.length }} advisor{{ t.advisories.length === 1 ? 'y' : 'ies' }}{{ t.minors.length ? ' · ' + t.minors.length + ' minor' : '' }}
                </summary>
                <ul class="mt-2 space-y-1 pl-1">
                  @for (d of t.failures; track $index) {
                    <li class="flex gap-2 text-rose-800 dark:text-rose-300"><span aria-hidden="true">✕</span><span>{{ d.text }}@if (d.dangerous) { <strong> (dangerous)</strong> }</span></li>
                  }
                  @for (d of t.minors; track $index) {
                    <li class="flex gap-2 text-gray-700 dark:text-slate-300"><span aria-hidden="true">•</span><span>{{ d.text }} <span class="text-xs text-gray-500">(minor)</span></span></li>
                  }
                  @for (d of t.advisories; track $index) {
                    <li class="flex gap-2 text-gray-700 dark:text-slate-300"><span aria-hidden="true">!</span><span>{{ d.text }}</span></li>
                  }
                </ul>
              </details>
            } @else {
              <p class="mt-1 text-xs text-gray-500 dark:text-slate-400">No advisories</p>
            }
          </li>
        } @empty {
          <li class="p-4 text-sm text-gray-600 dark:text-slate-300">Too new for an MOT{{ h.motTestDueDate ? ': first one due ' + (h.motTestDueDate | date: 'MMMM y') : '' }}.</li>
        }
      </ol>
      @if (h.tests.length > visibleTests().length) {
        <button type="button" (click)="showAll.set(true)" class="mt-3 text-sm font-semibold text-rose-700 hover:underline dark:text-rose-300">Show all {{ h.tests.length }} tests</button>
      }
      <p class="mt-4 text-xs text-gray-500 dark:text-slate-400">
        Official record from the DVSA MOT history service. Advisories are items the tester noted to watch, not failures.
        <a [href]="govLink" target="_blank" rel="noopener noreferrer" class="font-semibold text-rose-700 hover:underline dark:text-rose-300">View on GOV.UK ↗</a>
      </p>
    }
  `,
})
export class MotHistoryComponent implements OnChanges {
  @Input({ required: true }) registration!: string;

  private readonly lookup = inject(DvlaVehicleService);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  readonly govLink = GOV_MOT_CHECK;

  readonly state = signal<'loading' | 'ready' | 'none'>('loading');
  readonly history = signal<MotHistory | null>(null);
  readonly summary = signal<MotSummary | null>(null);
  readonly showAll = signal(false);

  maxMiles(): number {
    return Math.max(1, ...(this.summary()?.mileagePoints.map((p) => p.miles) ?? [1]));
  }

  visibleTests() {
    const tests = this.history()?.tests ?? [];
    return this.showAll() ? tests : tests.slice(0, 6);
  }

  ngOnChanges(): void {
    if (!this.browser || !this.registration) return;
    this.state.set('loading');
    this.showAll.set(false);
    this.lookup.motHistory(this.registration).subscribe({
      next: (h) => {
        this.history.set(h);
        this.summary.set(summariseMot(h));
        this.state.set('ready');
      },
      error: () => this.state.set('none'),
    });
  }
}

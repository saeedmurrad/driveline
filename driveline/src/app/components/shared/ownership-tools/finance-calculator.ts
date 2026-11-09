import { Component, Input, computed, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { Vehicle } from '../../../models/vehicle.model';
import { FINANCE_ILLUSTRATIVE_PARAMS } from '../../../utils/finance-display';
import { financeIllustration, formatGbp } from '../../../utils/vehicle-insights';

@Component({
  selector: 'app-finance-calculator',
  imports: [RouterLink],
  template: `
    <div class="space-y-5">
      <div>
        <div class="flex items-baseline justify-between gap-3">
          <label for="fc-deposit" class="text-sm font-semibold text-stone-800 dark:text-slate-100">Deposit</label>
          <span class="tabular-nums text-sm font-bold text-stone-900 dark:text-white">{{ fmt(deposit()) }}</span>
        </div>
        <input id="fc-deposit" type="range" class="range-input mt-2" min="0" [max]="maxDeposit()" step="250"
          [value]="deposit()" (input)="deposit.set(+$any($event.target).value)" />
        <div class="mt-1 flex justify-between text-[11px] text-stone-400"><span>£0</span><span>{{ fmt(maxDeposit()) }}</span></div>
      </div>

      <div>
        <p class="text-sm font-semibold text-stone-800 dark:text-slate-100">Term</p>
        <div class="mt-2 grid grid-cols-4 gap-2" role="radiogroup" aria-label="Finance term">
          @for (t of terms; track t) {
            <button type="button" role="radio" [attr.aria-checked]="term() === t" (click)="term.set(t)"
              class="rounded-xl border py-2.5 text-sm font-bold tabular-nums transition-all"
              [class]="term() === t
                ? 'border-rose-500 bg-rose-500 text-white shadow-md shadow-rose-500/25'
                : 'border-stone-200 bg-white text-stone-700 hover:border-rose-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200'">
              {{ t }}<span class="text-[10px] font-semibold opacity-80"> mo</span>
            </button>
          }
        </div>
      </div>

      @if (quote(); as q) {
        <div class="rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 p-5 text-white shadow-lg shadow-emerald-600/20">
          <p class="text-[11px] font-semibold uppercase tracking-wider text-white/80">Illustrative monthly payment</p>
          <p class="mt-1 text-4xl font-bold tabular-nums">{{ fmt(q.monthly) }}<span class="text-lg font-semibold">/mo</span></p>
          <p class="mt-1 text-sm text-white/85">{{ q.termMonths }} payments · {{ q.apr }}% APR representative</p>
        </div>
        <dl class="grid grid-cols-2 gap-2 text-sm">
          <div class="stat-chip"><dt class="tool-kicker">Cash price</dt><dd class="font-bold tabular-nums text-stone-900 dark:text-white">{{ fmt(vehicle.price) }}</dd></div>
          <div class="stat-chip"><dt class="tool-kicker">Deposit</dt><dd class="font-bold tabular-nums text-stone-900 dark:text-white">{{ fmt(q.deposit) }}</dd></div>
          <div class="stat-chip"><dt class="tool-kicker">Amount of credit</dt><dd class="font-bold tabular-nums text-stone-900 dark:text-white">{{ fmt(q.credit) }}</dd></div>
          <div class="stat-chip"><dt class="tool-kicker">Interest</dt><dd class="font-bold tabular-nums text-stone-900 dark:text-white">{{ fmt(q.chargeForCredit) }}</dd></div>
          <div class="stat-chip col-span-2"><dt class="tool-kicker">Total amount payable</dt><dd class="font-bold tabular-nums text-stone-900 dark:text-white">{{ fmt(q.totalPayable) }}</dd></div>
        </dl>
      } @else {
        <p class="rounded-xl bg-stone-50 p-4 text-sm text-stone-600 dark:bg-slate-900 dark:text-slate-300">With that deposit there is nothing left to finance. Lower the deposit to see payments.</p>
      }

      <p class="text-xs leading-relaxed text-stone-500 dark:text-slate-400">
        Illustrative Hire Purchase example at {{ apr }}% APR representative. Your actual rate depends on your circumstances and is subject to status and a credit check. Finance is arranged through third-party lenders. Over-18s and UK residents only.
      </p>
      <a routerLink="/finance" class="btn-primary w-full justify-center">Apply for this quote</a>
    </div>
  `,
})
export class FinanceCalculatorComponent {
  @Input({ required: true }) set vehicleInput(v: Vehicle) {
    this.vehicle = v;
    this.price.set(v.price);
    this.deposit.set(0);
  }
  vehicle!: Vehicle;

  readonly apr = FINANCE_ILLUSTRATIVE_PARAMS.representativeApr;
  readonly terms = [24, 36, 48, 60];
  private readonly price = signal(0);
  readonly deposit = signal(0);
  readonly term = signal(60);
  readonly maxDeposit = computed(() => Math.max(0, Math.floor((this.price() * 0.5) / 250) * 250));
  readonly quote = computed(() => financeIllustration(this.price(), this.deposit(), this.term()));
  readonly fmt = (n: number) => formatGbp(n);
}

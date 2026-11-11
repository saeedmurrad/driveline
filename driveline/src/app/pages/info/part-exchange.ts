import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PageHeaderComponent } from '../../components/layout/page-header/page-header';

/** How part exchange works: steps, what affects the value, what to have ready. */
@Component({
  selector: 'app-part-exchange-info',
  imports: [RouterLink, PageHeaderComponent],
  template: `
    <app-page-header crumb="Part exchange" title="How part exchange works" lead="Trade in your current car against your next one. A fair valuation, and we can collect it from you." />

    <div class="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
      <ol class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-label="Part exchange steps">
        @for (s of steps; track s.title; let i = $index) {
          <li class="rounded-2xl border border-line bg-surface-raised p-6 shadow-card">
            <span class="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-brand text-sm font-bold text-white">{{ i + 1 }}</span>
            <h2 class="mb-2 text-lg font-bold text-ink">{{ s.title }}</h2>
            <p class="text-sm leading-relaxed text-ink-muted">{{ s.text }}</p>
          </li>
        }
      </ol>

      <div class="mt-10 grid gap-6 lg:grid-cols-2">
        <section class="rounded-2xl border border-line bg-surface-raised p-6 shadow-card" aria-labelledby="value-h">
          <h2 id="value-h" class="mb-3 text-lg font-bold text-ink">What affects the value</h2>
          <ul class="space-y-2 text-sm text-ink-muted">
            @for (f of factors; track f) {
              <li class="flex gap-2"><span class="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand" aria-hidden="true"></span>{{ f }}</li>
            }
          </ul>
        </section>
        <section class="rounded-2xl border border-line bg-surface-raised p-6 shadow-card" aria-labelledby="ready-h">
          <h2 id="ready-h" class="mb-3 text-lg font-bold text-ink">Useful to have ready</h2>
          <ul class="space-y-2 text-sm text-ink-muted">
            @for (f of ready; track f) {
              <li class="flex gap-2"><span class="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand" aria-hidden="true"></span>{{ f }}</li>
            }
          </ul>
        </section>
      </div>

      <div class="mt-10 rounded-2xl bg-stone-900 p-6 text-white sm:flex sm:items-center sm:justify-between sm:gap-6">
        <div>
          <p class="text-lg font-bold">Ready for a valuation?</p>
          <p class="text-sm text-white/75">It takes about two minutes. Photos on WhatsApp help us give you an accurate figure.</p>
        </div>
        <div class="mt-4 flex flex-wrap gap-2 sm:mt-0">
          <a routerLink="/sell-your-car" class="inline-flex h-11 items-center rounded-xl bg-white px-4 text-sm font-semibold text-stone-900 hover:bg-stone-100">Value my car</a>
          <a href="https://wa.me/447423374244?text=Hello%2C%20I%27d%20like%20a%20part%20exchange%20valuation." target="_blank" rel="noopener" class="inline-flex h-11 items-center rounded-xl bg-emerald-700 px-4 text-sm font-semibold hover:bg-emerald-800">Send photos on WhatsApp</a>
        </div>
      </div>
    </div>
  `,
})
export class PartExchangeInfoComponent {
  readonly steps = [
    { title: 'Tell us about your car', text: 'Send the registration, mileage and condition through Sell Your Car, or WhatsApp us a few photos.' },
    { title: 'Get your valuation', text: 'We look at your car’s details and history and come back with a fair figure.' },
    { title: 'Choose your next car', text: 'Your part-exchange value goes against the price of the car you choose from our stock.' },
    { title: 'We take it off your hands', text: 'Bring it with you when you collect, or we can collect it at a time and place that suits you.' },
  ];
  readonly factors = [
    'Age and mileage',
    'Service history and MOT',
    'Condition inside and out, including tyres and any damage',
    'Number of previous owners',
    'Any modifications',
  ];
  readonly ready = [
    'The V5C logbook',
    'Service history book or receipts',
    'All the keys you have',
    'Details of any outstanding finance on the car',
  ];
}

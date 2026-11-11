import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PageHeaderComponent } from '../../components/layout/page-header/page-header';
import { DeliveryCheckComponent } from '../../components/shared/ownership-tools/delivery-check';

/** Delivery & collection: UK delivery on quote, video viewings, reserve, part-ex collection. */
@Component({
  selector: 'app-delivery',
  imports: [RouterLink, PageHeaderComponent, DeliveryCheckComponent],
  template: `
    <app-page-header crumb="Delivery & collection" title="Buy from home, delivered to your door" lead="Not near Peterborough? See the car on a video call, reserve it, and we'll deliver it anywhere in the UK." />

    <div class="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
      <ol class="grid gap-4 md:grid-cols-3" aria-label="How delivery works">
        @for (s of steps; track s.title; let i = $index) {
          <li class="rounded-2xl border border-line bg-surface-raised p-6 shadow-card">
            <span class="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-brand text-sm font-bold text-white">{{ i + 1 }}</span>
            <h2 class="mb-2 text-lg font-bold text-ink">{{ s.title }}</h2>
            <p class="text-sm leading-relaxed text-ink-muted">{{ s.text }}</p>
            @if (s.link) {
              <a [routerLink]="s.link.route" class="mt-3 inline-flex text-sm font-semibold link-brand hover:underline">{{ s.link.label }} →</a>
            }
          </li>
        }
      </ol>

      <div class="mt-10 grid gap-6 lg:grid-cols-2">
        <section class="rounded-2xl border border-line bg-surface-raised p-6 shadow-card" aria-labelledby="dist-h">
          <h2 id="dist-h" class="mb-1 text-lg font-bold text-ink">How far are you from us?</h2>
          <p class="mb-4 text-sm text-ink-muted">Enter your postcode, then ask for a delivery quote on WhatsApp.</p>
          <app-delivery-check />
        </section>
        <section class="rounded-2xl border border-line bg-surface-raised p-6 shadow-card" aria-labelledby="px-h">
          <h2 id="px-h" class="mb-1 text-lg font-bold text-ink">Got a car to part exchange?</h2>
          <p class="text-sm leading-relaxed text-ink-muted">We can collect your part exchange at a time and place that suits you. Send us the details first and we'll give you a valuation.</p>
          <div class="mt-4 flex flex-wrap gap-2">
            <a routerLink="/part-exchange" class="btn-outline !px-4 !py-2.5 text-sm">How part exchange works</a>
            <a routerLink="/sell-your-car" class="btn-primary !px-4 !py-2.5 text-sm">Get a valuation</a>
          </div>
        </section>
      </div>

      <div class="mt-10 text-center">
        <p class="text-sm text-ink-muted">Questions about delivery?</p>
        <div class="mt-3 flex flex-wrap justify-center gap-3">
          <a href="https://wa.me/447423374244" target="_blank" rel="noopener" class="inline-flex h-11 items-center rounded-xl bg-emerald-700 px-5 text-sm font-semibold text-white hover:bg-emerald-800">WhatsApp us</a>
          <a href="tel:01733563559" class="inline-flex h-11 items-center rounded-xl border border-line px-5 text-sm font-semibold text-ink hover:bg-surface-sunken">Call 01733 563559</a>
        </div>
      </div>
    </div>
  `,
})
export class DeliveryComponent {
  readonly steps = [
    {
      title: 'See it on a video call',
      text: "Pick a car and ask for a video viewing. We'll walk you round it on WhatsApp or FaceTime so you can see it properly before deciding.",
      link: { label: 'Browse our cars', route: '/cars' },
    },
    {
      title: 'Reserve it',
      text: "Press “Reserve it” on the car's page and we'll hold it for you while you arrange finance or delivery. No payment is taken online.",
    },
    {
      title: 'We deliver it to you',
      text: 'We deliver across the UK. Ask us for a delivery quote for your postcode and we will arrange a day that suits you.',
    },
  ];
}

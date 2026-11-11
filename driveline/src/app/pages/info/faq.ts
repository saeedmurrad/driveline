import { Component, DOCUMENT, OnDestroy, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PageHeaderComponent } from '../../components/layout/page-header/page-header';
import { DealerContextService } from '../../services/dealer-context.service';

interface Faq {
  q: string;
  a: string;
  link?: { label: string; route: string };
}

/**
 * Frequently asked questions. Answers only state what DriveLine already offers on the
 * site (inspection, in-house warranty, FCA finance, reserve without online payment,
 * video viewing, UK delivery on quote, part exchange with collection, opening hours).
 */
@Component({
  selector: 'app-faq',
  imports: [RouterLink, PageHeaderComponent],
  template: `
    <app-page-header crumb="FAQ" title="Questions buyers ask us" lead="Straight answers about buying, finance, warranty, part exchange and delivery. Can't see yours? Call or WhatsApp us." />

    <div class="mx-auto max-w-4xl px-4 py-14 sm:px-6 lg:px-8">
      @for (group of groups; track group.title) {
        <section class="mb-10" [attr.aria-labelledby]="'faq-' + $index">
          <h2 [id]="'faq-' + $index" class="mb-4 text-xl font-bold text-ink">{{ group.title }}</h2>
          <div class="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface-raised shadow-card">
            @for (item of group.items; track item.q) {
              <details class="faq-item group">
                <summary class="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-left font-semibold text-ink">
                  {{ item.q }}
                  <svg class="h-5 w-5 shrink-0 text-ink-faint transition-transform group-open:rotate-180" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/></svg>
                </summary>
                <div class="px-5 pb-5 text-ink-muted leading-relaxed">
                  <p>{{ item.a }}</p>
                  @if (item.link) {
                    <a [routerLink]="item.link.route" class="mt-2 inline-flex font-semibold link-brand hover:underline">{{ item.link.label }} →</a>
                  }
                </div>
              </details>
            }
          </div>
        </section>
      }

      <section class="mb-10" aria-labelledby="faq-hours">
        <h2 id="faq-hours" class="mb-4 text-xl font-bold text-ink">When are you open?</h2>
        <div class="rounded-2xl border border-line bg-surface-raised p-5 shadow-card">
          @if (business(); as b) {
            <dl class="grid grid-cols-1 gap-x-8 gap-y-1.5 sm:grid-cols-2">
              @for (h of b.openingHours; track h.day) {
                <div class="flex justify-between gap-4 text-sm"><dt class="text-ink-muted">{{ h.day }}</dt><dd class="font-semibold tabular-nums text-ink">{{ h.open }} – {{ h.close }}</dd></div>
              }
            </dl>
            @if (b.bankHolidayNote) {
              <p class="mt-3 text-sm text-ink-muted">{{ b.bankHolidayNote }}</p>
            }
            <p class="mt-3 text-sm text-ink-muted">{{ b.address.line1 }}, {{ b.address.line2 }}, {{ b.address.town }} {{ b.address.postcode }}</p>
          }
        </div>
      </section>

      <div class="rounded-2xl bg-stone-900 p-6 text-white sm:flex sm:items-center sm:justify-between sm:gap-6">
        <div>
          <p class="text-lg font-bold">Still have a question?</p>
          <p class="text-sm text-white/75">We're happy to help by phone, WhatsApp or email.</p>
        </div>
        <div class="mt-4 flex flex-wrap gap-2 sm:mt-0">
          <a href="https://wa.me/447423374244" target="_blank" rel="noopener" class="inline-flex h-11 items-center rounded-xl bg-emerald-700 px-4 text-sm font-semibold hover:bg-emerald-800">WhatsApp us</a>
          <a href="tel:01733563559" class="inline-flex h-11 items-center rounded-xl bg-white px-4 text-sm font-semibold text-stone-900 hover:bg-stone-100">01733 563559</a>
        </div>
      </div>
    </div>
  `,
  styles: [`.faq-item summary::-webkit-details-marker { display: none; }`],
})
export class FaqComponent implements OnInit, OnDestroy {
  private readonly document = inject(DOCUMENT);
  readonly business = inject(DealerContextService).businessInfo;

  readonly groups: { title: string; items: Faq[] }[] = [
    {
      title: 'Buying a car',
      items: [
        { q: 'Are your cars checked before they go on sale?', a: 'Yes. Every vehicle has a thorough multi-point safety inspection before we offer it for sale.' },
        { q: 'Can I reserve a car?', a: "Yes. Press “Reserve it” on the car's page and we'll hold it while you arrange a visit or finance. No payment is taken online.", link: { label: 'Browse our cars', route: '/cars' } },
        { q: 'Can I book a test drive?', a: "Yes. Press “Book a test drive” on the car's page, pick a day and time, and we'll confirm it with you." },
        { q: "Can I see a car if I can't get to Peterborough?", a: "Yes. Ask for a video viewing on the car's page and we'll walk you round the car on a WhatsApp or FaceTime video call." },
        { q: 'Can I check a car’s MOT history?', a: 'Yes. Every MOT is on the official GOV.UK MOT history service; each car page links to it and shows the registration to use.' },
      ],
    },
    {
      title: 'Finance',
      items: [
        { q: 'Do you offer finance?', a: 'Yes. We are authorised and regulated by the Financial Conduct Authority and offer finance packages for all credit histories. Monthly figures on the site are illustrative and subject to status.', link: { label: 'Finance options and calculator', route: '/finance' } },
      ],
    },
    {
      title: 'Warranty',
      items: [
        { q: 'Do your cars come with a warranty?', a: 'Every vehicle comes with our own in-house warranty: no third parties and no call-centre queues. Ask us about the cover on the car you are interested in.', link: { label: 'About our warranty', route: '/warranty' } },
        { q: 'What if something goes wrong and I live further away?', a: 'Call us directly. Whether you are local or further afield, we’ll quickly arrange to get your vehicle fixed.' },
      ],
    },
    {
      title: 'Part exchange and selling',
      items: [
        { q: 'Do you take part exchanges?', a: 'Yes. Tell us about your car and we’ll give you a fair valuation. We can collect it at a time and place that suits you.', link: { label: 'How part exchange works', route: '/part-exchange' } },
        { q: 'Will you buy my car even if I don’t buy one from you?', a: 'Yes. Use Sell Your Car to send us the details and we’ll come back with a valuation.', link: { label: 'Get a valuation', route: '/sell-your-car' } },
      ],
    },
    {
      title: 'Delivery',
      items: [
        { q: 'Do you deliver?', a: 'Yes, we deliver across the UK. Ask us for a delivery quote for the car you want and your postcode.', link: { label: 'Delivery and collection', route: '/delivery' } },
      ],
    },
  ];

  private schema: HTMLScriptElement | null = null;

  ngOnInit(): void {
    // FAQ rich results for Google
    const data = {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: this.groups.flatMap((g) => g.items).map((i) => ({ '@type': 'Question', name: i.q, acceptedAnswer: { '@type': 'Answer', text: i.a } })),
    };
    this.schema = this.document.createElement('script');
    this.schema.type = 'application/ld+json';
    this.schema.id = 'faq-schema';
    this.schema.text = JSON.stringify(data);
    this.document.getElementById('faq-schema')?.remove();
    this.document.head.appendChild(this.schema);
  }

  ngOnDestroy(): void {
    this.schema?.remove();
  }
}

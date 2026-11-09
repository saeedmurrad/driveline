import { Component, Input, PLATFORM_ID, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { EnquirySubmitService } from '../../../services/enquiry-submit.service';
import { validateEnquiryFields } from '../../../utils/enquiry-validation';
import { scrollFormAlertIntoView } from '../../../utils/scroll-form-alert';

/** "Can't see it? We'll find it" — a sourcing request sent to the dealer. */
@Component({
  selector: 'app-find-me-a-car',
  imports: [FormsModule],
  // The form's <select> options don't hydrate cleanly; let the browser render it fresh.
  host: { ngSkipHydration: 'true' },
  template: `
    <div class="relative overflow-hidden rounded-3xl bg-stone-900 text-white shadow-2xl dark:bg-slate-900 dark:ring-1 dark:ring-slate-700">
      <div class="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-rose-500/30 blur-3xl" aria-hidden="true"></div>
      <div class="pointer-events-none absolute -bottom-24 -left-16 h-64 w-64 rounded-full bg-orange-500/20 blur-3xl" aria-hidden="true"></div>
      <div class="relative grid gap-8 p-6 sm:p-10 lg:grid-cols-[1fr_1.3fr] lg:items-center">
        <div>
          <p class="text-xs font-bold uppercase tracking-[0.2em] text-rose-300">Vehicle sourcing</p>
          <h2 class="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">{{ heading }}</h2>
          <p class="mt-3 text-white/75">Tell us what you’re after and your budget. We search the trade every week and call you the moment we find a match, before it goes on sale. No obligation, no fee.</p>
          <ul class="mt-5 space-y-2 text-sm text-white/85">
            <li class="flex items-center gap-2"><span class="text-emerald-400">✓</span> Inspected and prepared like all our stock</li>
            <li class="flex items-center gap-2"><span class="text-emerald-400">✓</span> First refusal before it’s advertised</li>
            <li class="flex items-center gap-2"><span class="text-emerald-400">✓</span> Part exchange and finance welcome</li>
          </ul>
        </div>
        @if (sent()) {
          <div class="rounded-2xl bg-white/10 p-8 text-center ring-1 ring-white/15" role="status">
            <p class="text-xl font-bold">Request received</p>
            <p class="mt-2 text-white/75">We’ll be in touch as soon as we find a match.</p>
          </div>
        } @else {
          <form (ngSubmit)="submit()" class="grid grid-cols-2 gap-3 rounded-2xl bg-white p-5 text-stone-900 shadow-xl dark:bg-slate-800 dark:text-white" novalidate>
            <div class="col-span-2 sm:col-span-1">
              <label class="form-label text-xs" for="fm-want">Make and model</label>
              <input id="fm-want" name="want" [(ngModel)]="form.want" placeholder="e.g. Nissan Qashqai" class="form-input py-2.5 text-sm" />
            </div>
            <div class="col-span-2 sm:col-span-1">
              <label class="form-label text-xs" for="fm-budget">Budget up to</label>
              <select id="fm-budget" name="budget" [(ngModel)]="form.budget" class="form-input py-2.5 text-sm">
                @for (b of budgets; track b) { <option [value]="b">{{ b }}</option> }
              </select>
            </div>
            <div>
              <label class="form-label text-xs" for="fm-fuel">Fuel</label>
              <select id="fm-fuel" name="fuel" [(ngModel)]="form.fuel" class="form-input py-2.5 text-sm">
                @for (f of fuels; track f) { <option [value]="f">{{ f }}</option> }
              </select>
            </div>
            <div>
              <label class="form-label text-xs" for="fm-gear">Gearbox</label>
              <select id="fm-gear" name="gearbox" [(ngModel)]="form.gearbox" class="form-input py-2.5 text-sm">
                @for (g of gearboxes; track g) { <option [value]="g">{{ g }}</option> }
              </select>
            </div>
            <div>
              <label class="form-label text-xs" for="fm-first">First name*</label>
              <input id="fm-first" name="firstName" [(ngModel)]="form.firstName" autocomplete="given-name" class="form-input py-2.5 text-sm" />
            </div>
            <div>
              <label class="form-label text-xs" for="fm-last">Last name*</label>
              <input id="fm-last" name="lastName" [(ngModel)]="form.lastName" autocomplete="family-name" class="form-input py-2.5 text-sm" />
            </div>
            <div>
              <label class="form-label text-xs" for="fm-phone">Phone*</label>
              <input id="fm-phone" name="phone" type="tel" [(ngModel)]="form.phone" autocomplete="tel" class="form-input py-2.5 text-sm" />
            </div>
            <div>
              <label class="form-label text-xs" for="fm-email">Email*</label>
              <input id="fm-email" name="email" type="email" [(ngModel)]="form.email" autocomplete="email" class="form-input py-2.5 text-sm" />
            </div>
            @if (error()) {
              <div id="find-car-alert" class="col-span-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800" role="alert">{{ error() }}</div>
            }
            <button type="submit" class="btn-primary col-span-2 justify-center py-3 disabled:opacity-60" [disabled]="submitting()">
              {{ submitting() ? 'Sending…' : 'Find it for me' }}
            </button>
          </form>
        }
      </div>
    </div>
  `,
})
export class FindMeACarComponent {
  @Input() heading = 'Can’t see the right one? We’ll find it.';

  private readonly enquirySubmit = inject(EnquirySubmitService);
  private readonly platformId = inject(PLATFORM_ID);
  readonly sent = signal(false);
  readonly submitting = signal(false);
  readonly error = signal<string | null>(null);

  readonly budgets = ['£5,000', '£8,000', '£10,000', '£12,000', '£15,000', '£20,000', '£25,000+'];
  readonly fuels = ['Any', 'Petrol', 'Diesel', 'Hybrid', 'Electric'];
  readonly gearboxes = ['Any', 'Automatic', 'Manual'];

  form = { want: '', budget: '£10,000', fuel: 'Any', gearbox: 'Any', firstName: '', lastName: '', phone: '', email: '' };

  submit(): void {
    const f = this.form;
    const invalid = validateEnquiryFields(f);
    if (invalid) {
      this.error.set(invalid);
      scrollFormAlertIntoView(this.platformId, 'find-car-alert');
      return;
    }
    const body = [
      'Find me a car',
      '',
      `Looking for: ${f.want || 'Open to suggestions'}`,
      `Budget up to: ${f.budget}`,
      `Fuel: ${f.fuel} · Gearbox: ${f.gearbox}`,
      '',
      `Name: ${f.firstName} ${f.lastName}`,
      `Phone: ${f.phone}`,
      `Email: ${f.email}`,
    ].join('\n');
    const subject = `Find me a car — ${f.want || 'any'} up to ${f.budget}`;
    void this.enquirySubmit.submit(
      { type: 'sourcing', subject, payload: { ...f, body }, mailtoSubject: subject, mailtoBody: body },
      {
        onSuccess: () => {
          this.sent.set(true);
          this.error.set(null);
        },
        onError: (msg) => this.error.set(msg),
        setSubmitting: (v) => this.submitting.set(v),
      },
    );
  }
}

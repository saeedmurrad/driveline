import { Component, Input, PLATFORM_ID, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import type { Vehicle } from '../../../models/vehicle.model';
import { milesBetween } from '../../../utils/vehicle-insights';

interface PostcodeResult {
  status: number;
  result?: { latitude: number; longitude: number; admin_district?: string; postcode: string };
}

/** "How far are you?" — free postcodes.io lookup, no key needed. */
@Component({
  selector: 'app-delivery-check',
  imports: [FormsModule],
  template: `
    <form (ngSubmit)="check()" class="flex gap-2" novalidate>
      <label for="dc-postcode" class="sr-only">Your postcode</label>
      <input id="dc-postcode" name="postcode" [(ngModel)]="postcode" autocomplete="postal-code" placeholder="Your postcode"
        class="form-input min-w-0 flex-1 py-2.5 text-sm uppercase" maxlength="8" />
      <button type="submit" class="shrink-0 rounded-xl bg-stone-900 px-4 text-sm font-bold text-white transition-colors hover:bg-rose-600 disabled:opacity-60 dark:bg-white dark:text-stone-900"
        [disabled]="loading()">{{ loading() ? '…' : 'Check' }}</button>
    </form>
    @if (error()) {
      <p class="mt-2 text-xs text-red-600 dark:text-red-400" role="alert">{{ error() }}</p>
    }
    @if (miles() != null) {
      <div class="mt-3 rounded-xl bg-sky-50 p-3 text-sm text-sky-900 ring-1 ring-sky-100 dark:bg-sky-950/40 dark:text-sky-100 dark:ring-sky-900" role="status">
        <p><strong class="tabular-nums">About {{ miles() }} miles</strong> from our Peterborough forecourt{{ place() ? ' to ' + place() : '' }} (as the crow flies).</p>
        <p class="mt-1 text-xs opacity-80">{{ (miles() ?? 0) <= 30 ? 'You’re local — pop in any day, or we can bring it to you.' : 'We deliver across the UK. Ask for a delivery quote.' }}</p>
        <a [href]="whatsAppQuote()" target="_blank" rel="noopener noreferrer" class="mt-2 inline-flex text-xs font-bold text-emerald-700 underline underline-offset-2 dark:text-emerald-300">Get a delivery quote on WhatsApp →</a>
      </div>
    }
  `,
})
export class DeliveryCheckComponent {
  @Input({ required: true }) vehicle!: Vehicle;
  @Input() dealerPostcode = 'PE1 5BH';
  @Input() whatsAppNumber = '447423374244';

  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  postcode = '';
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly miles = signal<number | null>(null);
  readonly place = signal('');

  private async lookup(pc: string) {
    const res = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(pc)}`);
    const data = (await res.json()) as PostcodeResult;
    if (data.status !== 200 || !data.result) throw new Error('not found');
    return data.result;
  }

  async check(): Promise<void> {
    if (!this.browser) return;
    const pc = this.postcode.trim();
    this.error.set(null);
    if (pc.length < 5) {
      this.error.set('Enter a full UK postcode, e.g. PE1 5BH.');
      return;
    }
    this.loading.set(true);
    try {
      const [you, us] = await Promise.all([this.lookup(pc), this.lookup(this.dealerPostcode)]);
      const d = milesBetween({ lat: us.latitude, lng: us.longitude }, { lat: you.latitude, lng: you.longitude });
      this.miles.set(Math.max(1, Math.round(d)));
      this.place.set(you.admin_district ?? you.postcode);
    } catch {
      this.miles.set(null);
      this.error.set('We couldn’t find that postcode. Check it and try again.');
    } finally {
      this.loading.set(false);
    }
  }

  whatsAppQuote(): string {
    const v = this.vehicle;
    const text = `Hello, could I have a delivery quote to ${this.postcode.toUpperCase()} for the ${v.year} ${v.make} ${v.model} (stock ref ${v.id})?`;
    return `https://wa.me/${this.whatsAppNumber}?text=${encodeURIComponent(text)}`;
  }
}

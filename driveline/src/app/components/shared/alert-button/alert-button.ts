import { Component, Input, computed, inject, signal } from '@angular/core';
import { AlertsService, type SavedSearch } from '../../../services/alerts.service';

const gbp = (n: number) => '£' + Math.round(n).toLocaleString('en-GB');

/** "Up to £10,000 · Audi · Estate" style summary of what a new-arrival alert covers. */
export function describeSearch(s: SavedSearch): string {
  const parts = [
    s.make,
    s.bodyType,
    s.fuelType,
    s.transmission,
    s.maxPrice ? `up to ${gbp(s.maxPrice)}` : '',
    s.maxMonthly ? `up to ${gbp(s.maxMonthly)} a month` : '',
  ].filter(Boolean);
  const what = s.category === 'van' ? 'vans' : 'cars';
  return parts.length ? `${parts.join(' · ')} (${what})` : `any ${what}`;
}

/**
 * One alert switch: either "tell me if this car's price drops" (vehicleId) or
 * "tell me when a matching car arrives" (search). Hidden where the browser cannot
 * show notifications; on an iPhone it explains that the app must be installed first.
 */
@Component({
  selector: 'app-alert-button',
  template: `
    @if (alerts.offered()) {
      <div class="alert-button" [attr.data-alert]="vehicleId ? 'price' : 'arrivals'">
        <button
          type="button"
          class="alert-toggle"
          [class.is-on]="on()"
          [attr.aria-pressed]="on()"
          [disabled]="alerts.busy()"
          (click)="toggle()"
        >
          <svg class="h-[1.125rem] w-[1.125rem] shrink-0" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" [attr.fill]="on() ? 'currentColor' : 'none'" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 10-12 0v3.2a2 2 0 01-.6 1.4L4 17h5m6 0a3 3 0 11-6 0m6 0H9" />
          </svg>
          <span>{{ label() }}</span>
        </button>
        @if (!vehicleId && search) {
          <p class="alert-scope">For: {{ scope() }}</p>
        }
        @if (message(); as m) {
          <p class="alert-note" role="status">{{ m }}</p>
        }
      </div>
    }
  `,
  styles: `
    :host { display: block; }
    .alert-toggle {
      display: inline-flex; width: 100%; min-height: 2.75rem; align-items: center; justify-content: center; gap: 0.5rem;
      border-radius: 0.75rem; border: 1px solid rgb(214 211 209); background: transparent;
      padding: 0.5rem 0.875rem; font-size: 0.875rem; font-weight: 600; line-height: 1.2; color: inherit;
      transition: background-color 0.15s, border-color 0.15s, color 0.15s;
    }
    .alert-toggle:hover:not(:disabled) { border-color: rgb(var(--p-rose-500, 244 63 94)); }
    .alert-toggle:disabled { opacity: 0.6; cursor: progress; }
    .alert-toggle.is-on { border-color: rgb(var(--p-rose-600, 225 29 72)); background: rgb(var(--p-rose-50, 255 241 242)); color: rgb(var(--p-rose-800, 159 18 57)); }
    :host-context(.dark) .alert-toggle { border-color: rgb(71 85 105); }
    :host-context(.dark) .alert-toggle.is-on { border-color: rgb(var(--p-rose-400, 251 113 133)); background: rgb(var(--p-rose-950, 76 5 25) / 0.5); color: rgb(var(--p-rose-200, 254 205 211)); }
    .alert-scope, .alert-note { margin-top: 0.375rem; font-size: 0.75rem; line-height: 1.35; overflow-wrap: anywhere; }
    .alert-scope { opacity: 0.75; }
    .alert-note { font-weight: 600; }
  `,
})
export class AlertButtonComponent {
  protected readonly alerts = inject(AlertsService);

  /** Follow this car's price. */
  @Input() vehicleId?: string;
  /** Follow new arrivals for this search. */
  @Input() set searchInput(value: SavedSearch | undefined) {
    this.search = value;
    this.searchSig.set(value);
  }
  search?: SavedSearch;
  private readonly searchSig = signal<SavedSearch | undefined>(undefined);

  /** Only the switch that was pressed shows the result message. */
  private readonly pressed = signal(false);
  private readonly installHint = signal(false);

  readonly on = computed(() => {
    if (this.vehicleId) return this.alerts.vehicleIds().includes(String(this.vehicleId));
    const s = this.searchSig();
    return s ? this.alerts.watchesSearch(s) : false;
  });

  readonly label = computed(() => {
    if (this.vehicleId) return this.on() ? 'Price alert on' : 'Tell me if the price drops';
    return this.on() ? 'New-arrival alert on' : 'Tell me about new arrivals';
  });

  readonly scope = computed(() => describeSearch(this.searchSig() ?? {}));

  readonly message = computed(() => {
    if (this.installHint()) return 'On iPhone and iPad, alerts work once the site is on your Home Screen: tap Share, then “Add to Home Screen”, and open it from there.';
    return this.pressed() ? this.alerts.notice() : null;
  });

  async toggle(): Promise<void> {
    if (this.alerts.status() === 'needs-install') {
      this.installHint.set(true);
      return;
    }
    this.pressed.set(true);
    if (this.vehicleId) await this.alerts.toggleVehicle(this.vehicleId);
    else if (this.search) await this.alerts.toggleSearch(this.search);
  }
}

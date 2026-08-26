import { Component, inject, signal, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { HubAuthService } from '../../../services/hub-auth.service';
import { PlatformApiService } from '../../../services/platform-api.service';
import type { DealerRecord } from '../../../models/dealer.model';

@Component({
  selector: 'app-hub-dashboard',
  imports: [RouterLink],
  template: `
    <h1 class="text-2xl font-bold mb-2">Dashboard</h1>
    <p class="text-slate-600 mb-6">Signed in as {{ auth.user()?.email }}</p>
    @if (dealer(); as d) {
      <div class="grid gap-4 md:grid-cols-3 mb-8">
        <div class="rounded-xl bg-white border p-4 shadow-sm">
          <p class="text-sm text-slate-500">Dealer</p>
          <p class="font-semibold text-lg">{{ d.name }}</p>
          <p class="text-xs text-slate-400 mt-1">slug: {{ d.slug }}</p>
        </div>
        <div class="rounded-xl bg-white border p-4 shadow-sm">
          <p class="text-sm text-slate-500">Live stock</p>
          <p class="font-semibold text-lg">{{ vehicleCount() }}</p>
        </div>
        <div class="rounded-xl bg-white border p-4 shadow-sm">
          <p class="text-sm text-slate-500">Enquiries</p>
          <p class="font-semibold text-lg">{{ enquiryCount() }}</p>
        </div>
      </div>
      <a
        [href]="previewUrl(d.slug)"
        target="_blank"
        rel="noopener"
        class="inline-flex rounded-lg bg-sky-600 text-white px-4 py-2 text-sm font-semibold hover:bg-sky-500"
      >
        Preview public site →
      </a>
    }
    <div class="mt-8 flex gap-3">
      <a routerLink="/hub/site" class="text-sky-700 font-medium">Edit site settings</a>
      <a routerLink="/hub/stock" class="text-sky-700 font-medium">Manage stock</a>
    </div>
  `,
})
export class HubDashboardComponent implements OnInit {
  readonly auth = inject(HubAuthService);
  private readonly api = inject(PlatformApiService);

  dealer = signal<DealerRecord | null>(null);
  vehicleCount = signal(0);
  enquiryCount = signal(0);

  ngOnInit(): void {
    void this.load();
  }

  async load(): Promise<void> {
    const token = this.auth.token();
    if (!token) return;
    const { dealers } = await firstValueFrom(this.api.hubListDealers(token));
    const d =
      dealers.find((x) => x.id === this.auth.activeDealerId()) ?? dealers[0] ?? null;
    this.dealer.set(d);
    if (!d) return;
    const [vehicles, enquiries] = await Promise.all([
      firstValueFrom(this.api.hubListVehicles(token, d.id)),
      firstValueFrom(this.api.hubListEnquiries(token, d.id)),
    ]);
    this.vehicleCount.set(
      vehicles.vehicles.filter((v) => v.status === 'live' || v.status === 'reserved').length,
    );
    this.enquiryCount.set(enquiries.enquiries.length);
  }

  previewUrl(slug: string): string {
    return `/?dealer=${encodeURIComponent(slug)}`;
  }
}

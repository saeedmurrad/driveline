import { Component, inject, signal, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { HubAuthService } from '../../../services/hub-auth.service';
import { PlatformApiService } from '../../../services/platform-api.service';
import type { DealerRecord } from '../../../models/dealer.model';

@Component({
  selector: 'app-hub-site',
  imports: [FormsModule],
  template: `
    <h1 class="text-2xl font-bold mb-6">Site settings</h1>
    @if (saved()) {
      <p class="mb-4 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">Saved.</p>
    }
    @if (dealer(); as d) {
      <form class="max-w-xl space-y-4 bg-white rounded-xl border p-6 shadow-sm" (ngSubmit)="save()">
        <div>
          <label class="block text-sm font-medium mb-1">Dealer name</label>
          <input class="w-full border rounded-lg px-3 py-2" [(ngModel)]="d.name" name="name" />
        </div>
        <div>
          <label class="block text-sm font-medium mb-1">Tagline</label>
          <input class="w-full border rounded-lg px-3 py-2" [(ngModel)]="d.tagline" name="tagline" />
        </div>
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium mb-1">Primary colour</label>
            <input type="color" class="w-full h-10" [(ngModel)]="d.colors.primary" name="primary" />
          </div>
          <div>
            <label class="block text-sm font-medium mb-1">Accent colour</label>
            <input type="color" class="w-full h-10" [(ngModel)]="d.colors.accent" name="accent" />
          </div>
        </div>
        <div>
          <label class="block text-sm font-medium mb-1">Sales email</label>
          <input class="w-full border rounded-lg px-3 py-2" [(ngModel)]="d.business.email" name="email" />
        </div>
        <div>
          <label class="block text-sm font-medium mb-1">Phone</label>
          <input class="w-full border rounded-lg px-3 py-2" [(ngModel)]="d.business.phone" name="phone" />
        </div>
        <div>
          <label class="block text-sm font-medium mb-1">Town</label>
          <input class="w-full border rounded-lg px-3 py-2" [(ngModel)]="d.business.address.town" name="town" />
        </div>
        <button type="submit" class="rounded-lg bg-sky-600 text-white px-4 py-2 font-semibold" [disabled]="saving()">
          {{ saving() ? 'Saving…' : 'Save changes' }}
        </button>
      </form>
    }
  `,
})
export class HubSiteComponent implements OnInit {
  private readonly auth = inject(HubAuthService);
  private readonly api = inject(PlatformApiService);

  dealer = signal<DealerRecord | null>(null);
  saving = signal(false);
  saved = signal(false);

  ngOnInit(): void {
    void this.load();
  }

  async load(): Promise<void> {
    const token = this.auth.token();
    if (!token) return;
    const { dealers } = await firstValueFrom(this.api.hubListDealers(token));
    const d =
      dealers.find((x) => x.id === this.auth.activeDealerId()) ?? dealers[0] ?? null;
    this.dealer.set(d ? structuredClone(d) : null);
  }

  async save(): Promise<void> {
    const token = this.auth.token();
    const d = this.dealer();
    if (!token || !d) return;
    this.saving.set(true);
    this.saved.set(false);
    try {
      await firstValueFrom(this.api.hubPatchDealer(token, d.id, d));
      this.saved.set(true);
    } finally {
      this.saving.set(false);
    }
  }
}

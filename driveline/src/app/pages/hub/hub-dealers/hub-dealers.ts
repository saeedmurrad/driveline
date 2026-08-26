import { Component, inject, signal, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { HubAuthService } from '../../../services/hub-auth.service';
import { PlatformApiService } from '../../../services/platform-api.service';
import type { DealerRecord } from '../../../models/dealer.model';

@Component({
  selector: 'app-hub-dealers',
  imports: [FormsModule],
  template: `
    <h1 class="text-2xl font-bold mb-6">Dealers</h1>
    <form class="mb-8 bg-white border rounded-xl p-6 max-w-lg space-y-3 shadow-sm" (ngSubmit)="create()">
      <h2 class="font-semibold">Create dealer</h2>
      <input class="w-full border rounded-lg px-3 py-2" placeholder="Slug (e.g. smiths)" [(ngModel)]="newDealer.slug" name="slug" required />
      <input class="w-full border rounded-lg px-3 py-2" placeholder="Name" [(ngModel)]="newDealer.name" name="name" required />
      <input class="w-full border rounded-lg px-3 py-2" placeholder="Email" [(ngModel)]="newDealer.email" name="email" required />
      <input class="w-full border rounded-lg px-3 py-2" placeholder="Town" [(ngModel)]="newDealer.town" name="town" />
      <button type="submit" class="rounded-lg bg-sky-600 text-white px-4 py-2 text-sm font-semibold">Create</button>
    </form>
    <ul class="space-y-2">
      @for (d of dealers(); track d.id) {
        <li class="bg-white border rounded-lg px-4 py-3 flex justify-between items-center">
          <span><strong>{{ d.name }}</strong> <span class="text-slate-500 text-sm">({{ d.slug }})</span></span>
          <a [href]="'/?dealer=' + d.slug" target="_blank" class="text-sky-700 text-sm">Preview</a>
        </li>
      }
    </ul>
  `,
})
export class HubDealersComponent implements OnInit {
  private readonly auth = inject(HubAuthService);
  private readonly api = inject(PlatformApiService);

  dealers = signal<DealerRecord[]>([]);
  newDealer = { slug: '', name: '', email: '', town: '' };

  ngOnInit(): void {
    void this.load();
  }

  async load(): Promise<void> {
    const token = this.auth.token();
    if (!token) return;
    const res = await firstValueFrom(this.api.hubListDealers(token));
    this.dealers.set(res.dealers);
  }

  async create(): Promise<void> {
    const token = this.auth.token();
    if (!token) return;
    await firstValueFrom(this.api.hubCreateDealer(token, this.newDealer));
    this.newDealer = { slug: '', name: '', email: '', town: '' };
    await this.load();
  }
}

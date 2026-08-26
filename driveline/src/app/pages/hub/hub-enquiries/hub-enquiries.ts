import { Component, inject, signal, OnInit } from '@angular/core';
import { DatePipe, JsonPipe } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import { HubAuthService } from '../../../services/hub-auth.service';
import {
  PlatformApiService,
  type EnquiryRecord,
} from '../../../services/platform-api.service';
import type { DealerRecord } from '../../../models/dealer.model';

@Component({
  selector: 'app-hub-enquiries',
  imports: [DatePipe, JsonPipe],
  template: `
    <h1 class="text-2xl font-bold mb-6">Enquiries</h1>
    <div class="space-y-3">
      @for (e of enquiries(); track e.id) {
        <article class="bg-white border rounded-xl p-4 shadow-sm">
          <div class="flex justify-between gap-4">
            <div>
              <p class="font-semibold">{{ e.subject }}</p>
              <p class="text-xs text-slate-500">{{ e.type }} · {{ e.createdAt | date: 'medium' }}</p>
            </div>
          </div>
          <pre class="mt-3 text-xs bg-slate-50 rounded-lg p-3 overflow-auto">{{ e.payload | json }}</pre>
        </article>
      } @empty {
        <p class="text-slate-500">No enquiries yet.</p>
      }
    </div>
  `,
})
export class HubEnquiriesComponent implements OnInit {
  private readonly auth = inject(HubAuthService);
  private readonly api = inject(PlatformApiService);

  enquiries = signal<EnquiryRecord[]>([]);

  ngOnInit(): void {
    void this.load();
  }

  async load(): Promise<void> {
    const token = this.auth.token();
    if (!token) return;
    const { dealers } = await firstValueFrom(this.api.hubListDealers(token));
    const d =
      dealers.find((x) => x.id === this.auth.activeDealerId()) ?? dealers[0] ?? null;
    if (!d) return;
    const res = await firstValueFrom(this.api.hubListEnquiries(token, d.id));
    this.enquiries.set(res.enquiries);
  }
}

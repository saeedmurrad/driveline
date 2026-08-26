import { DecimalPipe } from '@angular/common';
import { Component, inject, signal, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { HubAuthService } from '../../../services/hub-auth.service';
import {
  PlatformApiService,
  type PlatformVehicle,
} from '../../../services/platform-api.service';
import type { DealerRecord } from '../../../models/dealer.model';

@Component({
  selector: 'app-hub-stock',
  imports: [FormsModule, DecimalPipe],
  template: `
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-bold">Stock</h1>
      <button type="button" class="rounded-lg bg-sky-600 text-white px-4 py-2 text-sm font-semibold" (click)="startNew()">
        Add vehicle
      </button>
    </div>

    @if (editing()) {
      <form class="mb-8 bg-white border rounded-xl p-6 shadow-sm space-y-3 max-w-2xl" (ngSubmit)="saveVehicle()">
        <h2 class="font-semibold">{{ form.id ? 'Edit' : 'New' }} vehicle</h2>
        <div class="grid md:grid-cols-2 gap-3">
          <input class="border rounded-lg px-3 py-2" placeholder="Make" [(ngModel)]="form.make" name="make" required />
          <input class="border rounded-lg px-3 py-2" placeholder="Model" [(ngModel)]="form.model" name="model" required />
          <input class="border rounded-lg px-3 py-2" placeholder="Derivative" [(ngModel)]="form.derivative" name="derivative" />
          <input class="border rounded-lg px-3 py-2" type="number" placeholder="Year" [(ngModel)]="form.year" name="year" />
          <input class="border rounded-lg px-3 py-2" type="number" placeholder="Price" [(ngModel)]="form.price" name="price" />
          <input class="border rounded-lg px-3 py-2" type="number" placeholder="Mileage" [(ngModel)]="form.mileage" name="mileage" />
          <select class="border rounded-lg px-3 py-2" [(ngModel)]="form.status" name="status">
            <option value="live">Live</option>
            <option value="reserved">Reserved</option>
            <option value="sold">Sold</option>
            <option value="draft">Draft</option>
          </select>
          <select class="border rounded-lg px-3 py-2" [(ngModel)]="form.category" name="category">
            <option value="car">Car</option>
            <option value="van">Van</option>
            <option value="4x4">4x4</option>
          </select>
        </div>
        <textarea class="w-full border rounded-lg px-3 py-2" rows="3" placeholder="Description" [(ngModel)]="form.description" name="description"></textarea>
        <div class="flex gap-2">
          <button type="submit" class="rounded-lg bg-emerald-600 text-white px-4 py-2 text-sm font-semibold">Save</button>
          <button type="button" class="rounded-lg border px-4 py-2 text-sm" (click)="editing.set(false)">Cancel</button>
        </div>
      </form>
    }

    <div class="bg-white border rounded-xl overflow-hidden shadow-sm">
      <table class="w-full text-sm">
        <thead class="bg-slate-50 text-left">
          <tr>
            <th class="p-3">Vehicle</th>
            <th class="p-3">Price</th>
            <th class="p-3">Status</th>
            <th class="p-3"></th>
          </tr>
        </thead>
        <tbody>
          @for (v of vehicles(); track v.id) {
            <tr class="border-t">
              <td class="p-3">{{ v.year }} {{ v.make }} {{ v.model }}</td>
              <td class="p-3">£{{ v.price | number }}</td>
              <td class="p-3"><span class="rounded-full bg-slate-100 px-2 py-0.5 text-xs">{{ v.status }}</span></td>
              <td class="p-3 text-right space-x-2">
                <button type="button" class="text-sky-700" (click)="edit(v)">Edit</button>
                <button type="button" class="text-red-600" (click)="remove(v.id)">Delete</button>
              </td>
            </tr>
          }
        </tbody>
      </table>
    </div>
  `,
})
export class HubStockComponent implements OnInit {
  private readonly auth = inject(HubAuthService);
  private readonly api = inject(PlatformApiService);

  dealer = signal<DealerRecord | null>(null);
  vehicles = signal<PlatformVehicle[]>([]);
  editing = signal(false);
  form: Partial<PlatformVehicle> = {};

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
    const res = await firstValueFrom(this.api.hubListVehicles(token, d.id));
    this.vehicles.set(res.vehicles);
  }

  startNew(): void {
    this.form = {
      make: '',
      model: '',
      derivative: '',
      year: new Date().getFullYear(),
      price: 0,
      mileage: 0,
      transmission: 'Manual',
      fuelType: 'Petrol',
      engineSize: 1.6,
      doors: 5,
      colour: '',
      bodyType: 'Hatchback',
      category: 'car',
      description: '',
      features: [],
      images: [],
      thumbnailImage: '',
      previousOwners: 1,
      motExpiry: '',
      serviceHistory: 'Full',
      status: 'draft',
      dateAdded: new Date().toISOString().slice(0, 10),
    };
    this.editing.set(true);
  }

  edit(v: PlatformVehicle): void {
    this.form = structuredClone(v);
    this.editing.set(true);
  }

  async saveVehicle(): Promise<void> {
    const token = this.auth.token();
    const d = this.dealer();
    if (!token || !d) return;
    await firstValueFrom(this.api.hubUpsertVehicle(token, d.id, this.form));
    this.editing.set(false);
    await this.load();
  }

  async remove(id: string): Promise<void> {
    const token = this.auth.token();
    const d = this.dealer();
    if (!token || !d || !confirm('Delete this vehicle?')) return;
    await firstValueFrom(this.api.hubDeleteVehicle(token, d.id, id));
    await this.load();
  }
}

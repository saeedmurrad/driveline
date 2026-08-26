import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import type { Vehicle } from '../models/vehicle.model';
import type { DealerPublicProfile, DealerRecord } from '../models/dealer.model';
import type { Review } from '../models/review.model';
import type { BusinessInfo } from '../models/contact.model';

@Injectable({ providedIn: 'root' })
export class PlatformApiService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.platformApiUrl;

  /** Dealer slug override for localhost (?dealer= or sessionStorage). */
  getDealerSlugOverride(): string | null {
    if (typeof window === 'undefined') return null;
    const params = new URLSearchParams(window.location.search);
    const q = params.get('dealer');
    if (q?.trim()) {
      sessionStorage.setItem('db_dealer_slug', q.trim().toLowerCase());
      return q.trim().toLowerCase();
    }
    return sessionStorage.getItem('db_dealer_slug');
  }

  private publicParams(): HttpParams {
    const slug = this.getDealerSlugOverride();
    let p = new HttpParams();
    if (slug) p = p.set('dealer', slug);
    return p;
  }

  fetchDealerProfile() {
    return this.http.get<DealerPublicProfile>(`${this.base}/public/dealer`, {
      params: this.publicParams(),
    });
  }

  fetchPublicVehicles() {
    return this.http.get<{ vehicles: Vehicle[] }>(
      `${this.base}/public/vehicles`,
      { params: this.publicParams() },
    );
  }

  submitEnquiry(body: {
    type: string;
    subject: string;
    payload: Record<string, unknown>;
    vehicleId?: string;
  }) {
    return this.http.post<{ id: string; ok: boolean }>(
      `${this.base}/public/enquiries`,
      body,
      { params: this.publicParams() },
    );
  }

  hubLogin(email: string, password: string) {
    return this.http.post<{ token: string; user: HubUser }>(`${this.base}/hub/login`, {
      email,
      password,
    });
  }

  hubMe(token: string) {
    return this.http.get<{ user: HubUser }>(`${this.base}/hub/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  }

  hubListDealers(token: string) {
    return this.http.get<{ dealers: DealerRecord[] }>(`${this.base}/hub/dealers`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  }

  hubCreateDealer(
    token: string,
    body: { slug: string; name: string; email: string; town?: string },
  ) {
    return this.http.post<{ dealer: DealerRecord }>(`${this.base}/hub/dealers`, body, {
      headers: { Authorization: `Bearer ${token}` },
    });
  }

  hubPatchDealer(token: string, dealerId: string, body: Partial<DealerRecord>) {
    return this.http.patch<{ dealer: DealerRecord }>(
      `${this.base}/hub/dealers/${dealerId}`,
      body,
      { headers: { Authorization: `Bearer ${token}` } },
    );
  }

  hubListVehicles(token: string, dealerId: string) {
    return this.http.get<{ vehicles: PlatformVehicle[] }>(
      `${this.base}/hub/dealers/${dealerId}/vehicles`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
  }

  hubUpsertVehicle(token: string, dealerId: string, body: Partial<PlatformVehicle> & { id?: string }) {
    if (body.id) {
      return this.http.patch<{ vehicle: PlatformVehicle }>(
        `${this.base}/hub/dealers/${dealerId}/vehicles/${body.id}`,
        body,
        { headers: { Authorization: `Bearer ${token}` } },
      );
    }
    return this.http.post<{ vehicle: PlatformVehicle }>(
      `${this.base}/hub/dealers/${dealerId}/vehicles`,
      body,
      { headers: { Authorization: `Bearer ${token}` } },
    );
  }

  hubDeleteVehicle(token: string, dealerId: string, vehicleId: string) {
    return this.http.delete<{ ok: boolean }>(
      `${this.base}/hub/dealers/${dealerId}/vehicles/${vehicleId}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
  }

  hubListEnquiries(token: string, dealerId: string) {
    return this.http.get<{ enquiries: EnquiryRecord[] }>(
      `${this.base}/hub/dealers/${dealerId}/enquiries`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
  }
}

export interface HubUser {
  uid: string;
  email: string;
  dealerId: string | null;
  role: 'platform_admin' | 'dealer_admin' | 'dealer_staff';
}

export interface PlatformVehicle extends Vehicle {
  dealerId: string;
  status: 'live' | 'reserved' | 'sold' | 'draft';
}

export interface EnquiryRecord {
  id: string;
  dealerId: string;
  type: string;
  subject: string;
  payload: Record<string, unknown>;
  vehicleId?: string;
  createdAt: string;
  read: boolean;
}

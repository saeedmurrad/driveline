import type { MotHistory } from '../models/mot-history.model';
import {
  HttpClient,
  HttpErrorResponse,
  HttpHeaders,
} from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import type {
  DvlaErrorBody,
  DvlaVehicleDetails,
} from '../models/dvla-vehicle.model';

const LOOKUP_UNAVAILABLE =
  'Registration lookup is not available right now. Please type your car details below and we will check everything when we value it.';

@Injectable({ providedIn: 'root' })
export class DvlaVehicleService {
  private readonly http = inject(HttpClient);

  /**
   * Normalises VRN (no spaces, upper case) and calls DVLA Vehicle Enquiry API
   * via `environment.dvlaLookupUrl` (dev proxy or SSR `/api/dvla-vehicle`).
   * @see https://developer-portal.driver-vehicle-licensing.api.gov.uk/availableapis.html
   */
  /** True when this build has a registration lookup service to call. */
  isAvailable(): boolean {
    const url = environment.dvlaLookupUrl?.trim() ?? '';
    return /^https?:\/\//i.test(url) || url.startsWith('/');
  }

  lookupByRegistration(registration: string): Observable<DvlaVehicleDetails> {
    const vrn = registration.replace(/\s+/g, '').toUpperCase();
    if (!vrn || vrn.length < 2) {
      return throwError(() => new Error('Please enter a valid UK registration.'));
    }
    const url = environment.dvlaLookupUrl?.trim() ?? '';
    if (!this.isAvailable()) {
      return throwError(() => new Error(LOOKUP_UNAVAILABLE));
    }

    const key = environment.dvlaApiKey?.trim();
    const headers = key
      ? new HttpHeaders({ 'x-api-key': key })
      : undefined;

    return this.http
      .post<DvlaVehicleDetails>(url, { registrationNumber: vrn }, { headers })
      .pipe(catchError((err: HttpErrorResponse) => throwError(() => this.mapError(err))));
  }

  /** Messages a customer can act on; technical detail goes to the console only. */
  /**
   * Full DVSA MOT history (tests, mileage, advisories) through the vehicle check worker:
   * GET {dvlaLookupUrl}/mot/{registration}. Errors use the same plain messages as lookups.
   */
  motHistory(registration: string): Observable<MotHistory> {
    const vrm = registration.replace(/[^a-z0-9]/gi, '').toUpperCase();
    if (!vrm || vrm.length < 2) {
      return throwError(() => new Error('Please enter a valid UK registration.'));
    }
    if (!this.isAvailable()) return throwError(() => new Error(LOOKUP_UNAVAILABLE));
    const base = environment.dvlaLookupUrl!.trim().replace(/\/+$/, '');
    return this.http
      .get<MotHistory>(`${base}/mot/${encodeURIComponent(vrm)}`)
      .pipe(catchError((err: HttpErrorResponse) => throwError(() => this.mapError(err))));
  }

  private mapError(err: HttpErrorResponse): Error {
    const body = err.error as DvlaErrorBody | undefined;
    console.warn('Registration lookup failed', err.status, body?.errors?.[0] ?? err.message);
    if (err.status === 404) {
      return new Error('We could not find that registration. Check it and try again, or type your car details below.');
    }
    if (err.status === 400) {
      return new Error('That does not look like a UK registration. Check it, or type your car details below.');
    }
    return new Error(LOOKUP_UNAVAILABLE);
  }
}

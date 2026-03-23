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

@Injectable({ providedIn: 'root' })
export class DvlaVehicleService {
  private readonly http = inject(HttpClient);

  /**
   * Normalises VRN (no spaces, upper case) and calls DVLA Vehicle Enquiry API
   * via `environment.dvlaLookupUrl` (dev proxy or SSR `/api/dvla-vehicle`).
   * @see https://developer-portal.driver-vehicle-licensing.api.gov.uk/availableapis.html
   */
  lookupByRegistration(registration: string): Observable<DvlaVehicleDetails> {
    const vrn = registration.replace(/\s+/g, '').toUpperCase();
    if (!vrn || vrn.length < 2) {
      return throwError(() => new Error('Please enter a valid UK registration.'));
    }
    const url = environment.dvlaLookupUrl?.trim();
    if (!url) {
      return throwError(
        () =>
          new Error(
            'Registration lookup is not configured. Set dvlaLookupUrl in environment (and dvlaApiKey or server DVLA_API_KEY).',
          ),
      );
    }
    const urlOk =
      /^https?:\/\//i.test(url) || url.startsWith('/');
    if (!urlOk) {
      return throwError(
        () =>
          new Error(
            'Registration lookup URL is invalid. On GitHub Pages, set secret DVLA_LOOKUP_URL to your full worker URL (https://…), not your DVLA API key. For dev/SSR, use a path such as /api/dvla-vehicle.',
          ),
      );
    }

    const key = environment.dvlaApiKey?.trim();
    const headers = key
      ? new HttpHeaders({ 'x-api-key': key })
      : undefined;

    return this.http
      .post<DvlaVehicleDetails>(url, { registrationNumber: vrn }, { headers })
      .pipe(catchError((err: HttpErrorResponse) => throwError(() => this.mapError(err))));
  }

  private mapError(err: HttpErrorResponse): Error {
    const body = err.error as DvlaErrorBody | undefined;
    const first = body?.errors?.[0];
    if (first?.detail) {
      return new Error(first.detail);
    }
    if (first?.title) {
      return new Error(first.title);
    }
    if (err.status === 404) {
      return new Error('No vehicle found for that registration.');
    }
    if (err.status === 0) {
      const hint =
        environment.production &&
        environment.dvlaLookupUrl?.includes('driver-vehicle-licensing.api.gov.uk')
          ? ' Browsers usually block direct calls to DVLA from a website (CORS). Deploy the Cloudflare Worker in workers/dvla-ves-proxy/ and set the GitHub secret DVLA_LOOKUP_URL to your worker URL, then redeploy.'
          : '';
      return new Error(
        `Could not reach the registration service. Check your connection or proxy URL.${hint}`,
      );
    }
    return new Error(err.message || 'Registration lookup failed.');
  }
}

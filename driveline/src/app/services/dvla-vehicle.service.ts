import { HttpClient, HttpErrorResponse } from '@angular/common/http';
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
   * (directly or via dev proxy — see environment.dvlaLookupUrl).
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
            'Registration lookup is not configured. Add a DVLA proxy URL in environment or run locally with the dev proxy and DVLA_API_KEY.',
          ),
      );
    }

    return this.http
      .post<DvlaVehicleDetails>(url, { registrationNumber: vrn })
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
      return new Error(
        'Could not reach the registration service. Check your connection or server configuration.',
      );
    }
    return new Error(err.message || 'Registration lookup failed.');
  }
}

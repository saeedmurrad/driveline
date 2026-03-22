import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface Web3FormsEnquiryPayload {
  subject: string;
  /** Full plain-text body */
  message: string;
  /** Visitor email (used as reply-to context in Web3Forms) */
  replyEmail: string;
  fromName: string;
}

interface Web3FormsApiResponse {
  success: boolean;
  message?: string;
}

/**
 * Sends enquiries via [Web3Forms](https://web3forms.com) (free tier, browser-safe access key).
 * Configure `web3formsAccessKey` in environments; add GitHub secret for Pages CI.
 */
@Injectable({ providedIn: 'root' })
export class Web3FormsEnquiryService {
  private readonly http = inject(HttpClient);
  private static readonly SUBMIT_URL = 'https://api.web3forms.com/submit';

  /**
   * Returns true if the access key is set (trimmed non-empty).
   */
  isConfigured(): boolean {
    return Boolean(environment.web3formsAccessKey?.trim());
  }

  send(payload: Web3FormsEnquiryPayload): Observable<void> {
    const key = environment.web3formsAccessKey?.trim();
    if (!key) {
      return throwError(
        () => new Error('NOT_CONFIGURED'),
      );
    }

    const body = {
      access_key: key,
      subject: payload.subject,
      name: payload.fromName,
      email: payload.replyEmail,
      message: payload.message,
    };

    return this.http
      .post<Web3FormsApiResponse>(Web3FormsEnquiryService.SUBMIT_URL, body)
      .pipe(
        map((res) => {
          if (!res.success) {
            throw new Error(res.message || 'Could not send message. Please try again.');
          }
        }),
      );
  }
}

import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import { PlatformApiService } from './platform-api.service';
import { DealerContextService } from './dealer-context.service';
import { openSalesEnquiryEmail } from '../utils/enquiry-mailto';

export interface PlatformEnquiryPayload {
  type: string;
  subject: string;
  payload: Record<string, unknown>;
  vehicleId?: string;
  mailtoSubject: string;
  mailtoBody: string;
}

@Injectable({ providedIn: 'root' })
export class EnquirySubmitService {
  private readonly api = inject(PlatformApiService);
  private readonly dealerContext = inject(DealerContextService);
  private readonly platformId = inject(PLATFORM_ID);

  async submit(
    enquiry: PlatformEnquiryPayload,
    callbacks: {
      onSuccess: () => void;
      onError: (message: string) => void;
      setSubmitting: (value: boolean) => void;
    },
  ): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) {
      callbacks.onError('This form only works in the browser.');
      return;
    }

    callbacks.setSubmitting(true);
    try {
      await firstValueFrom(
        this.api.submitEnquiry({
          type: enquiry.type,
          subject: enquiry.subject,
          payload: enquiry.payload,
          vehicleId: enquiry.vehicleId,
        }),
      );
      callbacks.onSuccess();
    } catch {
      const email = this.dealerContext.salesEmail();
      if (email) {
        openSalesEnquiryEmail(enquiry.mailtoSubject, enquiry.mailtoBody, email);
        callbacks.onSuccess();
      } else {
        callbacks.onError('Could not send enquiry. Please call the dealership.');
      }
    } finally {
      callbacks.setSubmitting(false);
    }
  }
}

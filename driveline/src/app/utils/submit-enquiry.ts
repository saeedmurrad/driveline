import { isPlatformBrowser } from '@angular/common';
import { finalize } from 'rxjs/operators';
import {
  Web3FormsEnquiryService,
  type Web3FormsEnquiryPayload,
} from '../services/web3forms-enquiry.service';
import { openSalesEnquiryEmail } from './enquiry-mailto';

/**
 * POSTs to Web3Forms when configured; otherwise opens mailto with the same content.
 */
export function submitEnquiryWithWeb3Fallback(
  service: Web3FormsEnquiryService,
  platformId: object,
  payload: Web3FormsEnquiryPayload,
  mailtoSubject: string,
  mailtoBody: string,
  callbacks: {
    onSuccess: () => void;
    onError: (message: string) => void;
    setSubmitting: (value: boolean) => void;
  },
): void {
  if (!isPlatformBrowser(platformId)) {
    callbacks.onError('This form only works in the browser.');
    return;
  }

  callbacks.setSubmitting(true);
  service
    .send(payload)
    .pipe(finalize(() => callbacks.setSubmitting(false)))
    .subscribe({
      next: () => {
        callbacks.onSuccess();
      },
      error: (err: Error) => {
        if (err.message === 'NOT_CONFIGURED') {
          openSalesEnquiryEmail(mailtoSubject, mailtoBody);
          callbacks.onSuccess();
        } else {
          callbacks.onError(
            err.message || 'Something went wrong. Please try again.',
          );
        }
      },
    });
}

import { SALES_EMAIL } from '../constants/sales-contact';

/**
 * Opens the user's email client with a new message to sales.
 * Use only in the browser (guard with isPlatformBrowser).
 */
export function openSalesEnquiryEmail(subject: string, body: string): void {
  const href = `mailto:${SALES_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  window.location.href = href;
}

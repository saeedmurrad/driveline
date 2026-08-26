/**
 * Opens the user's email client with a new message to sales.
 * Use only in the browser (guard with isPlatformBrowser).
 */
export function openSalesEnquiryEmail(
  subject: string,
  body: string,
  toEmail?: string,
): void {
  const to = toEmail?.trim() || 'sales@example.com';
  const href = `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  window.location.href = href;
}

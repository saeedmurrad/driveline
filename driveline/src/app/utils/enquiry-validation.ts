/** Shared checks before Web3Forms or mailto fallback (mailto was succeeding with empty fields). */
export function validateEnquiryFields(
  e: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    message?: string;
  },
  options: { requireMessage?: boolean } = {},
): string | null {
  if (!e.firstName?.trim()) {
    return 'Please enter your first name.';
  }
  if (!e.lastName?.trim()) {
    return 'Please enter your last name.';
  }
  const email = e.email?.trim() ?? '';
  if (!email) {
    return 'Please enter your email address.';
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return 'Please enter a valid email address.';
  }
  const phoneDigits = (e.phone ?? '').replace(/\D/g, '');
  if (phoneDigits.length < 10) {
    return 'Please enter a valid phone number.';
  }
  if (options.requireMessage && !e.message?.trim()) {
    return 'Please enter a message.';
  }
  return null;
}

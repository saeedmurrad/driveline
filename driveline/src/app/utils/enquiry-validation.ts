/** Max digits per E.164; prevents pasted garbage strings. */
export const PHONE_MAX_DIGITS = 15;
export const PHONE_MIN_DIGITS = 10;

/**
 * UK-focused phone check: digit count and obvious invalid patterns.
 * Returns an error message or null if valid.
 */
export function validatePhoneField(raw: string): string | null {
  const phoneDigits = (raw ?? '').replace(/\D/g, '');
  if (phoneDigits.length < PHONE_MIN_DIGITS) {
    return 'Please enter a valid phone number (at least 10 digits).';
  }
  if (phoneDigits.length > PHONE_MAX_DIGITS) {
    return `Please enter a valid phone number (no more than ${PHONE_MAX_DIGITS} digits).`;
  }
  if (/^(\d)\1+$/.test(phoneDigits)) {
    return 'Please enter a valid phone number.';
  }
  return null;
}

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
  const phoneErr = validatePhoneField(e.phone);
  if (phoneErr) {
    return phoneErr;
  }
  if (options.requireMessage && !e.message?.trim()) {
    return 'Please enter a message.';
  }
  return null;
}

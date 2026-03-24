import { describe, expect, it } from 'vitest';
import {
  validateEnquiryFields,
  validatePhoneField,
  PHONE_MAX_DIGITS,
} from './enquiry-validation';

describe('validatePhoneField', () => {
  it('accepts typical UK mobile length', () => {
    expect(validatePhoneField('07423 374244')).toBeNull();
  });

  it('rejects fewer than 10 digits', () => {
    expect(validatePhoneField('071234567')).not.toBeNull();
  });

  it('rejects more than 15 digits', () => {
    const tooLong = '1'.repeat(PHONE_MAX_DIGITS + 1);
    expect(validatePhoneField(tooLong)).not.toBeNull();
  });

  it('rejects all-identical digits', () => {
    expect(validatePhoneField('9999999999')).not.toBeNull();
  });
});

describe('validateEnquiryFields', () => {
  const base = {
    firstName: 'A',
    lastName: 'B',
    email: 'a@b.co',
    phone: '07423374244',
  };

  it('returns phone error for long garbage', () => {
    expect(
      validateEnquiryFields({
        ...base,
        phone: '9'.repeat(20),
      }),
    ).not.toBeNull();
  });
});

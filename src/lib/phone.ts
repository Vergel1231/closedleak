/**
 * US phone number validation and normalization.
 * Accepts 10 digits with common formatting: (555) 123-4567, 555-123-4567,
 * 5551234567, +1 555 123 4567, +15551234567, 1-555-123-4567.
 * Stores in normalized form: +1XXXXXXXXXX
 */

export function normalizePhone(input: string): string | null {
  if (!input || input.trim() === '') return null;
  const digits = input.replace(/\D/g, '');
  if (digits.length === 10) {
    return `+1${digits}`;
  }
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`;
  }
  return null;
}

export function validatePhone(input: string): string | null {
  if (!input || input.trim() === '') {
    return 'Phone number is required';
  }
  const normalized = normalizePhone(input);
  if (!normalized) {
    return 'Enter a valid US phone number, e.g. (555) 123-4567 or +1 555 123 4567';
  }
  return null;
}

/** Display form: +15551234567 -> (555) 123-4567. Falls back to the raw value. */
export function formatPhone(phone: string | null | undefined): string {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return phone;
}

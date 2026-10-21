// Helpers for numeric text fields that must stay editable as raw text.
// Empty text is allowed while typing and parses to 0 for calculations.

function stripLeadingZeros(s: string): string {
  return s.replace(/^0+(?=\d)/, '');
}

// Accept only digits and a single decimal point. Rejects negatives and
// any other characters. Strips leading zeros so "0350" becomes "350".
export function sanitizeNumeric(raw: string): string {
  let s = raw.replace(/[^0-9.]/g, '');
  const dot = s.indexOf('.');
  if (dot >= 0) {
    s = s.slice(0, dot + 1) + s.slice(dot + 1).replace(/\./g, '');
  }
  if (s.startsWith('.')) s = '0' + s;
  s = stripLeadingZeros(s);
  return s;
}

// Clamp a sanitized numeric string to the 0-100 range.
export function clampPercentString(raw: string): string {
  const s = sanitizeNumeric(raw);
  const n = parseNum(s);
  if (n > 100) return '100';
  return s;
}

export function parseNum(s: string): number {
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

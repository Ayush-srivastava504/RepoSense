/**
 * Deterministic "logo" for a company: first letter + a stable color
 * picked from its name. Avoids depending on an external logo API
 * (extra request, rate limits, broken images for obscure companies)
 * while still giving each card a distinct visual anchor like Astra's
 * job cards.
 */
const PALETTE = [
  { bg: '#EEF2FF', fg: '#4338CA' }, // indigo
  { bg: '#ECFDF5', fg: '#047857' }, // green
  { bg: '#FEF2F2', fg: '#B91C1C' }, // rust/red
  { bg: '#FFF7ED', fg: '#C2410C' }, // orange
  { bg: '#F5F3FF', fg: '#6D28D9' }, // violet
  { bg: '#EFF6FF', fg: '#1D4ED8' }, // blue
  { bg: '#FDF4FF', fg: '#A21CAF' }, // fuchsia
];

export function companyInitial(company?: string): string {
  const trimmed = company?.trim();
  return trimmed ? trimmed.charAt(0).toUpperCase() : '?';
}

export function companyColor(company?: string): { bg: string; fg: string } {
  const name = company?.trim() || '?';
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  return PALETTE[hash % PALETTE.length];
}

export const DHAKA_TIMEZONE = 'Asia/Dhaka';

/**
 * Formats numbers in South Asian / Bangladeshi grouping: 1,00,000.00
 */
export function formatNumberBD(value: number): string {
  const safe = Number.isFinite(value) ? value : 0;
  const rounded = Math.round((safe + Number.EPSILON) * 100) / 100;
  const isNeg = rounded < 0;
  const abs = Math.abs(rounded);
  const [intPart, decPart] = abs.toFixed(2).split('.');

  let formattedInt = intPart;
  if (intPart.length > 3) {
    const lastThree = intPart.slice(-3);
    const rest = intPart.slice(0, -3);
    const groupedRest = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',');
    formattedInt = `${groupedRest},${lastThree}`;
  }

  return `${isNeg ? '-' : ''}${formattedInt}.${decPart}`;
}

/**
 * Formats currency in BDT with Taka symbol: ৳7,460.00
 */
export function formatBDT(value: number): string {
  const safe = Number.isFinite(value) ? value : 0;
  const isNeg = safe < 0;
  const formatted = formatNumberBD(Math.abs(safe));
  return `${isNeg ? '-' : ''}৳${formatted}`;
}

/**
 * ASCII-safe BDT format for PDF vector fonts that lack the Unicode Taka glyph
 */
export function formatBDTAscii(value: number): string {
  const safe = Number.isFinite(value) ? value : 0;
  const isNeg = safe < 0;
  const formatted = formatNumberBD(Math.abs(safe));
  return `${isNeg ? '-' : ''}BDT ${formatted}`;
}

/**
 * Rounds currency values cleanly to 2 decimal places
 */
export function round2(value: number): number {
  const safe = Number.isFinite(value) ? value : 0;
  return Math.round((safe + Number.EPSILON) * 100) / 100;
}

/**
 * Current YYYY-MM-DD in Asia/Dhaka timezone
 */
export function getTodayDhakaISO(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: DHAKA_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

/**
 * Current YYYY-MM in Asia/Dhaka timezone
 */
export function getCurrentMonthDhakaISO(): string {
  return getTodayDhakaISO().slice(0, 7);
}

/**
 * Converts YYYY-MM-DD -> DD-MM-YYYY
 */
export function formatDateDDMMYYYY(isoDate: string | undefined | null): string {
  if (!isoDate) return '—';
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate.trim());
  if (!match) return isoDate;
  return `${match[3]}-${match[2]}-${match[1]}`;
}

/**
 * Formats epoch milliseconds into DD-MM-YYYY hh:mm AM/PM in Asia/Dhaka
 */
export function formatDateTimeDhaka(ms: number | undefined): string {
  if (!ms) return '—';
  const d = new Date(ms);
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: DHAKA_TIMEZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).formatToParts(d);

  const map: Record<string, string> = {};
  for (const p of parts) {
    map[p.type] = p.value;
  }
  return `${map.day}-${map.month}-${map.year} ${map.hour}:${map.minute} ${(map.dayPeriod || '').toUpperCase()}`.trim();
}

export function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

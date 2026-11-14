// Display formatting. Amounts are formatted, never computed, here.

const whole = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0, minimumFractionDigits: 0 });
const cents = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Whole dollars for headline numbers: 1234.56 → "$1,235"; negatives as "-$1,235". */
export function money(amount: number): string {
  return whole.format(normalize(Math.round(amount)));
}

/**
 * Whole dollars for an amount to PAY (pay now, the next payment, a pay target): rounded up, so paying the
 * shown amount is never a few cents short ("$2,000.25" → "$2,001"). `- 0.005` keeps float residue
 * (1850.0000001) at "$1,850". Totals and breakdowns use `money`.
 */
export function moneyUp(amount: number): string {
  return whole.format(normalize(Math.ceil(amount - 0.005)));
}

/** Dollars and cents for tables and the log: 1234.5 → "$1,234.50". */
export function moneyCents(amount: number): string {
  return cents.format(normalize(Math.round(amount * 100) / 100));
}

/**
 * A rate (fraction) as a percent: 0.2006 → "20.1%", 0.25 → "25%". `decimals` is the maximum number
 * of decimals; trailing zeros are dropped.
 */
export function pct(rate: number, decimals = 1): string {
  const f = new Intl.NumberFormat("en-US", { maximumFractionDigits: decimals, minimumFractionDigits: 0 });
  return `${f.format(normalize(rate * 100))}%`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** ISO date "2027-01-15" → "Jan 15, 2027". Parsed by hand so the time zone can't shift the day. */
export function longDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  const month = MONTHS[Number(m[2]) - 1];
  if (!month) return iso;
  return `${month} ${Number(m[3])}, ${m[1]}`;
}

/** ISO date "2026-09-15" → "Sep 15" (for dates inside the tax year, where the year is obvious). */
export function shortDate(iso: string): string {
  return longDate(iso).replace(/, \d{4}$/, "");
}

/** Several due dates in one phrase: "Sep 15, 2026", "Jun 15 and Sep 15, 2026", "Apr 15, Jun 15 and Sep 15, 2026". */
export function dateList(isos: readonly string[]): string {
  if (isos.length === 0) return "";
  const year = /^(\d{4})/.exec(isos[isos.length - 1])?.[1];
  const sameYear = year !== undefined && isos.every((d) => d.startsWith(year));
  const parts = isos.map((d) => (sameYear ? shortDate(d) : longDate(d)));
  const joined = parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
  return sameYear ? `${joined}, ${year}` : joined;
}

/** Avoid "-$0" from tiny negatives. */
const normalize = (n: number) => (Object.is(n, -0) || Math.abs(n) < 1e-9 ? 0 : n);

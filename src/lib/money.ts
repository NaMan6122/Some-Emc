const EXACT_RE = /^\d+(\.\d{1,2})?$/;

/**
 * Parse a human-entered AED amount into exact fils (ADR-002).
 * Accepts "3832500", "3,832,500.00", "AED 18,786,625.00", "-12.50",
 * "-AED 12.50", "AED -12.50" and accounting "(1,000.00)".
 * Throws on anything that cannot map to whole fils (e.g. "1.234").
 */
export function parseMoney(input: string): bigint {
  let s = input.trim().replace(/AED/gi, "").trim();
  let neg = false;
  if (/^\(.*\)$/.test(s)) {
    neg = true;
    s = s.slice(1, -1);
  }
  s = s.replace(/[,\s]/g, "");
  if (s.startsWith("-")) {
    neg = true;
    s = s.slice(1);
  } else if (s.startsWith("+")) {
    s = s.slice(1);
  }
  if (!EXACT_RE.test(s)) throw new Error(`Invalid money value: "${input}"`);
  const [whole, frac = ""] = s.split(".");
  return BigInt((neg ? "-" : "") + whole + frac.padEnd(2, "0"));
}

/** Format fils as "AED 1,234.56" (negatives "-AED 12.50") — integer math only. */
export function formatMoney(fils: bigint): string {
  const neg = fils < 0n;
  const abs = neg ? -fils : fils;
  const whole = abs / 100n;
  const frac = (abs % 100n).toString().padStart(2, "0");
  return `${neg ? "-" : ""}AED ${whole.toLocaleString("en-US")}.${frac}`;
}

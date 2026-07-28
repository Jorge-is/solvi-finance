// Money helpers. ALWAYS integer centavos in business logic — never float.
// The only place a fractional "soles" string should exist is at the UI/CSV boundary.

/** Format integer centavos as a "12.35" soles string (no currency symbol, no thousands separator). */
export function centavosToSolesString(centavos: number): string {
  if (!Number.isInteger(centavos)) {
    throw new Error(`centavosToSolesString: expected integer centavos, got ${centavos}`);
  }
  const negative = centavos < 0;
  const abs = Math.abs(centavos);
  const soles = Math.trunc(abs / 100);
  const cents = abs % 100;
  const sign = negative ? "-" : "";
  return `${sign}${soles}.${String(cents).padStart(2, "0")}`;
}

/** Format integer centavos as "S/ 12.35" for display in UI. */
export function centavosToDisplay(centavos: number): string {
  return `S/ ${centavosToSolesString(centavos)}`;
}

/**
 * Parse a soles string ("12.35", "12", "-12.3", "12,35") into integer centavos.
 * Never uses float math — parses the integer and fractional parts as strings.
 * Throws on invalid input (caller decides how to surface that, e.g. CSV row error).
 */
export function solesStringToCentavos(input: string): number {
  const trimmed = input.trim().replace(",", ".");
  const match = /^(-)?(\d+)(?:\.(\d{1,2}))?$/.exec(trimmed);
  if (!match) {
    throw new Error(`Invalid amount: "${input}"`);
  }
  const [, negSign, wholePart, fracPartRaw] = match;
  const fracPart = (fracPartRaw ?? "").padEnd(2, "0");
  const centavos = Number(wholePart) * 100 + Number(fracPart);
  if (!Number.isSafeInteger(centavos)) {
    throw new Error(`Amount out of range: "${input}"`);
  }
  return negSign ? -centavos : centavos;
}

/** Percentage (0-100+) of `spent` against `limit`, using integer math, rounded half-even (banker's rounding). */
export function percentOf(spent: number, limit: number): number {
  if (limit <= 0) return 0;
  const scaled = (spent * 10000) / limit; // basis points
  return bankersRound(scaled) / 100;
}

/** Banker's rounding (round-half-to-even) for the rare case fractional rounding is needed. */
export function bankersRound(value: number): number {
  const floor = Math.floor(value);
  const diff = value - floor;
  if (diff < 0.5) return floor;
  if (diff > 0.5) return floor + 1;
  // exactly .5 -> round to even
  return floor % 2 === 0 ? floor : floor + 1;
}

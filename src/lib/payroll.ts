/** Payroll sums. All amounts in kobo. */
export type Item = { name: string; kobo: number };
export type Settings = { pension_on: boolean; pension_staff_pct: number; pension_employer_pct: number; paye_on: boolean; tax_state: string | null; tin: string | null };

/**
 * Annual PAYE bands under the Nigeria Tax Act 2025 (from January 2026), in naira.
 * Shown to schools as an estimate: they should confirm with their tax adviser.
 */
const BANDS: [number, number][] = [
  [800_000, 0],
  [2_200_000, 0.15],
  [9_000_000, 0.18],
  [13_000_000, 0.21],
  [25_000_000, 0.23],
  [Infinity, 0.25],
];

export function annualTax(taxableNaira: number) {
  let left = Math.max(0, taxableNaira);
  let tax = 0;
  for (const [width, rate] of BANDS) {
    const slice = Math.min(left, width);
    tax += slice * rate;
    left -= slice;
    if (left <= 0) break;
  }
  return tax;
}

/** Housing and transport count towards pension, with basic pay. */
const PENSIONABLE = /housing|transport/i;

export function computeSlip(basic: number, allowances: Item[], deductions: Item[], s: Settings, monthlyRent = 0) {
  const allow = allowances.reduce((a, x) => a + x.kobo, 0);
  const other = deductions.reduce((a, x) => a + x.kobo, 0);
  const gross = basic + allow;
  const pensionBase = basic + allowances.filter((a) => PENSIONABLE.test(a.name)).reduce((a, x) => a + x.kobo, 0);
  const pension = s.pension_on ? Math.round((pensionBase * s.pension_staff_pct) / 100) : 0;
  const employer = s.pension_on ? Math.round((pensionBase * s.pension_employer_pct) / 100) : 0;
  let paye = 0;
  if (s.paye_on) {
    const rentRelief = Math.min((monthlyRent * 12 * 0.2) / 100, 500_000); // naira a year
    const taxable = ((gross - pension) * 12) / 100 - rentRelief;
    paye = Math.round((annualTax(taxable) / 12) * 100);
  }
  const net = gross - pension - paye - other;
  return { gross, allow, other, pension, employer, paye, net };
}

export function parseItems(raw: unknown): Item[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((x) => ({ name: String((x as Item).name ?? "").trim().slice(0, 40), kobo: Math.round(Number((x as Item).kobo) || 0) }))
    .filter((x) => x.name && x.kobo > 0);
}

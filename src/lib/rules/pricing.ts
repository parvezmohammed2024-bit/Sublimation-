/**
 * Quotation pricing. Integer sen throughout. Tax is read from settings, never hardcoded.
 */

export interface Addon {
  label: string;
  /** per_piece is multiplied by qty (e.g. names, numbers); flat is charged once (e.g. setup). */
  mode: "per_piece" | "flat";
  amountSen: number;
}

export interface LineInput {
  qty: number;
  unitPriceSen: number;
  addons: Addon[];
}

export interface PriceTier {
  minQty: number;
  priceSen: number;
}

export function lineTotalSen(line: LineInput): number {
  const addons = line.addons.reduce(
    (sum, a) => sum + (a.mode === "per_piece" ? a.amountSen * line.qty : a.amountSen),
    0,
  );
  return line.qty * line.unitPriceSen + addons;
}

export interface QuoteTotals {
  subtotalSen: number;
  rushFeeSen: number;
  taxSen: number;
  totalSen: number;
}

export function quoteTotals(args: {
  lines: LineInput[];
  rushFeeSen: number;
  taxEnabled: boolean;
  /** Percent, e.g. 6 for 6%. Only used when taxEnabled. */
  taxRatePercent: number | null;
}): QuoteTotals {
  const subtotalSen = args.lines.reduce((s, l) => s + lineTotalSen(l), 0);
  const taxable = subtotalSen + args.rushFeeSen;
  const taxSen =
    args.taxEnabled && args.taxRatePercent ? Math.round((taxable * args.taxRatePercent) / 100) : 0;
  return { subtotalSen, rushFeeSen: args.rushFeeSen, taxSen, totalSen: taxable + taxSen };
}

/** Suggested unit price: the tier with the highest minQty not above qty, or null if none apply. */
export function tierUnitPriceSen(tiers: PriceTier[], qty: number): number | null {
  const hit = [...tiers].sort((a, b) => b.minQty - a.minQty).find((t) => t.minQty <= qty);
  return hit ? hit.priceSen : null;
}

/** ISO date (YYYY-MM-DD) plus n calendar days, computed in UTC to avoid timezone drift. */
export function addDaysISO(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Sublimation only works on polyester or high-poly blends. */
export const isSublimationSafe = (fabric: { is_polyester: boolean } | null | undefined) =>
  !fabric || fabric.is_polyester;

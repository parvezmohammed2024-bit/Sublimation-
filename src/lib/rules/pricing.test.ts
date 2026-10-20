import { describe, expect, it } from "vitest";
import { addDaysISO, isSublimationSafe, lineTotalSen, quoteTotals, tierUnitPriceSen } from "./pricing";
import { formatMyPhone, normaliseMyPhone, whatsappLink } from "./phone";
import { addWorkingDays } from "./dates";

describe("pricing", () => {
  it("per-piece add-ons scale with qty, flat add-ons do not", () => {
    const total = lineTotalSen({
      qty: 20,
      unitPriceSen: 6500,
      addons: [
        { label: "Name", mode: "per_piece", amountSen: 300 },
        { label: "Setup", mode: "flat", amountSen: 5000 },
      ],
    });
    expect(total).toBe(20 * 6500 + 20 * 300 + 5000);
  });

  it("tax is off by default and uses the configured rate when on", () => {
    const lines = [{ qty: 10, unitPriceSen: 10000, addons: [] }];
    expect(quoteTotals({ lines, rushFeeSen: 0, taxEnabled: false, taxRatePercent: 6 }).totalSen).toBe(100000);
    const on = quoteTotals({ lines, rushFeeSen: 20000, taxEnabled: true, taxRatePercent: 8 });
    expect(on.taxSen).toBe(9600); // 8% of (1000 + 200) RM
    expect(on.totalSen).toBe(129600);
  });

  it("tax enabled without a rate charges nothing instead of guessing", () => {
    const lines = [{ qty: 1, unitPriceSen: 10000, addons: [] }];
    expect(quoteTotals({ lines, rushFeeSen: 0, taxEnabled: true, taxRatePercent: null }).taxSen).toBe(0);
  });

  it("picks the best price tier for the quantity", () => {
    const tiers = [
      { minQty: 1, priceSen: 7000 },
      { minQty: 20, priceSen: 6500 },
      { minQty: 50, priceSen: 6000 },
    ];
    expect(tierUnitPriceSen(tiers, 5)).toBe(7000);
    expect(tierUnitPriceSen(tiers, 20)).toBe(6500);
    expect(tierUnitPriceSen(tiers, 120)).toBe(6000);
    expect(tierUnitPriceSen([], 10)).toBeNull();
  });

  it("adds calendar days across a month boundary", () => {
    expect(addDaysISO("2026-10-20", 30)).toBe("2026-11-19");
  });

  it("flags non-polyester fabrics", () => {
    expect(isSublimationSafe({ is_polyester: false })).toBe(false);
    expect(isSublimationSafe({ is_polyester: true })).toBe(true);
    expect(isSublimationSafe(null)).toBe(true);
  });
});

describe("phone", () => {
  it.each([
    ["012-345 6789", "+60123456789"],
    ["0123456789", "+60123456789"],
    ["+60 12-345 6789", "+60123456789"],
    ["60123456789", "+60123456789"],
    ["123456789", "+60123456789"],
    ["03-1234 5678", "+60312345678"],
    ["0060123456789", "+60123456789"],
  ])("normalises %s", (input, expected) => {
    expect(normaliseMyPhone(input)).toBe(expected);
  });

  it("rejects junk", () => {
    expect(normaliseMyPhone("abc")).toBeNull();
    expect(normaliseMyPhone("0123")).toBeNull();
    expect(normaliseMyPhone("+1 415 555 2671")).toBeNull();
  });

  it("builds a WhatsApp link", () => {
    expect(whatsappLink("+60123456789", "Hi & hello")).toBe("https://wa.me/60123456789?text=Hi%20%26%20hello");
    expect(formatMyPhone("+60123456789")).toBe("012-345 6789");
  });
});

describe("working days", () => {
  it("skips Sundays by default", () => {
    // Fri 2026-10-23 + 2 working days = Sun skipped -> Mon, Tue... Sat is a work day
    expect(addWorkingDays("2026-10-23", 2)).toBe("2026-10-26"); // Sat 24, (Sun 25 skipped) Mon 26
  });
  it("skips listed holidays and custom weekends", () => {
    expect(addWorkingDays("2026-10-23", 2, { holidays: ["2026-10-24"] })).toBe("2026-10-27");
    expect(addWorkingDays("2026-10-23", 1, { weekendDays: [0, 6] })).toBe("2026-10-26");
  });
});

import { describe, expect, it } from "vitest";
import {
  balanceDueSen,
  computePaymentStatus,
  depositRequiredSen,
  releaseIndicator,
  sumVerifiedSen,
  toSen,
} from "./payments";
import { allowedTargets, evaluateTransition, type TransitionInput } from "./workflow";

const base: TransitionInput = {
  from: "QUOTATION_SENT",
  to: "CONFIRMED",
  actor: "admin",
  paymentStatus: "DEPOSIT_PAID",
  depositMet: true,
  designApproved: false,
  nameListConfirmed: false,
  qcShortfall: 0,
};
const t = (o: Partial<TransitionInput>) => evaluateTransition({ ...base, ...o });

describe("payment status", () => {
  const total = toSen(1000);
  const dep = depositRequiredSen(total, 50);
  it("computes each state from verified money only", () => {
    expect(computePaymentStatus({ totalSen: total, paidSen: 0, depositSen: dep })).toBe("UNPAID");
    expect(computePaymentStatus({ totalSen: total, paidSen: toSen(200), depositSen: dep })).toBe("PARTIALLY_PAID");
    expect(computePaymentStatus({ totalSen: total, paidSen: toSen(500), depositSen: dep })).toBe("DEPOSIT_PAID");
    expect(computePaymentStatus({ totalSen: total, paidSen: total, depositSen: dep })).toBe("FULLY_PAID");
  });
  it("ignores unverified proofs", () => {
    const paid = sumVerifiedSen([
      { amountSen: toSen(500), verified: true },
      { amountSen: toSen(500), verified: false },
    ]);
    expect(paid).toBe(toSen(500));
  });
  it("credit terms apply until fully paid", () => {
    expect(computePaymentStatus({ totalSen: total, paidSen: 0, depositSen: dep, creditTerms: true })).toBe("CREDIT_TERMS");
    expect(computePaymentStatus({ totalSen: total, paidSen: total, depositSen: dep, creditTerms: true })).toBe("FULLY_PAID");
  });
  it("has no float drift", () => {
    expect(toSen(0.1) + toSen(0.2)).toBe(toSen(0.3));
    expect(balanceDueSen(toSen(10.1), toSen(0.1))).toBe(toSen(10));
  });
});

describe("release indicator", () => {
  const common = { totalSen: 100000, dueDate: "2026-11-10", today: "2026-11-01" };
  it("green when ready and fully paid", () => {
    const r = releaseIndicator({ ...common, stageKey: "READY_FOR_COLLECTION", paymentStatus: "FULLY_PAID", paidSen: 100000 });
    expect(r.level).toBe("green");
  });
  it("amber when ready with balance, showing amount due", () => {
    const r = releaseIndicator({ ...common, stageKey: "READY_FOR_COLLECTION", paymentStatus: "DEPOSIT_PAID", paidSen: 50000 });
    expect(r).toEqual({ level: "amber", amountDueSen: 50000 });
  });
  it("red when overdue", () => {
    const r = releaseIndicator({ ...common, today: "2026-11-11", stageKey: "SEWING", paymentStatus: "DEPOSIT_PAID", paidSen: 50000 });
    expect(r.level).toBe("red");
  });
  it("no indicator once closed", () => {
    const r = releaseIndicator({ ...common, stageKey: "COLLECTED", paymentStatus: "FULLY_PAID", paidSen: 100000 });
    expect(r.level).toBe("none");
  });
});

describe("workflow guards", () => {
  it("blocks CONFIRMED without deposit, allows admin waiver with reason", () => {
    expect(t({ depositMet: false })).toEqual({ ok: false, code: "DEPOSIT_REQUIRED" });
    expect(t({ depositMet: false, waiveDeposit: true })).toEqual({ ok: false, code: "REASON_REQUIRED" });
    expect(t({ depositMet: false, waiveDeposit: true, reason: "Repeat customer" })).toEqual({ ok: true, audit: ["deposit_waived"] });
  });

  it("blocks TEMPLATE until design approved AND name list confirmed", () => {
    const tpl = { from: "NAME_LIST_CONFIRMED", to: "TEMPLATE", actor: "admin" as const };
    expect(t({ ...tpl })).toEqual({ ok: false, code: "DESIGN_NOT_APPROVED" });
    expect(t({ ...tpl, designApproved: true })).toEqual({ ok: false, code: "NAME_LIST_NOT_CONFIRMED" });
    expect(t({ ...tpl, designApproved: true, nameListConfirmed: true }).ok).toBe(true);
  });

  it("blocks QC -> PACKING while shortfall remains", () => {
    expect(t({ from: "QC", to: "PACKING", actor: "qc", qcShortfall: 3 })).toEqual({ ok: false, code: "QC_SHORTFALL" });
    expect(t({ from: "QC", to: "PACKING", actor: "qc" }).ok).toBe(true);
  });

  it("payment lock on collection; only super admin overrides with reason", () => {
    const c = { from: "READY_FOR_COLLECTION", to: "COLLECTED", actor: "dispatch" as const, paymentStatus: "DEPOSIT_PAID" as const };
    expect(t(c)).toEqual({ ok: false, code: "PAYMENT_LOCK" });
    expect(t({ ...c, overridePaymentLock: true, reason: "Credit terms" })).toEqual({ ok: false, code: "OVERRIDE_FORBIDDEN" });
    expect(t({ ...c, actor: "super_admin", overridePaymentLock: true })).toEqual({ ok: false, code: "REASON_REQUIRED" });
    expect(t({ ...c, actor: "super_admin", overridePaymentLock: true, reason: "Corporate credit" })).toEqual({ ok: true, audit: ["payment_override"] });
    expect(t({ ...c, paymentStatus: "FULLY_PAID" }).ok).toBe(true);
  });

  it("design is locked after approval; only super admin unlocks, with reason", () => {
    const u = { from: "DESIGN_APPROVED", to: "DESIGNING" };
    expect(t({ ...u, actor: "admin", reason: "Customer wants change" })).toEqual({ ok: false, code: "ROLE_FORBIDDEN" });
    expect(t({ ...u, actor: "super_admin" })).toEqual({ ok: false, code: "REASON_REQUIRED" });
    expect(t({ ...u, actor: "super_admin", reason: "Customer wants change" })).toEqual({ ok: true, audit: ["design_unlocked"] });
  });

  it("customer may only approve or request revision on a sent mockup", () => {
    expect(t({ from: "MOCKUP_SENT", to: "DESIGN_APPROVED", actor: "customer" }).ok).toBe(true);
    expect(t({ from: "MOCKUP_SENT", to: "REVISION_REQUESTED", actor: "customer" }).ok).toBe(true);
    expect(t({ from: "SEWING", to: "QC", actor: "customer" })).toEqual({ ok: false, code: "ROLE_FORBIDDEN" });
  });

  it("rejects illegal jumps and edits to closed jobs", () => {
    expect(t({ from: "DESIGNING", to: "PRINTING", actor: "admin" })).toEqual({ ok: false, code: "NOT_ALLOWED" });
    expect(t({ from: "COLLECTED", to: "QC", actor: "super_admin" })).toEqual({ ok: false, code: "TERMINAL" });
  });

  it("section roles move only their own stage", () => {
    expect(t({ from: "PRINTING", to: "HEAT_PRESS", actor: "printing" }).ok).toBe(true);
    expect(t({ from: "PRINTING", to: "HEAT_PRESS", actor: "designer" })).toEqual({ ok: false, code: "ROLE_FORBIDDEN" });
  });

  it("hold and cancel need a reason; resume needs a target", () => {
    expect(t({ from: "PRINTING", to: "ON_HOLD", actor: "admin" })).toEqual({ ok: false, code: "REASON_REQUIRED" });
    expect(t({ from: "PRINTING", to: "ON_HOLD", actor: "admin", reason: "Awaiting fabric" }).ok).toBe(true);
    expect(t({ from: "ON_HOLD", to: "PRINTING", actor: "admin" })).toEqual({ ok: false, code: "RESUME_TARGET_REQUIRED" });
    expect(t({ from: "ON_HOLD", to: "PRINTING", actor: "admin", resumeTo: "PRINTING" }).ok).toBe(true);
  });

  it("skips stages a shop has disabled (merged cutting+sewing)", () => {
    const enabled = ["HEAT_PRESS", "SEWING"]; // CUTTING disabled
    expect(allowedTargets("HEAT_PRESS", enabled)).toContain("SEWING");
    expect(allowedTargets("HEAT_PRESS", enabled)).not.toContain("CUTTING");
  });

  it("QC fail loop: QC -> QC_FAILED -> REWORK -> QC", () => {
    expect(t({ from: "QC", to: "QC_FAILED", actor: "qc" }).ok).toBe(true);
    expect(t({ from: "QC_FAILED", to: "REWORK", actor: "qc" }).ok).toBe(true);
    expect(t({ from: "REWORK", to: "QC", actor: "cutting_sewing" }).ok).toBe(true);
  });
});

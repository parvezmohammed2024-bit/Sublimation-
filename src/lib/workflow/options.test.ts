import { describe, expect, it } from "vitest";
import { primaryOption, transitionOptions, type FlowState } from "./options";

const base: FlowState = {
  jobId: "j1", stageKey: "PRINTING", prevStageKey: null, designApproved: true, nameListConfirmed: true,
  depositWaived: false, totalSen: 100000, paidSen: 50000, depositPercent: 50, creditTerms: false, mockupReady: true, qcShortfall: 0,
};
const s = (o: Partial<FlowState>): FlowState => ({ ...base, ...o });
const to = (opts: ReturnType<typeof transitionOptions>, key: string) => opts.find((o) => o.to === key);

describe("transition options", () => {
  it("printing staff get one tap forward and nothing else sensitive", () => {
    const opts = transitionOptions(s({}), "printing");
    expect(primaryOption(opts)).toMatchObject({ to: "HEAT_PRESS", status: "ok" });
    expect(to(opts, "ON_HOLD")).toBeUndefined(); // hold is admin-only
    expect(to(opts, "CANCELLED")).toBeUndefined();
  });

  it("admins can hold or cancel, but only with a reason", () => {
    const opts = transitionOptions(s({}), "admin");
    expect(to(opts, "ON_HOLD")).toMatchObject({ side: true, status: "needs_reason" });
    expect(to(opts, "CANCELLED")).toMatchObject({ side: true, status: "needs_reason" });
  });

  it("confirming needs a deposit: admin may waive, owner too, designer sees nothing", () => {
    const noDeposit = s({ stageKey: "QUOTATION_SENT", paidSen: 0 });
    expect(to(transitionOptions(noDeposit, "admin"), "CONFIRMED")).toMatchObject({ status: "needs_waiver" });
    expect(to(transitionOptions(s({ stageKey: "QUOTATION_SENT", paidSen: 50000 }), "admin"), "CONFIRMED")).toMatchObject({ status: "ok" });
    expect(transitionOptions(noDeposit, "designer")).toEqual([]);
  });

  it("template is blocked until design approved and name list confirmed", () => {
    // Confirmed jobs sit in the template section, so the template team starts them themselves.
    expect(to(transitionOptions(s({ stageKey: "NAME_LIST_CONFIRMED" }), "template"), "TEMPLATE")).toMatchObject({ status: "ok" });
    const noDesign = transitionOptions(s({ stageKey: "NAME_LIST_CONFIRMED", designApproved: false }), "template");
    expect(to(noDesign, "TEMPLATE")).toMatchObject({ status: "blocked", code: "DESIGN_NOT_APPROVED" });
    const noList = transitionOptions(s({ stageKey: "NAME_LIST_CONFIRMED", nameListConfirmed: false }), "admin");
    expect(to(noList, "TEMPLATE")).toMatchObject({ status: "blocked", code: "NAME_LIST_NOT_CONFIRMED" });
  });

  it("sections hand work on themselves, with no admin in the middle", () => {
    const next = (stageKey: string, role: Parameters<typeof transitionOptions>[1]) =>
      primaryOption(transitionOptions(s({ stageKey }), role))?.to;
    expect(next("CONFIRMED", "designer")).toBe("DESIGNING"); // designers start confirmed jobs
    expect(next("DESIGNING", "designer")).toBe("MOCKUP_SENT");
    expect(next("NAME_LIST_CONFIRMED", "template")).toBe("TEMPLATE");
    expect(next("TEMPLATE", "template")).toBe("PRINTING"); // template sends to printing
    expect(next("PRINTING", "printing")).toBe("HEAT_PRESS");
    expect(next("HEAT_PRESS", "printing")).toBe("CUTTING"); // printing sends to production
    expect(next("CUTTING", "cutting_sewing")).toBe("SEWING");
    expect(next("SEWING", "cutting_sewing")).toBe("QC");
    expect(next("QC", "qc")).toBe("PACKING");
    expect(next("PACKING", "dispatch")).toBe("READY_FOR_COLLECTION");
  });

  it("the designer cannot send until a mockup is uploaded", () => {
    const none = transitionOptions(s({ stageKey: "DESIGNING", mockupReady: false }), "designer");
    expect(to(none, "MOCKUP_SENT")).toMatchObject({ status: "blocked", code: "MOCKUP_REQUIRED" });
    const ready = transitionOptions(s({ stageKey: "DESIGNING", mockupReady: true }), "designer");
    expect(to(ready, "MOCKUP_SENT")).toMatchObject({ status: "ok", side: false });
  });

  it("a designer never sees approve or revision buttons for their own mockup", () => {
    const opts = transitionOptions(s({ stageKey: "MOCKUP_SENT" }), "designer");
    expect(opts).toEqual([]);
  });

  it("a section cannot move another section's jobs", () => {
    expect(transitionOptions(s({ stageKey: "PRINTING" }), "cutting_sewing")).toEqual([]);
    expect(transitionOptions(s({ stageKey: "SEWING" }), "printing")).toEqual([]);
    expect(transitionOptions(s({ stageKey: "TEMPLATE" }), "qc")).toEqual([]);
  });

  it("QC cannot pass while pieces are unresolved", () => {
    const opts = transitionOptions(s({ stageKey: "QC", qcShortfall: 4 }), "qc");
    expect(to(opts, "PACKING")).toMatchObject({ status: "blocked", code: "QC_SHORTFALL" });
    expect(to(opts, "QC_FAILED")).toMatchObject({ side: true, status: "ok" });
    expect(to(transitionOptions(s({ stageKey: "QC" }), "qc"), "PACKING")).toMatchObject({ status: "ok" });
  });

  it("collection is payment locked; only the owner can override", () => {
    const ready = s({ stageKey: "READY_FOR_COLLECTION" });
    expect(to(transitionOptions(ready, "dispatch"), "COLLECTED")).toMatchObject({ status: "blocked", code: "PAYMENT_LOCK" });
    expect(to(transitionOptions(ready, "super_admin"), "COLLECTED")).toMatchObject({ status: "needs_override" });
    expect(to(transitionOptions(s({ stageKey: "READY_FOR_COLLECTION", paidSen: 100000 }), "dispatch"), "COLLECTED")).toMatchObject({ status: "ok" });
  });

  it("a held job offers only a resume, to admins", () => {
    const held = s({ stageKey: "ON_HOLD", prevStageKey: "SEWING" });
    expect(transitionOptions(held, "admin")).toEqual([{ to: "SEWING", side: false, status: "ok" }]);
    expect(transitionOptions(held, "printing")).toEqual([]);
  });

  it("only the owner sees the design unlock", () => {
    const approved = s({ stageKey: "DESIGN_APPROVED" });
    expect(to(transitionOptions(approved, "super_admin"), "DESIGNING")).toMatchObject({ side: true, status: "needs_reason" });
    expect(to(transitionOptions(approved, "admin"), "DESIGNING")).toBeUndefined();
  });
});

/**
 * Job stage state machine. Pure and server-side: no DB, no UI.
 * Every status change must go through `evaluateTransition`.
 */
import {
  DEFAULT_STAGES,
  DESIGN_LOCKED_FROM,
  SECTION_ROLES,
  TERMINAL_STAGES,
  type Role,
} from "./stages";
import type { PaymentStatus } from "./payments";

export type Actor = Role | "customer";

/** Default allowed edges. Disabled stages are skipped by `allowedTargets`. */
const GRAPH: Record<string, string[]> = {
  QUOTATION_DRAFT: ["QUOTATION_SENT"],
  QUOTATION_SENT: ["CONFIRMED", "QUOTATION_DRAFT"],
  CONFIRMED: ["DESIGNING"],
  DESIGNING: ["MOCKUP_SENT"],
  MOCKUP_SENT: ["REVISION_REQUESTED", "DESIGN_APPROVED"],
  REVISION_REQUESTED: ["DESIGNING"],
  DESIGN_APPROVED: ["AWAITING_NAME_LIST", "NAME_LIST_CONFIRMED"],
  AWAITING_NAME_LIST: ["NAME_LIST_CONFIRMED"],
  NAME_LIST_CONFIRMED: ["TEMPLATE"],
  TEMPLATE: ["PRINTING"],
  PRINTING: ["HEAT_PRESS"],
  HEAT_PRESS: ["CUTTING"],
  CUTTING: ["SEWING"],
  SEWING: ["QC"],
  QC: ["PACKING", "QC_FAILED"],
  QC_FAILED: ["REWORK"],
  REWORK: ["QC"],
  PACKING: ["READY_FOR_COLLECTION"],
  READY_FOR_COLLECTION: ["COLLECTED", "DELIVERED"],
  COLLECTED: [],
  DELIVERED: [],
  ON_HOLD: [], // resume target is supplied via `resumeTo`
  CANCELLED: [],
};

const SIDE_STATES = new Set(["ON_HOLD", "CANCELLED"]);
/** Stages that are never skipped even if a shop disables them. */
const CORE_STAGES = new Set([
  "CONFIRMED", "DESIGN_APPROVED", "NAME_LIST_CONFIRMED", "QC",
  "READY_FOR_COLLECTION", "COLLECTED", "DELIVERED", "QC_FAILED", "REWORK",
  ...SIDE_STATES,
]);

const ADMIN_ONLY_TARGETS = new Set([
  "QUOTATION_SENT", "CONFIRMED", "AWAITING_NAME_LIST", "NAME_LIST_CONFIRMED",
  "ON_HOLD", "CANCELLED", "QUOTATION_DRAFT",
]);
const ADMINS: Actor[] = ["super_admin", "admin"];

export type TransitionErrorCode =
  | "NOT_ALLOWED"
  | "ROLE_FORBIDDEN"
  | "TERMINAL"
  | "DEPOSIT_REQUIRED"
  | "REASON_REQUIRED"
  | "DESIGN_NOT_APPROVED"
  | "NAME_LIST_NOT_CONFIRMED"
  | "QC_SHORTFALL"
  | "PAYMENT_LOCK"
  | "OVERRIDE_FORBIDDEN"
  | "RESUME_TARGET_REQUIRED";

export interface TransitionInput {
  from: string;
  to: string;
  actor: Actor;
  /** Free-text reason for waivers, overrides, holds, cancellations, unlocks. */
  reason?: string;
  note?: string;
  paymentStatus: PaymentStatus;
  depositMet: boolean;
  /** Admin chose to waive the deposit (requires `reason`). */
  waiveDeposit?: boolean;
  /** Super Admin releasing goods with an outstanding balance (requires `reason`). */
  overridePaymentLock?: boolean;
  designApproved: boolean;
  nameListConfirmed: boolean;
  /** Pieces still failing QC / short vs the order. Must be 0 to leave QC. */
  qcShortfall: number;
  /** Stage keys enabled for this shop; defaults to all. */
  enabledStages?: string[];
  /** Required when leaving ON_HOLD: the stage to resume at. */
  resumeTo?: string;
}

export type TransitionResult =
  | { ok: true; audit: Array<"deposit_waived" | "payment_override" | "design_unlocked"> }
  | { ok: false; code: TransitionErrorCode };

const fail = (code: TransitionErrorCode): TransitionResult => ({ ok: false, code });
const hasReason = (r?: string) => !!r && r.trim().length >= 3;

/** Expand edges past stages the shop has disabled. */
export function allowedTargets(from: string, enabled?: string[]): string[] {
  const isOn = (k: string) => !enabled || CORE_STAGES.has(k) || enabled.includes(k);
  const out = new Set<string>();
  const walk = (key: string, seen: Set<string>) => {
    for (const t of GRAPH[key] ?? []) {
      if (seen.has(t)) continue;
      if (isOn(t)) out.add(t);
      else walk(t, new Set(seen).add(t));
    }
  };
  walk(from, new Set([from]));
  if (!TERMINAL_STAGES.has(from) && from !== "ON_HOLD") {
    out.add("ON_HOLD");
    out.add("CANCELLED");
  }
  // Design unlock: back to DESIGNING from approved-but-not-yet-templated stages.
  if ((DESIGN_LOCKED_FROM as readonly string[]).includes(from)) out.add("DESIGNING");
  return [...out];
}

function actorMaySection(actor: Actor, stageKey: string): boolean {
  const def = DEFAULT_STAGES.find((s) => s.key === stageKey);
  if (!def) return false;
  return SECTION_ROLES[def.section].includes(actor as Role);
}

export function evaluateTransition(i: TransitionInput): TransitionResult {
  if (TERMINAL_STAGES.has(i.from)) return fail("TERMINAL");

  // ON_HOLD resumes to a caller-supplied stage; everything else follows the graph.
  if (i.from === "ON_HOLD") {
    if (!ADMINS.includes(i.actor)) return fail("ROLE_FORBIDDEN");
    if (!i.resumeTo || i.to !== i.resumeTo) return fail("RESUME_TARGET_REQUIRED");
    return { ok: true, audit: [] };
  }

  if (!allowedTargets(i.from, i.enabledStages).includes(i.to)) return fail("NOT_ALLOWED");

  const audit: Array<"deposit_waived" | "payment_override" | "design_unlocked"> = [];

  // --- Role checks -------------------------------------------------------
  const customerEdge =
    i.actor === "customer" &&
    i.from === "MOCKUP_SENT" &&
    (i.to === "DESIGN_APPROVED" || i.to === "REVISION_REQUESTED");
  if (i.actor === "customer" && !customerEdge) return fail("ROLE_FORBIDDEN");

  const isUnlock =
    i.to === "DESIGNING" && (DESIGN_LOCKED_FROM as readonly string[]).includes(i.from);

  if (!customerEdge) {
    if (ADMIN_ONLY_TARGETS.has(i.to) && !ADMINS.includes(i.actor)) return fail("ROLE_FORBIDDEN");
    if (!ADMINS.includes(i.actor) && !actorMaySection(i.actor, i.from)) return fail("ROLE_FORBIDDEN");
  }

  // --- Guards ------------------------------------------------------------
  if (isUnlock) {
    if (i.actor !== "super_admin") return fail("ROLE_FORBIDDEN");
    if (!hasReason(i.reason)) return fail("REASON_REQUIRED");
    audit.push("design_unlocked");
  }

  if (i.to === "ON_HOLD" || i.to === "CANCELLED") {
    if (!hasReason(i.reason)) return fail("REASON_REQUIRED");
  }

  if (i.to === "CONFIRMED" && !i.depositMet) {
    if (!i.waiveDeposit) return fail("DEPOSIT_REQUIRED");
    if (!hasReason(i.reason)) return fail("REASON_REQUIRED");
    audit.push("deposit_waived");
  }

  if (i.to === "TEMPLATE") {
    if (!i.designApproved) return fail("DESIGN_NOT_APPROVED");
    if (!i.nameListConfirmed) return fail("NAME_LIST_NOT_CONFIRMED");
  }

  if (i.from === "QC" && i.to === "PACKING" && i.qcShortfall > 0) return fail("QC_SHORTFALL");

  if (i.to === "COLLECTED" || i.to === "DELIVERED") {
    if (i.paymentStatus !== "FULLY_PAID") {
      if (!i.overridePaymentLock) return fail("PAYMENT_LOCK");
      if (i.actor !== "super_admin") return fail("OVERRIDE_FORBIDDEN");
      if (!hasReason(i.reason)) return fail("REASON_REQUIRED");
      audit.push("payment_override");
    }
  }

  return { ok: true, audit };
}

export const ALL_DEFAULT_STAGE_KEYS = DEFAULT_STAGES.map((s) => s.key);

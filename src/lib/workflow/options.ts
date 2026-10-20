/**
 * Pure helpers that turn a job's current state into the list of stage buttons a user should see.
 * Every decision is delegated to evaluateTransition (src/lib/rules/workflow.ts); nothing is
 * re-implemented here. The server action re-runs the same evaluation before writing.
 */
import {
  computePaymentStatus,
  depositRequiredSen,
  isDepositMet,
  sumVerifiedSen,
  toSen,
} from "../rules/payments";
import {
  allowedTargets,
  evaluateTransition,
  type Actor,
  type TransitionErrorCode,
  type TransitionInput,
} from "../rules/workflow";

export interface FlowState {
  jobId: string;
  stageKey: string;
  prevStageKey: string | null;
  designApproved: boolean;
  nameListConfirmed: boolean;
  depositWaived: boolean;
  totalSen: number;
  paidSen: number;
  depositPercent: number;
  creditTerms: boolean;
  /** Unresolved QC defect pieces. Must be 0 to leave QC. */
  qcShortfall: number;
}

/** Row shape returned by the flow query (jobs + customers + payments + qc_defects). */
export interface FlowRow {
  id: string;
  stage_key: string;
  prev_stage_key: string | null;
  design_approved: boolean;
  name_list_confirmed: boolean;
  deposit_waived: boolean;
  total: number | string;
  deposit_percent: number | string;
  customers: { credit_terms: boolean } | null;
  payments: { amount: number | string; verified: boolean }[] | null;
  qc_defects: { qty: number; resolved: boolean }[] | null;
}

export const FLOW_SELECT =
  "id, stage_key, prev_stage_key, design_approved, name_list_confirmed, deposit_waived, total, deposit_percent, customers(credit_terms), payments(amount, verified), qc_defects(qty, resolved)";

export function flowStateFromRow(r: FlowRow): FlowState {
  return {
    jobId: r.id,
    stageKey: r.stage_key,
    prevStageKey: r.prev_stage_key,
    designApproved: r.design_approved,
    nameListConfirmed: r.name_list_confirmed,
    depositWaived: r.deposit_waived,
    totalSen: toSen(Number(r.total)),
    paidSen: sumVerifiedSen(
      (r.payments ?? []).map((p) => ({ amountSen: toSen(Number(p.amount)), verified: p.verified })),
    ),
    depositPercent: Number(r.deposit_percent),
    creditTerms: !!r.customers?.credit_terms,
    qcShortfall: (r.qc_defects ?? []).reduce((n, d) => (d.resolved ? n : n + d.qty), 0),
  };
}

/** Everything evaluateTransition needs from the job, before the user adds a reason or override. */
export function baseInput(s: FlowState, actor: Actor, to: string, enabledStages?: string[]): TransitionInput {
  const depositSen = s.depositWaived ? 0 : depositRequiredSen(s.totalSen, s.depositPercent);
  return {
    from: s.stageKey,
    to,
    actor,
    paymentStatus: computePaymentStatus({
      totalSen: s.totalSen,
      paidSen: s.paidSen,
      depositSen,
      creditTerms: s.creditTerms,
    }),
    depositMet: s.depositWaived || isDepositMet(s.paidSen, depositSen),
    designApproved: s.designApproved,
    nameListConfirmed: s.nameListConfirmed,
    qcShortfall: s.qcShortfall,
    enabledStages,
  };
}

export type OptionStatus =
  | "ok" // one tap
  | "needs_reason" // hold / cancel / design unlock
  | "needs_waiver" // deposit missing: admin may waive with a reason
  | "needs_override" // balance unpaid: Super Admin may override with a reason
  | "blocked"; // a guard stops it; `code` says why

export interface TransitionOption {
  to: string;
  /** Hold, cancel, QC fail, revision, unlock: shown as secondary actions. */
  side: boolean;
  status: OptionStatus;
  code?: TransitionErrorCode;
}

const SIDE_TARGETS = new Set(["ON_HOLD", "CANCELLED", "QC_FAILED", "REVISION_REQUESTED", "QUOTATION_DRAFT"]);
const PLACEHOLDER_REASON = "reason";

export function transitionOptions(s: FlowState, actor: Actor, enabledStages?: string[]): TransitionOption[] {
  // A held job can only be resumed to where it was, by an admin.
  if (s.stageKey === "ON_HOLD") {
    if (!s.prevStageKey) return [];
    const r = evaluateTransition({ ...baseInput(s, actor, s.prevStageKey, enabledStages), resumeTo: s.prevStageKey });
    return r.ok ? [{ to: s.prevStageKey, side: false, status: "ok" }] : [];
  }

  const out: TransitionOption[] = [];
  for (const to of allowedTargets(s.stageKey, enabledStages)) {
    const input = baseInput(s, actor, to, enabledStages);
    const side = SIDE_TARGETS.has(to) || (to === "DESIGNING" && s.stageKey !== "REVISION_REQUESTED" && s.stageKey !== "CONFIRMED");
    const first = evaluateTransition(input);
    if (first.ok) {
      out.push({ to, side, status: "ok" });
      continue;
    }
    switch (first.code) {
      case "REASON_REQUIRED":
        out.push({ to, side, status: "needs_reason" });
        break;
      case "DEPOSIT_REQUIRED": {
        const w = evaluateTransition({ ...input, waiveDeposit: true, reason: PLACEHOLDER_REASON });
        if (w.ok) out.push({ to, side, status: "needs_waiver", code: first.code });
        else out.push({ to, side, status: "blocked", code: first.code });
        break;
      }
      case "PAYMENT_LOCK": {
        const o = evaluateTransition({ ...input, overridePaymentLock: true, reason: PLACEHOLDER_REASON });
        if (o.ok) out.push({ to, side, status: "needs_override", code: first.code });
        else out.push({ to, side, status: "blocked", code: first.code });
        break;
      }
      case "DESIGN_NOT_APPROVED":
      case "NAME_LIST_NOT_CONFIRMED":
      case "QC_SHORTFALL":
        out.push({ to, side, status: "blocked", code: first.code });
        break;
      default:
        break; // ROLE_FORBIDDEN / NOT_ALLOWED / TERMINAL: not for this user, so don't show it
    }
  }
  return out;
}

/** The single big forward button: the first non-side option. */
export const primaryOption = (opts: TransitionOption[]) => opts.find((o) => !o.side) ?? null;

/**
 * Payment rules. All amounts are integer sen (RM 1.00 = 100) to avoid float drift.
 * Payment status is always COMPUTED from verified payments, never set by hand.
 */

export type PaymentStatus =
  | "UNPAID"
  | "PARTIALLY_PAID"
  | "DEPOSIT_PAID"
  | "FULLY_PAID"
  | "CREDIT_TERMS";

export type ReleaseLevel = "green" | "amber" | "red" | "none";

export interface PaymentInput {
  amountSen: number;
  /** Customer-uploaded proofs are unverified until an admin verifies them. */
  verified: boolean;
}

export const toSen = (rm: number): number => Math.round(rm * 100);
export const toRm = (sen: number): number => sen / 100;

export function sumVerifiedSen(payments: PaymentInput[]): number {
  return payments.reduce((acc, p) => (p.verified ? acc + p.amountSen : acc), 0);
}

export function depositRequiredSen(totalSen: number, depositPercent: number): number {
  return Math.round((totalSen * depositPercent) / 100);
}

/**
 * UNPAID          nothing verified yet
 * PARTIALLY_PAID  some money in, deposit not yet met
 * DEPOSIT_PAID    deposit met, balance outstanding
 * FULLY_PAID      verified payments cover the total
 * CREDIT_TERMS    approved credit customer with a balance outstanding
 */
export function computePaymentStatus(args: {
  totalSen: number;
  paidSen: number;
  depositSen: number;
  creditTerms?: boolean;
}): PaymentStatus {
  const { totalSen, paidSen, depositSen, creditTerms } = args;
  if (totalSen > 0 && paidSen >= totalSen) return "FULLY_PAID";
  if (creditTerms) return "CREDIT_TERMS";
  if (paidSen <= 0) return "UNPAID";
  if (paidSen < depositSen) return "PARTIALLY_PAID";
  return "DEPOSIT_PAID";
}

export const balanceDueSen = (totalSen: number, paidSen: number): number =>
  Math.max(0, totalSen - paidSen);

export function isDepositMet(paidSen: number, depositSen: number): boolean {
  return paidSen >= depositSen && depositSen > 0;
}

/**
 * Release indicator shown on job sheet, dispatch screen and customer page.
 *  green = READY_FOR_COLLECTION and FULLY_PAID
 *  amber = ready but balance outstanding
 *  red   = open job past its due date (and not green)
 * `today` and `dueDate` are 'YYYY-MM-DD' in Asia/Kuala_Lumpur.
 */
export function releaseIndicator(args: {
  stageKey: string;
  paymentStatus: PaymentStatus;
  totalSen: number;
  paidSen: number;
  dueDate: string | null;
  today: string;
}): { level: ReleaseLevel; amountDueSen: number } {
  const { stageKey, paymentStatus, totalSen, paidSen, dueDate, today } = args;
  const amountDueSen = balanceDueSen(totalSen, paidSen);
  const closed = stageKey === "COLLECTED" || stageKey === "DELIVERED" || stageKey === "CANCELLED";
  if (closed) return { level: "none", amountDueSen };

  const ready = stageKey === "READY_FOR_COLLECTION";
  if (ready && paymentStatus === "FULLY_PAID") return { level: "green", amountDueSen: 0 };

  // ISO date strings compare correctly lexicographically.
  if (dueDate && dueDate < today) return { level: "red", amountDueSen };
  if (ready) return { level: "amber", amountDueSen };
  return { level: "none", amountDueSen };
}

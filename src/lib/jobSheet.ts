import type { SupabaseClient } from "@supabase/supabase-js";
import {
  computePaymentStatus,
  depositRequiredSen,
  releaseIndicator,
  sumVerifiedSen,
  type PaymentStatus,
  type ReleaseLevel,
} from "./rules/payments";
import type { Addon } from "./rules/pricing";
import { dbToSen, todayKL } from "./utils";

export interface JobSheetItem {
  garment: string;
  fabric: string | null;
  fabricIsPoly: boolean;
  collar: string | null;
  sleeve: string | null;
  cutting: string | null;
  qty: number;
  notes: string | null;
  addons: Addon[];
}

export interface JobSheetData {
  id: string;
  jobNo: string;
  stageKey: string;
  stageLabel: string;
  priority: "normal" | "rush";
  orderDate: string;
  dueDate: string | null;
  designApproved: boolean;
  nameListConfirmed: boolean;
  designBrief: string | null;
  internalNotes: string | null;
  customerNotes: string | null;
  designerId: string | null;
  customer: { name: string; organisation: string | null; phone: string; creditTerms: boolean };
  items: JobSheetItem[];
  totalQty: number;
  sizeBreakdown: { size: string; qty: number }[];
  nameListCount: number;
  totalSen: number;
  paidSen: number;
  pendingSen: number;
  balanceSen: number;
  paymentStatus: PaymentStatus;
  release: { level: ReleaseLevel; amountDueSen: number };
}

/** One query path for the job sheet screen and its PDF. RLS decides what the caller may see. */
export async function loadJobSheet(
  supabase: SupabaseClient,
  id: string,
  locale: string,
): Promise<JobSheetData | null> {
  const { data: job } = await supabase
    .from("jobs")
    .select(
      "*, customers(name, organisation, phone_e164, credit_terms), job_items(*, garment_types(name), fabrics(name, is_polyester), collar_types(name)), payments(amount, verified), name_list_entries(size)",
    )
    .eq("id", id)
    .maybeSingle();
  if (!job) return null;

  const { data: stage } = await supabase
    .from("stages")
    .select("label_en, label_ms")
    .eq("key", job.stage_key)
    .maybeSingle();

  interface ItemRow {
    garment_types: { name: string } | null;
    fabrics: { name: string; is_polyester: boolean } | null;
    collar_types: { name: string } | null;
    sleeve: string | null;
    cutting: string | null;
    qty: number;
    notes: string | null;
    addons: Addon[] | null;
  }
  const items: JobSheetItem[] = ((job.job_items ?? []) as ItemRow[]).map((i) => ({
    garment: i.garment_types?.name ?? "—",
    fabric: i.fabrics?.name ?? null,
    fabricIsPoly: i.fabrics ? !!i.fabrics.is_polyester : true,
    collar: i.collar_types?.name ?? null,
    sleeve: i.sleeve,
    cutting: i.cutting,
    qty: i.qty,
    notes: i.notes,
    addons: (i.addons ?? []) as Addon[],
  }));

  const sizes = new Map<string, number>();
  for (const e of job.name_list_entries ?? []) sizes.set(e.size, (sizes.get(e.size) ?? 0) + 1);

  const totalSen = dbToSen(job.total);
  const payments = (job.payments ?? []).map((p: { amount: number | string; verified: boolean }) => ({
    amountSen: dbToSen(p.amount),
    verified: p.verified,
  }));
  const paidSen = sumVerifiedSen(payments);
  const pendingSen = payments.reduce((n: number, p: { amountSen: number; verified: boolean }) => (p.verified ? n : n + p.amountSen), 0);
  const depositSen = job.deposit_waived ? 0 : depositRequiredSen(totalSen, Number(job.deposit_percent));
  const paymentStatus = computePaymentStatus({
    totalSen,
    paidSen,
    depositSen,
    creditTerms: !!job.customers?.credit_terms,
  });

  return {
    id: job.id,
    jobNo: job.job_no,
    stageKey: job.stage_key,
    stageLabel: (locale === "en" ? stage?.label_en : stage?.label_ms) ?? job.stage_key,
    priority: job.priority,
    orderDate: job.order_date,
    dueDate: job.due_date,
    designApproved: job.design_approved,
    nameListConfirmed: job.name_list_confirmed,
    designBrief: job.design_brief,
    internalNotes: job.internal_notes,
    customerNotes: job.customer_notes,
    designerId: job.designer_id,
    customer: {
      name: job.customers?.name ?? "",
      organisation: job.customers?.organisation ?? null,
      phone: job.customers?.phone_e164 ?? "",
      creditTerms: !!job.customers?.credit_terms,
    },
    items,
    totalQty: items.reduce((n, i) => n + i.qty, 0),
    sizeBreakdown: [...sizes.entries()].map(([size, qty]) => ({ size, qty })),
    nameListCount: (job.name_list_entries ?? []).length,
    totalSen,
    paidSen,
    pendingSen,
    balanceSen: Math.max(0, totalSen - paidSen),
    paymentStatus,
    release: releaseIndicator({
      stageKey: job.stage_key,
      paymentStatus,
      totalSen,
      paidSen,
      dueDate: job.due_date,
      today: todayKL(),
    }),
  };
}

/** QR target: staff scan it on the floor and land on this job (login first if needed). */
export const jobUrl = (jobId: string) =>
  `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/jobs/${jobId}`;

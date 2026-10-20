"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "@/i18n/navigation";
import { requireAdmin } from "@/lib/auth";
import { addDaysISO, quoteTotals } from "@/lib/rules/pricing";
import { createClient } from "@/lib/supabase/server";
import { rmToSen, todayKL } from "@/lib/utils";

const uuidOrEmpty = z.union([z.literal(""), z.string().uuid()]).transform((v) => v || null);

const addonSchema = z.object({
  label: z.string().trim().min(1).max(60),
  mode: z.enum(["per_piece", "flat"]),
  amountRm: z.coerce.number().min(0).max(100000),
});

const lineSchema = z.object({
  garmentTypeId: uuidOrEmpty,
  fabricId: uuidOrEmpty,
  collarTypeId: uuidOrEmpty,
  sleeve: z.union([z.literal(""), z.enum(["short", "long", "sleeveless"])]).transform((v) => v || null),
  cutting: z.union([z.literal(""), z.enum(["regular", "slim", "muslimah"])]).transform((v) => v || null),
  qty: z.coerce.number().int().min(1).max(100000),
  unitPriceRm: z.coerce.number().min(0).max(100000),
  notes: z.string().trim().max(300).default(""),
  addons: z.array(addonSchema).max(12).default([]),
});

const quoteSchema = z.object({
  locale: z.string(),
  customerId: z.string().uuid(),
  dueDate: z.union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)]).transform((v) => v || null),
  priority: z.enum(["normal", "rush"]),
  rushFeeRm: z.coerce.number().min(0).max(100000),
  notes: z.string().trim().max(500).default(""),
  lines: z.array(lineSchema).min(1).max(30),
});

export type QuotePayload = z.input<typeof quoteSchema>;
export type QuoteResult = { error: "invalid" | "db" } | undefined;

export async function createQuotation(payload: QuotePayload): Promise<QuoteResult> {
  const parsed = quoteSchema.safeParse(payload);
  if (!parsed.success) return { error: "invalid" };
  const v = parsed.data;
  const profile = await requireAdmin(v.locale);
  const supabase = await createClient();

  const [{ data: settings }, { data: garments }] = await Promise.all([
    supabase.from("settings").select("tax_enabled, tax_rate, quote_validity_days").maybeSingle(),
    supabase.from("garment_types").select("id, name"),
  ]);
  const garmentName = new Map<string, string>((garments ?? []).map((g) => [g.id, g.name]));

  const totals = quoteTotals({
    lines: v.lines.map((l) => ({
      qty: l.qty,
      unitPriceSen: rmToSen(l.unitPriceRm),
      addons: l.addons.map((a) => ({ label: a.label, mode: a.mode, amountSen: rmToSen(a.amountRm) })),
    })),
    rushFeeSen: v.priority === "rush" ? rmToSen(v.rushFeeRm) : 0,
    taxEnabled: !!settings?.tax_enabled,
    taxRatePercent: settings?.tax_rate != null ? Number(settings.tax_rate) : null,
  });

  const { data: quoteNo, error: noErr } = await supabase.rpc("next_quote_no", { p_shop: profile.shop_id });
  if (noErr || !quoteNo) return { error: "db" };

  const { data: quote, error } = await supabase
    .from("quotations")
    .insert({
      shop_id: profile.shop_id,
      quote_no: quoteNo,
      customer_id: v.customerId,
      status: "draft",
      valid_until: addDaysISO(todayKL(), settings?.quote_validity_days ?? 30),
      subtotal: totals.subtotalSen / 100,
      tax_amount: totals.taxSen / 100,
      total: totals.totalSen / 100,
      rush_fee: totals.rushFeeSen / 100,
      priority: v.priority,
      due_date: v.dueDate,
      notes: v.notes || null,
      created_by: profile.id,
    })
    .select("id")
    .single();
  if (error || !quote) return { error: "db" };

  const { error: itemsErr } = await supabase.from("quotation_items").insert(
    v.lines.map((l) => ({
      shop_id: profile.shop_id,
      quotation_id: quote.id,
      description: (l.garmentTypeId && garmentName.get(l.garmentTypeId)) || "Item",
      garment_type_id: l.garmentTypeId,
      fabric_id: l.fabricId,
      collar_type_id: l.collarTypeId,
      sleeve: l.sleeve,
      cutting: l.cutting,
      qty: l.qty,
      unit_price: l.unitPriceRm,
      notes: l.notes || null,
      addons: l.addons.map((a) => ({ label: a.label, mode: a.mode, amountSen: rmToSen(a.amountRm) })),
    })),
  );
  if (itemsErr) {
    await supabase.from("quotations").delete().eq("id", quote.id); // don't leave an empty quote
    return { error: "db" };
  }
  redirect({ href: `/quotations/${quote.id}`, locale: v.locale });
}

export async function markQuoteSent(formData: FormData) {
  const locale = String(formData.get("locale") ?? "ms");
  const id = z.string().uuid().parse(formData.get("id"));
  await requireAdmin(locale);
  const supabase = await createClient();
  await supabase.from("quotations").update({ status: "sent" }).eq("id", id).eq("status", "draft");
  revalidatePath(`/${locale}/quotations/${id}`);
}

/** Accepted quotation -> job sheet. The job starts at QUOTATION_SENT until the deposit is recorded. */
export async function createJobFromQuote(formData: FormData) {
  const locale = String(formData.get("locale") ?? "ms");
  const id = z.string().uuid().parse(formData.get("id"));
  const profile = await requireAdmin(locale);
  const supabase = await createClient();

  const { data: existing } = await supabase.from("jobs").select("id").eq("quotation_id", id).maybeSingle();
  if (existing) redirect({ href: `/jobs/${existing.id}`, locale });

  const [{ data: q }, { data: items }, { data: settings }] = await Promise.all([
    supabase.from("quotations").select("*").eq("id", id).maybeSingle(),
    supabase.from("quotation_items").select("*").eq("quotation_id", id),
    supabase.from("settings").select("default_deposit_percent").maybeSingle(),
  ]);
  if (!q || !items?.length || !["draft", "sent"].includes(q.status)) {
    redirect({ href: `/quotations/${id}`, locale });
  }

  const { data: jobNo, error: noErr } = await supabase.rpc("next_job_no", { p_shop: profile.shop_id });
  if (noErr || !jobNo) redirect({ href: `/quotations/${id}`, locale });

  const { data: job, error } = await supabase
    .from("jobs")
    .insert({
      shop_id: profile.shop_id,
      job_no: jobNo,
      customer_id: q!.customer_id,
      quotation_id: id,
      stage_key: "QUOTATION_SENT",
      priority: q!.priority,
      due_date: q!.due_date,
      sales_person: profile.id,
      subtotal: q!.subtotal,
      rush_fee: q!.rush_fee,
      tax_amount: q!.tax_amount,
      total: q!.total,
      deposit_percent: settings?.default_deposit_percent ?? 50,
    })
    .select("id")
    .single();
  if (error || !job) redirect({ href: `/quotations/${id}`, locale }); // e.g. unique index: converted in parallel

  await supabase.from("job_items").insert(
    items!.map((i) => ({
      shop_id: profile.shop_id,
      job_id: job!.id,
      garment_type_id: i.garment_type_id,
      fabric_id: i.fabric_id,
      collar_type_id: i.collar_type_id,
      sleeve: i.sleeve,
      cutting: i.cutting,
      qty: i.qty,
      unit_price: i.unit_price,
      addons: i.addons,
      notes: i.notes,
    })),
  );
  await supabase.from("job_stage_events").insert({
    shop_id: profile.shop_id,
    job_id: job!.id,
    from_stage: null,
    to_stage: "QUOTATION_SENT",
    actor_id: profile.id,
    note: `Created from ${q!.quote_no}`,
  });
  await supabase.from("quotations").update({ status: "accepted" }).eq("id", id);

  redirect({ href: `/jobs/${job!.id}`, locale });
}

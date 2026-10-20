"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  shop_name: z.string().min(1).max(120),
  address: z.string().max(300).default(""),
  phone: z.string().max(30).default(""),
  bank_name: z.string().max(80).default(""),
  account_no: z.string().max(40).default(""),
  account_name: z.string().max(120).default(""),
  job_prefix: z.string().regex(/^[A-Z]{1,6}$/),
  default_deposit_percent: z.coerce.number().min(0).max(100),
  default_lead_time_days: z.coerce.number().int().min(1).max(365),
  quote_validity_days: z.coerce.number().int().min(1).max(365),
  tax_enabled: z.preprocess((v) => v === "on", z.boolean()),
  tax_rate: z.preprocess((v) => (v === "" || v == null ? null : v), z.coerce.number().min(0).max(100).nullable()),
  tax_number: z.string().max(40).default(""),
});

export type SettingsState = { ok?: boolean; error?: string } | undefined;

export async function saveSettings(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  const profile = await getProfile();
  if (!profile || profile.role !== "super_admin") return { error: "forbidden" };

  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "invalid" };
  const v = parsed.data;
  if (v.tax_enabled && v.tax_rate == null) return { error: "Tax rate is required when tax is on" };

  const supabase = await createClient();
  const { error } = await supabase.from("settings").upsert({
    shop_id: profile.shop_id,
    shop_profile: { name: v.shop_name, address: v.address, phone: v.phone },
    bank_details: { bank: v.bank_name, account_no: v.account_no, account_name: v.account_name },
    job_prefix: v.job_prefix,
    default_deposit_percent: v.default_deposit_percent,
    default_lead_time_days: v.default_lead_time_days,
    quote_validity_days: v.quote_validity_days,
    tax_enabled: v.tax_enabled,
    tax_rate: v.tax_enabled ? v.tax_rate : null,
    tax_number: v.tax_number || null,
    updated_at: new Date().toISOString(),
  });
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return { ok: true };
}

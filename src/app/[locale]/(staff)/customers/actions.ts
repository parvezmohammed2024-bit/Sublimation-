"use server";

import { z } from "zod";
import { redirect } from "@/i18n/navigation";
import { requireAdmin } from "@/lib/auth";
import { normaliseMyPhone } from "@/lib/rules/phone";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  name: z.string().trim().min(1).max(120),
  organisation: z.string().trim().max(160).default(""),
  type: z.enum(["individual", "school", "club", "corporate", "government"]),
  phone: z.string().min(1),
  email: z.union([z.literal(""), z.string().email()]).default(""),
  address: z.string().trim().max(300).default(""),
  credit_terms: z.preprocess((v) => v === "on", z.boolean()),
  locale: z.string(),
});

export type CustomerState = { error?: "invalid" | "phone" | "db" } | undefined;

export async function createCustomer(_prev: CustomerState, formData: FormData): Promise<CustomerState> {
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "invalid" };
  const v = parsed.data;
  const profile = await requireAdmin(v.locale);
  const phone = normaliseMyPhone(v.phone);
  if (!phone) return { error: "phone" };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("customers")
    .insert({
      shop_id: profile.shop_id,
      name: v.name,
      organisation: v.organisation || null,
      type: v.type,
      phone_e164: phone,
      email: v.email || null,
      address: v.address || null,
      // Credit terms let a corporate customer owe a balance; only the owner may grant them.
      credit_terms: profile.role === "super_admin" ? v.credit_terms : false,
    })
    .select("id")
    .single();
  if (error || !data) return { error: "db" };
  redirect({ href: `/customers/${data.id}`, locale: v.locale });
}

"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getProfile } from "@/lib/auth";
import { ALL_ROLES } from "@/lib/rules/stages";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export type TeamState = { ok?: boolean; error?: "invalid" | "exists" | "forbidden" | "lastOwner" | "self" | "failed" } | undefined;

const createSchema = z.object({
  full_name: z.string().trim().min(1).max(120),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8).max(72),
  role: z.enum(ALL_ROLES as [string, ...string[]]),
  locale: z.string(),
});

async function owner() {
  const p = await getProfile();
  return p?.role === "super_admin" ? p : null;
}

/** Number of other active owners, so the shop can never lock itself out. */
async function otherActiveOwners(excludeId: string) {
  const supabase = await createClient();
  const { count } = await supabase
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("role", "super_admin")
    .eq("active", true)
    .neq("id", excludeId);
  return count ?? 0;
}

export async function createStaff(_prev: TeamState, formData: FormData): Promise<TeamState> {
  const me = await owner();
  if (!me) return { error: "forbidden" };
  const parsed = createSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "invalid" };
  const v = parsed.data;

  // Creating a login needs the Auth admin API, which only the service-role key can call.
  const admin = createServiceClient();
  const { data, error } = await admin.auth.admin.createUser({
    email: v.email,
    password: v.password,
    email_confirm: true,
  });
  if (error || !data.user) {
    return { error: /already|registered|exists/i.test(error?.message ?? "") ? "exists" : "failed" };
  }
  const { error: profErr } = await admin.from("profiles").insert({
    id: data.user.id,
    shop_id: me.shop_id,
    full_name: v.full_name,
    role: v.role,
    locale: v.locale === "en" ? "en" : "ms",
  });
  if (profErr) {
    await admin.auth.admin.deleteUser(data.user.id); // don't leave a login with no profile
    return { error: "failed" };
  }
  revalidatePath(`/${v.locale}/settings/team`);
  return { ok: true };
}

const idLocale = z.object({ id: z.string().uuid(), locale: z.string() });

export async function setStaffActive(formData: FormData) {
  const me = await owner();
  const parsed = idLocale.extend({ active: z.enum(["1", "0"]) }).safeParse(Object.fromEntries(formData));
  if (!me || !parsed.success) return;
  const { id, locale, active } = parsed.data;
  if (active === "0") {
    if (id === me.id) return;
    const supabase = await createClient();
    const { data: target } = await supabase.from("profiles").select("role").eq("id", id).maybeSingle();
    if (target?.role === "super_admin" && (await otherActiveOwners(id)) === 0) return;
  }
  const supabase = await createClient();
  await supabase.from("profiles").update({ active: active === "1" }).eq("id", id);
  revalidatePath(`/${locale}/settings/team`);
}

export async function changeStaffRole(formData: FormData) {
  const me = await owner();
  const parsed = idLocale.extend({ role: z.enum(ALL_ROLES as [string, ...string[]]) }).safeParse(Object.fromEntries(formData));
  if (!me || !parsed.success) return;
  const { id, locale, role } = parsed.data;
  const supabase = await createClient();
  const { data: target } = await supabase.from("profiles").select("role").eq("id", id).maybeSingle();
  if (target?.role === "super_admin" && role !== "super_admin" && (await otherActiveOwners(id)) === 0) return;
  await supabase.from("profiles").update({ role }).eq("id", id);
  revalidatePath(`/${locale}/settings/team`);
}

"use server";

import { revalidatePath } from "next/cache";
import { getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

/**
 * Section notifications are shared by everyone in the section, so marking them read clears
 * them for the whole section (RLS only exposes rows addressed to the user or their section).
 */
export async function markAllRead(formData: FormData) {
  const locale = String(formData.get("locale") ?? "ms");
  if (!(await getProfile())) return;
  const supabase = await createClient();
  await supabase.from("notifications").update({ read_at: new Date().toISOString() }).is("read_at", null);
  revalidatePath(`/${locale}`, "layout");
}

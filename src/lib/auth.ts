import { createClient } from "./supabase/server";
import type { Role } from "./rules/stages";

export interface StaffProfile {
  id: string;
  shop_id: string;
  full_name: string;
  role: Role;
  locale: "en" | "ms";
}

/** Returns the logged-in staff profile, or null if not logged in / no profile. */
export async function getProfile(): Promise<StaffProfile | null> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;
  const { data } = await supabase
    .from("profiles")
    .select("id, shop_id, full_name, role, locale")
    .eq("id", auth.user.id)
    .eq("active", true)
    .maybeSingle();
  return (data as StaffProfile | null) ?? null;
}

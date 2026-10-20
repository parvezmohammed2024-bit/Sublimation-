import { redirect } from "@/i18n/navigation";
import { createClient } from "./supabase/server";
import type { Role } from "./rules/stages";

export interface StaffProfile {
  id: string;
  shop_id: string;
  full_name: string;
  role: Role;
  locale: "en" | "ms";
}

export const isAdminRole = (role: Role) => role === "super_admin" || role === "admin";

/** Pages and actions for front-desk work. Redirects anyone else. */
export async function requireAdmin(locale: string): Promise<StaffProfile> {
  const profile = await getProfile();
  if (!profile) redirect({ href: "/login", locale });
  if (!isAdminRole(profile!.role)) redirect({ href: "/queue", locale });
  return profile!;
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

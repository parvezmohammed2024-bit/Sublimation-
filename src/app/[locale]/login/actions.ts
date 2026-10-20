"use server";

import { redirect } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const schema = z.object({ email: z.string().email(), password: z.string().min(1), locale: z.string() });

export async function login(_prev: { error?: string } | undefined, formData: FormData) {
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "invalid" };
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });
  if (error) return { error: "invalid" };
  redirect({ href: "/queue", locale: parsed.data.locale });
}

export async function logout(formData: FormData) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect({ href: "/login", locale: String(formData.get("locale") ?? "ms") });
}

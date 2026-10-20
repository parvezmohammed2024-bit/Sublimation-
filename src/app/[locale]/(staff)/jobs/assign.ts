"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({ jobId: z.string().uuid(), locale: z.string() });

/**
 * "I'll take this job": records who in the section is on it. Moving a job is never blocked by
 * who holds it (shop-floor reality), but the queue and timeline show who is responsible.
 * Row Level Security enforces that staff only claim in their own section, for themselves.
 */
export async function claimJob(formData: FormData) {
  const parsed = schema.safeParse(Object.fromEntries(formData));
  const profile = await getProfile();
  if (!parsed.success || !profile) return;
  const { jobId, locale } = parsed.data;

  const supabase = await createClient();
  const { data: job } = await supabase.from("jobs").select("stage_key").eq("id", jobId).maybeSingle();
  if (!job) return;
  const { data: stage } = await supabase.from("stages").select("section").eq("key", job.stage_key).maybeSingle();
  if (!stage) return;

  await supabase.from("job_assignments").insert({
    shop_id: profile.shop_id,
    job_id: jobId,
    section: stage.section,
    user_id: profile.id,
  }); // unique (job_id, section): a second claim simply fails
  revalidatePath(`/${locale}`, "layout");
}

export async function releaseJob(formData: FormData) {
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success || !(await getProfile())) return;
  const { jobId, locale } = parsed.data;
  const supabase = await createClient();
  const { data: job } = await supabase.from("jobs").select("stage_key").eq("id", jobId).maybeSingle();
  if (!job) return;
  const { data: stage } = await supabase.from("stages").select("section").eq("key", job.stage_key).maybeSingle();
  if (!stage) return;
  // RLS: only the holder or an admin can delete.
  await supabase.from("job_assignments").delete().eq("job_id", jobId).eq("section", stage.section);
  revalidatePath(`/${locale}`, "layout");
}

"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const EXT = new Set(["png", "jpg", "jpeg", "webp", "pdf"]);
const MAX_BYTES = 15 * 1024 * 1024;
const schema = z.object({
  jobId: z.string().uuid(),
  locale: z.string(),
  comment: z.string().trim().max(500).optional(),
});

export type MockupState = { ok?: boolean; error?: "invalid" | "locked" | "file" | "forbidden" | "failed" } | undefined;

/**
 * Designer (or an admin) uploads a new mockup version. Allowed only while the job is in
 * DESIGNING and the design is not approved; the database also blocks uploads once locked.
 */
export async function uploadMockup(_prev: MockupState, formData: FormData): Promise<MockupState> {
  const parsed = schema.safeParse(Object.fromEntries(formData));
  const profile = await getProfile();
  if (!parsed.success) return { error: "invalid" };
  if (!profile || !["designer", "admin", "super_admin"].includes(profile.role)) return { error: "forbidden" };
  const { jobId, locale, comment } = parsed.data;

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0 || file.size > MAX_BYTES) return { error: "file" };
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!EXT.has(ext)) return { error: "file" };

  const supabase = await createClient();
  const { data: job } = await supabase
    .from("jobs")
    .select("stage_key, design_approved")
    .eq("id", jobId)
    .maybeSingle();
  if (!job) return { error: "forbidden" };
  if (job.design_approved || job.stage_key !== "DESIGNING") return { error: "locked" };

  const { data: last } = await supabase
    .from("mockups")
    .select("version")
    .eq("job_id", jobId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  const version = (last?.version ?? 0) + 1;

  const path = `${profile.shop_id}/${jobId}/v${version}-${randomUUID()}.${ext}`;
  const up = await supabase.storage.from("mockups").upload(path, file, { contentType: file.type || undefined });
  if (up.error) return { error: "failed" };

  const { error } = await supabase.from("mockups").insert({
    shop_id: profile.shop_id,
    job_id: jobId,
    version,
    file_path: path,
    status: "draft",
    comment: comment || null,
    uploaded_by: profile.id,
  });
  if (error) {
    await supabase.storage.from("mockups").remove([path]); // keep storage and table in step
    return { error: /locked/i.test(error.message) ? "locked" : "failed" };
  }
  revalidatePath(`/${locale}`, "layout");
  return { ok: true };
}

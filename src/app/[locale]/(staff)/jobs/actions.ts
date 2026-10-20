"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const uuidOrEmpty = z.union([z.literal(""), z.string().uuid()]).transform((v) => v || null);

const updateSchema = z.object({
  id: z.string().uuid(),
  locale: z.string(),
  due_date: z.union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)]).transform((v) => v || null),
  priority: z.enum(["normal", "rush"]),
  designer_id: uuidOrEmpty,
  design_brief: z.string().max(2000).optional(),
  internal_notes: z.string().max(2000).default(""),
  customer_notes: z.string().max(2000).default(""),
});

export async function updateJob(formData: FormData) {
  const parsed = updateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;
  const v = parsed.data;
  await requireAdmin(v.locale);
  const supabase = await createClient();

  const { data: job } = await supabase.from("jobs").select("design_approved").eq("id", v.id).maybeSingle();
  if (!job) return;

  const patch: Record<string, unknown> = {
    due_date: v.due_date,
    priority: v.priority,
    designer_id: v.designer_id,
    internal_notes: v.internal_notes || null,
    customer_notes: v.customer_notes || null,
  };
  // Once the design is approved it is locked; the brief only changes after a Super Admin unlock.
  if (!job.design_approved && v.design_brief !== undefined) patch.design_brief = v.design_brief || null;

  await supabase.from("jobs").update(patch).eq("id", v.id);
  revalidatePath(`/${v.locale}/jobs/${v.id}`);
}

const ALLOWED_EXT = new Set(["png", "jpg", "jpeg", "webp", "gif", "svg", "pdf", "ai", "eps", "psd", "cdr", "zip"]);
const MAX_BYTES = 15 * 1024 * 1024;

export async function uploadAttachment(formData: FormData) {
  const locale = String(formData.get("locale") ?? "ms");
  const jobId = z.string().uuid().parse(formData.get("job_id"));
  const kind = z.enum(["logo", "reference", "other"]).parse(formData.get("kind"));
  const file = formData.get("file");
  const profile = await requireAdmin(locale);
  if (!(file instanceof File) || file.size === 0 || file.size > MAX_BYTES) return;

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!ALLOWED_EXT.has(ext)) return;
  const safeName = file.name.replace(/[^\w.\-]+/g, "_").slice(-80);
  const path = `${profile.shop_id}/${jobId}/${randomUUID()}-${safeName}`;

  const supabase = await createClient();
  const { error } = await supabase.storage.from("logos").upload(path, file, { contentType: file.type || undefined });
  if (error) return;
  const { error: rowErr } = await supabase.from("attachments").insert({
    shop_id: profile.shop_id,
    job_id: jobId,
    kind,
    file_path: path,
    file_name: file.name,
    uploaded_by: profile.id,
  });
  if (rowErr) await supabase.storage.from("logos").remove([path]); // keep storage and table in step
  revalidatePath(`/${locale}/jobs/${jobId}`);
}

export async function deleteAttachment(formData: FormData) {
  const locale = String(formData.get("locale") ?? "ms");
  const id = z.string().uuid().parse(formData.get("id"));
  await requireAdmin(locale);
  const supabase = await createClient();
  const { data: a } = await supabase.from("attachments").select("file_path, job_id").eq("id", id).maybeSingle();
  if (!a) return;
  await supabase.from("attachments").delete().eq("id", id);
  await supabase.storage.from("logos").remove([a.file_path]);
  revalidatePath(`/${locale}/jobs/${a.job_id}`);
}

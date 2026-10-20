"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { performTransition, type TransitionOutcome } from "@/lib/workflow/perform";

export type TransitionState = { error?: string; ok?: boolean } | undefined;

const schema = z.object({
  jobId: z.string().uuid(),
  to: z.string().min(1).max(40),
  locale: z.string(),
  reason: z.string().max(500).optional(),
  note: z.string().max(500).optional(),
  waiveDeposit: z.preprocess((v) => v === "1", z.boolean()),
  overridePaymentLock: z.preprocess((v) => v === "1", z.boolean()),
});

/** Form action behind every stage button on the job page and the queue. */
export async function transitionJob(_prev: TransitionState, formData: FormData): Promise<TransitionState> {
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "FAILED" };
  const profile = await getProfile();
  if (!profile) return { error: "ROLE_FORBIDDEN" };

  const photo = formData.get("photo");
  const res = await performTransition({
    supabase: await createClient(),
    profile,
    jobId: parsed.data.jobId,
    to: parsed.data.to,
    reason: parsed.data.reason,
    note: parsed.data.note,
    waiveDeposit: parsed.data.waiveDeposit,
    overridePaymentLock: parsed.data.overridePaymentLock,
    photo: photo instanceof File ? photo : null,
  });
  if (!res.ok) return { error: res.code };
  revalidatePath(`/${parsed.data.locale}`, "layout");
  return { ok: true };
}

/** Drag-and-drop on the board. Returns the outcome so the client can ask for a reason and retry. */
export async function moveJob(args: {
  jobId: string;
  to: string;
  locale: string;
  reason?: string;
}): Promise<TransitionOutcome> {
  const parsed = z
    .object({ jobId: z.string().uuid(), to: z.string().min(1).max(40), locale: z.string(), reason: z.string().max(500).optional() })
    .safeParse(args);
  if (!parsed.success) return { ok: false, code: "FAILED" };
  const profile = await getProfile();
  if (!profile) return { ok: false, code: "ROLE_FORBIDDEN" };

  const res = await performTransition({
    supabase: await createClient(),
    profile,
    jobId: parsed.data.jobId,
    to: parsed.data.to,
    reason: parsed.data.reason,
  });
  if (res.ok) revalidatePath(`/${parsed.data.locale}`, "layout");
  return res;
}

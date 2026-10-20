import "server-only";
import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { StaffProfile } from "../auth";
import { evaluateTransition, type TransitionErrorCode } from "../rules/workflow";
import { createServiceClient } from "../supabase/server";
import { FLOW_SELECT, baseInput, flowStateFromRow, type FlowRow, type FlowState } from "./options";

export type TransitionOutcome =
  | { ok: true }
  | { ok: false; code: TransitionErrorCode | "NOT_FOUND" | "CONFLICT" | "FAILED" };

export async function loadFlowState(supabase: SupabaseClient, jobId: string): Promise<FlowState | null> {
  const { data } = await supabase.from("jobs").select(FLOW_SELECT).eq("id", jobId).maybeSingle();
  return data ? flowStateFromRow(data as unknown as FlowRow) : null;
}

export async function enabledStageKeys(supabase: SupabaseClient): Promise<string[]> {
  const { data } = await supabase.from("stages").select("key").eq("enabled", true);
  return (data ?? []).map((s) => s.key);
}

const IMAGE_EXT = new Set(["png", "jpg", "jpeg", "webp", "heic"]);

/**
 * The only way a job changes stage. Order of operations:
 *  1. read the job as the logged-in user (Row Level Security decides if they may see it),
 *  2. evaluate the business rules,
 *  3. write through apply_transition with the service-role key (one transaction).
 */
export async function performTransition(args: {
  supabase: SupabaseClient;
  profile: StaffProfile;
  jobId: string;
  to: string;
  note?: string;
  reason?: string;
  waiveDeposit?: boolean;
  overridePaymentLock?: boolean;
  photo?: File | null;
}): Promise<TransitionOutcome> {
  const { supabase, profile, jobId, to } = args;
  const state = await loadFlowState(supabase, jobId);
  if (!state) return { ok: false, code: "NOT_FOUND" };

  const enabled = await enabledStageKeys(supabase);
  const verdict = evaluateTransition({
    ...baseInput(state, profile.role, to, enabled),
    reason: args.reason?.trim() || undefined,
    note: args.note?.trim() || undefined,
    waiveDeposit: args.waiveDeposit,
    overridePaymentLock: args.overridePaymentLock,
    resumeTo: state.stageKey === "ON_HOLD" ? (state.prevStageKey ?? undefined) : undefined,
  });
  if (!verdict.ok) return { ok: false, code: verdict.code };

  let photoPath: string | null = null;
  const photo = args.photo;
  if (photo && photo.size > 0 && photo.size <= 10 * 1024 * 1024) {
    const ext = photo.name.split(".").pop()?.toLowerCase() ?? "";
    if (IMAGE_EXT.has(ext)) {
      const path = `${profile.shop_id}/${jobId}/${randomUUID()}.${ext}`;
      const up = await supabase.storage.from("qc-photos").upload(path, photo, { contentType: photo.type || undefined });
      if (!up.error) photoPath = path;
    }
  }

  const { data, error } = await createServiceClient().rpc("apply_transition", {
    p_job: jobId,
    p_from: state.stageKey,
    p_to: to,
    p_actor: profile.id,
    p_note: args.note?.trim() || null,
    p_reason: args.reason?.trim() || null,
    p_photo: photoPath,
    p_waive: verdict.audit.includes("deposit_waived"),
    p_unlock: verdict.audit.includes("design_unlocked"),
    p_override: verdict.audit.includes("payment_override"),
  });
  if (error) return { ok: false, code: "FAILED" };
  if (data !== true) return { ok: false, code: "CONFLICT" }; // someone else moved it first
  return { ok: true };
}

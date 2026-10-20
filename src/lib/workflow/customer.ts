import "server-only";
import { randomUUID } from "node:crypto";
import { evaluateTransition, type TransitionErrorCode } from "../rules/workflow";
import { createServiceClient } from "../supabase/server";
import { FLOW_SELECT, baseInput, flowStateFromRow, type FlowRow } from "./options";

/** Tracking tokens are 18 random bytes, hex encoded. Reject anything else before touching the DB. */
export const isValidToken = (t: string) => /^[a-f0-9]{36}$/.test(t);

export type CustomerOutcome =
  | { ok: true }
  | { ok: false; code: TransitionErrorCode | "NOT_FOUND" | "CONFLICT" | "FAILED" | "NAME_REQUIRED" | "CONFIRM_REQUIRED" | "COMMENT_REQUIRED" | "FILE" };

const IMAGE_EXT = new Set(["png", "jpg", "jpeg", "webp"]);

/**
 * Customer approves the mockup, or asks for changes. The token is the only credential, so
 * every rule is checked here on the server: right stage, right actor, typed name, confirmation.
 * Approval then opens the name-list step as the system actor (no admin click needed).
 */
export async function customerDesignAction(args: {
  token: string;
  kind: "approve" | "revision";
  typedName?: string;
  confirmed?: boolean;
  comment?: string;
  image?: File | null;
  ip?: string;
}): Promise<CustomerOutcome> {
  if (!isValidToken(args.token)) return { ok: false, code: "NOT_FOUND" };
  const service = createServiceClient();

  const { data } = await service
    .from("jobs")
    .select(`shop_id, ${FLOW_SELECT}`)
    .eq("tracking_token", args.token)
    .maybeSingle();
  if (!data) return { ok: false, code: "NOT_FOUND" };
  const row = data as unknown as FlowRow & { shop_id: string };
  const state = flowStateFromRow(row);

  const typedName = args.typedName?.trim() ?? "";
  const comment = args.comment?.trim() ?? "";
  if (args.kind === "approve") {
    if (typedName.length < 2 || typedName.length > 80) return { ok: false, code: "NAME_REQUIRED" };
    if (!args.confirmed) return { ok: false, code: "CONFIRM_REQUIRED" };
  } else if (comment.length < 3 && !(args.image && args.image.size > 0)) {
    return { ok: false, code: "COMMENT_REQUIRED" };
  }

  const to = args.kind === "approve" ? "DESIGN_APPROVED" : "REVISION_REQUESTED";
  const verdict = evaluateTransition(baseInput(state, "customer", to));
  if (!verdict.ok) return { ok: false, code: verdict.code };

  let imagePath: string | null = null;
  if (args.kind === "revision" && args.image && args.image.size > 0) {
    const ext = args.image.name.split(".").pop()?.toLowerCase() ?? "";
    if (!IMAGE_EXT.has(ext) || args.image.size > 5 * 1024 * 1024) return { ok: false, code: "FILE" };
    const path = `${row.shop_id}/${row.id}/revision-${randomUUID()}.${ext}`;
    const up = await service.storage.from("mockups").upload(path, args.image, { contentType: args.image.type || undefined });
    if (!up.error) imagePath = path;
  }

  const { data: ok, error } = await service.rpc("apply_transition", {
    p_job: row.id,
    p_from: state.stageKey,
    p_to: to,
    p_actor: null,
    p_note: args.kind === "approve" ? `Approved by ${typedName}` : comment || null,
    p_reason: null,
    p_photo: imagePath,
    p_waive: false,
    p_unlock: false,
    p_override: false,
    p_actor_kind: "customer",
    p_approval: {
      typed_name: args.kind === "approve" ? typedName : null,
      comment: args.kind === "revision" ? comment || null : null,
      image_path: imagePath,
      ip: args.ip ?? "",
    },
  });
  if (error) return { ok: false, code: "FAILED" };
  if (ok !== true) return { ok: false, code: "CONFLICT" };

  if (args.kind === "approve") {
    // The design is now locked; the system opens the name-list step. If this second step fails
    // the job simply waits at DESIGN_APPROVED and an admin can advance it.
    const next = evaluateTransition(baseInput({ ...state, stageKey: "DESIGN_APPROVED", designApproved: true }, "system", "AWAITING_NAME_LIST"));
    if (next.ok) {
      await service.rpc("apply_transition", {
        p_job: row.id,
        p_from: "DESIGN_APPROVED",
        p_to: "AWAITING_NAME_LIST",
        p_actor: null,
        p_note: null,
        p_reason: null,
        p_photo: null,
        p_waive: false,
        p_unlock: false,
        p_override: false,
        p_actor_kind: "system",
        p_approval: null,
      });
    }
  }
  return { ok: true };
}

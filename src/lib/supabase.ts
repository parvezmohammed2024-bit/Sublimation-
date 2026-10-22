import { createClient } from "@supabase/supabase-js";
import type { PublicOrder, QueueData, Step, Team } from "./types";

const url = import.meta.env.VITE_SUPABASE_URL as string;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const isConfigured = Boolean(url && anon);
export const CONTACT_WHATSAPP = ((import.meta.env.VITE_CONTACT_WHATSAPP as string) || "").replace(/\D/g, "");
export const BUSINESS_NAME = (import.meta.env.VITE_BUSINESS_NAME as string) || "Sublimation Studio";

/**
 * Same project as StitchPay and the KG tracker, so the admin session has its own storage key
 * and never collides with theirs on one browser.
 */
export const supabase = createClient(url || "http://localhost", anon || "anon", {
  auth: { storageKey: "subli-admin-auth", persistSession: true, autoRefreshToken: true },
});

/** Turn a Postgres error into a plain message for the screen. */
export const errMsg = (e: unknown) =>
  (e as { message?: string })?.message?.replace(/^.*?ERROR:\s*/, "") ?? String(e);

// ------------------------------------------------------------- artwork
const BUCKET = "subli-artwork";
export const artworkUrl = (path: string) => `${url}/storage/v1/object/public/${BUCKET}/${path}`;

/** Shrink big phone photos before upload: longest side 2200px, JPEG. PNG/WebP under 1.5 MB are kept as they are. */
async function shrink(file: File): Promise<Blob> {
  if (file.size < 1_500_000 && file.type !== "image/jpeg") return file;
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, 2200 / Math.max(bmp.width, bmp.height));
    const c = document.createElement("canvas");
    c.width = Math.round(bmp.width * scale); c.height = Math.round(bmp.height * scale);
    c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
    const out = await new Promise<Blob | null>((r) => c.toBlob(r, "image/jpeg", 0.88));
    return out && out.size < file.size ? out : file;
  } catch { return file; }
}

export async function uploadArtwork(orderId: string, file: File): Promise<string> {
  const blob = await shrink(file);
  const ext = blob.type === "image/png" ? "png" : blob.type === "image/webp" ? "webp" : "jpg";
  const path = `${orderId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: blob.type || "image/jpeg" });
  if (error) throw error;
  return path;
}
export async function removeArtwork(path: string) {
  await supabase.storage.from(BUCKET).remove([path]);
}

// ---------------------------------------------------------------- team
export interface TeamSession {
  token: string;
  expires_at: number;
  member: { id: string; name: string; team: Team; mobile: string; must_set_pin: boolean };
}
const KEY = "subli-team-session";
export function loadTeamSession(): TeamSession | null {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) ?? "null") as TeamSession | null;
    return s && s.expires_at * 1000 > Date.now() ? s : null;
  } catch { return null; }
}
export const saveTeamSession = (s: TeamSession) => { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* private mode */ } };
export const clearTeamSession = () => { try { localStorage.removeItem(KEY); } catch { /* ignore */ } };

export class SessionExpired extends Error {}

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) {
    if (error.message.includes("session_expired")) throw new SessionExpired("session_expired");
    throw new Error(errMsg(error));
  }
  return data as T;
}

export type LoginResult = TeamSession | { error: "invalid_credentials" | "locked"; locked_until?: string };
export const teamLogin = (mobile: string, pin: string) => rpc<LoginResult>("subli_team_login", { p_mobile: mobile, p_pin: pin });
export const teamSetPin = (token: string, pin: string) => rpc<{ ok?: true; error?: string }>("subli_team_set_pin", { p_token: token, p_new_pin: pin });
export const teamLogout = (token: string) => rpc<void>("subli_team_logout", { p_token: token }).catch(() => undefined);
export const teamQueue = (token: string) => rpc<QueueData>("subli_team_queue", { p_token: token });
export const teamStart = (token: string, id: string) => rpc<void>("subli_team_start", { p_token: token, p_order_id: id });
export const teamDone = (token: string, id: string) => rpc<void>("subli_team_done", { p_token: token, p_order_id: id });
export const teamUndo = (token: string, entryId: string) => rpc<void>("subli_team_undo", { p_token: token, p_entry_id: entryId });
export const teamLog = (token: string, id: string, step: Step, qty: number, reason?: string) =>
  rpc<void>("subli_team_log", { p_token: token, p_order_id: id, p_step: step, p_qty: qty, p_reason: reason ?? null });

// -------------------------------------------------------------- public
export const trackOrder = (no: string) => rpc<PublicOrder | null>("subli_track_order", { p_tracking_no: no });
export type Decision = { status: "approved" | "changes" } | { error: "not_found" | "not_waiting" | "locked" | "no_phone" | "wrong_phone" | "note_required" };
export const customerDecide = (no: string, phone: string, approve: boolean, note?: string) =>
  rpc<Decision>("subli_customer_decide", { p_tracking_no: no, p_phone: phone, p_approve: approve, p_note: note ?? null });
export type MyOrdersResult = { name: string | null; orders: PublicOrder[] } | { error: "invalid" | "locked" };
export const trackCustomer = (phone: string, code: string) => rpc<MyOrdersResult>("subli_track_customer", { p_phone: phone, p_code: code });

/** wa.me link with a ready message */
export const waLink = (phoneDigits: string, text: string) => `https://wa.me/${phoneDigits}?text=${encodeURIComponent(text)}`;

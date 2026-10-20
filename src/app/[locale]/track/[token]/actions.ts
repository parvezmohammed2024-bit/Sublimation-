"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { customerDesignAction } from "@/lib/workflow/customer";

export type ReviewState = { ok?: boolean; error?: string } | undefined;

async function clientIp() {
  const h = await headers();
  return (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "").trim().slice(0, 45);
}

export async function approveDesign(_prev: ReviewState, formData: FormData): Promise<ReviewState> {
  const token = String(formData.get("token") ?? "");
  const res = await customerDesignAction({
    token,
    kind: "approve",
    typedName: String(formData.get("typedName") ?? ""),
    confirmed: formData.get("confirm") === "on",
    ip: await clientIp(),
  });
  if (!res.ok) return { error: res.code };
  revalidatePath(`/${String(formData.get("locale") ?? "ms")}/track/${token}`);
  return { ok: true };
}

export async function requestRevision(_prev: ReviewState, formData: FormData): Promise<ReviewState> {
  const token = String(formData.get("token") ?? "");
  const image = formData.get("image");
  const res = await customerDesignAction({
    token,
    kind: "revision",
    comment: String(formData.get("comment") ?? ""),
    image: image instanceof File ? image : null,
    ip: await clientIp(),
  });
  if (!res.ok) return { error: res.code };
  revalidatePath(`/${String(formData.get("locale") ?? "ms")}/track/${token}`);
  return { ok: true };
}

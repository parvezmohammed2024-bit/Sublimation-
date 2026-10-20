"use client";

import { useActionState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { approveDesign, requestRevision } from "./actions";

const field = "mt-1 w-full rounded-lg border border-line bg-card px-3 py-3 text-base";

export function DesignReview({ token, revisionsUsed, freeRevisions }: { token: string; revisionsUsed: number; freeRevisions: number }) {
  const t = useTranslations("track");
  const locale = useLocale();
  const [approveState, approveAction, approving] = useActionState(approveDesign, undefined);
  const [reviseState, reviseAction, revising] = useActionState(requestRevision, undefined);
  const err = (code?: string) => (code ? (t.has(`errors.${code}`) ? t(`errors.${code}`) : t("errors.FAILED")) : null);

  return (
    <div className="space-y-4">
      <form action={approveAction} className="space-y-3 rounded-xl border border-ok bg-card p-4">
        <h3 className="font-semibold">{t("approveTitle")}</h3>
        <input type="hidden" name="token" value={token} />
        <input type="hidden" name="locale" value={locale} />
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" name="confirm" required className="mt-1 size-5 shrink-0" />
          <span>{t("confirmText")}</span>
        </label>
        <label className="block text-sm">
          {t("typedName")}
          <input name="typedName" required minLength={2} maxLength={80} autoComplete="name" className={field} />
        </label>
        {err(approveState?.error) && <p role="alert" className="text-sm text-bad">{err(approveState?.error)}</p>}
        <button disabled={approving} className="w-full rounded-lg bg-ok px-4 py-4 text-lg font-semibold text-white disabled:opacity-60">
          {t("approve")}
        </button>
      </form>

      <form action={reviseAction} className="space-y-3 rounded-xl border border-line bg-card p-4">
        <h3 className="font-semibold">{t("reviseTitle")}</h3>
        <p className="text-sm text-muted">{t("revisionsInfo", { used: revisionsUsed, free: freeRevisions })}</p>
        <input type="hidden" name="token" value={token} />
        <input type="hidden" name="locale" value={locale} />
        <label className="block text-sm">
          {t("comment")}
          <textarea name="comment" rows={3} className={field} />
        </label>
        <label className="block text-sm">
          {t("attach")}
          <input type="file" name="image" accept="image/png,image/jpeg,image/webp" className="mt-1 block w-full text-sm" />
        </label>
        {err(reviseState?.error) && <p role="alert" className="text-sm text-bad">{err(reviseState?.error)}</p>}
        <button disabled={revising} className="w-full rounded-lg border border-line px-4 py-3 font-medium disabled:opacity-60">
          {t("sendRevision")}
        </button>
      </form>
    </div>
  );
}

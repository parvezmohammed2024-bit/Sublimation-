"use client";

import { useActionState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { uploadMockup } from "@/app/[locale]/(staff)/jobs/mockups";

export function MockupUpload({ jobId }: { jobId: string }) {
  const t = useTranslations("mockups");
  const locale = useLocale();
  const [state, action, pending] = useActionState(uploadMockup, undefined);
  return (
    <form action={action} className="space-y-2 rounded-xl border border-dashed border-line p-3" key={state?.ok ? "done" : "form"}>
      <input type="hidden" name="jobId" value={jobId} />
      <input type="hidden" name="locale" value={locale} />
      <input type="file" name="file" accept="image/png,image/jpeg,image/webp,application/pdf" required className="block w-full text-sm" />
      <input name="comment" placeholder={t("comment")} className="w-full rounded-lg border border-line bg-card px-3 py-3 text-base" />
      {state?.error && <p role="alert" className="text-sm text-bad">{t(`errors.${state.error}`)}</p>}
      {state?.ok && <p role="status" className="text-sm text-ok">{t("uploaded")}</p>}
      <button disabled={pending} className="w-full rounded-lg border border-line px-4 py-3 font-medium disabled:opacity-60">
        {t("upload")}
      </button>
    </form>
  );
}

"use client";

import { useActionState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { transitionJob } from "@/app/[locale]/(staff)/jobs/transition";
import type { OptionStatus } from "@/lib/workflow/options";

export interface StageActionOption {
  to: string;
  label: string;
  side: boolean;
  status: OptionStatus;
  code?: string;
  /** Set when the next stage belongs to a different section: shown as "Send to <section>". */
  handoff?: string;
}

const field = "w-full rounded-lg border border-line bg-card px-3 py-3 text-base";

function ErrorLine({ code }: { code?: string }) {
  const t = useTranslations("workflow.errors");
  if (!code) return null;
  return <p role="alert" className="text-sm text-bad">{t.has(code) ? t(code) : t("FAILED")}</p>;
}

function StageButton({ jobId, opt, compact = false }: { jobId: string; opt: StageActionOption; compact?: boolean }) {
  const t = useTranslations("workflow");
  const locale = useLocale();
  const [state, action, pending] = useActionState(transitionJob, undefined);

  if (opt.status === "blocked") {
    return (
      <div className="rounded-lg border border-dashed border-line p-3 text-sm text-muted">
        <span className="font-medium">{opt.label}</span>: {t.has(`errors.${opt.code}`) ? t(`errors.${opt.code}`) : ""}
      </div>
    );
  }

  const needsReason = opt.status !== "ok";
  const hidden = (
    <>
      <input type="hidden" name="jobId" value={jobId} />
      <input type="hidden" name="to" value={opt.to} />
      <input type="hidden" name="locale" value={locale} />
      {opt.status === "needs_waiver" && <input type="hidden" name="waiveDeposit" value="1" />}
      {opt.status === "needs_override" && <input type="hidden" name="overridePaymentLock" value="1" />}
    </>
  );

  if (!needsReason) {
    return (
      <form action={action} className="space-y-2">
        {hidden}
        <button
          disabled={pending}
          className={
            opt.side
              ? "w-full rounded-lg border border-line px-4 py-3 font-medium disabled:opacity-60"
              : compact
                ? "w-full rounded-xl bg-brand px-4 py-4 text-base font-semibold text-white disabled:opacity-60"
                : "w-full rounded-xl bg-brand px-4 py-5 text-lg font-semibold text-white disabled:opacity-60"
          }
        >
          {opt.side ? opt.label : opt.handoff ? t("sendTo", { section: opt.handoff }) : `${t("moveTo")} ${opt.label}`}
        </button>
        {!opt.side && !compact && (
          <details className="text-sm">
            <summary className="cursor-pointer text-muted">{t("addPhotoNote")}</summary>
            <div className="mt-2 space-y-2">
              <input name="note" placeholder={t("note")} className={field} />
              <input name="photo" type="file" accept="image/*" capture="environment" className="block w-full text-sm" />
            </div>
          </details>
        )}
        <ErrorLine code={state?.error} />
      </form>
    );
  }

  const hint =
    opt.status === "needs_waiver" ? t("waiveHint") : opt.status === "needs_override" ? t("overrideHint") : t("reasonHint");
  return (
    <details className="rounded-lg border border-line p-3">
      <summary className="cursor-pointer font-medium">
        {opt.status === "needs_waiver" ? `${opt.label}: ${t("waiveDeposit")}` : opt.status === "needs_override" ? `${opt.label}: ${t("overridePayment")}` : opt.label}
      </summary>
      <form action={action} className="mt-3 space-y-2">
        {hidden}
        <p className="text-sm text-muted">{hint}</p>
        <textarea name="reason" required minLength={3} rows={2} placeholder={t("reason")} className={field} />
        <button disabled={pending} className="w-full rounded-lg bg-bad px-4 py-3 font-medium text-white disabled:opacity-60">
          {t("confirm")}
        </button>
        <ErrorLine code={state?.error} />
      </form>
    </details>
  );
}

/** compact: queue cards show only the one-tap forward button, nothing that needs a reason. */
export function StageActions({
  jobId,
  options,
  compact = false,
}: {
  jobId: string;
  options: StageActionOption[];
  compact?: boolean;
}) {
  const t = useTranslations("workflow");
  if (compact) {
    const next = options.find((o) => !o.side && o.status === "ok");
    return next ? <StageButton jobId={jobId} opt={next} compact /> : null;
  }
  if (options.length === 0) return <p className="text-sm text-muted">{t("noActions")}</p>;
  const primary = options.filter((o) => !o.side);
  const side = options.filter((o) => o.side);
  return (
    <div className="space-y-3">
      {primary.map((o) => <StageButton key={o.to} jobId={jobId} opt={o} />)}
      {side.length > 0 && (
        <div className="space-y-2">
          {side.map((o) => <StageButton key={o.to} jobId={jobId} opt={o} />)}
        </div>
      )}
    </div>
  );
}

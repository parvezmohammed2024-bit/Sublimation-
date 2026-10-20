import { getTranslations } from "next-intl/server";
import { claimJob, releaseJob } from "@/app/[locale]/(staff)/jobs/assign";

/** Shows who holds the job in this section, with take / release. Server component, plain forms. */
export async function ClaimBar({
  jobId,
  locale,
  holderId,
  holderName,
  me,
  isAdmin,
}: {
  jobId: string;
  locale: string;
  holderId: string | null;
  holderName: string | null;
  me: string;
  isAdmin: boolean;
}) {
  const t = await getTranslations("assign");
  const hidden = (
    <>
      <input type="hidden" name="jobId" value={jobId} />
      <input type="hidden" name="locale" value={locale} />
    </>
  );
  if (!holderId) {
    return (
      <form action={claimJob}>
        {hidden}
        <button className="w-full rounded-lg border border-line px-3 py-2 text-sm font-medium">{t("take")}</button>
      </form>
    );
  }
  const mine = holderId === me;
  return (
    <div className="flex items-center justify-between gap-2 text-sm">
      <span className={mine ? "font-medium text-brand" : "text-muted"}>
        {mine ? t("youHaveThis") : t("takenBy", { name: holderName ?? "—" })}
      </span>
      {(mine || isAdmin) && (
        <form action={releaseJob}>
          {hidden}
          <button className="rounded-lg border border-line px-3 py-1.5 text-xs">{t("release")}</button>
        </form>
      )}
    </div>
  );
}

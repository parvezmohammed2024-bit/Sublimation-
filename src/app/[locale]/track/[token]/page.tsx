import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { SetupNotice } from "@/components/SetupNotice";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createServiceClient } from "@/lib/supabase/server";
import { isValidToken } from "@/lib/workflow/customer";
import { DesignReview } from "./DesignReview";

export const dynamic = "force-dynamic";

/**
 * Public customer page, opened with the unguessable link. Phase 4 shows the mockup review;
 * the full progress tracker, name list and payment sections arrive in later phases.
 * Everything here is read with the service-role key on the server, scoped to one token.
 */
export default async function TrackPage({ params }: { params: Promise<{ locale: string; token: string }> }) {
  const { locale, token } = await params;
  if (!isSupabaseConfigured()) return <SetupNotice />;
  if (!isValidToken(token)) notFound();

  const service = createServiceClient();
  const { data: job } = await service
    .from("jobs")
    .select("id, shop_id, job_no, stage_key, due_date, customer_notes, revision_count, customers(name)")
    .eq("tracking_token", token)
    .maybeSingle();
  if (!job) notFound();

  const [{ data: settings }, { data: stage }, { data: mockups }] = await Promise.all([
    service.from("settings").select("shop_profile, free_revisions").eq("shop_id", job.shop_id).maybeSingle(),
    service.from("stages").select("customer_label_en, customer_label_ms").eq("shop_id", job.shop_id).eq("key", job.stage_key).maybeSingle(),
    service.from("mockups").select("id, version, file_path, status").eq("job_id", job.id).order("version", { ascending: false }),
  ]);
  const t = await getTranslations("track");

  // The customer sees the version awaiting their decision, otherwise the latest approved one.
  const shown = (mockups ?? []).find((m) => m.status === "sent") ?? (mockups ?? []).find((m) => m.status === "approved");
  let url: string | null = null;
  if (shown) {
    const { data } = await service.storage.from("mockups").createSignedUrl(shown.file_path, 3600);
    url = data?.signedUrl ?? null;
  }
  const isPdf = shown?.file_path.toLowerCase().endsWith(".pdf");
  const awaitingDecision = job.stage_key === "MOCKUP_SENT" && shown?.status === "sent";
  const customer = job.customers as unknown as { name: string } | null;
  const shop = (settings?.shop_profile as { name?: string } | null)?.name;

  return (
    <main className="mx-auto min-h-dvh max-w-xl space-y-5 p-4 pb-16">
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted">{shop}</p>
          <h1 className="text-2xl font-bold">{job.job_no}</h1>
          <p className="text-muted">{customer?.name}</p>
        </div>
        <LocaleSwitcher />
      </header>

      <div className="rounded-xl border border-line bg-card p-4">
        <p className="text-sm text-muted">{t("status")}</p>
        <p className="text-lg font-semibold">
          {(locale === "en" ? stage?.customer_label_en : stage?.customer_label_ms) ?? job.stage_key}
        </p>
        {job.due_date && (
          <p className="mt-2 text-sm text-muted">
            {t("estimatedReady")}: <span className="font-medium text-fg">{job.due_date}</span>
          </p>
        )}
        {job.customer_notes && <p className="mt-2 text-sm">{job.customer_notes}</p>}
      </div>

      {shown && url && (
        <section className="space-y-3">
          <h2 className="font-semibold">{awaitingDecision ? t("reviewTitle") : t("yourDesign")}</h2>
          {isPdf ? (
            <a href={url} target="_blank" rel="noreferrer" className="block rounded-xl border border-line bg-card p-4 text-brand underline">
              {t("openPdf")}
            </a>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt={t("yourDesign")} className="w-full rounded-xl border border-line bg-white object-contain" />
          )}
          {!awaitingDecision && shown.status === "approved" && (
            <p className="rounded-lg bg-ok/10 p-3 text-sm text-ok">{t("approvedNote")}</p>
          )}
        </section>
      )}

      {awaitingDecision && (
        <DesignReview token={token} revisionsUsed={job.revision_count} freeRevisions={settings?.free_revisions ?? 2} />
      )}

      {!shown && <p className="text-sm text-muted">{t("noMockupYet")}</p>}
    </main>
  );
}

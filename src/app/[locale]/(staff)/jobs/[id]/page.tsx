import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import QRCode from "qrcode";
import { JobTimeline } from "@/components/JobTimeline";
import { LiveRefresh } from "@/components/LiveRefresh";
import { ReleaseBadge } from "@/components/ReleaseBadge";
import { StageActions } from "@/components/StageActions";
import { getProfile, isAdminRole } from "@/lib/auth";
import { jobUrl, loadJobSheet } from "@/lib/jobSheet";
import { formatMyPhone } from "@/lib/rules/phone";
import { createClient } from "@/lib/supabase/server";
import { formatRM } from "@/lib/utils";
import { transitionOptions } from "@/lib/workflow/options";
import { enabledStageKeys, loadFlowState } from "@/lib/workflow/perform";
import { redirect } from "@/i18n/navigation";
import { deleteAttachment, updateJob, uploadAttachment } from "../actions";

const field = "mt-1 w-full rounded-lg border border-line bg-card px-3 py-3 text-base";

export default async function JobPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  const profile = await getProfile();
  if (!profile) redirect({ href: "/login", locale });
  const isAdmin = isAdminRole(profile!.role);
  // Money is visible to admins and dispatch (RLS hides payments from everyone else).
  const seesMoney = isAdmin || profile!.role === "dispatch";

  const t = await getTranslations("jobs");
  const q = await getTranslations("quotes");
  const w = await getTranslations("workflow");
  const supabase = await createClient();

  const job = await loadJobSheet(supabase, id, locale);
  if (!job) notFound();

  const [{ data: designers }, { data: attachments }, qr, flow, enabled, { data: stages }, { data: full }] =
    await Promise.all([
      supabase.from("profiles").select("id, full_name").eq("role", "designer").eq("active", true),
      supabase.from("attachments").select("id, kind, file_path, file_name").eq("job_id", id).order("created_at"),
      QRCode.toDataURL(jobUrl(id), { margin: 1, width: 240 }),
      loadFlowState(supabase, id),
      enabledStageKeys(supabase),
      supabase.from("stages").select("key, label_en, label_ms"),
      supabase.from("jobs").select("design_brief, internal_notes, customer_notes, designer_id, due_date, priority").eq("id", id).single(),
    ]);

  const stageLabel = new Map((stages ?? []).map((s) => [s.key, locale === "en" ? s.label_en : s.label_ms]));
  const options = flow
    ? transitionOptions(flow, profile!.role, enabled).map((o) => ({
        ...o,
        label: stageLabel.get(o.to) ?? o.to,
      }))
    : [];

  const signed = await Promise.all(
    (attachments ?? []).map(async (a) => {
      const { data } = await supabase.storage.from("logos").createSignedUrl(a.file_path, 3600);
      return { ...a, url: data?.signedUrl ?? null };
    }),
  );

  return (
    <section className="space-y-6">
      <LiveRefresh tables="jobs,job_stage_events" />
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{job.jobNo}</h1>
          <p className="text-muted">{job.customer.organisation ?? job.customer.name}</p>
          <p className="text-sm text-muted">{formatMyPhone(job.customer.phone)}</p>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={qr} alt={`QR ${job.jobNo}`} width={96} height={96} className="rounded-lg bg-white p-1" />
      </div>

      <div className="rounded-xl border border-line bg-card p-4">
        <p className="text-sm text-muted">{t("stage")}</p>
        <p className="text-lg font-semibold">{job.stageLabel}</p>
        <p className="mt-3 text-sm text-muted">{t("dueDate")}</p>
        <p className="text-3xl font-bold">{job.dueDate ?? "—"}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {job.priority === "rush" && <span className="rounded-full bg-bad px-3 py-1 text-sm font-medium text-white">{t("rush")}</span>}
          {seesMoney && <ReleaseBadge level={job.release.level} amountDueSen={job.release.amountDueSen} />}
        </div>
      </div>

      <StageActions jobId={id} options={options} />

      <a
        href={`/api/jobs/${id}/pdf?locale=${locale}`}
        className="block rounded-lg border border-line px-4 py-3 text-center font-medium"
      >
        {t("downloadPdf")}
      </a>

      <div>
        <h2 className="mb-2 font-semibold">{t("items")} ({job.totalQty} {q("pc")})</h2>
        <ul className="space-y-2">
          {job.items.map((i, n) => (
            <li key={n} className="rounded-xl border border-line bg-card p-4 text-sm">
              <p className="font-medium">{i.garment} × {i.qty}</p>
              <p className="text-muted">
                {[i.fabric, i.collar, i.sleeve && q(`sleeves.${i.sleeve}`), i.cutting && q(`cuttings.${i.cutting}`)]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              {!i.fabricIsPoly && <p className="text-warn">{q("nonPoly")}</p>}
              {i.addons.map((a, k) => <p key={k} className="text-muted">+ {a.label}</p>)}
              {i.notes && <p className="text-muted">{i.notes}</p>}
            </li>
          ))}
        </ul>
      </div>

      {seesMoney && (
        <div className="rounded-xl border border-line bg-card p-4 text-sm">
          <h2 className="mb-2 font-semibold">{t("payment")}</h2>
          <div className="flex justify-between"><span className="text-muted">{t("total")}</span><span>{formatRM(job.totalSen)}</span></div>
          <div className="flex justify-between"><span className="text-muted">{t("paid")}</span><span>{formatRM(job.paidSen)}</span></div>
          {job.pendingSen > 0 && (
            <div className="flex justify-between"><span className="text-muted">{t("pending")}</span><span>{formatRM(job.pendingSen)}</span></div>
          )}
          <div className="flex justify-between pt-1 text-base font-semibold"><span>{t("balance")}</span><span>{formatRM(job.balanceSen)}</span></div>
          <p className="mt-1 text-muted">{t(`payStatus.${job.paymentStatus}`)}</p>
        </div>
      )}

      <div className="rounded-xl border border-line bg-card p-4 text-sm">
        <h2 className="mb-2 font-semibold">{t("nameList")}</h2>
        {job.nameListCount === 0 ? (
          <p className="text-muted">{t("noNameList")}</p>
        ) : (
          <p>{job.sizeBreakdown.map((s) => `${s.size}: ${s.qty}`).join("  ·  ")}</p>
        )}
      </div>

      {!isAdmin && (job.designBrief || job.internalNotes) && (
        <div className="rounded-xl border border-line bg-card p-4 text-sm">
          {job.designBrief && <p><span className="text-muted">{t("designBrief")}:</span> {job.designBrief}</p>}
          {job.internalNotes && <p className="mt-2"><span className="text-muted">{t("internalNotes")}:</span> {job.internalNotes}</p>}
        </div>
      )}

      <div>
        <h2 className="mb-3 font-semibold">{w("timeline")}</h2>
        <JobTimeline supabase={supabase} jobId={id} locale={locale} />
      </div>

      {isAdmin && (
        <form action={updateJob} className="space-y-3">
          <h2 className="font-semibold">{t("details")}</h2>
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="locale" value={locale} />
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm">
              {t("dueDate")}
              <input type="date" name="due_date" defaultValue={full?.due_date ?? ""} className={field} />
            </label>
            <label className="block text-sm">
              {t("priority")}
              <select name="priority" defaultValue={full?.priority} className={field}>
                <option value="normal">{q("normal")}</option>
                <option value="rush">{q("rush")}</option>
              </select>
            </label>
          </div>
          <label className="block text-sm">
            {t("designer")}
            <select name="designer_id" defaultValue={full?.designer_id ?? ""} className={field}>
              <option value="">—</option>
              {(designers ?? []).map((d) => <option key={d.id} value={d.id}>{d.full_name}</option>)}
            </select>
          </label>
          <label className="block text-sm">
            {t("designBrief")} {job.designApproved && <span className="text-muted">({t("locked")})</span>}
            <textarea name="design_brief" rows={3} defaultValue={full?.design_brief ?? ""} disabled={job.designApproved} className={field} />
          </label>
          <label className="block text-sm">
            {t("internalNotes")}
            <textarea name="internal_notes" rows={2} defaultValue={full?.internal_notes ?? ""} className={field} />
          </label>
          <label className="block text-sm">
            {t("customerNotes")}
            <textarea name="customer_notes" rows={2} defaultValue={full?.customer_notes ?? ""} className={field} />
          </label>
          <button className="w-full rounded-lg border border-line px-4 py-3 font-medium">{t("save")}</button>
        </form>
      )}

      <div className="space-y-3">
        <h2 className="font-semibold">{t("attachments")}</h2>
        <ul className="space-y-2">
          {signed.map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-2 rounded-xl border border-line bg-card p-3 text-sm">
              {a.url ? (
                <a href={a.url} target="_blank" rel="noreferrer" className="min-w-0 truncate text-brand underline">
                  {a.file_name ?? a.file_path}
                </a>
              ) : (
                <span className="truncate">{a.file_name}</span>
              )}
              <span className="shrink-0 text-xs text-muted">{t(`kinds.${a.kind}`)}</span>
              {isAdmin && (
                <form action={deleteAttachment}>
                  <input type="hidden" name="id" value={a.id} />
                  <input type="hidden" name="locale" value={locale} />
                  <button className="text-bad" aria-label={t("delete")}>×</button>
                </form>
              )}
            </li>
          ))}
        </ul>
        {isAdmin && (
          <form action={uploadAttachment} className="space-y-2 rounded-xl border border-dashed border-line p-3">
            <input type="hidden" name="job_id" value={id} />
            <input type="hidden" name="locale" value={locale} />
            <select name="kind" className={field} defaultValue="logo">
              <option value="logo">{t("kinds.logo")}</option>
              <option value="reference">{t("kinds.reference")}</option>
              <option value="other">{t("kinds.other")}</option>
            </select>
            <input type="file" name="file" required className="block w-full text-sm" />
            <button className="w-full rounded-lg border border-line px-4 py-3">{t("upload")}</button>
          </form>
        )}
      </div>
    </section>
  );
}

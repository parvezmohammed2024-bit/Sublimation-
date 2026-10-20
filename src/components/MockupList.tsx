import { getTranslations } from "next-intl/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { MockupUpload } from "./MockupUpload";

const STATUS_STYLE: Record<string, string> = {
  draft: "bg-line text-fg",
  sent: "bg-brand text-white",
  approved: "bg-ok text-white",
  revision_requested: "bg-warn text-white",
  superseded: "bg-line text-muted",
};

/** Versioned mockups with status. Staff-only; the customer sees the sent version on the tracking page. */
export async function MockupList({
  supabase,
  jobId,
  canUpload,
  revisionCount,
  freeRevisions,
}: {
  supabase: SupabaseClient;
  jobId: string;
  canUpload: boolean;
  revisionCount: number;
  freeRevisions: number;
}) {
  const t = await getTranslations("mockups");
  const { data: rows } = await supabase
    .from("mockups")
    .select("id, version, file_path, status, comment, created_at")
    .eq("job_id", jobId)
    .order("version", { ascending: false });

  const items = await Promise.all(
    (rows ?? []).map(async (m) => {
      const { data } = await supabase.storage.from("mockups").createSignedUrl(m.file_path, 3600);
      return { ...m, url: data?.signedUrl ?? null, isPdf: m.file_path.toLowerCase().endsWith(".pdf") };
    }),
  );
  const overFree = revisionCount > freeRevisions;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-semibold">{t("title")}</h2>
        <p className={`text-xs ${overFree ? "font-medium text-warn" : "text-muted"}`}>
          {t("revisions", { used: revisionCount, free: freeRevisions })}
        </p>
      </div>
      {overFree && <p className="rounded-lg bg-warn/15 p-3 text-sm text-warn">{t("overFree")}</p>}
      {items.length === 0 && <p className="text-sm text-muted">{t("none")}</p>}
      <ul className="space-y-3">
        {items.map((m) => (
          <li key={m.id} className="space-y-2 rounded-xl border border-line bg-card p-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="font-medium">{t("version", { n: m.version })}</span>
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[m.status] ?? ""}`}>
                {t(`status.${m.status}`)}
              </span>
            </div>
            {m.url && !m.isPdf && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={m.url} alt={t("version", { n: m.version })} className="max-h-72 w-full rounded-lg border border-line bg-white object-contain" />
            )}
            {m.url && m.isPdf && (
              <a href={m.url} target="_blank" rel="noreferrer" className="text-brand underline">{t("openPdf")}</a>
            )}
            {m.comment && <p className="text-muted">{m.comment}</p>}
          </li>
        ))}
      </ul>
      {canUpload && <MockupUpload jobId={jobId} />}
    </div>
  );
}

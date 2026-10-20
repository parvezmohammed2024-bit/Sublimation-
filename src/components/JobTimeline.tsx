import { getTranslations } from "next-intl/server";
import type { SupabaseClient } from "@supabase/supabase-js";

interface EventRow {
  id: string;
  from_stage: string | null;
  to_stage: string;
  actor_id: string | null;
  actor_kind: string;
  note: string | null;
  reason: string | null;
  photo_path: string | null;
  created_at: string;
}

/** Who moved the job, when, from -> to, with note / reason / photo. Newest first. */
export async function JobTimeline({
  supabase,
  jobId,
  locale,
}: {
  supabase: SupabaseClient;
  jobId: string;
  locale: string;
}) {
  const t = await getTranslations("workflow");
  const [{ data: events }, { data: stages }, { data: people }] = await Promise.all([
    supabase.from("job_stage_events").select("*").eq("job_id", jobId).order("created_at", { ascending: false }).limit(100),
    supabase.from("stages").select("key, label_en, label_ms"),
    supabase.from("profiles").select("id, full_name"),
  ]);
  const label = new Map((stages ?? []).map((s) => [s.key, locale === "en" ? s.label_en : s.label_ms]));
  const who = new Map((people ?? []).map((p) => [p.id, p.full_name]));
  const rows = (events ?? []) as EventRow[];

  const withPhotos = await Promise.all(
    rows.map(async (e) => {
      if (!e.photo_path) return { ...e, photoUrl: null as string | null };
      const { data } = await supabase.storage.from("qc-photos").createSignedUrl(e.photo_path, 3600);
      return { ...e, photoUrl: data?.signedUrl ?? null };
    }),
  );

  const when = new Intl.DateTimeFormat(locale === "en" ? "en-MY" : "ms-MY", {
    timeZone: "Asia/Kuala_Lumpur",
    dateStyle: "medium",
    timeStyle: "short",
  });

  if (withPhotos.length === 0) return <p className="text-sm text-muted">{t("noEvents")}</p>;
  return (
    <ol className="space-y-3 border-l-2 border-line pl-4">
      {withPhotos.map((e) => (
        <li key={e.id} className="relative text-sm">
          <span className="absolute -left-[1.4rem] top-1.5 size-2.5 rounded-full bg-brand" />
          <p className="font-medium">
            {e.from_stage ? `${label.get(e.from_stage) ?? e.from_stage} → ` : ""}
            {label.get(e.to_stage) ?? e.to_stage}
          </p>
          <p className="text-muted">
            {when.format(new Date(e.created_at))} ·{" "}
            {e.actor_kind === "customer" ? t("customer") : (e.actor_id && who.get(e.actor_id)) || t("system")}
          </p>
          {e.reason && <p><span className="text-muted">{t("reasonLabel")}:</span> {e.reason}</p>}
          {e.note && <p>{e.note}</p>}
          {e.photoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={e.photoUrl} alt="" className="mt-2 max-h-40 rounded-lg border border-line" />
          )}
        </li>
      ))}
    </ol>
  );
}

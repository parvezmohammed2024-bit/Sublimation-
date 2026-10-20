import { getTranslations } from "next-intl/server";
import { Link, redirect } from "@/i18n/navigation";
import { LiveRefresh } from "@/components/LiveRefresh";
import { StageActions } from "@/components/StageActions";
import { getProfile } from "@/lib/auth";
import { TERMINAL_STAGES } from "@/lib/rules/stages";
import { createClient } from "@/lib/supabase/server";
import { todayKL } from "@/lib/utils";
import { flowStateFromRow, transitionOptions, type FlowRow } from "@/lib/workflow/options";
import { enabledStageKeys } from "@/lib/workflow/perform";

type QueueRow = FlowRow & {
  job_no: string;
  due_date: string | null;
  priority: "normal" | "rush";
  customers: { name: string; organisation: string | null; credit_terms: boolean } | null;
  job_items: { qty: number }[];
};

const SELECT =
  "id, job_no, stage_key, prev_stage_key, due_date, priority, design_approved, name_list_confirmed, deposit_waived, total, deposit_percent, customers(name, organisation, credit_terms), job_items(qty), payments(amount, verified), qc_defects(qty, resolved)";

export default async function QueuePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const profile = await getProfile();
  if (!profile) redirect({ href: "/login", locale });
  const t = await getTranslations("queue");
  const supabase = await createClient();

  // RLS already limits rows to this user's section; admins see everything.
  const [{ data: jobs }, { data: stages }, enabled] = await Promise.all([
    supabase
      .from("jobs")
      .select(SELECT)
      .not("stage_key", "in", `(${[...TERMINAL_STAGES].join(",")})`)
      .returns<QueueRow[]>(),
    supabase.from("stages").select("key, label_en, label_ms"),
    enabledStageKeys(supabase),
  ]);

  const label = new Map((stages ?? []).map((s) => [s.key, locale === "en" ? s.label_en : s.label_ms]));
  const today = todayKL();

  // Urgency: overdue first, then rush, then earliest due date (no date last).
  const rank = (j: QueueRow) => [
    j.due_date && j.due_date < today ? 0 : 1,
    j.priority === "rush" ? 0 : 1,
    j.due_date ?? "9999-12-31",
  ];
  const list = [...(jobs ?? [])].sort((a, b) => {
    const [ra, rb] = [rank(a), rank(b)];
    for (let i = 0; i < ra.length; i++) if (ra[i] !== rb[i]) return ra[i] < rb[i] ? -1 : 1;
    return 0;
  });

  return (
    <section>
      <LiveRefresh />
      <h1 className="mb-4 text-xl font-semibold">{t("title")}</h1>
      {list.length === 0 && <p className="text-muted">{t("empty")}</p>}
      <ul className="space-y-3">
        {list.map((j) => {
          const overdue = !!j.due_date && j.due_date < today;
          const qty = j.job_items.reduce((n, i) => n + i.qty, 0);
          const options = transitionOptions(flowStateFromRow(j), profile!.role, enabled).map((o) => ({
            ...o,
            label: label.get(o.to) ?? o.to,
          }));
          return (
            <li key={j.id} className="space-y-3 rounded-xl border border-line bg-card p-4">
              <Link href={`/jobs/${j.id}`} className="block">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-lg font-semibold">{j.job_no}</p>
                  {j.priority === "rush" && (
                    <span className="rounded-full bg-bad px-2 py-0.5 text-xs font-medium text-white">{t("rush")}</span>
                  )}
                </div>
                <p className="text-muted">
                  {j.customers?.organisation ?? j.customers?.name} · {qty} {t("qty")}
                </p>
                <p className="mt-2 text-sm">{label.get(j.stage_key) ?? j.stage_key}</p>
                {j.due_date && (
                  <p className={`mt-1 text-sm font-medium ${overdue ? "text-bad" : ""}`}>
                    {overdue ? t("overdue") : t("due")}: {j.due_date}
                  </p>
                )}
              </Link>
              <StageActions jobId={j.id} options={options} compact />
            </li>
          );
        })}
      </ul>
    </section>
  );
}

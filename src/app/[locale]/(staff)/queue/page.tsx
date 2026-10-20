import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { TERMINAL_STAGES } from "@/lib/rules/stages";
import { todayKL } from "@/lib/utils";

interface QueueJob {
  id: string;
  job_no: string;
  stage_key: string;
  due_date: string | null;
  priority: "normal" | "rush";
  customers: { name: string; organisation: string | null } | null;
  job_items: { qty: number }[];
}

export default async function QueuePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations("queue");
  const supabase = await createClient();

  // RLS already limits rows to this user's section; admins see everything.
  const [{ data: jobs }, { data: stages }] = await Promise.all([
    supabase
      .from("jobs")
      .select("id, job_no, stage_key, due_date, priority, customers(name, organisation), job_items(qty)")
      .not("stage_key", "in", `(${[...TERMINAL_STAGES].join(",")})`)
      .order("due_date", { ascending: true, nullsFirst: false })
      .returns<QueueJob[]>(),
    supabase.from("stages").select("key, label_en, label_ms"),
  ]);

  const label = new Map((stages ?? []).map((s) => [s.key, locale === "en" ? s.label_en : s.label_ms]));
  const today = todayKL();
  const list = [...(jobs ?? [])].sort(
    (a, b) => Number(b.priority === "rush") - Number(a.priority === "rush"),
  );

  return (
    <section>
      <h1 className="mb-4 text-xl font-semibold">{t("title")}</h1>
      {list.length === 0 && <p className="text-muted">{t("empty")}</p>}
      <ul className="space-y-3">
        {list.map((j) => {
          const overdue = !!j.due_date && j.due_date < today;
          const qty = j.job_items.reduce((n, i) => n + i.qty, 0);
          return (
            <li key={j.id} className="rounded-xl border border-line bg-card p-4">
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
            </li>
          );
        })}
      </ul>
    </section>
  );
}

import { getTranslations } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { LiveRefresh } from "@/components/LiveRefresh";
import { getProfile } from "@/lib/auth";
import { addDaysISO } from "@/lib/rules/pricing";
import { createClient } from "@/lib/supabase/server";
import { safeSearch, todayKL } from "@/lib/utils";
import { Board, type BoardColumn } from "./Board";

const SECTIONS = ["sales", "design", "template", "printing", "sewing", "qc", "dispatch"] as const;

interface Row {
  id: string;
  job_no: string;
  stage_key: string;
  due_date: string | null;
  priority: "normal" | "rush";
  customers: { name: string; organisation: string | null } | null;
  job_items: { qty: number }[];
}

export default async function BoardPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ section?: string; priority?: string; due?: string; q?: string }>;
}) {
  const { locale } = await params;
  const profile = await getProfile();
  if (!profile) redirect({ href: "/login", locale });
  const sp = await searchParams;
  const q = safeSearch(sp.q ?? "").toLowerCase();
  const t = await getTranslations("board");
  const w = await getTranslations("workflow");
  const sec = await getTranslations("sections");
  const supabase = await createClient();

  const [{ data: stages }, { data: jobs }] = await Promise.all([
    supabase.from("stages").select("key, position, section, label_en, label_ms, enabled, is_terminal").eq("enabled", true),
    supabase
      .from("jobs")
      .select("id, job_no, stage_key, due_date, priority, customers(name, organisation), job_items(qty)")
      .is("closed_at", null)
      .order("due_date", { ascending: true, nullsFirst: false })
      .limit(500)
      .returns<Row[]>(),
  ]);

  const today = todayKL();
  const weekEnd = addDaysISO(today, 7);
  const stageSection = new Map((stages ?? []).map((s) => [s.key, s.section as string]));

  const keep = (j: Row) => {
    if (sp.section && stageSection.get(j.stage_key) !== sp.section) return false;
    if (sp.priority && j.priority !== sp.priority) return false;
    if (sp.due === "overdue" && !(j.due_date && j.due_date < today)) return false;
    if (sp.due === "week" && !(j.due_date && j.due_date >= today && j.due_date <= weekEnd)) return false;
    if (q) {
      const name = `${j.customers?.organisation ?? ""} ${j.customers?.name ?? ""} ${j.job_no}`.toLowerCase();
      if (!name.includes(q)) return false;
    }
    return true;
  };
  const visible = (jobs ?? []).filter(keep);

  const active = (stages ?? []).filter((s) => !s.is_terminal && s.key !== "CANCELLED");
  const ordered = [
    ...active.filter((s) => s.position != null).sort((a, b) => a.position - b.position),
    ...active.filter((s) => s.position == null),
  ];
  const columns: BoardColumn[] = ordered
    .filter((s) => !sp.section || s.section === sp.section)
    .map((s) => ({
      key: s.key,
      label: locale === "en" ? s.label_en : s.label_ms,
      side: s.position == null,
      jobs: visible
        .filter((j) => j.stage_key === s.key)
        .map((j) => ({
          id: j.id,
          jobNo: j.job_no,
          customer: j.customers?.organisation ?? j.customers?.name ?? "",
          qty: j.job_items.reduce((n, i) => n + i.qty, 0),
          due: j.due_date,
          overdue: !!j.due_date && j.due_date < today,
          rush: j.priority === "rush",
        })),
    }));

  const errors = Object.fromEntries(
    ["NOT_ALLOWED", "ROLE_FORBIDDEN", "TERMINAL", "DEPOSIT_REQUIRED", "REASON_REQUIRED", "DESIGN_NOT_APPROVED",
      "NAME_LIST_NOT_CONFIRMED", "QC_SHORTFALL", "PAYMENT_LOCK", "OVERRIDE_FORBIDDEN", "RESUME_TARGET_REQUIRED",
      "NOT_FOUND", "CONFLICT", "FAILED"].map((c) => [c, w(`errors.${c}`)]),
  );
  const input = "rounded-lg border border-line bg-card px-3 py-2 text-sm";

  return (
    <section>
      <LiveRefresh tables="jobs" />
      <h1 className="mb-3 text-xl font-semibold">{t("title")}</h1>
      <form className="mb-4 flex flex-wrap gap-2">
        <input name="q" defaultValue={sp.q ?? ""} type="search" placeholder={t("search")} className={`${input} min-w-0 flex-1`} />
        <select name="section" defaultValue={sp.section ?? ""} className={input}>
          <option value="">{t("allSections")}</option>
          {SECTIONS.map((s) => <option key={s} value={s}>{sec(s)}</option>)}
        </select>
        <select name="priority" defaultValue={sp.priority ?? ""} className={input}>
          <option value="">{t("anyPriority")}</option>
          <option value="rush">{t("rush")}</option>
          <option value="normal">{t("normal")}</option>
        </select>
        <select name="due" defaultValue={sp.due ?? ""} className={input}>
          <option value="">{t("anyDue")}</option>
          <option value="overdue">{t("overdue")}</option>
          <option value="week">{t("thisWeek")}</option>
        </select>
        <button className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white">{t("filter")}</button>
      </form>
      <Board
        columns={columns}
        locale={locale}
        labels={{
          rush: t("rush"),
          overdue: t("overdue"),
          reasonPrompt: w("reasonPrompt"),
          errors,
          dragHint: t("dragHint"),
          empty: t("emptyColumn"),
        }}
      />
    </section>
  );
}

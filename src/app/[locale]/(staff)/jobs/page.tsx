import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { safeSearch } from "@/lib/utils";

export default async function JobsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const { locale } = await params;
  await requireAdmin(locale);
  const q = safeSearch((await searchParams).q ?? "");
  const t = await getTranslations("jobs");
  const supabase = await createClient();

  // Search by job no, customer name / team / phone.
  let customerIds: string[] = [];
  if (q) {
    const digits = q.replace(/\D/g, "");
    const phonePart = digits.length >= 3 ? `,phone_e164.ilike.%${digits.replace(/^0/, "")}%` : "";
    const { data } = await supabase
      .from("customers")
      .select("id")
      .or(`name.ilike.%${q}%,organisation.ilike.%${q}%${phonePart}`)
      .limit(100);
    customerIds = (data ?? []).map((c) => c.id);
  }

  let query = supabase
    .from("jobs")
    .select("id, job_no, stage_key, due_date, priority, total, customers(name, organisation)")
    .order("created_at", { ascending: false })
    .limit(100);
  if (q) {
    query = query.or(
      customerIds.length ? `job_no.ilike.%${q}%,customer_id.in.(${customerIds.join(",")})` : `job_no.ilike.%${q}%`,
    );
  }
  const [{ data: jobs }, { data: stages }] = await Promise.all([
    query,
    supabase.from("stages").select("key, label_en, label_ms"),
  ]);
  const label = new Map((stages ?? []).map((s) => [s.key, locale === "en" ? s.label_en : s.label_ms]));

  return (
    <section>
      <h1 className="mb-4 text-xl font-semibold">{t("title")}</h1>
      <form className="mb-4">
        <input
          name="q"
          defaultValue={q}
          type="search"
          placeholder={t("searchPlaceholder")}
          className="w-full rounded-lg border border-line bg-card px-3 py-3 text-base"
        />
      </form>
      {(jobs ?? []).length === 0 && <p className="text-muted">{t("empty")}</p>}
      <ul className="space-y-2">
        {(jobs ?? []).map((j) => {
          const c = j.customers as unknown as { name: string; organisation: string | null } | null;
          return (
            <li key={j.id}>
              <Link href={`/jobs/${j.id}`} className="block rounded-xl border border-line bg-card p-4">
                <div className="flex justify-between gap-2">
                  <p className="font-semibold">{j.job_no}</p>
                  {j.priority === "rush" && (
                    <span className="rounded-full bg-bad px-2 py-0.5 text-xs font-medium text-white">{t("rush")}</span>
                  )}
                </div>
                <p className="text-sm text-muted">{c?.organisation ?? c?.name}</p>
                <p className="mt-1 text-sm">
                  {label.get(j.stage_key) ?? j.stage_key}
                  {j.due_date ? ` · ${t("due")} ${j.due_date}` : ""}
                </p>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

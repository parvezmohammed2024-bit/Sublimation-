import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { dbToSen, formatRM } from "@/lib/utils";

export default async function QuotationsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requireAdmin(locale);
  const t = await getTranslations("quotes");
  const supabase = await createClient();
  const { data: quotes } = await supabase
    .from("quotations")
    .select("id, quote_no, status, total, valid_until, customers(name, organisation)")
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <section>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">{t("title")}</h1>
        <Link href="/quotations/new" className="rounded-lg bg-brand px-4 py-2 font-medium text-white">
          {t("new")}
        </Link>
      </div>
      {(quotes ?? []).length === 0 && <p className="text-muted">{t("empty")}</p>}
      <ul className="space-y-2">
        {(quotes ?? []).map((q) => {
          const c = q.customers as unknown as { name: string; organisation: string | null } | null;
          return (
            <li key={q.id}>
              <Link href={`/quotations/${q.id}`} className="block rounded-xl border border-line bg-card p-4">
                <div className="flex justify-between gap-2">
                  <p className="font-medium">{q.quote_no}</p>
                  <p className="font-medium">{formatRM(dbToSen(q.total))}</p>
                </div>
                <p className="text-sm text-muted">{c?.organisation ?? c?.name}</p>
                <p className="mt-1 text-xs text-muted">
                  {t(`status.${q.status}`)}
                  {q.valid_until ? ` · ${t("validUntil")} ${q.valid_until}` : ""}
                </p>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

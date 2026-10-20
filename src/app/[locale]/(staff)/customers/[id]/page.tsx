import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { requireAdmin } from "@/lib/auth";
import { formatMyPhone, whatsappLink } from "@/lib/rules/phone";
import { createClient } from "@/lib/supabase/server";
import { dbToSen, formatRM } from "@/lib/utils";

export default async function CustomerPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  await requireAdmin(locale);
  const t = await getTranslations("customers");
  const supabase = await createClient();

  const [{ data: c }, { data: jobs }, { data: quotes }] = await Promise.all([
    supabase.from("customers").select("*").eq("id", id).maybeSingle(),
    supabase.from("jobs").select("id, job_no, stage_key, total").eq("customer_id", id).order("created_at", { ascending: false }),
    supabase.from("quotations").select("id, quote_no, status, total").eq("customer_id", id).order("created_at", { ascending: false }),
  ]);
  if (!c) notFound();

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">{c.organisation ?? c.name}</h1>
        <p className="text-muted">{c.organisation ? c.name : t(`types.${c.type}`)}</p>
        <p className="mt-2">
          <a className="text-brand underline" href={whatsappLink(c.phone_e164, "")} target="_blank" rel="noreferrer">
            {formatMyPhone(c.phone_e164)} (WhatsApp)
          </a>
        </p>
        {c.email && <p className="text-sm text-muted">{c.email}</p>}
        {c.address && <p className="text-sm text-muted">{c.address}</p>}
        {c.credit_terms && (
          <p className="mt-2 inline-block rounded-full bg-card px-3 py-1 text-xs ring-1 ring-line">{t("creditTerms")}</p>
        )}
      </div>

      <Link
        href={`/quotations/new?customer=${c.id}`}
        className="block rounded-lg bg-brand px-4 py-3 text-center font-medium text-white"
      >
        {t("newQuote")}
      </Link>

      <div>
        <h2 className="mb-2 font-semibold">{t("quotes")}</h2>
        {(quotes ?? []).length === 0 && <p className="text-sm text-muted">{t("none")}</p>}
        <ul className="space-y-2">
          {(quotes ?? []).map((q) => (
            <li key={q.id}>
              <Link href={`/quotations/${q.id}`} className="flex justify-between rounded-xl border border-line bg-card p-3 text-sm">
                <span>{q.quote_no}</span>
                <span>{formatRM(dbToSen(q.total))}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
      <div>
        <h2 className="mb-2 font-semibold">{t("jobs")}</h2>
        {(jobs ?? []).length === 0 && <p className="text-sm text-muted">{t("none")}</p>}
        <ul className="space-y-2">
          {(jobs ?? []).map((j) => (
            <li key={j.id}>
              <Link href={`/jobs/${j.id}`} className="flex justify-between rounded-xl border border-line bg-card p-3 text-sm">
                <span>{j.job_no}</span>
                <span>{formatRM(dbToSen(j.total))}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

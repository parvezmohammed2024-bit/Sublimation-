import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { requireAdmin } from "@/lib/auth";
import { whatsappLink } from "@/lib/rules/phone";
import { lineTotalSen, type Addon } from "@/lib/rules/pricing";
import { createClient } from "@/lib/supabase/server";
import { dbToSen, formatRM } from "@/lib/utils";
import { createJobFromQuote, markQuoteSent } from "../actions";

export default async function QuotationPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  await requireAdmin(locale);
  const t = await getTranslations("quotes");
  const supabase = await createClient();

  const [{ data: q }, { data: items }, { data: job }] = await Promise.all([
    supabase.from("quotations").select("*, customers(name, organisation, phone_e164)").eq("id", id).maybeSingle(),
    supabase
      .from("quotation_items")
      .select("*, garment_types(name), fabrics(name, is_polyester), collar_types(name)")
      .eq("quotation_id", id),
    supabase.from("jobs").select("id, job_no").eq("quotation_id", id).maybeSingle(),
  ]);
  if (!q) notFound();
  const c = q.customers as { name: string; organisation: string | null; phone_e164: string };

  const msg =
    locale === "en"
      ? `Hi ${c.name}, here is your quotation ${q.quote_no}: total ${formatRM(dbToSen(q.total))}. Valid until ${q.valid_until}. Please reply to confirm.`
      : `Hai ${c.name}, ini sebut harga ${q.quote_no}: jumlah ${formatRM(dbToSen(q.total))}. Sah sehingga ${q.valid_until}. Sila balas untuk mengesahkan.`;

  return (
    <section className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold">{q.quote_no}</h1>
        <p className="text-muted">{c.organisation ?? c.name}</p>
        <p className="text-sm text-muted">
          {t(`status.${q.status}`)} · {t("validUntil")} {q.valid_until}
        </p>
      </div>

      <ul className="space-y-3">
        {(items ?? []).map((i) => {
          const addons = (i.addons ?? []) as Addon[];
          const total = lineTotalSen({ qty: i.qty, unitPriceSen: dbToSen(i.unit_price), addons });
          return (
            <li key={i.id} className="rounded-xl border border-line bg-card p-4 text-sm">
              <div className="flex justify-between gap-2 font-medium">
                <span>{i.garment_types?.name ?? i.description} × {i.qty}</span>
                <span>{formatRM(total)}</span>
              </div>
              <p className="text-muted">
                {[i.fabrics?.name, i.collar_types?.name, i.sleeve && t(`sleeves.${i.sleeve}`), i.cutting && t(`cuttings.${i.cutting}`)]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              <p className="text-muted">{formatRM(dbToSen(i.unit_price))} / {t("pc")}</p>
              {addons.map((a, n) => (
                <p key={n} className="text-muted">
                  + {a.label} ({formatRM(a.amountSen)} {a.mode === "per_piece" ? `/ ${t("pc")}` : t("flat")})
                </p>
              ))}
              {i.fabrics && !i.fabrics.is_polyester && <p className="mt-1 text-warn">{t("nonPoly")}</p>}
            </li>
          );
        })}
      </ul>

      <dl className="space-y-1 rounded-xl border border-line bg-card p-4 text-sm">
        <div className="flex justify-between"><dt className="text-muted">{t("subtotal")}</dt><dd>{formatRM(dbToSen(q.subtotal))}</dd></div>
        {dbToSen(q.rush_fee) > 0 && <div className="flex justify-between"><dt className="text-muted">{t("rushFee")}</dt><dd>{formatRM(dbToSen(q.rush_fee))}</dd></div>}
        {dbToSen(q.tax_amount) > 0 && <div className="flex justify-between"><dt className="text-muted">{t("tax")}</dt><dd>{formatRM(dbToSen(q.tax_amount))}</dd></div>}
        <div className="flex justify-between pt-2 text-lg font-semibold"><dt>{t("total")}</dt><dd>{formatRM(dbToSen(q.total))}</dd></div>
      </dl>

      <div className="space-y-3">
        <a
          href={whatsappLink(c.phone_e164, msg)}
          target="_blank"
          rel="noreferrer"
          className="block rounded-lg border border-line px-4 py-3 text-center"
        >
          {t("sendWhatsapp")}
        </a>
        {q.status === "draft" && (
          <form action={markQuoteSent}>
            <input type="hidden" name="id" value={q.id} />
            <input type="hidden" name="locale" value={locale} />
            <button className="w-full rounded-lg border border-line px-4 py-3">{t("markSent")}</button>
          </form>
        )}
        {job ? (
          <Link href={`/jobs/${job.id}`} className="block rounded-lg bg-brand px-4 py-3 text-center font-medium text-white">
            {t("openJob")} {job.job_no}
          </Link>
        ) : (
          ["draft", "sent"].includes(q.status) && (
            <form action={createJobFromQuote}>
              <input type="hidden" name="id" value={q.id} />
              <input type="hidden" name="locale" value={locale} />
              <button className="w-full rounded-lg bg-brand px-4 py-3 font-medium text-white">{t("createJob")}</button>
            </form>
          )
        )}
      </div>
    </section>
  );
}

import { getTranslations } from "next-intl/server";
import { getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { SettingsForm, type SettingsValues } from "./SettingsForm";

export default async function SettingsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations("settings");
  const profile = await getProfile();
  if (profile?.role !== "super_admin") return <p className="text-muted">{t("onlyOwner")}</p>;

  const supabase = await createClient();
  const [{ data: s }, { data: stages }, { data: fabrics }, { data: garments }] = await Promise.all([
    supabase.from("settings").select("*").maybeSingle(),
    supabase.from("stages").select("key, label_en, label_ms, enabled").order("position", { nullsFirst: false }),
    supabase.from("fabrics").select("id, name, gsm, is_polyester").order("name"),
    supabase.from("garment_types").select("id, name").order("name"),
  ]);

  const values: SettingsValues = {
    shop_name: s?.shop_profile?.name ?? "",
    address: s?.shop_profile?.address ?? "",
    phone: s?.shop_profile?.phone ?? "",
    bank_name: s?.bank_details?.bank ?? "",
    account_no: s?.bank_details?.account_no ?? "",
    account_name: s?.bank_details?.account_name ?? "",
    job_prefix: s?.job_prefix ?? "SB",
    default_deposit_percent: s?.default_deposit_percent ?? 50,
    default_lead_time_days: s?.default_lead_time_days ?? 14,
    quote_validity_days: s?.quote_validity_days ?? 30,
    tax_enabled: s?.tax_enabled ?? false,
    tax_rate: s?.tax_rate ?? null,
    tax_number: s?.tax_number ?? "",
  };

  return (
    <section className="space-y-8">
      <h1 className="text-xl font-semibold">{t("title")}</h1>
      <SettingsForm values={values} />

      <div>
        <h2 className="mb-2 font-semibold">{t("stages")}</h2>
        <ul className="divide-y divide-line rounded-xl border border-line bg-card text-sm">
          {(stages ?? []).map((st) => (
            <li key={st.key} className={`px-4 py-3 ${st.enabled ? "" : "text-muted line-through"}`}>
              {locale === "en" ? st.label_en : st.label_ms}
            </li>
          ))}
        </ul>
      </div>
      <div>
        <h2 className="mb-2 font-semibold">{t("fabrics")}</h2>
        <ul className="divide-y divide-line rounded-xl border border-line bg-card text-sm">
          {(fabrics ?? []).map((f) => (
            <li key={f.id} className="flex justify-between gap-2 px-4 py-3">
              <span>{f.name}{f.gsm ? ` · ${f.gsm}gsm` : ""}</span>
              {!f.is_polyester && <span className="text-warn">{t("nonPoly")}</span>}
            </li>
          ))}
        </ul>
      </div>
      <div>
        <h2 className="mb-2 font-semibold">{t("garments")}</h2>
        <ul className="divide-y divide-line rounded-xl border border-line bg-card text-sm">
          {(garments ?? []).map((g) => (
            <li key={g.id} className="px-4 py-3">{g.name}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}

import { getTranslations } from "next-intl/server";
import { requireAdmin } from "@/lib/auth";
import { addWorkingDays } from "@/lib/rules/dates";
import type { PriceTier } from "@/lib/rules/pricing";
import { createClient } from "@/lib/supabase/server";
import { todayKL } from "@/lib/utils";
import { QuoteForm } from "./QuoteForm";

export default async function NewQuotePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ customer?: string }>;
}) {
  const { locale } = await params;
  await requireAdmin(locale);
  const { customer } = await searchParams;
  const t = await getTranslations("quotes");
  const supabase = await createClient();

  const [{ data: customers }, { data: garments }, { data: fabrics }, { data: collars }, { data: settings }] =
    await Promise.all([
      supabase.from("customers").select("id, name, organisation").order("name"),
      supabase.from("garment_types").select("id, name, price_tiers").eq("active", true).order("name"),
      supabase.from("fabrics").select("id, name, is_polyester").eq("active", true).order("name"),
      supabase.from("collar_types").select("id, name").eq("active", true).order("name"),
      supabase.from("settings").select("tax_enabled, tax_rate, default_lead_time_days").maybeSingle(),
    ]);

  // Suggested due date from the default lead time. Public holidays are not applied until
  // the shop's holiday list exists (they change yearly), so treat it as a starting point.
  const suggested = addWorkingDays(todayKL(), settings?.default_lead_time_days ?? 14);

  return (
    <section>
      <h1 className="mb-4 text-xl font-semibold">{t("new")}</h1>
      <QuoteForm
        customers={customers ?? []}
        garments={(garments ?? []).map((g) => ({ ...g, price_tiers: (g.price_tiers ?? []) as PriceTier[] }))}
        fabrics={fabrics ?? []}
        collars={collars ?? []}
        tax={{ enabled: !!settings?.tax_enabled, rate: settings?.tax_rate != null ? Number(settings.tax_rate) : null }}
        defaultCustomerId={customer ?? ""}
        defaultDueDate={suggested}
      />
    </section>
  );
}

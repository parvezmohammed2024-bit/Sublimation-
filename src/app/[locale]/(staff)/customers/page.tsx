import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { requireAdmin } from "@/lib/auth";
import { formatMyPhone } from "@/lib/rules/phone";
import { createClient } from "@/lib/supabase/server";
import { safeSearch } from "@/lib/utils";

export default async function CustomersPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const { locale } = await params;
  await requireAdmin(locale);
  const q = safeSearch((await searchParams).q ?? "");
  const t = await getTranslations("customers");
  const supabase = await createClient();

  let query = supabase
    .from("customers")
    .select("id, name, organisation, phone_e164, type")
    .order("created_at", { ascending: false })
    .limit(100);
  if (q) {
    const digits = q.replace(/\D/g, "");
    const phonePart = digits.length >= 3 ? `,phone_e164.ilike.%${digits.replace(/^0/, "")}%` : "";
    query = query.or(`name.ilike.%${q}%,organisation.ilike.%${q}%${phonePart}`);
  }
  const { data: customers } = await query;

  return (
    <section>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">{t("title")}</h1>
        <Link href="/customers/new" className="rounded-lg bg-brand px-4 py-2 font-medium text-white">
          {t("new")}
        </Link>
      </div>
      <form className="mb-4">
        <input
          name="q"
          defaultValue={q}
          type="search"
          placeholder={t("searchPlaceholder")}
          className="w-full rounded-lg border border-line bg-card px-3 py-3 text-base"
        />
      </form>
      {(customers ?? []).length === 0 && <p className="text-muted">{t("empty")}</p>}
      <ul className="space-y-2">
        {(customers ?? []).map((c) => (
          <li key={c.id}>
            <Link href={`/customers/${c.id}`} className="block rounded-xl border border-line bg-card p-4">
              <p className="font-medium">{c.organisation ?? c.name}</p>
              <p className="text-sm text-muted">
                {c.organisation ? `${c.name} · ` : ""}
                {formatMyPhone(c.phone_e164)} · {t(`types.${c.type}`)}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { requireOwner } from "@/lib/auth";
import { ALL_ROLES, ROLE_SECTION, type Role, type Section } from "@/lib/rules/stages";
import { createClient } from "@/lib/supabase/server";
import { AddStaffForm } from "./AddStaffForm";
import { changeStaffRole, setStaffActive } from "./actions";

const SECTION_ORDER: Section[] = ["sales", "design", "template", "printing", "sewing", "qc", "dispatch"];

export default async function TeamPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const me = await requireOwner(locale);
  const t = await getTranslations("team");
  const r = await getTranslations("role");
  const sec = await getTranslations("sections");
  const supabase = await createClient();

  const { data: people } = await supabase
    .from("profiles")
    .select("id, full_name, role, active")
    .order("full_name");
  const bySection = new Map<Section, NonNullable<typeof people>>();
  for (const p of people ?? []) {
    const s = ROLE_SECTION[p.role as Role];
    bySection.set(s, [...(bySection.get(s) ?? []), p]);
  }

  return (
    <section className="space-y-6">
      <div>
        <Link href="/settings" className="text-sm text-brand underline">{t("back")}</Link>
        <h1 className="mt-2 text-xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-muted">{t("intro")}</p>
      </div>

      {SECTION_ORDER.map((s) => (
        <div key={s}>
          <h2 className="mb-2 font-semibold">{sec(s)}</h2>
          <ul className="divide-y divide-line rounded-xl border border-line bg-card">
            {(bySection.get(s) ?? []).map((p) => (
              <li key={p.id} className={`space-y-2 p-3 text-sm ${p.active ? "" : "opacity-60"}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">
                    {p.full_name}
                    {p.id === me.id && <span className="ml-1 text-muted">({t("you")})</span>}
                    {!p.active && <span className="ml-1 text-muted">· {t("inactive")}</span>}
                  </span>
                  <form action={setStaffActive}>
                    <input type="hidden" name="id" value={p.id} />
                    <input type="hidden" name="locale" value={locale} />
                    <input type="hidden" name="active" value={p.active ? "0" : "1"} />
                    <button className="rounded-lg border border-line px-3 py-1.5 text-xs">
                      {p.active ? t("deactivate") : t("reactivate")}
                    </button>
                  </form>
                </div>
                <form action={changeStaffRole} className="flex gap-2">
                  <input type="hidden" name="id" value={p.id} />
                  <input type="hidden" name="locale" value={locale} />
                  <select name="role" defaultValue={p.role} className="min-w-0 flex-1 rounded-lg border border-line bg-bg px-2 py-2 text-sm">
                    {ALL_ROLES.map((x) => <option key={x} value={x}>{r(x)}</option>)}
                  </select>
                  <button className="rounded-lg border border-line px-3 py-2 text-xs">{t("change")}</button>
                </form>
              </li>
            ))}
            {(bySection.get(s) ?? []).length === 0 && <li className="p-3 text-sm text-muted">{t("empty")}</li>}
          </ul>
        </div>
      ))}

      <AddStaffForm />
    </section>
  );
}

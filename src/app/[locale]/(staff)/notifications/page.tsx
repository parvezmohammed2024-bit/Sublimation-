import { getTranslations } from "next-intl/server";
import { Link, redirect } from "@/i18n/navigation";
import { LiveRefresh } from "@/components/LiveRefresh";
import { getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { markAllRead } from "./actions";

export default async function NotificationsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const profile = await getProfile();
  if (!profile) redirect({ href: "/login", locale });
  const t = await getTranslations("notifications");
  const supabase = await createClient();
  const { data: items } = await supabase
    .from("notifications")
    .select("id, job_id, title, body, read_at, created_at")
    .order("created_at", { ascending: false })
    .limit(50);

  const when = new Intl.DateTimeFormat(locale === "en" ? "en-MY" : "ms-MY", {
    timeZone: "Asia/Kuala_Lumpur",
    dateStyle: "medium",
    timeStyle: "short",
  });

  return (
    <section>
      <LiveRefresh tables="notifications" />
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">{t("title")}</h1>
        <form action={markAllRead}>
          <input type="hidden" name="locale" value={locale} />
          <button className="rounded-lg border border-line px-3 py-2 text-sm">{t("markAllRead")}</button>
        </form>
      </div>
      {(items ?? []).length === 0 && <p className="text-muted">{t("empty")}</p>}
      <ul className="space-y-2">
        {(items ?? []).map((n) => (
          <li key={n.id}>
            <Link
              href={n.job_id ? `/jobs/${n.job_id}` : "/queue"}
              className={`block rounded-xl border p-4 text-sm ${n.read_at ? "border-line bg-card" : "border-brand bg-brand/5"}`}
            >
              <p className="font-medium">{t.has(`codes.${n.title}`) ? t(`codes.${n.title}`, { job: n.body ?? "" }) : n.title}</p>
              <p className="text-muted">{when.format(new Date(n.created_at))}</p>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

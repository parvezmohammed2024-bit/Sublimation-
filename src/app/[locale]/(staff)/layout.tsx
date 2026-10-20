import { getTranslations } from "next-intl/server";
import { Link, redirect } from "@/i18n/navigation";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { SetupNotice } from "@/components/SetupNotice";
import { getProfile, isAdminRole } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { logout } from "../login/actions";

export default async function StaffLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isSupabaseConfigured()) return <SetupNotice />;
  const profile = await getProfile();
  if (!profile) redirect({ href: "/login", locale });

  const t = await getTranslations();
  const supabase = await createClient();
  const { count: unread } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .is("read_at", null);
  const isOwner = profile!.role === "super_admin";
  const isAdmin = isAdminRole(profile!.role);
  return (
    <div className="mx-auto min-h-dvh max-w-3xl pb-20">
      <header className="flex items-center justify-between gap-3 border-b border-line bg-card px-4 py-3">
        <div className="min-w-0">
          <p className="truncate font-medium">{profile!.full_name}</p>
          <p className="text-xs text-muted">{t(`role.${profile!.role}`)}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/notifications"
            aria-label={t("notifications.title")}
            className="relative rounded-lg border border-line px-3 py-2 text-sm"
          >
            🔔
            {!!unread && (
              <span className="absolute -right-1 -top-1 rounded-full bg-bad px-1.5 text-xs font-medium text-white">
                {unread > 9 ? "9+" : unread}
              </span>
            )}
          </Link>
          <LocaleSwitcher />
          <form action={logout}>
            <input type="hidden" name="locale" value={locale} />
            <button className="rounded-lg border border-line px-3 py-2 text-sm">{t("nav.logout")}</button>
          </form>
        </div>
      </header>
      <main className="p-4">{children}</main>
      <nav className="fixed inset-x-0 bottom-0 border-t border-line bg-card">
        <div className="mx-auto flex max-w-3xl overflow-x-auto text-sm font-medium">
          <Link href="/queue" className="min-w-16 flex-1 px-1 py-4 text-center">{t("nav.queue")}</Link>
          <Link href="/board" className="min-w-16 flex-1 px-1 py-4 text-center">{t("nav.board")}</Link>
          {isAdmin && (
            <>
              <Link href="/jobs" className="min-w-16 flex-1 px-1 py-4 text-center">{t("nav.jobs")}</Link>
              <Link href="/quotations" className="min-w-16 flex-1 px-1 py-4 text-center">{t("nav.quotes")}</Link>
              <Link href="/customers" className="min-w-16 flex-1 px-1 py-4 text-center">{t("nav.customers")}</Link>
            </>
          )}
          {isOwner && (
            <Link href="/settings" className="min-w-16 flex-1 px-1 py-4 text-center">{t("nav.settings")}</Link>
          )}
        </div>
      </nav>
    </div>
  );
}

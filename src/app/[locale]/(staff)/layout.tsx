import { getTranslations } from "next-intl/server";
import { Link, redirect } from "@/i18n/navigation";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { SetupNotice } from "@/components/SetupNotice";
import { getProfile } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabase/env";
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
  const isOwner = profile!.role === "super_admin";
  return (
    <div className="mx-auto min-h-dvh max-w-3xl pb-20">
      <header className="flex items-center justify-between gap-3 border-b border-line bg-card px-4 py-3">
        <div className="min-w-0">
          <p className="truncate font-medium">{profile!.full_name}</p>
          <p className="text-xs text-muted">{t(`role.${profile!.role}`)}</p>
        </div>
        <div className="flex items-center gap-2">
          <LocaleSwitcher />
          <form action={logout}>
            <input type="hidden" name="locale" value={locale} />
            <button className="rounded-lg border border-line px-3 py-2 text-sm">{t("nav.logout")}</button>
          </form>
        </div>
      </header>
      <main className="p-4">{children}</main>
      <nav className="fixed inset-x-0 bottom-0 border-t border-line bg-card">
        <div className="mx-auto flex max-w-3xl">
          <Link href="/queue" className="flex-1 py-4 text-center font-medium">{t("nav.queue")}</Link>
          {isOwner && (
            <Link href="/settings" className="flex-1 py-4 text-center font-medium">{t("nav.settings")}</Link>
          )}
        </div>
      </nav>
    </div>
  );
}

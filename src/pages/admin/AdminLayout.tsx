import { NavLink, Navigate, Outlet, useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useAdmin } from "../../lib/useAdmin";
import { useI18n } from "../../lib/i18n";
import { Icon, type IconName } from "../../components/Icon";
import { Brand, LangToggle, ThemeToggle } from "../../components/Shell";

export default function AdminLayout() {
  const state = useAdmin();
  const { t } = useI18n();
  const nav = useNavigate();

  if (state === "loading") return <p className="p-6 text-muted">{t.loading}</p>;
  if (state === "out") return <Navigate to="/admin/login" replace />;

  const tab = (to: string, icon: IconName, label: string, end = false) => (
    <NavLink to={to} end={end} className={({ isActive }) =>
      `flex min-h-14 min-w-0 flex-1 basis-0 flex-col items-center justify-center gap-0.5 whitespace-nowrap border-t-[3px] px-0.5 text-[10px] font-bold uppercase tracking-wide ${
        isActive ? "border-magenta bg-surface-2 text-ink" : "border-transparent text-muted"}`}>
      <Icon name={icon} className="h-6 w-6" />{label}
    </NavLink>
  );

  return (
    <div className="min-h-dvh">
      <header className="fixed inset-x-0 top-0 z-40 bg-key text-white shadow-sm">
        <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between gap-2 px-4">
          <Brand to="/admin" />
          <div className="flex shrink-0 items-center gap-2"><LangToggle /><ThemeToggle />
            <button onClick={async () => { await supabase.auth.signOut(); nav("/admin/login"); }} aria-label={t.signOut} title={t.signOut}
              className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/15 bg-white/5 hover:bg-white/15">
              <Icon name="logout" />
            </button>
          </div>
        </div>
        <div className="cmyk-bar" aria-hidden="true" />
      </header>

      <main className="mx-auto w-full max-w-5xl px-4 pb-28 pt-[6.25rem]"><Outlet /></main>

      <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface shadow-md">
        <div className="mx-auto flex h-16 w-full max-w-5xl items-stretch">
          {tab("/admin", "dashboard", t.dashboard, true)}
          {tab("/admin/orders/new", "plus", t.newJob)}
          {tab("/admin/customers", "phone", t.customers)}
          {tab("/admin/team", "users", t.workers)}
        </div>
      </nav>
    </div>
  );
}

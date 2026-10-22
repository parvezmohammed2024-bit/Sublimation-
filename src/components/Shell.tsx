import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Icon } from "./Icon";
import { useI18n } from "../lib/i18n";
import { BUSINESS_NAME } from "../lib/supabase";

/** CMY dots overlapping like ink, inside a registration target. */
export function Logo({ className = "h-9 w-9" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <g style={{ mixBlendMode: "screen" }}>
        <circle cx="26" cy="27" r="13" fill="#00a8e8" />
        <circle cx="38" cy="27" r="13" fill="#ff1f8e" />
        <circle cx="32" cy="38" r="13" fill="#ffd000" />
      </g>
      <circle cx="32" cy="32" r="23" fill="none" stroke="#fff" strokeWidth="2" opacity=".8" />
      <path d="M32 3v10M32 51v10M3 32h10M51 32h10" stroke="#fff" strokeWidth="2" opacity=".8" />
    </svg>
  );
}

export function Brand({ to = "/" }: { to?: string }) {
  const { t } = useI18n();
  return (
    <Link to={to} className="flex min-w-0 items-center gap-2.5">
      <Logo className="h-10 w-10 shrink-0" />
      <span className="flex min-w-0 flex-col leading-none">
        <span className="truncate font-display text-[1.05rem] font-bold tracking-tight text-white">{BUSINESS_NAME}</span>
        <span className="mt-1 hidden truncate font-mono text-[0.62rem] font-bold uppercase tracking-[0.2em] text-white/60 min-[380px]:block">{t.appName}</span>
      </span>
    </Link>
  );
}

export function ThemeToggle() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains("dark"));
  const flip = () => {
    const next = !dark;
    document.documentElement.classList.toggle("dark", next);
    try { localStorage.setItem("subli-theme", next ? "dark" : "light"); } catch { /* ignore */ }
    setDark(next);
  };
  return (
    <button onClick={flip} aria-label="Toggle dark mode"
      className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/15 bg-white/5 text-white hover:bg-white/15">
      <Icon name={dark ? "sun" : "moon"} />
    </button>
  );
}

export function LangToggle() {
  const { lang, setLang } = useI18n();
  const seg = (l: "en" | "ms", label: string) => (
    <button onClick={() => setLang(l)} aria-pressed={lang === l}
      className={`min-h-9 rounded-md px-2.5 font-mono text-xs font-bold ${lang === l ? "bg-white text-key" : "text-white/70 hover:text-white"}`}>
      {label}
    </button>
  );
  return <div className="flex items-center rounded-lg border border-white/15 bg-white/5 p-0.5">{seg("en", "EN")}{seg("ms", "BM")}</div>;
}

export function TopBar({ extra }: { extra?: ReactNode }) {
  return (
    <header className="bg-key text-white">
      <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between gap-2 px-4">
        <Brand />
        <div className="flex shrink-0 items-center gap-2">{extra}<LangToggle /><ThemeToggle /></div>
      </div>
      <div className="cmyk-bar" aria-hidden="true" />
    </header>
  );
}

/** Public page frame: black bar, dye-cloud title band, content in a column. */
export function Shell({ title, subtitle, back, children }: {
  title?: string; subtitle?: string; children: ReactNode; back?: { label: string; to: string };
}) {
  return (
    <div className="flex min-h-dvh flex-col">
      <TopBar />
      {title && (
        <div className="dye text-white">
          <div className="halftone" />
          <div className="mx-auto w-full max-w-3xl px-4 pb-14 pt-7">
            {back && (
              <Link to={back.to} className="mb-3 inline-flex min-h-10 items-center gap-1 rounded-lg border border-white/20 bg-white/10 px-3 text-sm font-semibold hover:bg-white/20">
                <Icon name="left" className="h-4 w-4" />{back.label}
              </Link>
            )}
            <h1 className="text-3xl font-bold sm:text-4xl">{title}</h1>
            {subtitle && <p className="mt-1.5 max-w-prose text-white/75">{subtitle}</p>}
          </div>
        </div>
      )}
      <div className={`mx-auto w-full max-w-3xl flex-1 px-4 pb-10 ${title ? "-mt-9" : "pt-5"}`}>{children}</div>
      <Footer />
    </div>
  );
}

export function Footer() {
  return (
    <footer className="border-t border-line bg-surface">
      <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-2 px-4 py-5 text-sm text-muted">
        <span className="flex items-center gap-2"><span className="reg-mark text-muted" aria-hidden="true" />{BUSINESS_NAME} · Sublimation printing</span>
        <span className="tabular">© {new Date().getFullYear()}</span>
      </div>
    </footer>
  );
}

export const cardCls = "sheet rounded-2xl border border-line p-5 shadow-[0_12px_32px_-16px_rgb(18_16_25/0.35)] sm:p-7";
export const panelCls = "rounded-2xl border border-line bg-surface p-4 sm:p-5";
export const inputCls =
  "min-h-12 w-full rounded-lg border border-line bg-surface px-3.5 text-base text-ink outline-none placeholder:text-muted/70 focus:border-cyan focus:ring-2 focus:ring-cyan/30";
export const btnCls =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-key px-5 text-sm font-bold uppercase tracking-wider text-white hover:opacity-90 disabled:opacity-45 dark:bg-white dark:text-key";
export const accentBtnCls =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-magenta px-5 text-sm font-bold uppercase tracking-wider text-white hover:brightness-110 disabled:opacity-45";
export const okBtnCls =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-ok px-5 text-sm font-bold uppercase tracking-wider text-white hover:brightness-110 disabled:opacity-45 dark:text-key";
export const ghostBtnCls =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-line bg-surface px-4 text-sm font-semibold text-ink hover:bg-surface-2 disabled:opacity-45";
export const labelCls = "mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted";

import { useEffect, useState, type ReactNode } from "react";
import { Icon } from "./Icon";
import { useI18n } from "../lib/i18n";
import { STAGE_ICON, STAGE_SOFT } from "../lib/stages";
import { artworkUrl } from "../lib/supabase";
import type { RosterLine, SizeQty, Stage } from "../lib/types";

export function StageChip({ stage, label }: { stage: Stage; label?: string }) {
  const { t } = useI18n();
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-bold ${STAGE_SOFT[stage]}`}>
      <Icon name={STAGE_ICON[stage]} className="h-3.5 w-3.5" />{label ?? t.stage[stage]}
    </span>
  );
}

export function SizeChips({ sizes }: { sizes: SizeQty[] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {sizes.filter((s) => s.qty > 0).map((s) => (
        <span key={s.size} className="inline-flex overflow-hidden rounded-md border border-line font-mono text-xs font-bold">
          <span className="bg-surface-2 px-1.5 py-1 text-muted">{s.size}</span>
          <span className="px-1.5 py-1 tabular">{s.qty}</span>
        </span>
      ))}
    </div>
  );
}

export function Modal({ title, onClose, children, wide = false }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", k); document.body.style.overflow = prev; };
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={title} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}
        className={`max-h-[92dvh] w-full overflow-y-auto rounded-t-2xl border border-line bg-surface p-5 shadow-2xl sm:rounded-2xl ${wide ? "sm:max-w-2xl" : "sm:max-w-md"}`}>
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-lg font-bold">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="flex h-10 w-10 items-center justify-center rounded-lg border border-line hover:bg-surface-2">
            <Icon name="close" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/** Full-screen artwork viewer with next/previous. */
export function Lightbox({ paths, start, onClose }: { paths: string[]; start: number; onClose: () => void }) {
  const [i, setI] = useState(start);
  const n = paths.length;
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") setI((v) => (v + 1) % n);
      if (e.key === "ArrowLeft") setI((v) => (v - 1 + n) % n);
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [n, onClose]);
  const nav = "absolute top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25";
  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-black/92" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="flex items-center justify-between p-3 text-white">
        <span className="font-mono text-sm">{i + 1} / {n}</span>
        <button aria-label="Close" className="flex h-11 w-11 items-center justify-center rounded-full bg-white/15"><Icon name="close" /></button>
      </div>
      <div className="relative flex flex-1 items-center justify-center p-3" onClick={(e) => e.stopPropagation()}>
        <img src={artworkUrl(paths[i])} alt="" className="max-h-full max-w-full rounded-lg object-contain" />
        {n > 1 && <>
          <button className={`${nav} left-3`} aria-label="Previous" onClick={() => setI((i - 1 + n) % n)}><Icon name="left" /></button>
          <button className={`${nav} right-3`} aria-label="Next" onClick={() => setI((i + 1) % n)}><Icon name="right" /></button>
        </>}
      </div>
    </div>
  );
}

/** Thumbnails that open the viewer. Looks like transfer sheets laid on the table. */
export function Mockups({ paths, size = "md", empty }: { paths: string[]; size?: "sm" | "md" | "lg"; empty?: ReactNode }) {
  const [open, setOpen] = useState<number | null>(null);
  if (!paths.length) return <>{empty ?? null}</>;
  const box = size === "sm" ? "h-16 w-16" : size === "lg" ? "aspect-[4/3] w-full" : "h-24 w-24";
  return (
    <>
      <div className={size === "lg" ? "grid gap-3 sm:grid-cols-2" : "flex flex-wrap gap-2"}>
        {paths.map((p, i) => (
          <button key={p} onClick={() => setOpen(i)} aria-label={`Artwork ${i + 1}`}
            className={`${box} group relative overflow-hidden rounded-lg border border-line bg-surface-2 p-1 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md`}>
            <img src={artworkUrl(p)} alt="" loading="lazy" className="h-full w-full rounded object-cover" />
          </button>
        ))}
      </div>
      {open !== null && <Lightbox paths={paths} start={open} onClose={() => setOpen(null)} />}
    </>
  );
}

export function RosterTable({ roster }: { roster: RosterLine[] }) {
  const { t } = useI18n();
  return (
    <div className="overflow-x-auto rounded-lg border border-line">
      <table className="w-full text-left text-sm">
        <thead className="bg-surface-2 text-xs uppercase tracking-wider text-muted">
          <tr><th className="px-3 py-2">#</th><th className="px-3 py-2">{t.rosterName}</th><th className="px-3 py-2">{t.rosterNumber}</th><th className="px-3 py-2">{t.size}</th></tr>
        </thead>
        <tbody>
          {roster.map((r, i) => (
            <tr key={i} className="border-t border-line">
              <td className="px-3 py-2 text-muted tabular">{i + 1}</td>
              <td className="px-3 py-2 font-semibold">{r.name || "—"}</td>
              <td className="px-3 py-2 font-mono font-bold">{r.number || "—"}</td>
              <td className="px-3 py-2 font-mono">{r.size || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** A progress meter in one ink. */
export function Meter({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const pct = total > 0 ? Math.min(100, Math.round((value / total) * 100)) : 0;
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
        <span className="font-semibold text-muted">{label}</span>
        <span className="font-mono font-bold tabular">{value}<span className="text-muted">/{total}</span></span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-surface-2">
        <div className={`h-full rounded-full ${color} transition-[width] duration-700`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function Notice({ tone, icon = "warning", children }: { tone: "warn" | "ok" | "danger" | "info"; icon?: Parameters<typeof Icon>[0]["name"]; children: ReactNode }) {
  const cls = {
    warn: "border-warn/40 bg-warn/10 text-warn",
    ok: "border-ok/40 bg-ok/10 text-ok",
    danger: "border-danger/40 bg-danger/8 text-danger",
    info: "border-cyan/40 bg-cyan/10 text-cyan",
  }[tone];
  return (
    <div className={`flex items-start gap-2.5 rounded-xl border p-3.5 text-sm font-semibold ${cls}`} role={tone === "danger" ? "alert" : undefined}>
      <Icon name={icon} className="mt-0.5 h-5 w-5 shrink-0" /><div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

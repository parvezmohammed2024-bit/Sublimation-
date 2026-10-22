import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Footer, TopBar, accentBtnCls, cardCls, inputCls } from "../components/Shell";
import { Icon, type IconName } from "../components/Icon";
import { Notice } from "../components/Bits";
import { useI18n } from "../lib/i18n";
import { isConfigured } from "../lib/supabase";

export default function Home() {
  const { t } = useI18n();
  const nav = useNavigate();
  const [no, setNo] = useState("");
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (no.trim()) nav(`/track/${encodeURIComponent(no.trim().toUpperCase())}`);
  };

  const steps: { icon: IconName; color: string; title: string; text: string }[] = [
    { icon: "palette", color: "text-cyan border-cyan/40", title: t.stage.artwork, text: t.homeStep1 },
    { icon: "print", color: "text-magenta border-magenta/40", title: t.stage.printing, text: t.homeStep2 },
    { icon: "press", color: "text-heat border-heat/40", title: t.stage.production, text: t.homeStep3 },
    { icon: "box", color: "text-ok border-ok/40", title: t.stage.ready, text: t.homeStep4 },
  ];

  return (
    <div className="flex min-h-dvh flex-col">
      <TopBar />
      <section className="dye text-white">
        <div className="halftone" />
        <div className="mx-auto w-full max-w-5xl px-4 pb-24 pt-12 sm:pt-16">
          <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 font-mono text-xs font-bold uppercase tracking-[0.18em]">
            <span className="h-2 w-2 rounded-full bg-[#00a8e8]" /><span className="h-2 w-2 rounded-full bg-[#ff1f8e]" /><span className="h-2 w-2 rounded-full bg-[#ffd000]" />
            {t.homeKicker}
          </p>
          <h1 className="max-w-2xl text-4xl font-bold leading-[1.05] sm:text-6xl">{t.homeTitle}</h1>
          <p className="mt-4 max-w-xl text-lg text-white/75">{t.homeLead}</p>
        </div>
      </section>

      <main className="mx-auto -mt-16 w-full max-w-5xl flex-1 px-4 pb-12">
        {!isConfigured && <div className="mb-4"><Notice tone="danger">{t.notConfigured}</Notice></div>}
        <form onSubmit={submit} className={`${cardCls} max-w-2xl`}>
          <label htmlFor="trk" className="mb-2 block font-display text-lg font-bold">{t.trackTitle}</label>
          <div className="flex flex-col gap-2.5 sm:flex-row">
            <input id="trk" className={`${inputCls} min-h-14 font-mono text-lg uppercase tracking-wider`} value={no} onChange={(e) => setNo(e.target.value)}
              placeholder="SB-2610-7QX4" autoCapitalize="characters" autoComplete="off" spellCheck={false} />
            <button className={`${accentBtnCls} min-h-14 px-6 text-base`}>{t.track}<Icon name="arrowRight" /></button>
          </div>
          <Link to="/my" className="mt-3 inline-flex items-center gap-2 text-sm font-bold text-cyan">
            <Icon name="phone" className="h-4 w-4" />{t.manyOrdersLink}<Icon name="arrowRight" className="h-4 w-4" />
          </Link>
        </form>

        <h2 className="mt-12 text-2xl font-bold">{t.homeHow}</h2>
        <ol className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((s, i) => (
            <li key={s.title} className="sheet rounded-2xl border border-line p-5">
              <div className="flex items-center justify-between">
                <span className={`flex h-12 w-12 items-center justify-center rounded-xl border-2 ${s.color}`}><Icon name={s.icon} className="h-6 w-6" /></span>
                <span className="font-mono text-3xl font-bold text-line">0{i + 1}</span>
              </div>
              <h3 className="mt-4 text-lg font-bold">{s.title}</h3>
              <p className="mt-1 text-sm text-muted">{s.text}</p>
            </li>
          ))}
        </ol>

        <div className="mt-12 flex flex-wrap gap-3 border-t border-line pt-6 text-sm">
          <span className="font-bold uppercase tracking-wider text-muted">{t.staff}</span>
          <Link to="/team/login" className="inline-flex items-center gap-1.5 font-semibold text-ink hover:text-magenta"><Icon name="users" className="h-4 w-4" />{t.teamLogin}</Link>
          <Link to="/admin/login" className="inline-flex items-center gap-1.5 font-semibold text-ink hover:text-magenta"><Icon name="lock" className="h-4 w-4" />{t.adminLogin}</Link>
        </div>
      </main>
      <Footer />
    </div>
  );
}

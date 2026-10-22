import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Shell, btnCls, cardCls, inputCls } from "../../components/Shell";
import { Notice } from "../../components/Bits";
import { saveTeamSession, teamLogin } from "../../lib/supabase";
import { useI18n } from "../../lib/i18n";

export const pinInputCls = `${inputCls} min-h-14 text-center font-mono text-2xl tracking-[0.6em] placeholder:font-sans placeholder:text-base placeholder:tracking-normal`;

export default function TeamLogin() {
  const { t } = useI18n();
  const nav = useNavigate();
  const [mobile, setMobile] = useState("");
  const [pin, setPin] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setErr("");
    try {
      const r = await teamLogin(mobile, pin);
      if ("error" in r) { setErr(r.error === "locked" ? t.locked : t.badLogin); setPin(""); return; }
      saveTeamSession(r);
      nav("/team");
    } catch { setErr(t.serviceDown); } finally { setBusy(false); }
  }

  return (
    <Shell title={t.teamLogin} subtitle={t.teamLoginLead} back={{ label: t.back, to: "/" }}>
      <form onSubmit={submit} className={`${cardCls} grid max-w-md gap-3`}>
        <input className={inputCls} inputMode="tel" autoComplete="tel" placeholder={t.mobile} value={mobile} onChange={(e) => setMobile(e.target.value)} />
        <input className={pinInputCls} inputMode="numeric" type="password" autoComplete="off" placeholder={t.pin}
          value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))} />
        <p className="text-sm text-muted">{t.firstLoginHint}</p>
        {err && <Notice tone="danger">{err}</Notice>}
        <button className={btnCls} disabled={busy || pin.length !== 4}>{t.signIn}</button>
      </form>
    </Shell>
  );
}

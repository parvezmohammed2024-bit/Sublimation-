import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Shell, btnCls, cardCls, inputCls } from "../../components/Shell";
import { Notice } from "../../components/Bits";
import { supabase } from "../../lib/supabase";
import { useI18n } from "../../lib/i18n";

export default function AdminLogin() {
  const { t } = useI18n();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setErr("");
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.user) { setErr(t.badLogin); setBusy(false); return; }
    // The auth users are shared with StitchPay; only people listed in subli_admins may continue.
    const { data: row, error: e2 } = await supabase.from("subli_admins").select("user_id").eq("user_id", data.user.id).maybeSingle();
    if (e2 || !row) {
      await supabase.auth.signOut();
      setErr(e2 ? `${t.notAdmin} (${e2.message})` : t.notAdmin);
      setBusy(false);
      return;
    }
    nav("/admin");
  }

  return (
    <Shell title={t.adminLogin} subtitle={t.adminLoginLead} back={{ label: t.back, to: "/" }}>
      <form onSubmit={submit} className={`${cardCls} grid max-w-md gap-3`}>
        <input className={inputCls} type="email" autoComplete="email" placeholder={t.email} value={email} onChange={(e) => setEmail(e.target.value)} />
        <input className={inputCls} type="password" autoComplete="current-password" placeholder={t.password} value={password} onChange={(e) => setPassword(e.target.value)} />
        {err && <Notice tone="danger">{err}</Notice>}
        <button className={btnCls} disabled={busy}>{t.signIn}</button>
      </form>
    </Shell>
  );
}

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Icon } from "../../components/Icon";
import { Notice } from "../../components/Bits";
import { btnCls, ghostBtnCls, inputCls, labelCls, panelCls } from "../../components/Shell";
import { useI18n } from "../../lib/i18n";
import { errMsg, supabase, waLink } from "../../lib/supabase";
import { fmtPhone } from "../../lib/format";
import type { Customer } from "../../lib/types";

export default function Customers() {
  const { t } = useI18n();
  const [list, setList] = useState<Customer[] | null>(null);
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState("");

  const load = useCallback(async () => {
    const { data, error } = await supabase.from("subli_customers").select("id, phone, name, code, created_at").order("created_at", { ascending: false });
    if (error) setErr(errMsg(error)); else setList(data as Customer[]);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function create(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setErr("");
    const { error } = await supabase.rpc("subli_customer_for_phone", { p_phone: phone, p_name: name || null });
    if (error) setErr(errMsg(error)); else { setPhone(""); setName(""); await load(); }
    setBusy(false);
  }
  async function newCode(id: string) {
    if (!confirm(t.confirmNewCode)) return;
    setBusy(true);
    const { error } = await supabase.rpc("subli_customer_new_code", { p_customer_id: id });
    if (error) setErr(errMsg(error)); else await load();
    setBusy(false);
  }

  const shown = (list ?? []).filter((c) => !q.trim() || `${c.name ?? ""} ${c.phone}`.toLowerCase().includes(q.trim().toLowerCase()));
  const myUrl = `${window.location.origin}/my`;

  return (
    <div className="grid grid-cols-1 gap-4">
      <div>
        <h1 className="text-2xl font-bold sm:text-3xl">{t.customers}</h1>
        <p className="text-sm text-muted">{t.customersLead}</p>
      </div>
      <form onSubmit={create} className={`${panelCls} grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end`}>
        <div><label className={labelCls} htmlFor="cp">{t.phone}</label><input id="cp" className={inputCls} inputMode="tel" placeholder="012-345 6789" value={phone} onChange={(e) => setPhone(e.target.value)} required /></div>
        <div><label className={labelCls} htmlFor="cn">{t.nameOpt}</label><input id="cn" className={inputCls} value={name} onChange={(e) => setName(e.target.value)} /></div>
        <button className={btnCls} disabled={busy}><Icon name="key" />{t.getCode}</button>
      </form>
      {err && <Notice tone="danger">{err}</Notice>}
      <input className={inputCls} placeholder={t.searchCustomers} value={q} onChange={(e) => setQ(e.target.value)} />
      {!list && <p className="text-muted">{t.loading}</p>}
      <ul className="grid gap-2 sm:grid-cols-2">
        {shown.map((c) => (
          <li key={c.id} className="sheet flex flex-wrap items-center gap-3 rounded-2xl border border-line p-4">
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{c.name || "—"}</p>
              <p className="text-sm text-muted">{fmtPhone(c.phone)}</p>
            </div>
            <span className="rounded-lg bg-surface-2 px-3 py-1.5 font-mono text-xl font-bold tracking-[0.25em]">{c.code}</span>
            <div className="flex w-full gap-2">
              <a className={`${ghostBtnCls} flex-1`} target="_blank" rel="noreferrer"
                href={waLink(c.phone, t.waCode.replace("{code}", c.code).replace("{url}", myUrl))}><Icon name="chat" className="h-4 w-4" />WhatsApp</a>
              <button className={ghostBtnCls} disabled={busy} onClick={() => newCode(c.id)}><Icon name="refresh" className="h-4 w-4" />{t.newCode}</button>
            </div>
          </li>
        ))}
      </ul>
      {list && list.length === 0 && <p className="text-center text-muted">{t.noCustomers}</p>}
    </div>
  );
}

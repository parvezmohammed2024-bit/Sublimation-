import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Shell, accentBtnCls, cardCls, inputCls, labelCls } from "../components/Shell";
import { Icon } from "../components/Icon";
import { Notice, StageChip } from "../components/Bits";
import { useI18n } from "../lib/i18n";
import { fmtDate, rm } from "../lib/format";
import { trackCustomer } from "../lib/supabase";
import type { PublicOrder } from "../lib/types";

export default function MyOrders() {
  const { t } = useI18n();
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [res, setRes] = useState<{ name: string | null; orders: PublicOrder[] } | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setErr("");
    try {
      const r = await trackCustomer(phone, code);
      if ("error" in r) { setErr(r.error === "locked" ? t.lockedCustomer : t.badCode); setRes(null); }
      else setRes(r);
    } catch { setErr(t.serviceDown); } finally { setBusy(false); }
  }

  return (
    <Shell title={t.myOrdersTitle} subtitle={t.myOrdersLead} back={{ label: t.back, to: "/" }}>
      <form onSubmit={submit} className={`${cardCls} grid gap-3 sm:grid-cols-[1fr_10rem_auto] sm:items-end`}>
        <div><label className={labelCls} htmlFor="p">{t.phone}</label>
          <input id="p" className={inputCls} inputMode="tel" autoComplete="tel" placeholder="012-345 6789" value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
        <div><label className={labelCls} htmlFor="c">{t.customerCode}</label>
          <input id="c" className={`${inputCls} text-center font-mono tracking-[0.4em]`} inputMode="numeric" maxLength={4} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 4))} /></div>
        <button className={accentBtnCls} disabled={busy || code.length !== 4}>{t.show}</button>
      </form>
      {err && <div className="mt-4"><Notice tone="danger">{err}</Notice></div>}
      {res && (
        <div className="mt-6">
          <h2 className="text-xl font-bold">{res.name ? `${t.hello} ${res.name}` : t.activeOrders}</h2>
          {res.orders.length === 0 && <p className="mt-3 text-muted">{t.noActiveOrders}</p>}
          <ul className="mt-3 grid gap-3">
            {res.orders.map((o) => {
              const due = Number(o.balance) > 0.004;
              return (
                <li key={o.tracking_no}>
                  <Link to={`/track/${o.tracking_no}`} state={{ from: "my" }} className="sheet block rounded-2xl border border-line p-4 hover:border-cyan">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-mono font-bold">{o.tracking_no}</span>
                      <StageChip stage={o.stage} />
                    </div>
                    <p className="mt-2 font-semibold">{o.item_type} · <span className="tabular">{o.total_qty} {t.pcs}</span></p>
                    <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-sm text-muted">
                      <span>{t.targetDate}: {fmtDate(o.deadline)}</span>
                      <span className={due ? "font-bold text-warn" : "font-bold text-ok"}>{due ? `${t.balance} ${rm(o.balance)}` : t.fullyPaid}</span>
                    </div>
                    {o.approval_status === "waiting" && <p className="mt-2 inline-flex items-center gap-1.5 text-sm font-bold text-cyan"><Icon name="palette" className="h-4 w-4" />{t.needsYourApproval}</p>}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </Shell>
  );
}

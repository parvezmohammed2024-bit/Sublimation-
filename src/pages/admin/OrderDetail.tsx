import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Icon } from "../../components/Icon";
import { Meter, Mockups, Notice, RosterTable, SizeChips, StageChip } from "../../components/Bits";
import { accentBtnCls, btnCls, ghostBtnCls, inputCls, labelCls, okBtnCls, panelCls } from "../../components/Shell";
import { useI18n } from "../../lib/i18n";
import { errMsg, removeArtwork, supabase, waLink } from "../../lib/supabase";
import { sumUp, trackUrl } from "../../lib/admin";
import { STAGES } from "../../lib/stages";
import { TONE_CLASS, deadlineTone, fmtDate, fmtDateTime, fmtPhone, rm, todayMY } from "../../lib/format";
import type { EventRow, Order, Payment, ProgressRow, Stage } from "../../lib/types";

const METHODS = ["Cash", "Bank transfer", "DuitNow QR", "Cheque", "Other"];

export default function OrderDetail() {
  const { id } = useParams();
  const { t } = useI18n();
  const nav = useNavigate();
  const [o, setO] = useState<Order | null>(null);
  const [pays, setPays] = useState<Payment[]>([]);
  const [prog, setProg] = useState<ProgressRow[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    const [a, b, c, d] = await Promise.all([
      supabase.from("subli_orders").select("*").eq("id", id!).maybeSingle(),
      supabase.from("subli_payments").select("*").eq("order_id", id!).order("paid_on", { ascending: false }),
      supabase.from("subli_progress").select("*").eq("order_id", id!).order("created_at", { ascending: false }),
      supabase.from("subli_events").select("*").eq("order_id", id!).order("created_at", { ascending: false }),
    ]);
    if (a.error) { setErr(errMsg(a.error)); return; }
    if (!a.data) { setErr(t.notFound); return; }
    setO({ ...(a.data as Order), price_total: Number(a.data.price_total) });
    setPays((b.data ?? []) as Payment[]); setProg((c.data ?? []) as ProgressRow[]); setEvents((d.data ?? []) as EventRow[]);
  }, [id, t]);

  useEffect(() => { load(); const i = setInterval(load, 20_000); return () => clearInterval(i); }, [load]);

  async function run(fn: () => PromiseLike<{ error: unknown }> | Promise<unknown>) {
    setBusy(true); setErr("");
    try {
      const r = await fn();
      const e = (r as { error?: unknown } | undefined)?.error;
      if (e) throw e;
      await load();
    } catch (x) {
      const m = errMsg(x);
      setErr(m.includes("BALANCE_DUE") ? t.balanceBlocks : m);
    } finally { setBusy(false); }
  }

  if (!o) return <p className="text-muted">{err || t.loading}</p>;

  const paid = pays.reduce((a, p) => a + Number(p.amount), 0);
  const balance = Math.max(o.price_total - paid, 0);
  const s = sumUp(prog);
  const url = trackUrl(o.tracking_no);
  const phoneDigits = o.customer_phone ?? "";
  const msg = (kind: "approval" | "ready" | "status") => {
    const base = kind === "approval" ? t.waApproval : kind === "ready" ? (balance > 0.004 ? t.waReadyBalance.replace("{amount}", rm(balance)) : t.waReady) : t.waStatus;
    return `${t.waGreeting} ${o.customer_name},\n\n${base}\n\n${o.item_type} · ${o.total_qty} ${t.pcs}\n${t.trackingNo}: ${o.tracking_no}\n${url}`;
  };

  return (
    <div className="grid grid-cols-1 gap-4">
      <div>
        <div className="flex items-center gap-2">
          <Link to="/admin" className={ghostBtnCls} aria-label={t.back}><Icon name="left" /></Link>
          <span className="flex-1" />
          <StageChip stage={o.stage} />
          <Link to={`/admin/orders/${o.id}/edit`} className={ghostBtnCls}><Icon name="edit" />{t.edit}</Link>
        </div>
        <p className="mt-3 font-mono text-sm font-bold text-muted">{o.tracking_no}</p>
        <h1 className="text-2xl font-bold sm:text-3xl">{o.customer_name}</h1>
        <p className="text-muted">{o.item_type} · <span className="tabular">{o.total_qty} {t.pcs}</span></p>
      </div>
      {err && <Notice tone="danger">{err}</Notice>}

      {/* share */}
      <section className={`${panelCls} flex flex-wrap items-center gap-2`}>
        <span className="min-w-0 flex-1 basis-56 truncate font-mono text-sm text-muted">{url}</span>
        <button className={ghostBtnCls} onClick={() => { navigator.clipboard?.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>
          <Icon name={copied ? "check" : "copy"} />{copied ? t.copied : t.copyLink}</button>
        {phoneDigits && <a className={ghostBtnCls} href={waLink(phoneDigits, msg(o.stage === "ready" ? "ready" : o.approval_status === "waiting" ? "approval" : "status"))} target="_blank" rel="noreferrer"><Icon name="chat" />WhatsApp</a>}
      </section>

      <div className="grid gap-4 lg:grid-cols-[1.25fr_1fr]">
        <div className="grid min-w-0 content-start gap-4">
          {/* artwork & approval */}
          <section className={panelCls}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 font-bold"><Icon name="palette" className="h-5 w-5 text-cyan" />{t.artworkApproval}</h2>
              <span className="rounded-full bg-cyan/12 px-2.5 py-1 text-xs font-bold text-cyan">{t.approvalState[o.approval_status]}{o.approval_round > 1 && ` · ${t.round} ${o.approval_round}`}</span>
            </div>
            <div className="mt-3"><Mockups paths={o.mockups} empty={<p className="text-sm text-muted">{t.noMockup}</p>} /></div>
            {o.approval_status === "changes" && o.approval_note && (
              <div className="mt-3"><Notice tone="info" icon="edit"><p>{t.customerAsked}</p><p className="mt-1 font-normal italic">"{o.approval_note}"</p></Notice></div>
            )}
            {o.approval_status === "approved" && o.approved_at && (
              <p className="mt-3 text-sm text-ok"><Icon name="check" className="mr-1 inline h-4 w-4" />{t.approvedBy[o.approved_by ?? "admin"]} · {fmtDateTime(o.approved_at)}</p>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              {o.approval_status !== "approved" && (
                <>
                  {(o.approval_status === "not_sent" || o.approval_status === "changes") && (
                    o.approval_status === "changes" || o.mockups.length > 0
                      ? <button className={accentBtnCls} disabled={busy || !o.mockups.length} onClick={() => run(() => supabase.rpc("subli_admin_approval", { p_order_id: o.id, p_action: "send" }))}><Icon name="arrowRight" />{o.approval_status === "changes" ? t.sendAgain : t.sendForApproval}</button>
                      : <Link to={`/admin/orders/${o.id}/edit`} className={accentBtnCls}><Icon name="image" />{t.uploadMockup}</Link>
                  )}
                  {o.approval_status === "changes" && <Link to={`/admin/orders/${o.id}/edit`} className={ghostBtnCls}><Icon name="image" />{t.updateMockup}</Link>}
                  {o.approval_status === "waiting" && phoneDigits && <a className={accentBtnCls} href={waLink(phoneDigits, msg("approval"))} target="_blank" rel="noreferrer"><Icon name="chat" />{t.sendWaApproval}</a>}
                  <button className={ghostBtnCls} disabled={busy} onClick={() => confirm(t.confirmManualApprove) && run(() => supabase.rpc("subli_admin_approval", { p_order_id: o.id, p_action: "approve" }))}><Icon name="check" />{t.markApproved}</button>
                </>
              )}
            </div>
            {o.approval_status === "waiting" && !phoneDigits && <p className="mt-2 text-sm text-warn">{t.noPhoneApproval}</p>}
          </section>

          {/* progress */}
          {(o.stage !== "artwork" || prog.length > 0) && (
            <section className={panelCls}>
              <h2 className="font-bold">{t.workshopProgress}</h2>
              <div className="mt-3 grid gap-3">
                <Meter label={t.step.printed} value={s.printed} total={o.total_qty} color="bg-magenta" />
                <Meter label={t.step.pressed} value={s.pressed} total={o.total_qty} color="bg-heat" />
                <Meter label={t.step.qc_pass} value={s.passed} total={o.total_qty} color="bg-ok" />
              </div>
              {s.rejected > 0 && <p className="mt-3 text-sm font-semibold text-danger">{t.rejectedSoFar.replace("{n}", String(s.rejected))} · {t.step.reprinted} {s.reprinted}{s.reprint_pending > 0 && ` · ${t.waitReprint.replace("{n}", String(s.reprint_pending))}`}</p>}
              {prog.length > 0 && (
                <details className="mt-3 rounded-lg border border-line">
                  <summary className="cursor-pointer px-3 py-2 text-sm font-bold text-muted">{t.entries} ({prog.length})</summary>
                  <ul className="divide-y divide-line">
                    {prog.map((p) => (
                      <li key={p.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                        <span><b>{t.step[p.step]}</b> <span className="font-mono">{p.qty}</span>{p.reason && <span className="text-muted"> · {t.reason[p.reason as keyof typeof t.reason] ?? p.reason}</span>}
                          <span className="block text-xs text-muted">{p.by_name} · {fmtDateTime(p.created_at)}</span></span>
                        <button aria-label={t.remove} className="flex h-9 w-9 items-center justify-center rounded-md text-muted hover:text-danger" disabled={busy}
                          onClick={() => confirm(t.confirmDeleteEntry) && run(() => supabase.from("subli_progress").delete().eq("id", p.id))}><Icon name="trash" className="h-4 w-4" /></button>
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </section>
          )}

          {/* details */}
          <section className={panelCls}>
            <h2 className="font-bold">{t.orderDetails}</h2>
            <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
              <div><dt className="text-muted">{t.phone}</dt><dd className="font-semibold">{fmtPhone(o.customer_phone)}</dd></div>
              <div><dt className="text-muted">{t.deadline}</dt><dd className={TONE_CLASS[deadlineTone(o)]}>{fmtDate(o.deadline)}</dd></div>
              <div><dt className="text-muted">{t.item}</dt><dd className="font-semibold">{o.item_type}</dd></div>
              <div><dt className="text-muted">{t.fabric}</dt><dd className="font-semibold">{o.fabric || "—"}</dd></div>
              <div><dt className="text-muted">{t.printTypeLabel}</dt><dd className="font-semibold">{t.printType[o.print_type]}</dd></div>
              <div><dt className="text-muted">{t.quantity}</dt><dd className="font-semibold tabular">{o.total_qty} {t.pcs}</dd></div>
            </dl>
            <div className="mt-3"><SizeChips sizes={o.sizes} /></div>
            {o.notes && <p className="mt-3 whitespace-pre-line rounded-lg bg-yellow/15 p-3 text-sm">{o.notes}</p>}
            {o.roster.length > 0 && (
              <details className="mt-3"><summary className="cursor-pointer text-sm font-bold text-cyan">{t.roster} ({o.roster.length})</summary>
                <div className="mt-2"><RosterTable roster={o.roster} /></div></details>
            )}
          </section>
        </div>

        <div className="grid min-w-0 content-start gap-4">
          <Payments o={o} pays={pays} paid={paid} balance={balance} busy={busy} run={run} />
          <StageControl o={o} balance={balance} busy={busy} run={run} onDeleted={() => nav("/admin")} />
          {events.length > 0 && (
            <section className={panelCls}>
              <h2 className="font-bold">{t.history}</h2>
              <ol className="mt-3 grid gap-2.5 border-l-2 border-line pl-4">
                {events.map((e) => (
                  <li key={e.id} className="relative text-sm">
                    <span className="absolute -left-[1.4rem] top-1 h-2.5 w-2.5 rounded-full bg-muted" />
                    <span className="font-semibold">{t.eventText[e.action as keyof typeof t.eventText] ?? e.action}</span>
                    {" · "}<span className="text-muted">{t.stage[e.stage as Stage] ?? e.stage}</span>
                    {e.note && <span className="text-muted"> · {e.note}</span>}
                    <span className="block text-xs text-muted">{e.by_name ? `${e.by_name} · ` : ""}{fmtDateTime(e.created_at)}</span>
                  </li>
                ))}
                <li className="relative text-sm"><span className="absolute -left-[1.4rem] top-1 h-2.5 w-2.5 rounded-full bg-cyan" />
                  <span className="font-semibold">{t.eventText.created}</span><span className="block text-xs text-muted">{fmtDateTime(o.created_at)}</span></li>
              </ol>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

type Run = (fn: () => PromiseLike<{ error: unknown }> | Promise<unknown>) => Promise<void>;

function Payments({ o, pays, paid, balance, busy, run }: { o: Order; pays: Payment[]; paid: number; balance: number; busy: boolean; run: Run }) {
  const { t } = useI18n();
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState(METHODS[0]);
  const [date, setDate] = useState(todayMY());
  const [note, setNote] = useState("");
  const add = (e: FormEvent) => {
    e.preventDefault();
    const a = Number(amount);
    if (!(a > 0)) return;
    run(() => supabase.from("subli_payments").insert({ order_id: o.id, amount: a, method, paid_on: date, note: note.trim() || null }))
      .then(() => { setAmount(""); setNote(""); });
  };
  return (
    <section className={panelCls}>
      <h2 className="flex items-center gap-2 font-bold"><Icon name="money" className="h-5 w-5 text-ok" />{t.payment}</h2>
      <dl className="mt-3 grid grid-cols-3 gap-2 text-sm">
        <div className="rounded-lg bg-surface-2 p-2.5"><dt className="text-muted">{t.total}</dt><dd className="font-mono font-bold tabular">{rm(o.price_total)}</dd></div>
        <div className="rounded-lg bg-surface-2 p-2.5"><dt className="text-muted">{t.paid}</dt><dd className="font-mono font-bold tabular text-ok">{rm(paid)}</dd></div>
        <div className={`rounded-lg p-2.5 ${balance > 0.004 ? "bg-warn/12" : "bg-ok/12"}`}><dt className="text-muted">{t.balance}</dt><dd className={`font-mono font-bold tabular ${balance > 0.004 ? "text-warn" : "text-ok"}`}>{rm(balance)}</dd></div>
      </dl>
      {o.price_total === 0 && <p className="mt-2 text-sm text-warn">{t.noPriceSet}</p>}
      <form onSubmit={add} className="mt-4 grid grid-cols-2 gap-2">
        <div className="col-span-2 sm:col-span-1"><label className={labelCls} htmlFor="am">{t.amount}</label>
          <input id="am" className={`${inputCls} font-mono`} inputMode="decimal" placeholder={balance > 0 ? balance.toFixed(2) : "0.00"} value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))} /></div>
        <div className="col-span-2 sm:col-span-1"><label className={labelCls} htmlFor="me">{t.method}</label>
          <select id="me" className={inputCls} value={method} onChange={(e) => setMethod(e.target.value)}>{METHODS.map((m) => <option key={m}>{m}</option>)}</select></div>
        <div><label className={labelCls} htmlFor="pd">{t.date}</label><input id="pd" type="date" className={inputCls} value={date} onChange={(e) => setDate(e.target.value)} /></div>
        <div><label className={labelCls} htmlFor="pn">{t.noteOpt}</label><input id="pn" className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} /></div>
        <div className="col-span-2 flex gap-2">
          {balance > 0.004 && <button type="button" className={ghostBtnCls} onClick={() => setAmount(balance.toFixed(2))}>{t.fullBalance}</button>}
          <button className={`${btnCls} flex-1`} disabled={busy || !(Number(amount) > 0)}><Icon name="plus" />{t.addPayment}</button>
        </div>
      </form>
      {pays.length > 0 && (
        <ul className="mt-4 divide-y divide-line rounded-lg border border-line">
          {pays.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
              <span><span className="font-mono font-bold">{rm(p.amount)}</span> · {p.method}
                <span className="block text-xs text-muted">{fmtDate(p.paid_on)}{p.note ? ` · ${p.note}` : ""}</span></span>
              <button aria-label={t.remove} className="flex h-9 w-9 items-center justify-center rounded-md text-muted hover:text-danger" disabled={busy}
                onClick={() => confirm(t.confirmDeletePayment) && run(() => supabase.from("subli_payments").delete().eq("id", p.id))}><Icon name="trash" className="h-4 w-4" /></button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function StageControl({ o, balance, busy, run, onDeleted }: { o: Order; balance: number; busy: boolean; run: Run; onDeleted: () => void }) {
  const { t } = useI18n();
  const [to, setTo] = useState<Stage>(o.stage);
  const [force, setForce] = useState(false);
  useEffect(() => setTo(o.stage), [o.stage]);
  const due = balance > 0.004;
  const move = (stage: Stage, f = false) => run(() => supabase.rpc("subli_admin_move", { p_order_id: o.id, p_stage: stage, p_force: f }));

  return (
    <section className={panelCls}>
      <h2 className="font-bold">{t.stageControl}</h2>
      {o.stage === "ready" && (
        <div className="mt-3 grid gap-2">
          {due ? (
            <>
              <Notice tone="warn" icon="lock">{t.notDeliverableAdmin.replace("{amount}", rm(balance))}</Notice>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-5 w-5" checked={force} onChange={(e) => setForce(e.target.checked)} />{t.deliverAnyway}</label>
              <button className={okBtnCls} disabled={busy || !force} onClick={() => move("delivered", true)}><Icon name="truck" />{t.markDelivered}</button>
            </>
          ) : (
            <button className={okBtnCls} disabled={busy} onClick={() => move("delivered")}><Icon name="truck" />{t.markDelivered}</button>
          )}
        </div>
      )}
      <div className="mt-3 flex gap-2">
        <select className={inputCls} value={to} onChange={(e) => setTo(e.target.value as Stage)} aria-label={t.moveTo}>
          {STAGES.filter((x) => x !== "delivered").map((x) => <option key={x} value={x}>{t.stage[x]}</option>)}
        </select>
        <button className={ghostBtnCls} disabled={busy || to === o.stage} onClick={() => move(to)}>{t.move}</button>
      </div>
      <p className="mt-1.5 text-xs text-muted">{t.moveHelp}</p>
      <button className={`${ghostBtnCls} mt-4 w-full text-danger`} disabled={busy} onClick={async () => {
        if (!confirm(t.confirmDeleteOrder.replace("{no}", o.tracking_no))) return;
        const { error } = await supabase.from("subli_orders").delete().eq("id", o.id);
        if (!error) { await Promise.all(o.mockups.map(removeArtwork)); onDeleted(); }
      }}><Icon name="trash" />{t.deleteOrder}</button>
    </section>
  );
}

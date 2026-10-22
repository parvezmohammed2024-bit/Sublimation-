import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { Shell, accentBtnCls, btnCls, cardCls, ghostBtnCls, inputCls, labelCls, okBtnCls } from "../components/Shell";
import { Icon } from "../components/Icon";
import { Meter, Mockups, Notice, RosterTable, SizeChips } from "../components/Bits";
import { useI18n } from "../lib/i18n";
import { FLOW, STAGE_ICON, STAGE_TEXT, rank } from "../lib/stages";
import { fmtDate, fmtDateTime, rm } from "../lib/format";
import { CONTACT_WHATSAPP, customerDecide, trackOrder, waLink } from "../lib/supabase";
import type { PublicOrder, Stage } from "../lib/types";

export default function Track() {
  const { trackingNo } = useParams();
  const nav = useNavigate();
  const fromMy = (useLocation().state as { from?: string } | null)?.from === "my";
  const { t } = useI18n();
  const [input, setInput] = useState(trackingNo ?? "");
  const [res, setRes] = useState<PublicOrder | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "notfound" | "error">("idle");

  const load = useCallback(async (quiet = false) => {
    if (!trackingNo) return;
    if (!quiet) setState("loading");
    try {
      const r = await trackOrder(trackingNo);
      setRes(r);
      setState(r ? "idle" : "notfound");
    } catch { setState("error"); }
  }, [trackingNo]);

  useEffect(() => { window.scrollTo(0, 0); setRes(null); load(); }, [load]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (input.trim()) nav(`/track/${encodeURIComponent(input.trim().toUpperCase())}`, { state: fromMy ? { from: "my" } : undefined });
  };

  return (
    <Shell title={t.trackTitle} subtitle={t.trackLead} back={fromMy ? { label: t.backToMyOrders, to: "/my" } : { label: t.back, to: "/" }}>
      <form onSubmit={submit} className={`${cardCls} flex flex-col gap-2.5 sm:flex-row`}>
        <input className={`${inputCls} min-h-14 font-mono text-lg uppercase tracking-wider`} value={input} onChange={(e) => setInput(e.target.value)}
          placeholder="SB-2610-7QX4" aria-label={t.trackingNo} autoCapitalize="characters" autoComplete="off" spellCheck={false} />
        <button className={`${accentBtnCls} min-h-14 px-6 text-base`}>{t.track}<Icon name="arrowRight" /></button>
      </form>
      {state === "loading" && <p className="mt-6 text-muted">{t.loading}</p>}
      {state === "notfound" && <div className="mt-6"><Notice tone="danger">{t.notFound}</Notice></div>}
      {state === "error" && <div className="mt-6"><Notice tone="danger">{t.serviceDown}</Notice></div>}
      {res && <Result r={res} reload={() => load(true)} />}
    </Shell>
  );
}

function Result({ r, reload }: { r: PublicOrder; reload: () => void }) {
  const { t } = useI18n();
  const balance = Number(r.balance);
  const paidUp = balance <= 0.004;
  const contact = CONTACT_WHATSAPP && (
    <a href={waLink(CONTACT_WHATSAPP, `${t.waHello} ${r.tracking_no}`)} target="_blank" rel="noreferrer" className={`${ghostBtnCls} mt-3`}>
      <Icon name="chat" />{t.contactAdmin}
    </a>
  );

  return (
    <div className="mt-6 grid gap-4">
      <section className={cardCls}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className={labelCls}>{t.trackingNo}</p>
            <p className="font-mono text-2xl font-bold tracking-wide">{r.tracking_no}</p>
          </div>
          {r.stage === "delivered"
            ? <span className="rounded-full bg-grey/15 px-3 py-1 text-sm font-bold text-grey">{t.stage.delivered}</span>
            : r.stage === "ready"
              ? <span className={`rounded-full px-3 py-1 text-sm font-bold ${paidUp ? "bg-ok/15 text-ok" : "bg-warn/15 text-warn"}`}>{paidUp ? t.readyCollect : t.notDeliverable}</span>
              : null}
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <div><dt className="text-muted">{t.item}</dt><dd className="font-semibold">{r.item_type}</dd></div>
          <div><dt className="text-muted">{t.quantity}</dt><dd className="font-semibold tabular">{r.total_qty} {t.pcs}</dd></div>
          <div><dt className="text-muted">{t.received}</dt><dd className="font-semibold">{fmtDate(r.received_at)}</dd></div>
          <div><dt className="text-muted">{t.targetDate}</dt><dd className="font-semibold">{fmtDate(r.deadline)}</dd></div>
        </dl>
        <div className="mt-6"><Stepper r={r} /></div>
      </section>

      {r.stage === "ready" && (
        paidUp
          ? <Notice tone="ok" icon="box">{t.readyPaidMsg}</Notice>
          : <Notice tone="warn" icon="money"><p>{t.readyBalanceMsg.replace("{amount}", rm(balance))}</p>{contact}</Notice>
      )}
      {r.stage === "delivered" && r.done.delivered && <Notice tone="ok" icon="truck">{t.deliveredOn} {fmtDateTime(r.done.delivered)}</Notice>}

      <Approval r={r} reload={reload} />

      {(r.stage === "printing" || r.stage === "production") && (
        <section className={cardCls}>
          <h2 className="text-lg font-bold">{t.liveProgress}</h2>
          <div className="mt-4 grid gap-4">
            <Meter label={t.step.printed} value={Math.min(r.sums.printed, r.total_qty)} total={r.total_qty} color="bg-magenta" />
            <Meter label={t.step.pressed} value={Math.min(r.sums.pressed, r.total_qty)} total={r.total_qty} color="bg-heat" />
            <Meter label={t.step.qc_pass} value={r.sums.passed} total={r.total_qty} color="bg-ok" />
          </div>
        </section>
      )}

      <section className={cardCls}>
        <h2 className="text-lg font-bold">{t.orderDetails}</h2>
        <div className="mt-3"><SizeChips sizes={r.sizes} /></div>
        {r.fabric && <p className="mt-3 text-sm"><span className="text-muted">{t.fabric}:</span> <span className="font-semibold">{r.fabric}</span></p>}
        {r.roster.length > 0 && r.approval_status !== "waiting" && (
          <details className="mt-4">
            <summary className="cursor-pointer text-sm font-bold text-cyan">{t.showRoster} ({r.roster.length})</summary>
            <div className="mt-3"><RosterTable roster={r.roster} /></div>
          </details>
        )}
        {r.approval_status !== "waiting" && r.mockups.length > 0 && (
          <div className="mt-5"><p className={labelCls}>{t.artwork}</p><Mockups paths={r.mockups} /></div>
        )}
      </section>

      <section className={cardCls}>
        <h2 className="text-lg font-bold">{t.payment}</h2>
        <dl className="mt-3 grid grid-cols-3 gap-3 text-sm">
          <div><dt className="text-muted">{t.total}</dt><dd className="font-mono font-bold tabular">{rm(r.price_total)}</dd></div>
          <div><dt className="text-muted">{t.paid}</dt><dd className="font-mono font-bold tabular text-ok">{rm(r.paid)}</dd></div>
          <div><dt className="text-muted">{t.balance}</dt><dd className={`font-mono font-bold tabular ${paidUp ? "text-ok" : "text-warn"}`}>{rm(balance)}</dd></div>
        </dl>
        {!paidUp && r.stage !== "ready" && <p className="mt-3 text-sm text-muted">{t.balanceBeforeCollect}</p>}
        {r.stage !== "ready" && contact}
      </section>
    </div>
  );
}

/** Four steps; the ink fill runs up to the current one and the current dot "bleeds". */
function Stepper({ r }: { r: PublicOrder }) {
  const { t } = useI18n();
  const cur: Stage = r.stage === "delivered" ? "ready" : r.stage;
  const curRank = rank(cur);
  const done = (s: Stage) => r.stage === "delivered" || rank(s) < curRank;
  const when: Record<string, string | null> = { artwork: r.done.artwork, printing: r.done.printing, production: r.done.production, ready: r.done.delivered };
  const fillPct = ((curRank - 1) / (FLOW.length - 1)) * 100;
  const sub = (s: Stage) => {
    if (s === "artwork" && cur === "artwork") return t.approvalState[r.approval_status];
    if (s === cur && s !== "ready") return r.stage_status === "in_progress" ? t.inProgress : t.queued;
    if (done(s) && when[s]) return fmtDate(when[s]);
    return "";
  };

  return (
    <div>
      {/* phone: vertical */}
      <ol className="relative grid gap-5 sm:hidden">
        <span className="absolute bottom-3 left-[21px] top-3 w-1 rounded-full bg-surface-2" aria-hidden="true" />
        <span className="ink-fill-y absolute left-[21px] top-3 w-1" style={{ height: `calc(${fillPct}% - ${fillPct ? 12 : 0}px)` }} aria-hidden="true" />
        {FLOW.map((s) => <StepDot key={s} s={s} state={done(s) ? "done" : s === cur ? "now" : "next"} label={t.stage[s]} sub={sub(s)} row />)}
      </ol>
      {/* tablet+: horizontal */}
      <ol className="relative hidden grid-cols-4 sm:grid">
        <span className="absolute left-[12.5%] right-[12.5%] top-[21px] h-1 rounded-full bg-surface-2" aria-hidden="true" />
        <span className="ink-fill-x absolute left-[12.5%] top-[21px] h-1" style={{ width: `${fillPct * 0.75}%` }} aria-hidden="true" />
        {FLOW.map((s) => <StepDot key={s} s={s} state={done(s) ? "done" : s === cur ? "now" : "next"} label={t.stage[s]} sub={sub(s)} />)}
      </ol>
    </div>
  );
}

function StepDot({ s, state, label, sub, row = false }: { s: Stage; state: "done" | "now" | "next"; label: string; sub: string; row?: boolean }) {
  const dot = state === "done"
    ? "bg-ink text-bg border-ink dark:bg-white dark:text-key dark:border-white"
    : state === "now" ? `bg-surface border-current ${STAGE_TEXT[s]} bleed` : "bg-surface text-muted border-line";
  return (
    <li className={`relative z-10 flex ${row ? "items-center gap-3" : "flex-col items-center text-center"}`} aria-current={state === "now" ? "step" : undefined}>
      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 ${dot}`}>
        <Icon name={state === "done" ? "check" : STAGE_ICON[s]} className="h-5 w-5" />
      </span>
      <span className={row ? "" : "mt-2 px-1"}>
        <span className={`block text-sm font-bold ${state === "next" ? "text-muted" : "text-ink"}`}>{label}</span>
        {sub && <span className={`block text-xs ${state === "now" ? `font-semibold ${STAGE_TEXT[s]}` : "text-muted"}`}>{sub}</span>}
      </span>
    </li>
  );
}

function Approval({ r, reload }: { r: PublicOrder; reload: () => void }) {
  const { t } = useI18n();
  const [phone, setPhone] = useState("");
  const [mode, setMode] = useState<"idle" | "changes">("idle");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "ok" | "danger"; text: string } | null>(null);

  if (r.approval_status === "changes") {
    return <Notice tone="info" icon="edit"><p>{t.changesSent}</p>{r.approval_note && <p className="mt-1 font-normal italic">"{r.approval_note}"</p>}</Notice>;
  }
  if (r.approval_status !== "waiting") return null;

  async function decide(approve: boolean) {
    setBusy(true); setMsg(null);
    try {
      const d = await customerDecide(r.tracking_no, phone, approve, note);
      if ("status" in d) {
        setMsg({ tone: "ok", text: d.status === "approved" ? t.approvedThanks : t.changesThanks });
        setTimeout(reload, 900);
      } else {
        setMsg({ tone: "danger", text: t.decideErr[d.error] });
      }
    } catch { setMsg({ tone: "danger", text: t.serviceDown }); }
    finally { setBusy(false); }
  }

  return (
    <section className={`${cardCls} border-cyan/50`}>
      <div className="flex items-center gap-2 text-cyan"><Icon name="palette" /><span className="text-xs font-bold uppercase tracking-wider">{t.round} {r.approval_round}</span></div>
      <h2 className="mt-1 text-xl font-bold">{t.approveTitle}</h2>
      <p className="mt-1 text-sm text-muted">{t.approveLead}</p>
      <div className="mt-4"><Mockups paths={r.mockups} size="lg" /></div>
      {r.roster.length > 0 && (
        <details className="mt-4" open>
          <summary className="cursor-pointer text-sm font-bold text-cyan">{t.checkRoster} ({r.roster.length})</summary>
          <div className="mt-3"><RosterTable roster={r.roster} /></div>
        </details>
      )}
      <ul className="mt-4 grid gap-1.5 text-sm text-muted">
        {t.approveChecklist.map((c) => <li key={c} className="flex gap-2"><Icon name="check" className="mt-0.5 h-4 w-4 shrink-0 text-cyan" />{c}</li>)}
      </ul>
      <div className="mt-5 grid gap-3">
        <div>
          <label className={labelCls} htmlFor="ph">{t.yourPhone}</label>
          <input id="ph" className={inputCls} inputMode="tel" autoComplete="tel" placeholder="012-345 6789" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <p className="mt-1 text-xs text-muted">{t.phoneWhy}</p>
        </div>
        {mode === "changes" && (
          <div>
            <label className={labelCls} htmlFor="nt">{t.whatToChange}</label>
            <textarea id="nt" rows={3} className={`${inputCls} py-3`} value={note} onChange={(e) => setNote(e.target.value)} placeholder={t.changePlaceholder} />
          </div>
        )}
        {msg && <Notice tone={msg.tone} icon={msg.tone === "ok" ? "check" : "warning"}>{msg.text}</Notice>}
        <div className="grid gap-2 sm:grid-cols-2">
          {mode === "idle" ? <>
            <button className={okBtnCls} disabled={busy || phone.replace(/\D/g, "").length < 9} onClick={() => decide(true)}><Icon name="check" />{t.approveBtn}</button>
            <button className={ghostBtnCls} disabled={busy} onClick={() => setMode("changes")}><Icon name="edit" />{t.requestChanges}</button>
          </> : <>
            <button className={btnCls} disabled={busy || phone.replace(/\D/g, "").length < 9 || !note.trim()} onClick={() => decide(false)}>{t.sendChanges}</button>
            <button className={ghostBtnCls} disabled={busy} onClick={() => setMode("idle")}>{t.cancel}</button>
          </>}
        </div>
      </div>
    </section>
  );
}

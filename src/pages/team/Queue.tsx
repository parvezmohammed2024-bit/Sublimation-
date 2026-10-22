import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "../../components/Icon";
import { LangToggle, Logo, ThemeToggle, btnCls, ghostBtnCls, inputCls, labelCls } from "../../components/Shell";
import { Meter, Mockups, Modal, Notice, RosterTable, SizeChips, StageChip } from "../../components/Bits";
import { pinInputCls } from "./Login";
import { useI18n } from "../../lib/i18n";
import { REJECT_REASONS, STAGE_BG } from "../../lib/stages";
import { TONE_CLASS, daysLeft, deadlineTone, fmtDate, fmtDateTime } from "../../lib/format";
import {
  SessionExpired, clearTeamSession, loadTeamSession, saveTeamSession, teamDone, teamLog, teamLogout,
  teamQueue, teamSetPin, teamStart, teamUndo, type TeamSession,
} from "../../lib/supabase";
import type { LogEntry, QueueData, Step, TeamOrder } from "../../lib/types";

type LogReq = { order: TeamOrder; step: Step; max: number; suggest: number };

export default function TeamQueue() {
  const { t } = useI18n();
  const nav = useNavigate();
  const [session, setSession] = useState<TeamSession | null>(loadTeamSession);
  const [data, setData] = useState<QueueData | null>(null);
  const [err, setErr] = useState("");
  const [tab, setTab] = useState<"mine" | "all">("mine");
  const [logReq, setLogReq] = useState<LogReq | null>(null);
  const [pinOpen, setPinOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toast, setToast] = useState("");
  const seen = useRef<Set<string> | null>(null);
  const [fresh, setFresh] = useState<Set<string>>(new Set());

  const out = useCallback(() => { clearTeamSession(); nav("/team/login", { replace: true }); }, [nav]);

  const load = useCallback(async () => {
    if (!session) return;
    try {
      const q = await teamQueue(session.token);
      // highlight jobs that arrived since the last refresh
      const ids = new Set(q.orders.map((o) => o.id));
      if (seen.current) {
        const added = [...ids].filter((id) => !seen.current!.has(id));
        if (added.length) { setFresh(new Set(added)); setToast(t.newJobs.replace("{n}", String(added.length))); }
      }
      seen.current = ids;
      setData(q); setErr("");
    } catch (e) {
      if (e instanceof SessionExpired) out();
      else setErr(t.serviceDown);
    }
  }, [session, out, t]);

  useEffect(() => { if (!session) out(); }, [session, out]);
  useEffect(() => {
    load();
    const id = setInterval(load, 20_000);
    const vis = () => document.visibilityState === "visible" && load();
    document.addEventListener("visibilitychange", vis);
    return () => { clearInterval(id); document.removeEventListener("visibilitychange", vis); };
  }, [load]);
  useEffect(() => { if (toast) { const id = setTimeout(() => setToast(""), 4000); return () => clearTimeout(id); } }, [toast]);

  if (!session) return null;
  const team = session.member.team;
  const isPrint = team === "printing";

  async function act(id: string, fn: () => Promise<void>) {
    setBusyId(id); setErr("");
    try { await fn(); await load(); }
    catch (e) { if (e instanceof SessionExpired) out(); else setErr((e as Error).message); }
    finally { setBusyId(null); }
  }

  const mine = data?.orders ?? [];
  const own = mine.filter((o) => o.stage === team);
  const reprints = mine.filter((o) => o.stage !== team);

  return (
    <div className="min-h-dvh">
      <header className={`text-white ${isPrint ? "print-head" : "heat-wave"}`}>
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-2 px-4 pt-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-black/25"><Logo className="h-9 w-9" /></span>
          <div className="flex shrink-0 items-center gap-1.5">
            <LangToggle /><ThemeToggle />
            <button onClick={() => setPinOpen(true)} aria-label={t.changePin} title={t.changePin}
              className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/15 bg-white/5 hover:bg-white/15"><Icon name="key" /></button>
            <button onClick={async () => { await teamLogout(session.token); out(); }} aria-label={t.signOut} title={t.signOut}
              className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/15 bg-white/5 hover:bg-white/15"><Icon name="logout" /></button>
          </div>
        </div>
        <div className="mx-auto w-full max-w-3xl px-4 pt-3">
          <h1 className="font-display text-2xl font-bold leading-tight">{t.teamName[team]}</h1>
          <p className="text-sm text-white/85">{session.member.name}</p>
        </div>
        <div className="mx-auto flex w-full max-w-3xl gap-1 px-4 pt-4">
          {(["mine", "all"] as const).map((k) => (
            <button key={k} onClick={() => setTab(k)} aria-pressed={tab === k}
              className={`min-h-11 flex-1 rounded-t-xl px-3 text-sm font-bold ${tab === k ? "bg-bg text-ink" : "text-white/85 hover:bg-white/10"}`}>
              {k === "mine" ? `${t.myJobs} (${mine.length})` : `${t.allJobs} (${(data?.coming.length ?? 0) + own.length})`}
            </button>
          ))}
        </div>
      </header>
      <div className="cmyk-bar" aria-hidden="true" />

      {toast && <div className="sticky top-2 z-30 mx-auto mt-2 w-fit rounded-full bg-key px-4 py-2 text-sm font-bold text-white shadow-lg arrive dark:bg-white dark:text-key">{toast}</div>}

      <main className="mx-auto w-full max-w-3xl px-4 pb-16 pt-4">
        {session.member.must_set_pin && data?.member.must_set_pin !== false && (
          <div className="mb-4"><Notice tone="info" icon="key">
            <p>{t.defaultPinNotice}</p>
            <button onClick={() => setPinOpen(true)} className="mt-2 underline">{t.changePin}</button>
          </Notice></div>
        )}
        {err && <div className="mb-4"><Notice tone="danger">{err}</Notice></div>}
        {!data && !err && <p className="text-muted">{t.loading}</p>}

        {data && tab === "mine" && (
          <div className="grid gap-4">
            {reprints.map((o) => (
              <ReprintCard key={o.id} o={o} log={data.log.filter((l) => l.order_id === o.id)} busy={busyId === o.id}
                onLog={() => setLogReq({ order: o, step: "reprinted", max: o.sums.reprint_pending, suggest: o.sums.reprint_pending })} />
            ))}
            {own.map((o) => (
              <JobCard key={o.id} o={o} team={team} fresh={fresh.has(o.id)} busy={busyId === o.id}
                log={data.log.filter((l) => l.order_id === o.id)}
                onStart={() => act(o.id, () => teamStart(session.token, o.id))}
                onDone={() => act(o.id, () => teamDone(session.token, o.id))}
                onUndo={(entry) => act(o.id, () => teamUndo(session.token, entry))}
                onLog={(step, max, suggest) => setLogReq({ order: o, step, max, suggest })} />
            ))}
            {mine.length === 0 && (
              <div className="sheet rounded-2xl border border-line p-8 text-center">
                <Icon name={isPrint ? "print" : "press"} className="mx-auto h-10 w-10 text-muted" />
                <p className="mt-3 font-display text-lg font-bold">{t.queueEmpty}</p>
                <p className="mt-1 text-sm text-muted">{t.queueEmptyLead}</p>
              </div>
            )}
          </div>
        )}

        {data && tab === "all" && (
          <ul className="grid gap-2">
            {[...own.map((o) => ({ ...o })), ...data.coming].sort((a, b) => a.deadline.localeCompare(b.deadline)).map((o) => (
              <li key={o.id} className="rounded-xl border border-line bg-surface p-3.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-mono text-sm font-bold">{o.tracking_no}</span>
                  <StageChip stage={o.stage} label={o.stage === "artwork" ? t.approvalState[o.approval_status] : undefined} />
                </div>
                <p className="mt-1 font-semibold">{o.customer_name} · {o.item_type} · <span className="tabular">{o.total_qty} {t.pcs}</span></p>
                <div className="mt-1 flex flex-wrap justify-between gap-2 text-sm">
                  <span className={TONE_CLASS[deadlineTone(o)]}>{t.due} {fmtDate(o.deadline)}</span>
                  {o.stage !== "artwork" && <span className="font-mono text-muted tabular">P {o.sums.printed} · H {o.sums.pressed} · QC {o.sums.passed}</span>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>

      {logReq && <LogModal req={logReq} onClose={() => setLogReq(null)} onSave={async (qty, reason) => {
        const r = logReq; setLogReq(null);
        await act(r.order.id, () => teamLog(session.token, r.order.id, r.step, qty, reason));
      }} />}
      {pinOpen && <PinModal onClose={() => setPinOpen(false)} onSave={async (pin) => {
        await teamSetPin(session.token, pin);
        const next = { ...session, member: { ...session.member, must_set_pin: pin === session.member.mobile.slice(-4) } };
        saveTeamSession(next); setSession(next); setPinOpen(false); setToast(t.pinSaved); load();
      }} />}
    </div>
  );
}

function JobHead({ o, badge }: { o: TeamOrder; badge?: React.ReactNode }) {
  const { t } = useI18n();
  const d = daysLeft(o.deadline);
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-mono text-sm font-bold tracking-wide text-muted">{o.tracking_no}</span>
        <span className="flex items-center gap-2">{badge}
          <span className={`inline-flex items-center gap-1 text-sm ${TONE_CLASS[deadlineTone(o)]}`}><Icon name="calendar" className="h-4 w-4" />
            {fmtDate(o.deadline)} · {d < 0 ? t.daysLate.replace("{n}", String(-d)) : d === 0 ? t.today : d === 1 ? t.oneDayLeft : t.daysLeft.replace("{n}", String(d))}</span>
        </span>
      </div>
      <h3 className="mt-1 text-xl font-bold">{o.customer_name}</h3>
      <p className="text-ink">{o.item_type} · <span className="font-bold tabular">{o.total_qty} {t.pcs}</span>
        {o.fabric && <span className="text-muted"> · {o.fabric}</span>}
        <span className="text-muted"> · {t.printType[o.print_type]}</span></p>
    </>
  );
}

function JobInfo({ o }: { o: TeamOrder }) {
  const { t } = useI18n();
  const [roster, setRoster] = useState(false);
  return (
    <>
      <div className="mt-3"><SizeChips sizes={o.sizes} /></div>
      {(o.mockups.length > 0 || o.roster.length > 0) && (
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <Mockups paths={o.mockups} size="sm" />
          {o.roster.length > 0 && <button onClick={() => setRoster(true)} className={ghostBtnCls}><Icon name="list" />{t.roster} ({o.roster.length})</button>}
        </div>
      )}
      {o.notes && <p className="mt-3 whitespace-pre-line rounded-lg bg-yellow/15 p-3 text-sm"><span className="font-bold">{t.notes}: </span>{o.notes}</p>}
      {roster && <Modal title={`${t.roster} · ${o.tracking_no}`} onClose={() => setRoster(false)} wide><RosterTable roster={o.roster} /></Modal>}
    </>
  );
}

function EntryList({ log, onUndo }: { log: LogEntry[]; onUndo?: (id: string) => void }) {
  const { t } = useI18n();
  if (!log.length) return null;
  const canUndo = (l: LogEntry) => l.mine && Date.now() - new Date(l.created_at).getTime() < 2 * 3600_000;
  return (
    <details className="mt-4 rounded-lg border border-line">
      <summary className="cursor-pointer px-3 py-2 text-sm font-bold text-muted">{t.entries} ({log.length})</summary>
      <ul className="divide-y divide-line">
        {log.slice(0, 20).map((l) => (
          <li key={l.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
            <span><span className="font-bold">{t.step[l.step]}</span> <span className="font-mono tabular">{l.qty}</span>
              {l.reason && <span className="text-muted"> · {t.reason[l.reason as keyof typeof t.reason] ?? l.reason}</span>}
              <span className="block text-xs text-muted">{l.by_name} · {fmtDateTime(l.created_at)}</span></span>
            {onUndo && canUndo(l) && <button onClick={() => onUndo(l.id)} className="inline-flex min-h-9 items-center gap-1 rounded-md border border-line px-2.5 text-xs font-bold hover:bg-surface-2"><Icon name="undo" className="h-4 w-4" />{t.undo}</button>}
          </li>
        ))}
      </ul>
    </details>
  );
}

function JobCard({ o, team, fresh, busy, log, onStart, onDone, onUndo, onLog }: {
  o: TeamOrder; team: "printing" | "production"; fresh: boolean; busy: boolean; log: LogEntry[];
  onStart: () => void; onDone: () => void; onUndo: (id: string) => void; onLog: (step: Step, max: number, suggest: number) => void;
}) {
  const { t } = useI18n();
  const s = o.sums;
  const isPrint = team === "printing";
  const started = o.stage_status === "in_progress";
  const remaining = (n: number) => Math.max(o.total_qty - n, 0);
  const doneBlock = !isPrint && (s.reprint_pending > 0
    ? t.waitReprint.replace("{n}", String(s.reprint_pending))
    : s.passed < o.total_qty ? t.qcShort.replace("{a}", String(s.passed)).replace("{b}", String(o.total_qty)) : "");
  const accent = isPrint ? "bg-magenta" : "bg-heat";

  return (
    <article className={`sheet rounded-2xl border border-line p-5 shadow-sm ${fresh ? "arrive ring-2 ring-cyan" : ""}`}>
      <JobHead o={o} badge={fresh ? <span className="rounded-full bg-cyan px-2 py-0.5 text-xs font-bold text-white">{t.newBadge}</span> : undefined} />
      <JobInfo o={o} />

      {!started ? (
        <button disabled={busy} onClick={onStart} className={`mt-5 inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-xl ${accent} text-base font-bold uppercase tracking-wider text-white hover:brightness-110 disabled:opacity-50`}>
          <Icon name={isPrint ? "print" : "flame"} />{isPrint ? t.startPrinting : t.startPressing}
        </button>
      ) : (
        <div className="mt-5 grid gap-4 rounded-xl border border-line bg-surface-2/60 p-4">
          <p className="inline-flex items-center gap-2 text-sm font-bold"><span className={`h-2.5 w-2.5 rounded-full ${STAGE_BG[o.stage]} animate-pulse`} />{t.inProgress}</p>
          {isPrint ? (
            <>
              <Meter label={t.step.printed} value={s.printed} total={o.total_qty} color="bg-magenta" />
              <button disabled={busy} onClick={() => onLog("printed", o.total_qty * 2, remaining(s.printed) || 1)} className={`${btnCls} w-full`}><Icon name="plus" />{t.logPrinted}</button>
            </>
          ) : (
            <>
              <Meter label={t.step.pressed} value={Math.min(s.pressed, o.total_qty)} total={o.total_qty} color="bg-heat" />
              <Meter label={t.step.qc_pass} value={s.passed} total={o.total_qty} color="bg-ok" />
              {s.rejected > 0 && <p className="text-sm font-semibold text-danger">{t.rejectedSoFar.replace("{n}", String(s.rejected))}{s.reprint_pending > 0 && ` · ${t.waitReprint.replace("{n}", String(s.reprint_pending))}`}</p>}
              <div className="grid grid-cols-3 gap-2">
                <button disabled={busy} onClick={() => onLog("pressed", o.total_qty * 2, remaining(s.pressed) || 1)} className="inline-flex min-h-14 flex-col items-center justify-center rounded-lg bg-heat px-2 text-xs font-bold uppercase text-white hover:brightness-110 disabled:opacity-50"><Icon name="flame" />{t.step.pressed}</button>
                <button disabled={busy || s.passed >= o.total_qty} onClick={() => onLog("qc_pass", remaining(s.passed), remaining(s.passed))} className="inline-flex min-h-14 flex-col items-center justify-center rounded-lg bg-ok px-2 text-xs font-bold uppercase text-white hover:brightness-110 disabled:opacity-50 dark:text-key"><Icon name="shield" />{t.qcPassShort}</button>
                <button disabled={busy} onClick={() => onLog("qc_reject", o.total_qty, 1)} className="inline-flex min-h-14 flex-col items-center justify-center rounded-lg bg-danger px-2 text-xs font-bold uppercase text-white hover:brightness-110 disabled:opacity-50 dark:text-key"><Icon name="close" />{t.qcRejectShort}</button>
              </div>
            </>
          )}
          {doneBlock && s.reprint_pending === 0 && <p className="text-sm text-muted">{doneBlock}</p>}
          <button disabled={busy || !!doneBlock} onClick={onDone}
            className="inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-xl border-2 border-ink bg-surface text-base font-bold uppercase tracking-wider text-ink hover:bg-ink hover:text-bg disabled:opacity-40">
            <Icon name="check" />{isPrint ? t.donePrinting : t.doneQc}
          </button>
        </div>
      )}
      <EntryList log={log} onUndo={onUndo} />
    </article>
  );
}

function ReprintCard({ o, log, busy, onLog }: { o: TeamOrder; log: LogEntry[]; busy: boolean; onLog: () => void }) {
  const { t } = useI18n();
  const rejects = log.filter((l) => l.step === "qc_reject");
  return (
    <article className="sheet rounded-2xl border-2 border-danger/50 p-5 shadow-sm arrive">
      <JobHead o={o} badge={<span className="rounded-full bg-danger px-2 py-0.5 text-xs font-bold text-white dark:text-key">{t.reprint}</span>} />
      <div className="mt-3"><Notice tone="danger" icon="refresh">
        <p>{t.reprintNeeded.replace("{n}", String(o.sums.reprint_pending))}</p>
        {rejects.length > 0 && <p className="mt-1 font-normal">{rejects.map((r) => `${r.qty} × ${t.reason[r.reason as keyof typeof t.reason] ?? r.reason}`).join(", ")}</p>}
      </Notice></div>
      <JobInfo o={o} />
      <button disabled={busy} onClick={onLog} className="mt-4 inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-magenta text-base font-bold uppercase tracking-wider text-white hover:brightness-110 disabled:opacity-50">
        <Icon name="print" />{t.logReprinted}
      </button>
    </article>
  );
}

function LogModal({ req, onClose, onSave }: { req: LogReq; onClose: () => void; onSave: (qty: number, reason?: string) => void }) {
  const { t } = useI18n();
  const [qty, setQty] = useState(Math.max(1, Math.min(req.suggest, req.max)));
  const [reason, setReason] = useState<string>("");
  const [other, setOther] = useState("");
  const isReject = req.step === "qc_reject";
  const valid = qty >= 1 && qty <= req.max && (!isReject || (reason && (reason !== "other" || other.trim())));
  const step = (d: number) => setQty((q) => Math.min(req.max, Math.max(1, q + d)));
  return (
    <Modal title={`${t.step[req.step]} · ${req.order.tracking_no}`} onClose={onClose}>
      <p className="text-sm text-muted">{req.order.customer_name} · {req.order.item_type} · {req.order.total_qty} {t.pcs}</p>
      <label className={`${labelCls} mt-4`} htmlFor="qty">{t.howMany}</label>
      <div className="flex items-center gap-2">
        <button onClick={() => step(-1)} className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-line text-ink hover:bg-surface-2" aria-label="-1"><Icon name="minus" /></button>
        <input id="qty" className={`${inputCls} min-h-14 text-center font-mono text-2xl font-bold`} inputMode="numeric" value={qty}
          onChange={(e) => setQty(Number(e.target.value.replace(/\D/g, "")) || 0)} />
        <button onClick={() => step(1)} className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-line text-ink hover:bg-surface-2" aria-label="+1"><Icon name="plus" /></button>
      </div>
      {req.suggest > 1 && qty !== Math.min(req.suggest, req.max) && (
        <button onClick={() => setQty(Math.min(req.suggest, req.max))} className="mt-2 text-sm font-bold text-cyan">{t.useAll.replace("{n}", String(Math.min(req.suggest, req.max)))}</button>
      )}
      {qty > req.max && <p className="mt-2 text-sm text-danger">{t.maxIs.replace("{n}", String(req.max))}</p>}
      {isReject && (
        <>
          <p className={`${labelCls} mt-4`}>{t.rejectReason}</p>
          <div className="flex flex-wrap gap-2">
            {REJECT_REASONS.map((r) => (
              <button key={r} onClick={() => setReason(r)} aria-pressed={reason === r}
                className={`min-h-11 rounded-full border px-3.5 text-sm font-semibold ${reason === r ? "border-danger bg-danger text-white dark:text-key" : "border-line bg-surface hover:bg-surface-2"}`}>
                {t.reason[r]}
              </button>
            ))}
          </div>
          {reason === "other" && <input className={`${inputCls} mt-2`} placeholder={t.describe} value={other} onChange={(e) => setOther(e.target.value)} />}
        </>
      )}
      <button disabled={!valid} onClick={() => onSave(qty, isReject ? (reason === "other" ? other.trim() : reason) : undefined)} className={`${btnCls} mt-5 w-full`}>{t.save}</button>
    </Modal>
  );
}

function PinModal({ onClose, onSave }: { onClose: () => void; onSave: (pin: string) => Promise<void> }) {
  const { t } = useI18n();
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const d = (v: string) => v.replace(/\D/g, "").slice(0, 4);
  return (
    <Modal title={t.changePin} onClose={onClose}>
      <p className="mb-3 text-sm text-muted">{t.setPinHelp}</p>
      <div className="grid gap-3">
        <input className={pinInputCls} inputMode="numeric" type="password" autoComplete="new-password" placeholder={t.newPin} value={a} onChange={(e) => setA(d(e.target.value))} />
        <input className={pinInputCls} inputMode="numeric" type="password" autoComplete="new-password" placeholder={t.confirmPin} value={b} onChange={(e) => setB(d(e.target.value))} />
        {err && <Notice tone="danger">{err}</Notice>}
        <button className={btnCls} disabled={busy || a.length !== 4 || b.length !== 4} onClick={async () => {
          if (a !== b) { setErr(t.pinMismatch); return; }
          setBusy(true); setErr("");
          try { await onSave(a); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
        }}>{t.savePin}</button>
      </div>
    </Modal>
  );
}

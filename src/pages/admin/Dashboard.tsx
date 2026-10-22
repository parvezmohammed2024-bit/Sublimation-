import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Icon, type IconName } from "../../components/Icon";
import { Notice, StageChip } from "../../components/Bits";
import { accentBtnCls, inputCls } from "../../components/Shell";
import { useI18n } from "../../lib/i18n";
import { loadBoard, type BoardOrder } from "../../lib/admin";
import { errMsg } from "../../lib/supabase";
import { TONE_CLASS, daysLeft, deadlineTone, fmtDate, rm } from "../../lib/format";
import type { Stage } from "../../lib/types";

type Filter = "active" | Stage | "all";

export default function Dashboard() {
  const { t } = useI18n();
  const [orders, setOrders] = useState<BoardOrder[] | null>(null);
  const [filter, setFilter] = useState<Filter>("active");
  const [q, setQ] = useState("");
  const [err, setErr] = useState("");

  const closed = filter === "all" || filter === "delivered" || filter === "cancelled";
  useEffect(() => {
    let alive = true;
    const run = () => loadBoard(closed).then((o) => alive && setOrders(o)).catch((e) => alive && setErr(errMsg(e)));
    run();
    const id = setInterval(run, 30_000);
    return () => { alive = false; clearInterval(id); };
  }, [closed]);

  const active = useMemo(() => (orders ?? []).filter((o) => !["delivered", "cancelled"].includes(o.stage)), [orders]);
  const count = (s: Stage) => active.filter((o) => o.stage === s).length;
  const overdue = active.filter((o) => deadlineTone(o) === "overdue").length;
  const readyUnpaid = active.filter((o) => o.stage === "ready" && o.balance > 0.004);
  const readyPaid = active.filter((o) => o.stage === "ready" && o.balance <= 0.004);
  const changes = active.filter((o) => o.stage === "artwork" && o.approval_status === "changes");
  const notSent = active.filter((o) => o.stage === "artwork" && o.approval_status === "not_sent");
  const waiting = active.filter((o) => o.stage === "artwork" && o.approval_status === "waiting");
  const reprints = active.filter((o) => o.sums.reprint_pending > 0);

  const list = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (orders ?? [])
      .filter((o) => filter === "all" ? true : filter === "active" ? !["delivered", "cancelled"].includes(o.stage) : o.stage === filter)
      .filter((o) => !term || [o.tracking_no, o.customer_name, o.item_type, o.customer_phone ?? ""].some((v) => v.toLowerCase().includes(term)));
  }, [orders, filter, q]);

  const tiles: { stage: Stage; icon: IconName; color: string; n: number; sub: string }[] = [
    { stage: "artwork", icon: "palette", color: "text-cyan", n: count("artwork"), sub: `${waiting.length} ${t.waitingShort}` },
    { stage: "printing", icon: "print", color: "text-magenta", n: count("printing"), sub: t.teamName.printing },
    { stage: "production", icon: "press", color: "text-heat", n: count("production"), sub: t.teamName.production },
    { stage: "ready", icon: "box", color: "text-ok", n: count("ready"), sub: `${readyUnpaid.length} ${t.unpaidShort}` },
  ];

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">{t.dashboard}</h1>
          <p className="text-sm text-muted">{active.length} {t.activeJobs}{overdue > 0 && <span className="font-bold text-danger"> · {overdue} {t.overdue}</span>}</p>
        </div>
        <Link to="/admin/orders/new" className={accentBtnCls}><Icon name="plus" />{t.newJob}</Link>
      </div>
      {err && <div className="mt-4"><Notice tone="danger">{err}</Notice></div>}

      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map((x) => (
          <button key={x.stage} onClick={() => setFilter(filter === x.stage ? "active" : x.stage)} aria-pressed={filter === x.stage}
            className={`sheet rounded-2xl border p-4 text-left transition hover:-translate-y-0.5 ${filter === x.stage ? "border-ink" : "border-line"}`}>
            <span className={`flex items-center gap-2 text-xs font-bold uppercase tracking-wider ${x.color}`}><Icon name={x.icon} className="h-4 w-4" />{t.stage[x.stage]}</span>
            <span className="mt-2 block font-display text-4xl font-bold tabular">{x.n}</span>
            <span className="block truncate text-xs text-muted">{x.sub}</span>
          </button>
        ))}
      </div>

      {(changes.length + notSent.length + readyPaid.length + readyUnpaid.length + reprints.length) > 0 && (
        <section className="mt-6">
          <h2 className="text-lg font-bold">{t.needsAction}</h2>
          <ul className="mt-2 grid grid-cols-1 gap-2">
            {changes.map((o) => <ActionRow key={o.id} o={o} tone="text-cyan" icon="edit" text={t.actChanges} />)}
            {notSent.map((o) => <ActionRow key={o.id} o={o} tone="text-cyan" icon="palette" text={t.actSendMockup} />)}
            {reprints.map((o) => <ActionRow key={o.id} o={o} tone="text-danger" icon="refresh" text={t.actReprint.replace("{n}", String(o.sums.reprint_pending))} />)}
            {readyPaid.map((o) => <ActionRow key={o.id} o={o} tone="text-ok" icon="truck" text={t.actDeliver} />)}
            {readyUnpaid.map((o) => <ActionRow key={o.id} o={o} tone="text-warn" icon="money" text={`${t.actCollect} ${rm(o.balance)}`} />)}
          </ul>
        </section>
      )}

      <section className="mt-6">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-0 flex-1 basis-60">
            <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" />
            <input className={`${inputCls} pl-10`} placeholder={t.searchJobs} value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        </div>
        <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto pb-1">
          {(["active", "artwork", "printing", "production", "ready", "delivered", "cancelled", "all"] as Filter[]).map((f) => (
            <button key={f} onClick={() => setFilter(f)} aria-pressed={filter === f}
              className={`min-h-10 shrink-0 rounded-full border px-3.5 text-sm font-semibold ${filter === f ? "border-ink bg-ink text-bg" : "border-line bg-surface text-muted hover:text-ink"}`}>
              {f === "active" ? t.active : f === "all" ? t.all : t.stage[f]}
            </button>
          ))}
        </div>

        {!orders && !err && <p className="mt-4 text-muted">{t.loading}</p>}
        {orders && list.length === 0 && <p className="mt-6 text-center text-muted">{t.noJobs}</p>}
        <ul className="mt-3 grid gap-2.5 md:grid-cols-2">
          {list.map((o) => <OrderRow key={o.id} o={o} />)}
        </ul>
      </section>
    </div>
  );
}

function ActionRow({ o, tone, icon, text }: { o: BoardOrder; tone: string; icon: IconName; text: string }) {
  return (
    <li>
      <Link to={`/admin/orders/${o.id}`} className="flex items-center gap-3 rounded-xl border border-line bg-surface p-3 hover:border-ink">
        <Icon name={icon} className={`h-5 w-5 shrink-0 ${tone}`} />
        <span className="min-w-0 flex-1">
          <span className={`block text-sm font-bold ${tone}`}>{text}</span>
          <span className="block truncate text-sm text-muted"><span className="font-mono">{o.tracking_no}</span> · {o.customer_name} · {o.item_type}</span>
        </span>
        <Icon name="right" className="h-4 w-4 shrink-0 text-muted" />
      </Link>
    </li>
  );
}

function OrderRow({ o }: { o: BoardOrder }) {
  const { t } = useI18n();
  const d = daysLeft(o.deadline);
  const showProgress = o.stage === "printing" || o.stage === "production";
  return (
    <li>
      <Link to={`/admin/orders/${o.id}`} className="sheet block h-full rounded-2xl border border-line p-4 hover:border-ink">
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-sm font-bold">{o.tracking_no}</span>
          <StageChip stage={o.stage} label={o.stage === "artwork" ? t.approvalState[o.approval_status] : undefined} />
        </div>
        <p className="mt-2 truncate font-semibold">{o.customer_name}</p>
        <p className="truncate text-sm text-muted">{o.item_type} · <span className="tabular">{o.total_qty} {t.pcs}</span></p>
        {showProgress && (
          <div className="mt-2 grid grid-cols-3 gap-1" title={`${t.step.printed} ${o.sums.printed} · ${t.step.pressed} ${o.sums.pressed} · QC ${o.sums.passed}/${o.total_qty}`}>
            {([["bg-magenta", o.sums.printed], ["bg-heat", o.sums.pressed], ["bg-ok", o.sums.passed]] as const).map(([c, n]) => (
              <div key={c} className="h-1.5 overflow-hidden rounded-full bg-surface-2">
                <div className={`h-full ${c}`} style={{ width: `${Math.min(100, (n / o.total_qty) * 100)}%` }} />
              </div>
            ))}
          </div>
        )}
        <div className="mt-2 flex items-center justify-between gap-2 text-sm">
          <span className={TONE_CLASS[deadlineTone(o)]}>{fmtDate(o.deadline)}{deadlineTone(o) === "overdue" && ` · ${t.daysLate.replace("{n}", String(-d))}`}</span>
          <span className={`font-mono font-bold tabular ${o.balance > 0.004 ? "text-warn" : "text-ok"}`}>{o.balance > 0.004 ? rm(o.balance) : t.paidShort}</span>
        </div>
      </Link>
    </li>
  );
}

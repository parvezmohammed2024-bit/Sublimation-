import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Icon } from "../../components/Icon";
import { Notice } from "../../components/Bits";
import { btnCls, ghostBtnCls, inputCls, labelCls, panelCls } from "../../components/Shell";
import { useI18n } from "../../lib/i18n";
import { errMsg, supabase } from "../../lib/supabase";
import { fmtPhone } from "../../lib/format";
import { TEAMS } from "../../lib/stages";
import type { Member, Team } from "../../lib/types";

export default function TeamSettings() {
  const { t } = useI18n();
  const [members, setMembers] = useState<Member[] | null>(null);
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [team, setTeam] = useState<Team>("printing");
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await supabase.from("subli_team_members")
      .select("id, name, mobile, team, active, must_set_pin, locked_until, created_at").order("team").order("name");
    if (error) setErr(errMsg(error)); else setMembers(data as Member[]);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function call(fn: string, args: Record<string, unknown>, success?: string) {
    setBusy(true); setErr(""); setOk("");
    const { error } = await supabase.rpc(fn, args);
    if (error) setErr(errMsg(error)); else { if (success) setOk(success); await load(); }
    setBusy(false);
    return !error;
  }

  async function add(e: FormEvent) {
    e.preventDefault();
    if (await call("subli_create_team_member", { p_name: name, p_mobile: mobile, p_team: team }, t.workerAdded.replace("{pin}", mobile.replace(/\D/g, "").slice(-4)))) {
      setName(""); setMobile("");
    }
  }

  return (
    <div className="grid grid-cols-1 gap-4">
      <h1 className="text-2xl font-bold sm:text-3xl">{t.workers}</h1>
      <form onSubmit={add} className={`${panelCls} grid gap-3 sm:grid-cols-2`}>
        <h2 className="font-bold sm:col-span-2">{t.addWorker}</h2>
        <div><label className={labelCls} htmlFor="wn">{t.name}</label><input id="wn" className={inputCls} value={name} onChange={(e) => setName(e.target.value)} required /></div>
        <div><label className={labelCls} htmlFor="wm">{t.mobile}</label><input id="wm" className={inputCls} inputMode="tel" placeholder="012-345 6789" value={mobile} onChange={(e) => setMobile(e.target.value)} required /></div>
        <div className="sm:col-span-2">
          <span className={labelCls}>{t.section}</span>
          <div className="grid grid-cols-2 gap-2">
            {TEAMS.map((x) => (
              <button type="button" key={x} onClick={() => setTeam(x)} aria-pressed={team === x}
                className={`flex min-h-14 items-center justify-center gap-2 rounded-xl border-2 text-sm font-bold ${team === x ? (x === "printing" ? "border-magenta bg-magenta/10 text-magenta" : "border-heat bg-heat/10 text-heat") : "border-line text-muted"}`}>
                <Icon name={x === "printing" ? "print" : "press"} />{t.teamName[x]}
              </button>
            ))}
          </div>
        </div>
        <p className="text-sm text-muted sm:col-span-2">{t.defaultPinHelp}</p>
        <button className={`${btnCls} sm:col-span-2`} disabled={busy}><Icon name="plus" />{t.addWorker}</button>
      </form>
      {err && <Notice tone="danger">{err}</Notice>}
      {ok && <Notice tone="ok" icon="check">{ok}</Notice>}

      {TEAMS.map((x) => {
        const list = (members ?? []).filter((m) => m.team === x);
        return (
          <section key={x} className={panelCls}>
            <h2 className={`flex items-center gap-2 font-bold ${x === "printing" ? "text-magenta" : "text-heat"}`}><Icon name={x === "printing" ? "print" : "press"} />{t.teamName[x]} <span className="text-muted">({list.length})</span></h2>
            {!members && <p className="mt-2 text-muted">{t.loading}</p>}
            {members && list.length === 0 && <p className="mt-2 text-sm text-muted">{t.noWorkers}</p>}
            <ul className="mt-3 divide-y divide-line">
              {list.map((m) => (
                <li key={m.id} className={`flex flex-wrap items-center gap-2 py-3 ${m.active ? "" : "opacity-55"}`}>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{m.name} {!m.active && <span className="text-xs font-bold uppercase text-muted">· {t.inactive}</span>}</p>
                    <p className="text-sm text-muted">{fmtPhone(m.mobile)}{m.must_set_pin && ` · ${t.onDefaultPin}`}{m.locked_until && new Date(m.locked_until) > new Date() && <span className="text-danger"> · {t.lockedShort}</span>}</p>
                  </div>
                  <button className={ghostBtnCls} disabled={busy} onClick={() => call("subli_update_member", { p_member_id: m.id, p_team: m.team === "printing" ? "production" : "printing", p_active: m.active })}
                    title={t.moveSection}><Icon name="refresh" className="h-4 w-4" />{t.teamName[m.team === "printing" ? "production" : "printing"]}</button>
                  <button className={ghostBtnCls} disabled={busy} onClick={() => confirm(t.confirmResetPin.replace("{name}", m.name)) && call("subli_reset_member_pin", { p_member_id: m.id }, t.pinReset)}><Icon name="key" className="h-4 w-4" />{t.resetPin}</button>
                  <button className={ghostBtnCls} disabled={busy} onClick={() => call("subli_update_member", { p_member_id: m.id, p_team: m.team, p_active: !m.active })}>{m.active ? t.deactivate : t.activate}</button>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

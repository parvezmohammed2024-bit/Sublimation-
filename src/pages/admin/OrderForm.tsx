import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Icon } from "../../components/Icon";
import { Notice } from "../../components/Bits";
import { accentBtnCls, ghostBtnCls, inputCls, labelCls, panelCls } from "../../components/Shell";
import { useI18n } from "../../lib/i18n";
import { artworkUrl, errMsg, removeArtwork, supabase, uploadArtwork } from "../../lib/supabase";
import { plusDays, todayMY } from "../../lib/format";
import type { Order, RosterLine, SizeQty } from "../../lib/types";

const SIZES = ["XS", "S", "M", "L", "XL", "2XL", "3XL", "4XL", "5XL"];
const ITEMS = ["Football jersey", "Futsal jersey", "Round-neck T-shirt", "Collar / polo T-shirt", "Long-sleeve jersey", "Running vest", "Shorts", "Lanyard", "Banner / bunting", "Face mask"];
const FABRICS = ["Microfiber (100% polyester)", "Interlock", "Jacquard", "Bird's eye", "Honeycomb", "Dri-fit", "Spandex"];

/** "AHMAD, 10, L" / tab separated, one player per line */
function parseRoster(text: string): RosterLine[] {
  return text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).map((l) => {
    const [name = "", number = "", size = ""] = l.split(/\t|,|;|\|/).map((p) => p.trim());
    return { name: name.toUpperCase(), number, size: size.toUpperCase() };
  });
}
function sizesFromRoster(r: RosterLine[]): SizeQty[] {
  const m = new Map<string, number>();
  r.forEach((x) => { const s = x.size || "?"; m.set(s, (m.get(s) ?? 0) + 1); });
  const idx = (s: string) => { const i = SIZES.indexOf(s); return i < 0 ? 99 : i; };
  return [...m].sort((a, b) => idx(a[0]) - idx(b[0])).map(([size, qty]) => ({ size, qty }));
}

export default function OrderForm() {
  const { id } = useParams();
  const editing = Boolean(id);
  const { t } = useI18n();
  const nav = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [item, setItem] = useState("");
  const [fabric, setFabric] = useState("");
  const [printType, setPrintType] = useState<"full" | "partial">("full");
  const [deadline, setDeadline] = useState(plusDays(todayMY(), 7));
  const [price, setPrice] = useState("");
  const [sizes, setSizes] = useState<SizeQty[]>([{ size: "M", qty: 0 }]);
  const [roster, setRoster] = useState<RosterLine[]>([]);
  const [rosterText, setRosterText] = useState("");
  const [notes, setNotes] = useState("");
  const [mockups, setMockups] = useState<string[]>([]);
  const [removed, setRemoved] = useState<string[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [loaded, setLoaded] = useState(!editing);

  useEffect(() => {
    if (!id) return;
    supabase.from("subli_orders").select("*").eq("id", id).single().then(({ data, error }) => {
      if (error || !data) { setErr(errMsg(error)); return; }
      const o = data as Order;
      setName(o.customer_name); setPhone(o.customer_phone ?? ""); setItem(o.item_type); setFabric(o.fabric ?? "");
      setPrintType(o.print_type); setDeadline(o.deadline); setPrice(String(o.price_total ?? ""));
      setSizes(o.sizes.length ? o.sizes : [{ size: "M", qty: 0 }]); setRoster(o.roster ?? []); setNotes(o.notes ?? "");
      setMockups(o.mockups ?? []); setLoaded(true);
    });
  }, [id]);

  const total = sizes.reduce((a, s) => a + (Number(s.qty) || 0), 0);
  const setSize = (i: number, patch: Partial<SizeQty>) => setSizes((v) => v.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  const addSize = (size = "") => setSizes((v) => (size && v.some((s) => s.size === size) ? v : [...v, { size, qty: 0 }]));

  async function submit(e: FormEvent) {
    e.preventDefault();
    setErr("");
    const cleanSizes = sizes.map((s) => ({ size: s.size.trim().toUpperCase(), qty: Math.max(0, Math.floor(Number(s.qty) || 0)) })).filter((s) => s.size && s.qty > 0);
    const finalSizes = cleanSizes.length ? cleanSizes : roster.length ? sizesFromRoster(roster) : [];
    if (!name.trim() || !item.trim()) { setErr(t.fillRequired); return; }
    if (!finalSizes.length) { setErr(t.needQty); return; }
    setBusy(true);
    try {
      const row = {
        customer_name: name.trim(), customer_phone: phone.trim() || null, item_type: item.trim(), fabric: fabric.trim() || null,
        print_type: printType, deadline, price_total: Number(price) || 0, sizes: finalSizes,
        roster: roster.filter((r) => r.name || r.number), notes: notes.trim() || null,
      };
      let orderId = id;
      if (editing) {
        const { error } = await supabase.from("subli_orders").update(row).eq("id", id!);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("subli_orders").insert(row).select("id").single();
        if (error) throw error;
        orderId = data.id;
      }
      const kept = mockups.filter((m) => !removed.includes(m));
      const uploaded: string[] = [];
      for (const f of files) uploaded.push(await uploadArtwork(orderId!, f));
      if (uploaded.length || removed.length) {
        const { error } = await supabase.from("subli_orders").update({ mockups: [...kept, ...uploaded] }).eq("id", orderId!);
        if (error) throw error;
        await Promise.all(removed.map(removeArtwork));
      }
      nav(`/admin/orders/${orderId}`, { replace: true });
    } catch (x) { setErr(errMsg(x)); } finally { setBusy(false); }
  }

  if (!loaded) return <p className="text-muted">{err || t.loading}</p>;

  return (
    <form onSubmit={submit} className="grid grid-cols-1 gap-4">
      <div className="flex items-center gap-3">
        {editing && <Link to={`/admin/orders/${id}`} className={ghostBtnCls} aria-label={t.back}><Icon name="left" /></Link>}
        <h1 className="text-2xl font-bold sm:text-3xl">{editing ? t.editJob : t.newJobSheet}</h1>
      </div>

      <section className={panelCls}>
        <h2 className="mb-3 flex items-center gap-2 font-bold"><span className="h-3 w-3 rounded-full bg-cyan" />{t.customer}</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div><label className={labelCls} htmlFor="cn">{t.customerName} *</label><input id="cn" className={inputCls} value={name} onChange={(e) => setName(e.target.value)} required /></div>
          <div><label className={labelCls} htmlFor="cp">{t.phone}</label><input id="cp" className={inputCls} inputMode="tel" placeholder="012-345 6789" value={phone} onChange={(e) => setPhone(e.target.value)} />
            <p className="mt-1 text-xs text-muted">{t.phoneNeeded}</p></div>
        </div>
      </section>

      <section className={panelCls}>
        <h2 className="mb-3 flex items-center gap-2 font-bold"><span className="h-3 w-3 rounded-full bg-magenta" />{t.job}</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div><label className={labelCls} htmlFor="it">{t.item} *</label><input id="it" list="items" className={inputCls} value={item} onChange={(e) => setItem(e.target.value)} required />
            <datalist id="items">{ITEMS.map((i) => <option key={i} value={i} />)}</datalist></div>
          <div><label className={labelCls} htmlFor="fb">{t.fabric}</label><input id="fb" list="fabrics" className={inputCls} value={fabric} onChange={(e) => setFabric(e.target.value)} />
            <datalist id="fabrics">{FABRICS.map((i) => <option key={i} value={i} />)}</datalist></div>
          <div>
            <span className={labelCls}>{t.printTypeLabel}</span>
            <div className="grid grid-cols-2 gap-1 rounded-lg border border-line bg-surface-2 p-1">
              {(["full", "partial"] as const).map((p) => (
                <button type="button" key={p} onClick={() => setPrintType(p)} aria-pressed={printType === p}
                  className={`min-h-10 rounded-md text-sm font-bold ${printType === p ? "bg-surface text-ink shadow-sm" : "text-muted"}`}>{t.printType[p]}</button>
              ))}
            </div>
          </div>
          <div><label className={labelCls} htmlFor="dl">{t.deadline} *</label><input id="dl" type="date" className={inputCls} value={deadline} min={editing ? undefined : todayMY()} onChange={(e) => setDeadline(e.target.value)} required /></div>
          <div><label className={labelCls} htmlFor="pr">{t.totalPrice}</label>
            <div className="relative"><span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 font-mono text-sm text-muted">RM</span>
              <input id="pr" className={`${inputCls} pl-12 font-mono`} inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value.replace(/[^\d.]/g, ""))} placeholder="0.00" /></div>
            <p className="mt-1 text-xs text-muted">{t.priceVisibility}</p></div>
        </div>
      </section>

      <section className={panelCls}>
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 font-bold"><span className="h-3 w-3 rounded-full bg-yellow" />{t.sizesQty}</h2>
          <span className="font-mono text-sm font-bold tabular">{t.total}: {total} {t.pcs}</span>
        </div>
        <div className="no-scrollbar mb-3 flex gap-1.5 overflow-x-auto">
          {SIZES.map((s) => (
            <button type="button" key={s} onClick={() => addSize(s)} disabled={sizes.some((x) => x.size === s)}
              className="min-h-9 shrink-0 rounded-md border border-line px-2.5 font-mono text-xs font-bold hover:bg-surface-2 disabled:opacity-35">+ {s}</button>
          ))}
        </div>
        <div className="grid gap-2">
          {sizes.map((s, i) => (
            <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2">
              <input className={`${inputCls} font-mono uppercase`} aria-label={t.size} placeholder={t.size} value={s.size} onChange={(e) => setSize(i, { size: e.target.value })} />
              <input className={`${inputCls} font-mono`} aria-label={t.quantity} inputMode="numeric" value={s.qty || ""} placeholder="0" onChange={(e) => setSize(i, { qty: Number(e.target.value.replace(/\D/g, "")) || 0 })} />
              <button type="button" onClick={() => setSizes((v) => v.filter((_, j) => j !== i))} aria-label={t.remove} className="flex h-12 w-12 items-center justify-center rounded-lg border border-line text-muted hover:text-danger"><Icon name="trash" /></button>
            </div>
          ))}
        </div>
        <button type="button" onClick={() => addSize()} className={`${ghostBtnCls} mt-2`}><Icon name="plus" />{t.addSize}</button>
      </section>

      <section className={panelCls}>
        <h2 className="flex items-center gap-2 font-bold"><span className="h-3 w-3 rounded-full bg-key dark:bg-white" />{t.rosterTitle}</h2>
        <p className="mt-1 text-sm text-muted">{t.rosterHelp}</p>
        <textarea className={`${inputCls} mt-3 py-3 font-mono text-sm`} rows={4} placeholder={"AHMAD, 10, L\nFARID, 7, M\nWEI JIE, 23, XL"} value={rosterText} onChange={(e) => setRosterText(e.target.value)} />
        <div className="mt-2 flex flex-wrap gap-2">
          <button type="button" className={ghostBtnCls} disabled={!rosterText.trim()} onClick={() => { setRoster((r) => [...r, ...parseRoster(rosterText)]); setRosterText(""); }}><Icon name="plus" />{t.addToRoster}</button>
          {roster.length > 0 && <button type="button" className={ghostBtnCls} onClick={() => setSizes(sizesFromRoster(roster))}><Icon name="refresh" />{t.sizesFromRoster}</button>}
          {roster.length > 0 && <button type="button" className={`${ghostBtnCls} text-danger`} onClick={() => setRoster([])}><Icon name="trash" />{t.clearRoster}</button>}
        </div>
        {roster.length > 0 && (
          <div className="mt-3 max-h-80 overflow-y-auto rounded-lg border border-line">
            {roster.map((r, i) => (
              <div key={i} className="grid grid-cols-[2rem_1fr_4.5rem_4.5rem_2.5rem] items-center gap-1.5 border-b border-line p-1.5 last:border-0">
                <span className="text-center text-xs text-muted tabular">{i + 1}</span>
                <input className="min-h-10 rounded-md border border-line bg-surface px-2 text-sm font-semibold uppercase" aria-label={t.rosterName} value={r.name} onChange={(e) => setRoster((v) => v.map((x, j) => (j === i ? { ...x, name: e.target.value.toUpperCase() } : x)))} />
                <input className="min-h-10 rounded-md border border-line bg-surface px-2 text-center font-mono text-sm" aria-label={t.rosterNumber} value={r.number} onChange={(e) => setRoster((v) => v.map((x, j) => (j === i ? { ...x, number: e.target.value } : x)))} />
                <input className="min-h-10 rounded-md border border-line bg-surface px-2 text-center font-mono text-sm uppercase" aria-label={t.size} value={r.size} onChange={(e) => setRoster((v) => v.map((x, j) => (j === i ? { ...x, size: e.target.value.toUpperCase() } : x)))} />
                <button type="button" onClick={() => setRoster((v) => v.filter((_, j) => j !== i))} aria-label={t.remove} className="flex h-10 w-10 items-center justify-center text-muted hover:text-danger"><Icon name="close" className="h-4 w-4" /></button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className={panelCls}>
        <h2 className="flex items-center gap-2 font-bold"><Icon name="palette" className="h-5 w-5 text-cyan" />{t.mockupTitle}</h2>
        <p className="mt-1 text-sm text-muted">{t.mockupHelp}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {mockups.filter((m) => !removed.includes(m)).map((m) => (
            <div key={m} className="relative h-24 w-24 overflow-hidden rounded-lg border border-line bg-surface-2 p-1">
              <img src={artworkUrl(m)} alt="" className="h-full w-full rounded object-cover" />
              <button type="button" onClick={() => setRemoved((r) => [...r, m])} aria-label={t.remove} className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-full bg-black/70 text-white"><Icon name="close" className="h-4 w-4" /></button>
            </div>
          ))}
          {files.map((f, i) => (
            <div key={i} className="relative h-24 w-24 overflow-hidden rounded-lg border-2 border-dashed border-cyan bg-surface-2 p-1">
              <img src={URL.createObjectURL(f)} alt="" className="h-full w-full rounded object-cover" />
              <button type="button" onClick={() => setFiles((v) => v.filter((_, j) => j !== i))} aria-label={t.remove} className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-full bg-black/70 text-white"><Icon name="close" className="h-4 w-4" /></button>
            </div>
          ))}
          <button type="button" onClick={() => fileRef.current?.click()} className="flex h-24 w-24 flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-line text-xs font-bold text-muted hover:border-cyan hover:text-cyan">
            <Icon name="image" className="h-6 w-6" />{t.addImage}
          </button>
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={(e) => { const picked = Array.from(e.target.files ?? []); setFiles((v) => [...v, ...picked]); e.target.value = ""; }} />
        </div>
      </section>

      <section className={panelCls}>
        <label className={labelCls} htmlFor="nt">{t.notesForTeam}</label>
        <textarea id="nt" rows={3} className={`${inputCls} py-3`} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t.notesPlaceholder} />
      </section>

      {err && <Notice tone="danger">{err}</Notice>}
      <div className="sticky bottom-20 z-10 flex justify-end">
        <button className={`${accentBtnCls} min-h-14 px-8 text-base shadow-lg`} disabled={busy}>{busy ? t.saving : editing ? t.saveChanges : t.createJob}</button>
      </div>
    </form>
  );
}

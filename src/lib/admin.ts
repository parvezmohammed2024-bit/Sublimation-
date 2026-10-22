import { supabase } from "./supabase";
import type { Order, Step, Sums } from "./types";

export interface BoardOrder extends Order { paid: number; balance: number; sums: Sums }

const emptySums = (): Sums => ({ printed: 0, pressed: 0, passed: 0, rejected: 0, reprinted: 0, reprint_pending: 0 });

export function sumUp(rows: { step: Step; qty: number }[]): Sums {
  const s = emptySums();
  for (const r of rows) {
    if (r.step === "printed") s.printed += r.qty;
    if (r.step === "pressed") s.pressed += r.qty;
    if (r.step === "qc_pass") s.passed += r.qty;
    if (r.step === "qc_reject") s.rejected += r.qty;
    if (r.step === "reprinted") s.reprinted += r.qty;
  }
  s.reprint_pending = Math.max(s.rejected - s.reprinted, 0);
  return s;
}

/** All orders with paid / balance / progress totals, for the dashboard. */
export async function loadBoard(includeClosed: boolean): Promise<BoardOrder[]> {
  let q = supabase.from("subli_orders").select("*").order("deadline", { ascending: true });
  if (!includeClosed) q = q.not("stage", "in", "(delivered,cancelled)");
  const { data: orders, error } = await q;
  if (error) throw error;
  const ids = (orders ?? []).map((o) => o.id);
  if (!ids.length) return [];
  const [{ data: pays }, { data: prog }] = await Promise.all([
    supabase.from("subli_payments").select("order_id, amount").in("order_id", ids),
    supabase.from("subli_progress").select("order_id, step, qty").in("order_id", ids),
  ]);
  return (orders as Order[]).map((o) => {
    const paid = (pays ?? []).filter((p) => p.order_id === o.id).reduce((a, p) => a + Number(p.amount), 0);
    return {
      ...o, price_total: Number(o.price_total), paid,
      balance: Math.max(Number(o.price_total) - paid, 0),
      sums: sumUp((prog ?? []).filter((p) => p.order_id === o.id) as { step: Step; qty: number }[]),
    };
  });
}

export const trackUrl = (no: string) => `${window.location.origin}/track/${no}`;

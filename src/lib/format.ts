const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export const rm = (n: number | null | undefined) =>
  n == null ? "—" : `RM ${Number(n).toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** YYYY-MM-DD for an instant in Malaysia time */
export function todayMY(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kuala_Lumpur", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export function fmtDate(v: string | null | undefined): string {
  if (!v) return "—";
  const ymd = v.length === 10 ? v : todayMY(new Date(v));
  const [y, m, d] = ymd.split("-").map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

export function fmtDateTime(iso: string): string {
  const time = new Intl.DateTimeFormat("en-MY", { timeZone: "Asia/Kuala_Lumpur", hour: "numeric", minute: "2-digit", hour12: true }).format(new Date(iso));
  return `${fmtDate(iso).replace(/ \d{4}$/, "")}, ${time.toUpperCase()}`;
}

const dayNum = (ymd: string) => {
  const [y, m, d] = ymd.split("-").map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86_400_000);
};
export const daysLeft = (deadline: string) => dayNum(deadline) - dayNum(todayMY());
export const plusDays = (ymd: string, n: number) => new Date((dayNum(ymd) + n) * 86_400_000).toISOString().slice(0, 10);

export type Tone = "overdue" | "soon" | "normal";
export const deadlineTone = (o: { deadline: string; stage: string }): Tone => {
  if (["ready", "delivered", "cancelled"].includes(o.stage)) return "normal";
  const d = daysLeft(o.deadline);
  return d < 0 ? "overdue" : d <= 2 ? "soon" : "normal";
};
export const TONE_CLASS: Record<Tone, string> = {
  overdue: "text-danger font-semibold",
  soon: "text-warn font-semibold",
  normal: "text-ink",
};

export const normalizePhone = (p: string) => {
  const d = (p ?? "").replace(/\D/g, "");
  return d.startsWith("0") ? "6" + d : d;
};
/** 60127771234 -> 012-777 1234 */
export function fmtPhone(p: string | null | undefined) {
  if (!p) return "—";
  const local = p.startsWith("60") ? "0" + p.slice(2) : p;
  return local.length >= 10 ? `${local.slice(0, 3)}-${local.slice(3, local.length - 4)} ${local.slice(-4)}` : local;
}

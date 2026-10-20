import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));

export const formatRM = (sen: number) =>
  new Intl.NumberFormat("en-MY", { style: "currency", currency: "MYR" }).format(sen / 100);

/** Strip characters that have meaning inside a PostgREST filter string. */
export const safeSearch = (q: string) => q.replace(/[,()%*\\"']/g, " ").trim().slice(0, 60);

export const rmToSen = (rm: number) => Math.round(rm * 100);
export const senToRm = (sen: number) => sen / 100;
/** numeric(12,2) columns arrive as number or string; always return sen. */
export const dbToSen = (v: number | string | null | undefined) => Math.round(Number(v ?? 0) * 100);

/** Today as YYYY-MM-DD in Asia/Kuala_Lumpur. */
export const todayKL = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kuala_Lumpur" }).format(new Date());

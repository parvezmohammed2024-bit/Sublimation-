import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));

export const formatRM = (sen: number) =>
  new Intl.NumberFormat("en-MY", { style: "currency", currency: "MYR" }).format(sen / 100);

/** Today as YYYY-MM-DD in Asia/Kuala_Lumpur. */
export const todayKL = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kuala_Lumpur" }).format(new Date());

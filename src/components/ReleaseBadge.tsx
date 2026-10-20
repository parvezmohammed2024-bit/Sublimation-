import { getTranslations } from "next-intl/server";
import type { ReleaseLevel } from "@/lib/rules/payments";
import { formatRM } from "@/lib/utils";

const STYLE: Record<Exclude<ReleaseLevel, "none">, string> = {
  green: "bg-ok text-white",
  amber: "bg-warn text-white",
  red: "bg-bad text-white",
};

/** Green = ready & fully paid, amber = ready with balance due, red = overdue. */
export async function ReleaseBadge({ level, amountDueSen }: { level: ReleaseLevel; amountDueSen: number }) {
  if (level === "none") return null;
  const t = await getTranslations("release");
  return (
    <span className={`inline-block rounded-full px-3 py-1 text-sm font-medium ${STYLE[level]}`}>
      {t(level)}
      {level !== "green" && amountDueSen > 0 ? ` · ${t("due")} ${formatRM(amountDueSen)}` : ""}
    </span>
  );
}

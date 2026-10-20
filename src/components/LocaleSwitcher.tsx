"use client";

import { useLocale } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

export function LocaleSwitcher() {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  return (
    <div className="inline-flex overflow-hidden rounded-lg border border-line text-sm" role="group" aria-label="Language">
      {routing.locales.map((l) => (
        <button
          key={l}
          type="button"
          aria-pressed={l === locale}
          onClick={() => router.replace(pathname, { locale: l })}
          className={`px-3 py-2 uppercase ${l === locale ? "bg-brand text-white" : "bg-card"}`}
        >
          {l}
        </button>
      ))}
    </div>
  );
}

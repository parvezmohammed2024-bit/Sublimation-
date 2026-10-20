"use client";

import { useActionState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { createCustomer } from "./actions";

const input = "mt-1 w-full rounded-lg border border-line bg-card px-3 py-3 text-base";
const TYPES = ["individual", "school", "club", "corporate", "government"] as const;

export function CustomerForm({ canGrantCredit }: { canGrantCredit: boolean }) {
  const t = useTranslations("customers");
  const locale = useLocale();
  const [state, action, pending] = useActionState(createCustomer, undefined);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="locale" value={locale} />
      <label className="block text-sm">
        {t("name")}
        <input name="name" required className={input} />
      </label>
      <label className="block text-sm">
        {t("organisation")}
        <input name="organisation" className={input} />
      </label>
      <label className="block text-sm">
        {t("type")}
        <select name="type" className={input} defaultValue="individual">
          {TYPES.map((x) => (
            <option key={x} value={x}>{t(`types.${x}`)}</option>
          ))}
        </select>
      </label>
      <label className="block text-sm">
        {t("phone")}
        <input name="phone" type="tel" inputMode="tel" required placeholder="012-345 6789" className={input} />
      </label>
      {state?.error === "phone" && <p role="alert" className="text-sm text-bad">{t("badPhone")}</p>}
      <label className="block text-sm">
        {t("email")}
        <input name="email" type="email" className={input} />
      </label>
      <label className="block text-sm">
        {t("address")}
        <textarea name="address" rows={2} className={input} />
      </label>
      {canGrantCredit && (
        <label className="flex items-center gap-3 py-2 text-sm">
          <input name="credit_terms" type="checkbox" className="size-5" />
          {t("creditTerms")}
        </label>
      )}
      {(state?.error === "invalid" || state?.error === "db") && (
        <p role="alert" className="text-sm text-bad">{t("saveFailed")}</p>
      )}
      <button disabled={pending} className="w-full rounded-lg bg-brand px-4 py-3 font-medium text-white disabled:opacity-60">
        {t("save")}
      </button>
    </form>
  );
}

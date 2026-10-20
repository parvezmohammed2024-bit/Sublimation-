"use client";

import { useActionState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { login } from "./actions";

export function LoginForm() {
  const t = useTranslations("auth");
  const locale = useLocale();
  const [state, action, pending] = useActionState(login, undefined);
  const field = "mt-1 w-full rounded-lg border border-line bg-card px-3 py-3 text-base";
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="locale" value={locale} />
      <label className="block text-sm">
        {t("email")}
        <input name="email" type="email" autoComplete="email" required className={field} />
      </label>
      <label className="block text-sm">
        {t("password")}
        <input name="password" type="password" autoComplete="current-password" required className={field} />
      </label>
      {state?.error && <p role="alert" className="text-sm text-bad">{t("invalid")}</p>}
      <button
        disabled={pending}
        className="w-full rounded-lg bg-brand px-4 py-3 text-base font-medium text-white disabled:opacity-60"
      >
        {t("submit")}
      </button>
    </form>
  );
}

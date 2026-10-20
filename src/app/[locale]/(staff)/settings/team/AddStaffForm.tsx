"use client";

import { useActionState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ALL_ROLES } from "@/lib/rules/stages";
import { createStaff } from "./actions";

const input = "mt-1 w-full rounded-lg border border-line bg-card px-3 py-3 text-base";

export function AddStaffForm({ defaultRole }: { defaultRole?: string }) {
  const t = useTranslations("team");
  const r = useTranslations("role");
  const locale = useLocale();
  const [state, action, pending] = useActionState(createStaff, undefined);
  return (
    <form action={action} className="space-y-3 rounded-xl border border-line bg-card p-4" key={state?.ok ? "done" : "form"}>
      <h2 className="font-semibold">{t("add")}</h2>
      <input type="hidden" name="locale" value={locale} />
      <label className="block text-sm">
        {t("fullName")}
        <input name="full_name" required className={input} />
      </label>
      <label className="block text-sm">
        {t("email")}
        <input name="email" type="email" required autoComplete="off" className={input} />
      </label>
      <label className="block text-sm">
        {t("password")}
        <input name="password" type="text" required minLength={8} autoComplete="off" className={input} />
      </label>
      <label className="block text-sm">
        {t("role")}
        <select name="role" defaultValue={defaultRole ?? "designer"} className={input}>
          {ALL_ROLES.map((x) => <option key={x} value={x}>{r(x)}</option>)}
        </select>
      </label>
      {state?.error && <p role="alert" className="text-sm text-bad">{t(`errors.${state.error}`)}</p>}
      {state?.ok && <p role="status" className="text-sm text-ok">{t("created")}</p>}
      <button disabled={pending} className="w-full rounded-lg bg-brand px-4 py-3 font-medium text-white disabled:opacity-60">
        {t("create")}
      </button>
    </form>
  );
}

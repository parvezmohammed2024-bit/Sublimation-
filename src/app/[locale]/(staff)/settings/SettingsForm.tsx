"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { saveSettings } from "./actions";

export interface SettingsValues {
  shop_name: string; address: string; phone: string;
  bank_name: string; account_no: string; account_name: string;
  job_prefix: string; default_deposit_percent: number;
  default_lead_time_days: number; quote_validity_days: number; free_revisions: number;
  tax_enabled: boolean; tax_rate: number | null; tax_number: string;
}

const input = "mt-1 w-full rounded-lg border border-line bg-card px-3 py-3 text-base";

function Field({ label, name, defaultValue, type = "text" }: {
  label: string; name: string; defaultValue: string | number; type?: string;
}) {
  return (
    <label className="block text-sm">
      {label}
      <input name={name} type={type} defaultValue={defaultValue} step="any" className={input} />
    </label>
  );
}

export function SettingsForm({ values }: { values: SettingsValues }) {
  const t = useTranslations("settings");
  const [state, action, pending] = useActionState(saveSettings, undefined);
  return (
    <form action={action} className="space-y-6">
      <fieldset className="space-y-3">
        <legend className="mb-1 font-semibold">{t("shop")}</legend>
        <Field label={t("shopName")} name="shop_name" defaultValue={values.shop_name} />
        <Field label={t("address")} name="address" defaultValue={values.address} />
        <Field label={t("phone")} name="phone" defaultValue={values.phone} />
      </fieldset>
      <fieldset className="space-y-3">
        <legend className="mb-1 font-semibold">{t("bank")}</legend>
        <Field label={t("bankName")} name="bank_name" defaultValue={values.bank_name} />
        <Field label={t("accountNo")} name="account_no" defaultValue={values.account_no} />
        <Field label={t("accountName")} name="account_name" defaultValue={values.account_name} />
      </fieldset>
      <fieldset className="space-y-3">
        <legend className="mb-1 font-semibold">{t("jobs")}</legend>
        <Field label={t("prefix")} name="job_prefix" defaultValue={values.job_prefix} />
        <Field label={t("deposit")} name="default_deposit_percent" type="number" defaultValue={values.default_deposit_percent} />
        <Field label={t("leadTime")} name="default_lead_time_days" type="number" defaultValue={values.default_lead_time_days} />
        <Field label={t("quoteValidity")} name="quote_validity_days" type="number" defaultValue={values.quote_validity_days} />
        <Field label={t("freeRevisions")} name="free_revisions" type="number" defaultValue={values.free_revisions} />
      </fieldset>
      <fieldset className="space-y-3">
        <legend className="mb-1 font-semibold">{t("tax")}</legend>
        <label className="flex items-center gap-3 py-2 text-sm">
          <input name="tax_enabled" type="checkbox" defaultChecked={values.tax_enabled} className="size-5" />
          {t("taxEnabled")}
        </label>
        <Field label={t("taxRate")} name="tax_rate" type="number" defaultValue={values.tax_rate ?? ""} />
        <Field label={t("taxNumber")} name="tax_number" defaultValue={values.tax_number} />
      </fieldset>
      {state?.error && <p role="alert" className="text-sm text-bad">{state.error}</p>}
      {state?.ok && <p role="status" className="text-sm text-ok">{t("saved")}</p>}
      <button disabled={pending} className="w-full rounded-lg bg-brand px-4 py-3 font-medium text-white disabled:opacity-60">
        {t("save")}
      </button>
    </form>
  );
}

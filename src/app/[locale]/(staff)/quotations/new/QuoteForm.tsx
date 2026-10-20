"use client";

import { useState, useTransition } from "react";
import { useFieldArray, useForm, useWatch, type Control } from "react-hook-form";
import { useLocale, useTranslations } from "next-intl";
import { isSublimationSafe, quoteTotals, tierUnitPriceSen, type PriceTier } from "@/lib/rules/pricing";
import { formatRM, rmToSen } from "@/lib/utils";
import { createQuotation } from "../actions";

export interface Option { id: string; name: string }
interface Props {
  customers: { id: string; name: string; organisation: string | null }[];
  garments: (Option & { price_tiers: PriceTier[] })[];
  fabrics: (Option & { is_polyester: boolean })[];
  collars: Option[];
  tax: { enabled: boolean; rate: number | null };
  defaultCustomerId: string;
  defaultDueDate: string;
}

interface Addon { label: string; mode: "per_piece" | "flat"; amountRm: number }
interface Line {
  garmentTypeId: string; fabricId: string; collarTypeId: string;
  sleeve: "" | "short" | "long" | "sleeveless"; cutting: "" | "regular" | "slim" | "muslimah"; qty: number; unitPriceRm: number; notes: string; addons: Addon[];
}
interface Values {
  customerId: string; dueDate: string; priority: "normal" | "rush"; rushFeeRm: number; notes: string; lines: Line[];
}

const input = "mt-1 w-full rounded-lg border border-line bg-card px-3 py-3 text-base";
const blankLine = (): Line => ({
  garmentTypeId: "", fabricId: "", collarTypeId: "", sleeve: "short", cutting: "regular",
  qty: 10, unitPriceRm: 0, notes: "", addons: [],
});

export function QuoteForm(props: Props) {
  const t = useTranslations("quotes");
  const locale = useLocale();
  const [error, setError] = useState(false);
  const [pending, start] = useTransition();
  const { register, control, handleSubmit, setValue } = useForm<Values>({
    defaultValues: {
      customerId: props.defaultCustomerId,
      dueDate: props.defaultDueDate,
      priority: "normal",
      rushFeeRm: 0,
      notes: "",
      lines: [blankLine()],
    },
  });
  const { fields, append, remove } = useFieldArray({ control, name: "lines" });
  const values = useWatch({ control }) as Values;

  const totals = quoteTotals({
    lines: (values.lines ?? []).map((l) => ({
      qty: Number(l?.qty) || 0,
      unitPriceSen: rmToSen(Number(l?.unitPriceRm) || 0),
      addons: (l?.addons ?? []).map((a) => ({
        label: a?.label ?? "", mode: a?.mode ?? "flat", amountSen: rmToSen(Number(a?.amountRm) || 0),
      })),
    })),
    rushFeeSen: values.priority === "rush" ? rmToSen(Number(values.rushFeeRm) || 0) : 0,
    taxEnabled: props.tax.enabled,
    taxRatePercent: props.tax.rate,
  });

  const onSubmit = handleSubmit((v) => {
    setError(false);
    start(async () => {
      const res = await createQuotation({ ...v, locale });
      if (res?.error) setError(true);
    });
  });

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <label className="block text-sm">
        {t("customer")}
        <select {...register("customerId", { required: true })} className={input}>
          <option value="">—</option>
          {props.customers.map((c) => (
            <option key={c.id} value={c.id}>{c.organisation ? `${c.organisation} (${c.name})` : c.name}</option>
          ))}
        </select>
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="block text-sm">
          {t("dueDate")}
          <input type="date" {...register("dueDate")} className={input} />
        </label>
        <label className="block text-sm">
          {t("priority")}
          <select {...register("priority")} className={input}>
            <option value="normal">{t("normal")}</option>
            <option value="rush">{t("rush")}</option>
          </select>
        </label>
      </div>
      {values.priority === "rush" && (
        <label className="block text-sm">
          {t("rushFee")} (RM)
          <input type="number" step="0.01" min="0" {...register("rushFeeRm", { valueAsNumber: true })} className={input} />
        </label>
      )}

      <div className="space-y-4">
        {fields.map((f, i) => (
          <LineEditor
            key={f.id}
            index={i}
            control={control}
            register={register}
            setValue={setValue}
            props={props}
            onRemove={fields.length > 1 ? () => remove(i) : undefined}
          />
        ))}
        <button type="button" onClick={() => append(blankLine())} className="w-full rounded-lg border border-line px-4 py-3">
          + {t("addLine")}
        </button>
      </div>

      <label className="block text-sm">
        {t("notes")}
        <textarea rows={2} {...register("notes")} className={input} />
      </label>

      <dl className="space-y-1 rounded-xl border border-line bg-card p-4 text-sm">
        <Row k={t("subtotal")} v={formatRM(totals.subtotalSen)} />
        {totals.rushFeeSen > 0 && <Row k={t("rushFee")} v={formatRM(totals.rushFeeSen)} />}
        {props.tax.enabled && <Row k={`${t("tax")} ${props.tax.rate ?? ""}%`} v={formatRM(totals.taxSen)} />}
        <div className="flex justify-between pt-2 text-lg font-semibold">
          <dt>{t("total")}</dt>
          <dd>{formatRM(totals.totalSen)}</dd>
        </div>
      </dl>

      {error && <p role="alert" className="text-sm text-bad">{t("saveFailed")}</p>}
      <button disabled={pending} className="w-full rounded-lg bg-brand px-4 py-3 font-medium text-white disabled:opacity-60">
        {t("save")}
      </button>
    </form>
  );
}

const Row = ({ k, v }: { k: string; v: string }) => (
  <div className="flex justify-between">
    <dt className="text-muted">{k}</dt>
    <dd>{v}</dd>
  </div>
);

function LineEditor({
  index, control, register, setValue, props, onRemove,
}: {
  index: number;
  control: Control<Values>;
  register: ReturnType<typeof useForm<Values>>["register"];
  setValue: ReturnType<typeof useForm<Values>>["setValue"];
  props: Props;
  onRemove?: () => void;
}) {
  const t = useTranslations("quotes");
  const addons = useFieldArray({ control, name: `lines.${index}.addons` });
  const line = useWatch({ control, name: `lines.${index}` }) as Line;

  const fabric = props.fabrics.find((f) => f.id === line?.fabricId);
  const garment = props.garments.find((g) => g.id === line?.garmentTypeId);
  const tier = garment ? tierUnitPriceSen(garment.price_tiers ?? [], Number(line?.qty) || 0) : null;
  const p = `lines.${index}` as const;

  return (
    <fieldset className="space-y-3 rounded-xl border border-line bg-card p-4">
      <div className="flex items-center justify-between">
        <legend className="font-semibold">{t("line")} {index + 1}</legend>
        {onRemove && (
          <button type="button" onClick={onRemove} className="text-sm text-bad">{t("remove")}</button>
        )}
      </div>

      <label className="block text-sm">
        {t("garment")}
        <select {...register(`${p}.garmentTypeId`)} className={input}>
          <option value="">—</option>
          {props.garments.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
      </label>
      <label className="block text-sm">
        {t("fabric")}
        <select {...register(`${p}.fabricId`)} className={input}>
          <option value="">—</option>
          {props.fabrics.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
        </select>
      </label>
      {!isSublimationSafe(fabric) && (
        <p role="alert" className="rounded-lg bg-warn/15 p-3 text-sm text-warn">{t("nonPoly")}</p>
      )}

      <div className="grid grid-cols-2 gap-3">
        <label className="block text-sm">
          {t("collar")}
          <select {...register(`${p}.collarTypeId`)} className={input}>
            <option value="">—</option>
            {props.collars.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <label className="block text-sm">
          {t("sleeve")}
          <select {...register(`${p}.sleeve`)} className={input}>
            <option value="short">{t("sleeves.short")}</option>
            <option value="long">{t("sleeves.long")}</option>
            <option value="sleeveless">{t("sleeves.sleeveless")}</option>
          </select>
        </label>
        <label className="block text-sm">
          {t("cutting")}
          <select {...register(`${p}.cutting`)} className={input}>
            <option value="regular">{t("cuttings.regular")}</option>
            <option value="slim">{t("cuttings.slim")}</option>
            <option value="muslimah">{t("cuttings.muslimah")}</option>
          </select>
        </label>
        <label className="block text-sm">
          {t("qty")}
          <input type="number" min="1" inputMode="numeric" {...register(`${p}.qty`, { valueAsNumber: true })} className={input} />
        </label>
      </div>

      <label className="block text-sm">
        {t("unitPrice")} (RM)
        <input type="number" step="0.01" min="0" inputMode="decimal" {...register(`${p}.unitPriceRm`, { valueAsNumber: true })} className={input} />
      </label>
      {tier != null && (
        <button
          type="button"
          onClick={() => setValue(`${p}.unitPriceRm`, tier / 100)}
          className="text-sm text-brand underline"
        >
          {t("useTier", { price: formatRM(tier) })}
        </button>
      )}

      <div className="space-y-2">
        {addons.fields.map((a, ai) => (
          <div key={a.id} className="grid grid-cols-[1fr_auto] gap-2 rounded-lg bg-bg p-2">
            <input placeholder={t("addonLabel")} {...register(`${p}.addons.${ai}.label`)} className={input} />
            <button type="button" onClick={() => addons.remove(ai)} className="px-2 text-bad" aria-label={t("remove")}>×</button>
            <select {...register(`${p}.addons.${ai}.mode`)} className={input}>
              <option value="per_piece">{t("perPiece")}</option>
              <option value="flat">{t("flat")}</option>
            </select>
            <input type="number" step="0.01" min="0" placeholder="RM" {...register(`${p}.addons.${ai}.amountRm`, { valueAsNumber: true })} className={input} />
          </div>
        ))}
        <button
          type="button"
          onClick={() => addons.append({ label: "", mode: "per_piece", amountRm: 0 })}
          className="text-sm text-brand underline"
        >
          + {t("addAddon")}
        </button>
      </div>

      <label className="block text-sm">
        {t("lineNotes")}
        <input {...register(`${p}.notes`)} className={input} />
      </label>
    </fieldset>
  );
}

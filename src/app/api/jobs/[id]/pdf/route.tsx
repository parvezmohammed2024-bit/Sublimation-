import { renderToBuffer } from "@react-pdf/renderer";
import { getTranslations } from "next-intl/server";
import QRCode from "qrcode";
import { z } from "zod";
import { getProfile } from "@/lib/auth";
import { jobUrl, loadJobSheet } from "@/lib/jobSheet";
import { JobSheetPdf, type JobSheetLabels, type PdfItem } from "@/lib/pdf/JobSheetPdf";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!z.string().uuid().safeParse(id).success) return new Response("Not found", { status: 404 });
  if (!(await getProfile())) return new Response("Unauthorized", { status: 401 });

  const url = new URL(req.url);
  const locale = url.searchParams.get("locale") === "en" ? "en" : "ms";

  // Row Level Security applies: a user only gets sheets for jobs they may see.
  const supabase = await createClient();
  const data = await loadJobSheet(supabase, id, locale);
  if (!data) return new Response("Not found", { status: 404 });

  const t = await getTranslations({ locale, namespace: "pdf" });
  const q = await getTranslations({ locale, namespace: "quotes" });
  const labels: JobSheetLabels = {
    title: t("title"), customer: t("customer"), stage: t("stage"), due: t("due"), rush: t("rush"),
    qty: t("qty"), items: t("items"), garment: t("garment"), fabric: t("fabric"), collar: t("collar"),
    sleeve: t("sleeve"), cutting: t("cutting"), sizes: t("sizes"), noSizes: t("noSizes"), brief: t("brief"),
    notes: t("notes"), mockup: t("mockup"), noMockup: t("noMockup"), balance: t("balance"),
    scan: t("scan"), orderDate: t("orderDate"), nonPoly: q("nonPoly"),
  };
  const items: PdfItem[] = data.items.map((i) => ({
    garment: i.garment,
    fabric: i.fabric ?? "—",
    collar: i.collar ?? "—",
    sleeve: i.sleeve ? q(`sleeves.${i.sleeve}`) : "—",
    cutting: i.cutting ? q(`cuttings.${i.cutting}`) : "—",
    qty: i.qty,
    warn: !i.fabricIsPoly,
    extras: [...i.addons.map((a) => `+ ${a.label}`), i.notes ?? ""].filter(Boolean).join("   "),
  }));

  // Thumbnail: the newest approved or sent mockup that react-pdf can embed (PNG / JPG).
  const { data: mockups } = await supabase
    .from("mockups")
    .select("file_path, status, version")
    .eq("job_id", id)
    .in("status", ["approved", "sent", "draft"])
    .order("version", { ascending: false });
  const embeddable = (mockups ?? []).find((m) => /\.(png|jpe?g)$/i.test(m.file_path));
  let mockupUrl: string | null = null;
  if (embeddable) {
    const { data: signed } = await supabase.storage.from("mockups").createSignedUrl(embeddable.file_path, 300);
    mockupUrl = signed?.signedUrl ?? null;
  }

  const qr = await QRCode.toDataURL(jobUrl(id), { margin: 1, width: 300 });
  const buffer = await renderToBuffer(
    <JobSheetPdf data={data} qr={qr} labels={labels} items={items} mockupUrl={mockupUrl} />,
  );

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${data.jobNo}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}

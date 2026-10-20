import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { renderToBuffer } from "@react-pdf/renderer";
import QRCode from "qrcode";
import { describe, expect, it } from "vitest";
import type { JobSheetData } from "../jobSheet";
import { JobSheetPdf, type JobSheetLabels, type PdfItem } from "./JobSheetPdf";

const labels: JobSheetLabels = {
  title: "Job sheet", customer: "Customer", stage: "Stage", due: "Due date", rush: "RUSH", qty: "pcs",
  items: "Items", garment: "Garment", fabric: "Fabric", collar: "Collar", sleeve: "Sleeve", cutting: "Cutting",
  sizes: "Size breakdown", noSizes: "No list yet", brief: "Design brief", notes: "Special instructions",
  mockup: "Mockup", noMockup: "No mockup yet", balance: "BALANCE DUE", scan: "Scan to update",
  orderDate: "Ordered", nonPoly: "Not polyester",
};

const data: JobSheetData = {
  id: "11111111-1111-1111-1111-111111111111", jobNo: "SB-2610-0001", stageKey: "PRINTING", stageLabel: "Printing",
  priority: "rush", orderDate: "2026-10-20", dueDate: "2026-11-03", designApproved: true, nameListConfirmed: true,
  designBrief: "Navy and gold, club crest on chest, sponsor logo on sleeve.", internalNotes: "Customer wants collars matched.",
  customerNotes: null, designerId: null,
  customer: { name: "Ahmad Faizal", organisation: "Kelab Bola Taman Maju", phone: "+60123450001", creditTerms: false },
  items: [], totalQty: 30,
  sizeBreakdown: [{ size: "S", qty: 5 }, { size: "M", qty: 12 }, { size: "L", qty: 10 }, { size: "XL", qty: 3 }],
  nameListCount: 30, totalSen: 180000, paidSen: 90000, pendingSen: 0, balanceSen: 90000,
  paymentStatus: "DEPOSIT_PAID", release: { level: "none", amountDueSen: 90000 },
};
const items: PdfItem[] = [
  { garment: "Round neck jersey", fabric: "Microfiber Interlock", collar: "Round neck", sleeve: "Short", cutting: "Regular", qty: 30, warn: false, extras: "+ Names   + Numbers" },
];

describe("job sheet PDF", () => {
  it("renders a valid PDF with a QR code", async () => {
    const qr = await QRCode.toDataURL("http://localhost:3000/jobs/11111111", { margin: 1, width: 300 });
    const buf = await renderToBuffer(<JobSheetPdf data={data} qr={qr} labels={labels} items={items} />);
    expect(buf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(buf.length).toBeGreaterThan(2000);
    if (process.env.SAVE_SAMPLE_PDF) writeFileSync(join(tmpdir(), "jobsheet-sample.pdf"), buf);
  });
});

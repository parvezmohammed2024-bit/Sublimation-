/**
 * Default stage definitions. The DB `stages` table is the source of truth at
 * runtime (shops can merge/skip stages); this list seeds it and is the
 * fallback used by the rules module.
 */

export type Role =
  | "super_admin"
  | "admin"
  | "designer"
  | "template"
  | "printing"
  | "cutting_sewing"
  | "qc"
  | "dispatch";

export type Section =
  | "sales"
  | "design"
  | "template"
  | "printing"
  | "sewing"
  | "qc"
  | "dispatch";

export interface StageDef {
  key: string;
  /** Position on the main path. Side/loop stages have a null position. */
  position: number | null;
  section: Section;
  labelEn: string;
  labelMs: string;
  /** Simplified name shown on the customer tracking page. */
  customerLabelEn: string;
  customerLabelMs: string;
  isTerminal?: boolean;
}

export const DEFAULT_STAGES: StageDef[] = [
  { key: "QUOTATION_DRAFT", position: 0, section: "sales", labelEn: "Quotation draft", labelMs: "Draf sebut harga", customerLabelEn: "Quotation", customerLabelMs: "Sebut harga" },
  { key: "QUOTATION_SENT", position: 1, section: "sales", labelEn: "Quotation sent", labelMs: "Sebut harga dihantar", customerLabelEn: "Quotation", customerLabelMs: "Sebut harga" },
  { key: "CONFIRMED", position: 2, section: "sales", labelEn: "Confirmed", labelMs: "Disahkan", customerLabelEn: "Order confirmed", customerLabelMs: "Tempahan disahkan" },
  { key: "DESIGNING", position: 3, section: "design", labelEn: "Designing", labelMs: "Sedang reka", customerLabelEn: "Design", customerLabelMs: "Reka bentuk" },
  { key: "MOCKUP_SENT", position: 4, section: "design", labelEn: "Mockup sent", labelMs: "Mockup dihantar", customerLabelEn: "Design", customerLabelMs: "Reka bentuk" },
  { key: "REVISION_REQUESTED", position: null, section: "design", labelEn: "Revision requested", labelMs: "Semakan diminta", customerLabelEn: "Design", customerLabelMs: "Reka bentuk" },
  { key: "DESIGN_APPROVED", position: 5, section: "design", labelEn: "Design approved", labelMs: "Reka bentuk diluluskan", customerLabelEn: "Design approved", customerLabelMs: "Reka bentuk diluluskan" },
  { key: "AWAITING_NAME_LIST", position: 6, section: "sales", labelEn: "Awaiting name list", labelMs: "Menunggu senarai nama", customerLabelEn: "Name list", customerLabelMs: "Senarai nama" },
  { key: "NAME_LIST_CONFIRMED", position: 7, section: "template", labelEn: "Name list confirmed", labelMs: "Senarai nama disahkan", customerLabelEn: "Name list", customerLabelMs: "Senarai nama" },
  { key: "TEMPLATE", position: 8, section: "template", labelEn: "Template / pattern", labelMs: "Templat / corak", customerLabelEn: "Preparing production", customerLabelMs: "Menyediakan pengeluaran" },
  { key: "PRINTING", position: 9, section: "printing", labelEn: "Printing", labelMs: "Mencetak", customerLabelEn: "Printing", customerLabelMs: "Pencetakan" },
  { key: "HEAT_PRESS", position: 10, section: "printing", labelEn: "Heat press", labelMs: "Heat press", customerLabelEn: "Printing", customerLabelMs: "Pencetakan" },
  { key: "CUTTING", position: 11, section: "sewing", labelEn: "Cutting", labelMs: "Memotong", customerLabelEn: "Sewing", customerLabelMs: "Jahitan" },
  { key: "SEWING", position: 12, section: "sewing", labelEn: "Sewing", labelMs: "Menjahit", customerLabelEn: "Sewing", customerLabelMs: "Jahitan" },
  { key: "QC", position: 13, section: "qc", labelEn: "Quality check", labelMs: "Semakan kualiti", customerLabelEn: "Quality check", customerLabelMs: "Semakan kualiti" },
  { key: "QC_FAILED", position: null, section: "qc", labelEn: "QC failed", labelMs: "QC gagal", customerLabelEn: "Quality check", customerLabelMs: "Semakan kualiti" },
  { key: "REWORK", position: null, section: "sewing", labelEn: "Rework", labelMs: "Kerja semula", customerLabelEn: "Quality check", customerLabelMs: "Semakan kualiti" },
  { key: "PACKING", position: 14, section: "dispatch", labelEn: "Packing", labelMs: "Pembungkusan", customerLabelEn: "Packing", customerLabelMs: "Pembungkusan" },
  { key: "READY_FOR_COLLECTION", position: 15, section: "dispatch", labelEn: "Ready for collection", labelMs: "Sedia untuk diambil", customerLabelEn: "Ready", customerLabelMs: "Sedia" },
  { key: "COLLECTED", position: 16, section: "dispatch", labelEn: "Collected", labelMs: "Telah diambil", customerLabelEn: "Collected", customerLabelMs: "Telah diambil", isTerminal: true },
  { key: "DELIVERED", position: 16, section: "dispatch", labelEn: "Delivered", labelMs: "Telah dihantar", customerLabelEn: "Delivered", customerLabelMs: "Telah dihantar", isTerminal: true },
  { key: "ON_HOLD", position: null, section: "sales", labelEn: "On hold", labelMs: "Ditangguhkan", customerLabelEn: "On hold", customerLabelMs: "Ditangguhkan" },
  { key: "CANCELLED", position: null, section: "sales", labelEn: "Cancelled", labelMs: "Dibatalkan", customerLabelEn: "Cancelled", customerLabelMs: "Dibatalkan", isTerminal: true },
];

/** Stages from which the design is considered locked (approved, pre-production). */
export const DESIGN_LOCKED_FROM = ["DESIGN_APPROVED", "AWAITING_NAME_LIST", "NAME_LIST_CONFIRMED"] as const;

export const TERMINAL_STAGES = new Set(
  DEFAULT_STAGES.filter((s) => s.isTerminal).map((s) => s.key),
);

/** Which role may operate jobs currently sitting in a given section. */
export const SECTION_ROLES: Record<Section, Role[]> = {
  sales: ["super_admin", "admin"],
  design: ["super_admin", "admin", "designer"],
  template: ["super_admin", "admin", "template"],
  printing: ["super_admin", "admin", "printing"],
  sewing: ["super_admin", "admin", "cutting_sewing"],
  qc: ["super_admin", "admin", "qc"],
  dispatch: ["super_admin", "admin", "dispatch"],
};

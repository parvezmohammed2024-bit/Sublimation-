export type Stage = "artwork" | "printing" | "production" | "ready" | "delivered" | "cancelled";
export type StageStatus = "waiting" | "in_progress";
export type Team = "printing" | "production";
export type Approval = "not_sent" | "waiting" | "approved" | "changes";
export type Step = "printed" | "pressed" | "qc_pass" | "qc_reject" | "reprinted";

export interface SizeQty { size: string; qty: number }
export interface RosterLine { name: string; number: string; size: string }
export interface Sums { printed: number; pressed: number; passed: number; rejected: number; reprinted: number; reprint_pending: number }

export interface Order {
  id: string;
  tracking_no: string;
  customer_name: string;
  customer_phone: string | null;
  item_type: string;
  fabric: string | null;
  print_type: "full" | "partial";
  sizes: SizeQty[];
  total_qty: number;
  roster: RosterLine[];
  notes: string | null;
  mockups: string[];
  deadline: string;
  price_total: number;
  stage: Stage;
  stage_status: StageStatus;
  approval_status: Approval;
  approval_round: number;
  approval_note: string | null;
  approved_at: string | null;
  approved_by: "customer" | "admin" | null;
  created_at: string;
  updated_at: string;
}

/** what a team sees: no prices */
export interface TeamOrder {
  id: string; tracking_no: string; customer_name: string; item_type: string; fabric: string | null;
  print_type: "full" | "partial"; sizes: SizeQty[]; total_qty: number; roster: RosterLine[];
  notes: string | null; mockups: string[]; deadline: string; stage: Stage; stage_status: StageStatus;
  approval_status: Approval; created_at: string; sums: Sums;
}
export interface ComingOrder {
  id: string; tracking_no: string; customer_name: string; item_type: string; total_qty: number;
  deadline: string; stage: Stage; stage_status: StageStatus; approval_status: Approval; sums: Sums;
}
export interface LogEntry {
  id: string; order_id: string; step: Step; qty: number; reason: string | null;
  by_name: string | null; created_at: string; mine: boolean;
}
export interface QueueData {
  member: { id: string; name: string; team: Team; must_set_pin: boolean };
  orders: TeamOrder[];
  coming: ComingOrder[];
  log: LogEntry[];
}

export interface PublicOrder {
  tracking_no: string; customer_name: string; item_type: string; fabric: string | null;
  total_qty: number; sizes: SizeQty[]; roster: RosterLine[]; mockups: string[]; deadline: string;
  stage: Stage; stage_status: StageStatus; approval_status: Approval; approval_round: number;
  approval_note: string | null; approved_at: string | null; received_at: string;
  price_total: number; paid: number; balance: number; sums: Sums;
  done: { artwork: string | null; printing: string | null; production: string | null; delivered: string | null };
}

export interface Payment { id: string; order_id: string; amount: number; method: string | null; note: string | null; paid_on: string; created_at: string }
export interface ProgressRow { id: string; order_id: string; step: Step; qty: number; reason: string | null; by_name: string | null; created_at: string }
export interface EventRow { id: string; order_id: string; stage: string; action: string; note: string | null; by_name: string | null; created_at: string }
export interface Member { id: string; name: string; mobile: string; team: Team; active: boolean; must_set_pin: boolean; locked_until: string | null; created_at: string }
export interface Customer { id: string; phone: string; name: string | null; code: string; created_at: string }

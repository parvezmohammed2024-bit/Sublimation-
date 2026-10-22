import type { IconName } from "../components/Icon";
import type { Stage, Team } from "./types";

/** One ink per stage. Classes are written out in full so Tailwind keeps them. */
export const STAGE_TEXT: Record<Stage, string> = {
  artwork: "text-cyan", printing: "text-magenta", production: "text-heat",
  ready: "text-ok", delivered: "text-grey", cancelled: "text-grey",
};
export const STAGE_BG: Record<Stage, string> = {
  artwork: "bg-cyan", printing: "bg-magenta", production: "bg-heat",
  ready: "bg-ok", delivered: "bg-grey", cancelled: "bg-grey",
};
export const STAGE_SOFT: Record<Stage, string> = {
  artwork: "bg-cyan/12 text-cyan border-cyan/30",
  printing: "bg-magenta/12 text-magenta border-magenta/30",
  production: "bg-heat/12 text-heat border-heat/30",
  ready: "bg-ok/12 text-ok border-ok/30",
  delivered: "bg-grey/12 text-grey border-grey/30",
  cancelled: "bg-grey/12 text-grey border-grey/30",
};
export const STAGE_ICON: Record<Stage, IconName> = {
  artwork: "palette", printing: "print", production: "press",
  ready: "box", delivered: "truck", cancelled: "close",
};
export const STAGES: Stage[] = ["artwork", "printing", "production", "ready", "delivered", "cancelled"];
export const FLOW: Stage[] = ["artwork", "printing", "production", "ready"];
export const TEAMS: Team[] = ["printing", "production"];

export const rank = (s: Stage) => ({ artwork: 1, printing: 2, production: 3, ready: 4, delivered: 5, cancelled: 0 })[s];

/** QC reject reasons, from the common sublimation defects */
export const REJECT_REASONS = [
  "ghosting", "faded", "blurry", "white_spots", "misprint", "wrong_name", "scorch", "other",
] as const;

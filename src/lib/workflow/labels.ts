import type { StageActionOption } from "@/components/StageActions";
import type { TransitionOption } from "./options";

export interface StageRow {
  key: string;
  section: string;
  label_en: string;
  label_ms: string;
}

/**
 * Adds display labels, and marks a forward move as a handoff when the next stage is owned by a
 * different section (e.g. Template -> "Send to Printing & Press").
 */
export function toActionOptions(
  options: TransitionOption[],
  currentStage: string,
  stages: StageRow[],
  locale: string,
  sectionName: (section: string) => string,
): StageActionOption[] {
  const byKey = new Map(stages.map((s) => [s.key, s]));
  const currentSection = byKey.get(currentStage)?.section;
  return options.map((o) => {
    const target = byKey.get(o.to);
    const handoff =
      !o.side && target && currentSection && target.section !== currentSection
        ? sectionName(target.section)
        : undefined;
    return {
      ...o,
      label: target ? (locale === "en" ? target.label_en : target.label_ms) : o.to,
      handoff,
    };
  });
}

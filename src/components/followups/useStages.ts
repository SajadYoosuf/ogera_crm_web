"use client";

import { useMemo } from "react";
import { useEnumOptions } from "@/hooks/useEnumOptions";
import { PARTNER_STAGES, STAGES, columnFor, partnerColumnFor, partnerMeta, stageMeta, type LeadKind, type StageMeta, type StageSlug } from "./stages";

const NONE: ReadonlySet<string> = new Set();

/**
 * The board's stages with the names, order and visibility set in Settings -> Lead stages.
 * Colours and descriptions stay with the built-in stage. A hidden stage is still listed while
 * `occupied` says leads sit in it, so those leads never vanish from the board.
 */
export function useStages(occupied: ReadonlySet<string> = NONE) {
  const { options, isLoaded } = useEnumOptions("lead_stage");

  const stages = useMemo<StageMeta[]>(() => {
    if (!isLoaded) return STAGES;
    const known = new Map(STAGES.map((stage) => [stage.slug as string, stage]));
    const seen = new Set<string>();
    const ordered = options.flatMap((option) => {
      if (seen.has(option.value)) return [];
      const base = known.get(option.value);
      if (!base) return [];
      seen.add(option.value);
      return [{ ...base, label: option.label }];
    });
    const shown = new Set(ordered.map((stage) => stage.slug as string));
    const hidden = STAGES.filter((stage) => !shown.has(stage.slug) && occupied.has(stage.slug));
    return [...ordered, ...hidden];
  }, [options, isLoaded, occupied]);

  const labelled = useMemo(() => new Map(stages.map((stage) => [stage.slug as string, stage])), [stages]);
  const metaOf = (slug: StageSlug): StageMeta => labelled.get(slug) ?? stageMeta(slug);
  return { stages, metaOf };
}

/** The stages, labels and column rule for consumers or partners. Consumers follow Settings; the partner pipeline is fixed. */
export function usePipeline(kind: LeadKind, occupied: ReadonlySet<string> = NONE) {
  const consumer = useStages(kind === "consumer" ? occupied : NONE);
  return kind === "partner"
    ? { stages: PARTNER_STAGES, metaOf: partnerMeta, columnOf: partnerColumnFor }
    : { ...consumer, columnOf: columnFor };
}

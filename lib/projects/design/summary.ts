import { formatPlannedLengthMeters, roundPlannedLengthMeters } from "@/lib/gps/distance"
import type {
  ProjectDesignElement,
  ProjectDesignGain,
  ProjectDesignSegment,
} from "@/lib/types/project-design"

export type ProjectDesignSummary = {
  nodeCount: number
  napCount: number
  segmentCount: number
  /** Physical designed length. Does not include gains. */
  plannedLengthM: number
  traceGainM: number
  elementGainM: number
  totalCableM: number
}

export function buildProjectDesignSummary(
  elements: Array<Pick<ProjectDesignElement, "kind"> & { gainM?: number }>,
  segments: Pick<ProjectDesignSegment, "plannedLengthM">[],
  gains: Array<Pick<ProjectDesignGain, "gainM">> = []
): ProjectDesignSummary {
  const plannedLengthM = segments.reduce(
    (total, segment) => total + segment.plannedLengthM,
    0
  )
  const traceGainM = gains.reduce((total, gain) => total + (gain.gainM ?? 0), 0)
  const elementGainM = elements.reduce(
    (total, element) => total + (element.gainM ?? 0),
    0
  )

  return {
    nodeCount: elements.filter((element) => element.kind === "node").length,
    napCount: elements.filter((element) => element.kind === "nap").length,
    segmentCount: segments.length,
    plannedLengthM,
    traceGainM,
    elementGainM,
    totalCableM: roundPlannedLengthMeters(
      plannedLengthM + traceGainM + elementGainM
    ),
  }
}

export function resolveProjectDesignSegmentLabel(
  segment: Pick<ProjectDesignSegment, "name" | "originElementId" | "destinationElementId">,
  elements: Pick<ProjectDesignElement, "id" | "name">[]
): string {
  const named = segment.name.trim()
  if (named) {
    return named
  }

  const origin = elements.find((element) => element.id === segment.originElementId)
  const destination = elements.find(
    (element) => element.id === segment.destinationElementId
  )

  if (origin && destination) {
    return `${origin.name} → ${destination.name}`
  }

  if (origin) {
    return `${origin.name} → …`
  }

  if (destination) {
    return `… → ${destination.name}`
  }

  return "Tramo"
}

export function formatProjectDesignSegmentListLabel(
  segment: Pick<
    ProjectDesignSegment,
    "name" | "originElementId" | "destinationElementId" | "plannedLengthM"
  >,
  elements: Pick<ProjectDesignElement, "id" | "name">[]
): string {
  return `${resolveProjectDesignSegmentLabel(segment, elements)} — ${formatPlannedLengthMeters(segment.plannedLengthM)}`
}

export function formatProjectDesignSegmentSidebarMeta(
  segment: Pick<ProjectDesignSegment, "cableReference" | "plannedLengthM">
): string {
  const reference = segment.cableReference.trim()
  const length = formatPlannedLengthMeters(segment.plannedLengthM)
  return reference ? `${reference} · ${length}` : length
}

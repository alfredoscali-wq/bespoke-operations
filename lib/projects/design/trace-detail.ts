import {
  formatGainMeters,
  formatPlannedLengthMeters,
  roundPlannedLengthMeters,
} from "@/lib/gps/distance"
import { formatProjectDesignSegmentTypeLabel } from "@/lib/projects/design/labels"
import { resolveProjectDesignSegmentLabel } from "@/lib/projects/design/summary"
import {
  normalizeTendidoSegmentIds,
  tendidoGainsForSegments,
} from "@/lib/projects/design/tendido"
import type {
  ProjectDesignElement,
  ProjectDesignGain,
  ProjectDesignSegment,
  ProjectDesignSegmentType,
  ProjectDesignSnapshot,
} from "@/lib/types/project-design"

export const PROJECT_DESIGN_UNDEFINED_ENDPOINT = "Sin definir"
export const PROJECT_DESIGN_UNSPECIFIED_CABLE = "Sin especificar"
export const PROJECT_DESIGN_EMPTY_NOTES = "—"

export type ProjectDesignTraceDetail = {
  id: string
  identifier: string
  type: ProjectDesignSegmentType
  typeLabel: string
  plannedLengthM: number
  plannedLengthLabel: string
  cableReference: string
  cableReferenceLabel: string
  originLabel: string
  destinationLabel: string
  originDestinationLabel: string
  gainM: number
  gainLabel: string
  observations: string
  observationsLabel: string
}

export type TendidoOtTracesView = {
  traces: ProjectDesignTraceDetail[]
  missingSegmentIds: string[]
  plannedLengthM: number
  traceGainM: number
  plannedCableM: number
}

function emptySnapshot(
  snapshot?: ProjectDesignSnapshot | null
): ProjectDesignSnapshot {
  if (!snapshot) {
    return { elements: [], segments: [], gains: [] }
  }
  return {
    elements: snapshot.elements ?? [],
    segments: snapshot.segments ?? [],
    gains: snapshot.gains ?? [],
  }
}

export function resolveProjectDesignEndpointLabel(
  elementId: string | null | undefined,
  elements: Pick<ProjectDesignElement, "id" | "name">[]
): string {
  const id = typeof elementId === "string" ? elementId.trim() : ""
  if (!id) {
    return PROJECT_DESIGN_UNDEFINED_ENDPOINT
  }
  const element = elements.find((item) => item.id === id)
  const name = element?.name.trim() ?? ""
  return name || PROJECT_DESIGN_UNDEFINED_ENDPOINT
}

export function formatProjectDesignCableReference(
  value: string | null | undefined
): string {
  const trimmed = typeof value === "string" ? value.trim() : ""
  return trimmed || PROJECT_DESIGN_UNSPECIFIED_CABLE
}

export function sumProjectDesignTraceGains(
  gains: ReadonlyArray<Pick<ProjectDesignGain, "segmentId" | "gainM">>,
  segmentId: string
): number {
  return roundPlannedLengthMeters(
    tendidoGainsForSegments(gains, [segmentId]).reduce(
      (total, gain) => total + (gain.gainM ?? 0),
      0
    )
  )
}

export function buildProjectDesignTraceDetail(
  segment: Pick<
    ProjectDesignSegment,
    | "id"
    | "name"
    | "type"
    | "plannedLengthM"
    | "cableReference"
    | "originElementId"
    | "destinationElementId"
    | "notes"
  >,
  snapshot?: ProjectDesignSnapshot | null
): ProjectDesignTraceDetail {
  const data = emptySnapshot(snapshot)
  const originLabel = resolveProjectDesignEndpointLabel(
    segment.originElementId,
    data.elements
  )
  const destinationLabel = resolveProjectDesignEndpointLabel(
    segment.destinationElementId,
    data.elements
  )
  const plannedLengthM = roundPlannedLengthMeters(segment.plannedLengthM ?? 0)
  const gainM = sumProjectDesignTraceGains(data.gains, segment.id)
  const notes = segment.notes?.trim() ?? ""

  return {
    id: segment.id,
    identifier: resolveProjectDesignSegmentLabel(segment, data.elements),
    type: segment.type,
    typeLabel: formatProjectDesignSegmentTypeLabel(segment.type),
    plannedLengthM,
    plannedLengthLabel: formatPlannedLengthMeters(plannedLengthM),
    cableReference: segment.cableReference?.trim() ?? "",
    cableReferenceLabel: formatProjectDesignCableReference(segment.cableReference),
    originLabel,
    destinationLabel,
    originDestinationLabel: `${originLabel} → ${destinationLabel}`,
    gainM,
    gainLabel: formatGainMeters(gainM),
    observations: notes,
    observationsLabel: notes || PROJECT_DESIGN_EMPTY_NOTES,
  }
}

export function buildTendidoOtTracesView(input: {
  snapshot?: ProjectDesignSnapshot | null
  segmentIds?: readonly string[] | null
}): TendidoOtTracesView {
  const data = emptySnapshot(input.snapshot)
  const segmentIds = normalizeTendidoSegmentIds(input.segmentIds)
  const traces: ProjectDesignTraceDetail[] = []
  const missingSegmentIds: string[] = []

  for (const id of segmentIds) {
    const segment = data.segments.find((item) => item.id === id)
    if (!segment) {
      missingSegmentIds.push(id)
      continue
    }
    traces.push(buildProjectDesignTraceDetail(segment, data))
  }

  const selectedIds = traces.map((trace) => trace.id)
  const plannedLengthM = roundPlannedLengthMeters(
    traces.reduce((total, trace) => total + trace.plannedLengthM, 0)
  )
  const traceGainM = roundPlannedLengthMeters(
    tendidoGainsForSegments(data.gains, selectedIds).reduce(
      (total, gain) => total + (gain.gainM ?? 0),
      0
    )
  )

  return {
    traces,
    missingSegmentIds,
    plannedLengthM,
    traceGainM,
    plannedCableM: roundPlannedLengthMeters(plannedLengthM + traceGainM),
  }
}

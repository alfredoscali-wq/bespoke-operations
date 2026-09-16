import { roundPlannedLengthMeters } from "@/lib/gps/distance"
import { resolveProjectDesignSegmentLabel } from "@/lib/projects/design/summary"
import type {
  ProjectDesignElement,
  ProjectDesignGain,
  ProjectDesignSegment,
  ProjectDesignSnapshot,
} from "@/lib/types/project-design"
import {
  PROJECT_DESIGN_PLAN_SNAPSHOT_METADATA_KEY,
  PROJECT_DESIGN_SOURCE_METADATA_KEY,
  PROJECT_DESIGN_WORK_TYPE_METADATA_KEY,
  type ProjectDesignSegmentsSourceMetadata,
  type ProjectDesignTendidoPlanSegment,
  type ProjectDesignTendidoPlanSnapshot,
} from "@/lib/types/project-design-ot"

export {
  PROJECT_DESIGN_PLAN_SNAPSHOT_METADATA_KEY,
  PROJECT_DESIGN_SOURCE_METADATA_KEY,
  PROJECT_DESIGN_WORK_TYPE_METADATA_KEY,
}

export const TENDIDO_EMPTY_SELECTION_MESSAGE =
  "Seleccioná al menos una traza."

export const TENDIDO_NO_TRACES_MESSAGE =
  "Esta Obra no tiene trazas de Tendido disponibles."

export const TENDIDO_INVALID_ID_MESSAGE =
  "Hay trazas seleccionadas que no existen en el diseño."

export const TENDIDO_WRONG_PROJECT_MESSAGE =
  "Hay trazas seleccionadas que no pertenecen a esta Obra."

export const TENDIDO_WRONG_TYPE_MESSAGE =
  "Solo se pueden seleccionar trazas de tipo Tendido."

export type TendidoPlanErrorCode =
  | "empty-selection"
  | "invalid-id"
  | "wrong-project"
  | "wrong-type"

export type TendidoTraceOption = {
  id: string
  label: string
  originDestination: string | null
  plannedLengthM: number
  gainCount: number
  gainM: number
}

export type TendidoPlan = {
  segments: ProjectDesignSegment[]
  gains: ProjectDesignGain[]
  plannedLengthM: number
  traceGainM: number
  plannedCableM: number
  source: ProjectDesignSegmentsSourceMetadata
  snapshot: ProjectDesignTendidoPlanSnapshot
}

export type TendidoPlanResult =
  | { ok: true; plan: TendidoPlan }
  | { ok: false; code: TendidoPlanErrorCode; message: string }

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

export function normalizeTendidoSegmentIds(
  ids: readonly unknown[] | null | undefined
): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  if (!ids) {
    return result
  }
  for (const value of ids) {
    if (typeof value !== "string") {
      continue
    }
    const id = value.trim()
    if (!id || seen.has(id)) {
      continue
    }
    seen.add(id)
    result.push(id)
  }
  return result
}

export function listSelectableTendidoSegments(
  snapshot: ProjectDesignSnapshot | null | undefined,
  projectId: string
): ProjectDesignSegment[] {
  const data = emptySnapshot(snapshot)
  const project = projectId.trim()
  return data.segments.filter(
    (segment) =>
      segment.type === "tendido" &&
      (!project || segment.projectId === project)
  )
}

export function formatTendidoOriginDestination(
  segment: Pick<ProjectDesignSegment, "originElementId" | "destinationElementId">,
  elements: Pick<ProjectDesignElement, "id" | "name">[]
): string | null {
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
  return null
}

export function listTendidoTraceOptions(
  snapshot: ProjectDesignSnapshot | null | undefined,
  projectId: string
): TendidoTraceOption[] {
  const data = emptySnapshot(snapshot)
  const segments = listSelectableTendidoSegments(data, projectId)
  return segments.map((segment) => {
    const gains = data.gains.filter((gain) => gain.segmentId === segment.id)
    return {
      id: segment.id,
      label: resolveProjectDesignSegmentLabel(segment, data.elements),
      originDestination: formatTendidoOriginDestination(segment, data.elements),
      plannedLengthM: roundPlannedLengthMeters(segment.plannedLengthM),
      gainCount: gains.length,
      gainM: roundPlannedLengthMeters(
        gains.reduce((total, gain) => total + (gain.gainM ?? 0), 0)
      ),
    }
  })
}

function asTendidoPlanSegmentType(
  value: unknown
): ProjectDesignTendidoPlanSegment["type"] | null {
  if (value === "tendido" || value === "drop" || value === "otro") {
    return value
  }
  return null
}

function tendidoError(
  code: TendidoPlanErrorCode,
  message: string
): { ok: false; code: TendidoPlanErrorCode; message: string } {
  return { ok: false, code, message }
}

export function resolveTendidoPlan(input: {
  snapshot?: ProjectDesignSnapshot | null
  projectId: string
  segmentIds: readonly string[]
  capturedAt?: Date
}): TendidoPlanResult {
  const data = emptySnapshot(input.snapshot)
  const projectId = input.projectId.trim()
  const segmentIds = normalizeTendidoSegmentIds(input.segmentIds)

  if (segmentIds.length === 0) {
    return tendidoError("empty-selection", TENDIDO_EMPTY_SELECTION_MESSAGE)
  }

  const selected: ProjectDesignSegment[] = []
  for (const id of segmentIds) {
    const segment = data.segments.find((item) => item.id === id)
    if (!segment) {
      return tendidoError("invalid-id", TENDIDO_INVALID_ID_MESSAGE)
    }
    if (projectId && segment.projectId !== projectId) {
      return tendidoError("wrong-project", TENDIDO_WRONG_PROJECT_MESSAGE)
    }
    if (segment.type !== "tendido") {
      return tendidoError("wrong-type", TENDIDO_WRONG_TYPE_MESSAGE)
    }
    selected.push(segment)
  }

  const selectedIds = new Set(selected.map((segment) => segment.id))
  const gains = data.gains.filter((gain) => selectedIds.has(gain.segmentId))
  const plannedLengthM = roundPlannedLengthMeters(
    selected.reduce((total, segment) => total + (segment.plannedLengthM ?? 0), 0)
  )
  const traceGainM = roundPlannedLengthMeters(
    gains.reduce((total, gain) => total + (gain.gainM ?? 0), 0)
  )
  const plannedCableM = roundPlannedLengthMeters(plannedLengthM + traceGainM)
  const capturedAt = (input.capturedAt ?? new Date()).toISOString()
  const source: ProjectDesignSegmentsSourceMetadata = {
    kind: "segments",
    segmentIds: selected.map((segment) => segment.id),
  }

  const snapshot: ProjectDesignTendidoPlanSnapshot = {
    capturedAt,
    workType: "tendido",
    segmentIds: source.segmentIds,
    segments: selected.map((segment) => ({
      id: segment.id,
      label: resolveProjectDesignSegmentLabel(segment, data.elements),
      type: segment.type,
      plannedLengthM: roundPlannedLengthMeters(segment.plannedLengthM),
    })),
    gainIds: gains.map((gain) => gain.id),
    plannedLengthM,
    traceGainM,
    plannedCableM,
  }

  return {
    ok: true,
    plan: {
      segments: selected,
      gains,
      plannedLengthM,
      traceGainM,
      plannedCableM,
      source,
      snapshot,
    },
  }
}

export function buildTendidoSourceMetadata(
  segmentIds: readonly string[]
): ProjectDesignSegmentsSourceMetadata {
  return {
    kind: "segments",
    segmentIds: normalizeTendidoSegmentIds(segmentIds),
  }
}

export function mergeTendidoPlanIntoMetadata(
  existing: Record<string, unknown> | undefined,
  plan: Pick<TendidoPlan, "source" | "snapshot">
): Record<string, unknown> {
  return {
    ...(existing ?? {}),
    [PROJECT_DESIGN_WORK_TYPE_METADATA_KEY]: "tendido",
    [PROJECT_DESIGN_SOURCE_METADATA_KEY]: plan.source,
    [PROJECT_DESIGN_PLAN_SNAPSHOT_METADATA_KEY]: plan.snapshot,
  }
}

export function readProjectDesignPlanSnapshot(
  metadata: Record<string, unknown> | undefined
): ProjectDesignTendidoPlanSnapshot | null {
  const raw = metadata?.[PROJECT_DESIGN_PLAN_SNAPSHOT_METADATA_KEY]
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return null
  }
  const record = raw as Record<string, unknown>
  if (record.workType !== "tendido") {
    return null
  }
  const segmentIds = normalizeTendidoSegmentIds(
    Array.isArray(record.segmentIds) ? record.segmentIds : []
  )
  if (segmentIds.length === 0) {
    return null
  }
  const plannedLengthM =
    typeof record.plannedLengthM === "number" ? record.plannedLengthM : null
  const traceGainM =
    typeof record.traceGainM === "number" ? record.traceGainM : null
  const plannedCableM =
    typeof record.plannedCableM === "number" ? record.plannedCableM : null
  if (
    plannedLengthM == null ||
    traceGainM == null ||
    plannedCableM == null
  ) {
    return null
  }

  const segments = Array.isArray(record.segments)
    ? record.segments.flatMap((item) => {
        if (!item || typeof item !== "object" || Array.isArray(item)) {
          return []
        }
        const row = item as Record<string, unknown>
        const id = typeof row.id === "string" ? row.id.trim() : ""
        const label = typeof row.label === "string" ? row.label : ""
        const type = asTendidoPlanSegmentType(row.type)
        const length =
          typeof row.plannedLengthM === "number" ? row.plannedLengthM : null
        if (!id || length == null || !type) {
          return []
        }
        return [
          {
            id,
            label,
            type,
            plannedLengthM: length,
          },
        ]
      })
    : []

  const gainIds = normalizeTendidoSegmentIds(
    Array.isArray(record.gainIds) ? record.gainIds : []
  )

  return {
    capturedAt:
      typeof record.capturedAt === "string" ? record.capturedAt : "",
    workType: "tendido",
    segmentIds,
    segments,
    gainIds,
    plannedLengthM,
    traceGainM,
    plannedCableM,
  }
}

export function buildDefaultTendidoOtTitle(
  options: TendidoTraceOption[]
): string {
  if (options.length === 0) {
    return "Tendido"
  }
  if (options.length === 1) {
    return `Tendido · ${options[0].label}`
  }
  return `Tendido · ${options.length} trazas`
}

export function tendidoGainsForSegments<
  T extends Pick<ProjectDesignGain, "segmentId">,
>(gains: readonly T[], segmentIds: readonly string[]): T[] {
  const allowed = new Set(normalizeTendidoSegmentIds(segmentIds))
  return gains.filter((gain) => allowed.has(gain.segmentId))
}

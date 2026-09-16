import { hasCoordinates } from "@/lib/gps/coordinates"
import {
  calculatePolylineLengthMeters,
  roundPlannedLengthMeters,
} from "@/lib/gps/distance"
import {
  DEFAULT_NAP_COLOR,
  DEFAULT_NODE_COLOR,
  DEFAULT_SEGMENT_COLOR,
  isProjectDesignHexColor,
  normalizeProjectDesignColor,
} from "@/lib/projects/design/colors"
import {
  defaultIconForKind,
  resolveElementIcon,
} from "@/lib/projects/design/icons"
import { parseProjectDesignGainMeters } from "@/lib/projects/design/gains"
import { validateDesignGeometry } from "@/lib/projects/design/geometry"
import { assertSameProjectDesignTenant } from "@/lib/projects/design/deletion"
import type { GpsCoordinates } from "@/lib/gps/types"
import type {
  CreateProjectDesignElementInput,
  CreateProjectDesignGainInput,
  CreateProjectDesignSegmentInput,
  ProjectDesignElementIcon,
  ProjectDesignElementKind,
  ProjectDesignSegmentType,
} from "@/lib/types/project-design"
import { PROJECT_DESIGN_SEGMENT_TYPES } from "@/lib/types/project-design"

export function validateProjectDesignElementDraft(input: {
  companyId: string
  projectCompanyId: string
  projectId: string
  kind: ProjectDesignElementKind
  name: string
  latitude: number
  longitude: number
  color?: string
  icon?: ProjectDesignElementIcon
  gainM?: number
}): { ok: true } | { ok: false; message: string } {
  const tenant = assertSameProjectDesignTenant({
    companyId: input.companyId,
    projectCompanyId: input.projectCompanyId,
    projectId: input.projectId,
    resourceProjectId: input.projectId,
  })
  if (!tenant.ok) {
    return tenant
  }

  if (input.kind !== "node" && input.kind !== "nap") {
    return { ok: false, message: "Tipo de elemento no válido." }
  }

  if (!input.name.trim()) {
    return { ok: false, message: "El identificador es obligatorio." }
  }

  if (!hasCoordinates(input.latitude, input.longitude)) {
    return { ok: false, message: "Las coordenadas GPS no son válidas." }
  }

  if (input.color && !isProjectDesignHexColor(input.color)) {
    return { ok: false, message: "El color no es válido." }
  }

  if (input.icon && resolveElementIcon(input.kind, input.icon) !== input.icon) {
    return { ok: false, message: "El icono no es válido para este elemento." }
  }

  if (input.gainM !== undefined && parseProjectDesignGainMeters(input.gainM) == null) {
    return { ok: false, message: "La ganancia debe ser un número mayor o igual a 0." }
  }

  return { ok: true }
}

function isSegmentType(value: unknown): value is ProjectDesignSegmentType {
  return (
    typeof value === "string" &&
    (PROJECT_DESIGN_SEGMENT_TYPES as readonly string[]).includes(value)
  )
}

export function prepareProjectDesignSegmentDraft(input: {
  companyId: string
  projectCompanyId: string
  projectId: string
  geometry: GpsCoordinates[]
  originElementId?: string | null
  destinationElementId?: string | null
  name?: string
  type?: ProjectDesignSegmentType
  cableReference?: string
  color?: string
  notes?: string
}):
  | {
      ok: true
      payload: CreateProjectDesignSegmentInput
      plannedLengthM: number
    }
  | { ok: false; message: string } {
  const tenant = assertSameProjectDesignTenant({
    companyId: input.companyId,
    projectCompanyId: input.projectCompanyId,
    projectId: input.projectId,
    resourceProjectId: input.projectId,
  })
  if (!tenant.ok) {
    return tenant
  }

  const geometry = validateDesignGeometry(input.geometry)
  if (!geometry.ok) {
    return geometry
  }

  if (input.type && !isSegmentType(input.type)) {
    return { ok: false, message: "El tipo de tramo no es válido." }
  }

  if (input.color && !isProjectDesignHexColor(input.color)) {
    return { ok: false, message: "El color del tramo no es válido." }
  }

  const plannedLengthM = roundPlannedLengthMeters(
    calculatePolylineLengthMeters(geometry.points)
  )

  return {
    ok: true,
    plannedLengthM,
    payload: {
      companyId: input.companyId,
      projectId: input.projectId,
      originElementId: input.originElementId ?? null,
      destinationElementId: input.destinationElementId ?? null,
      name: input.name?.trim() ?? "",
      type: input.type ?? "tendido",
      cableReference: input.cableReference?.trim() ?? "",
      color: normalizeProjectDesignColor(input.color, DEFAULT_SEGMENT_COLOR),
      notes: input.notes?.trim() ?? "",
      geometry: geometry.points,
    },
  }
}

export function prepareProjectDesignElementDraft(
  input: CreateProjectDesignElementInput & { projectCompanyId: string }
):
  | { ok: true; payload: CreateProjectDesignElementInput }
  | { ok: false; message: string } {
  const validation = validateProjectDesignElementDraft(input)
  if (!validation.ok) {
    return validation
  }

  return {
    ok: true,
    payload: {
      companyId: input.companyId,
      projectId: input.projectId,
      kind: input.kind,
      name: input.name.trim(),
      latitude: input.latitude,
      longitude: input.longitude,
      notes: input.notes?.trim() ?? "",
      color: normalizeProjectDesignColor(
        input.color,
        input.kind === "nap" ? DEFAULT_NAP_COLOR : DEFAULT_NODE_COLOR
      ),
      icon: resolveElementIcon(
        input.kind,
        input.icon ?? defaultIconForKind(input.kind)
      ),
      gainM: parseProjectDesignGainMeters(input.gainM ?? 0) ?? 0,
      displayOrder: input.displayOrder,
    },
  }
}

export function prepareProjectDesignGainDraft(input: {
  companyId: string
  projectCompanyId: string
  projectId: string
  segmentId: string
  segmentProjectId: string
  latitude: number
  longitude: number
  gainM: number
  observations?: string
}):
  | { ok: true; payload: CreateProjectDesignGainInput }
  | { ok: false; message: string } {
  const tenant = assertSameProjectDesignTenant({
    companyId: input.companyId,
    projectCompanyId: input.projectCompanyId,
    projectId: input.projectId,
    resourceProjectId: input.projectId,
  })
  if (!tenant.ok) {
    return tenant
  }

  if (input.segmentProjectId !== input.projectId) {
    return { ok: false, message: "La ganancia no pertenece a esta traza." }
  }

  if (!input.segmentId.trim()) {
    return { ok: false, message: "La ganancia debe asociarse a una traza." }
  }

  if (!hasCoordinates(input.latitude, input.longitude)) {
    return { ok: false, message: "Las coordenadas GPS no son válidas." }
  }

  const gainM = parseProjectDesignGainMeters(input.gainM)
  if (gainM == null) {
    return { ok: false, message: "La ganancia debe ser un número mayor o igual a 0." }
  }

  return {
    ok: true,
    payload: {
      companyId: input.companyId,
      projectId: input.projectId,
      segmentId: input.segmentId,
      latitude: input.latitude,
      longitude: input.longitude,
      gainM,
      observations: input.observations?.trim() ?? "",
    },
  }
}

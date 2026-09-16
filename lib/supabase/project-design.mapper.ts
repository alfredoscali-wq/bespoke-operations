import type { Json } from "@/lib/supabase/database.types"
import type {
  ProjectDesignElementRow,
  ProjectDesignElementInsert,
  ProjectDesignElementUpdate,
  ProjectDesignGainRow,
  ProjectDesignGainInsert,
  ProjectDesignGainUpdate,
  ProjectDesignSegmentRow,
  ProjectDesignSegmentInsert,
  ProjectDesignSegmentUpdate,
} from "@/lib/supabase/database.aliases"
import {
  DEFAULT_NAP_COLOR,
  DEFAULT_NODE_COLOR,
  DEFAULT_SEGMENT_COLOR,
  normalizeProjectDesignColor,
} from "@/lib/projects/design/colors"
import { parseProjectDesignGainMeters } from "@/lib/projects/design/gains"
import {
  defaultIconForKind,
  resolveElementIcon,
} from "@/lib/projects/design/icons"
import { parseDesignGeometry } from "@/lib/projects/design/geometry"
import type {
  CreateProjectDesignElementInput,
  CreateProjectDesignGainInput,
  CreateProjectDesignSegmentInput,
  ProjectDesignElement,
  ProjectDesignElementKind,
  ProjectDesignGain,
  ProjectDesignSegment,
  ProjectDesignSegmentType,
  UpdateProjectDesignElementInput,
  UpdateProjectDesignGainInput,
  UpdateProjectDesignSegmentInput,
} from "@/lib/types/project-design"
import { PROJECT_DESIGN_SEGMENT_TYPES } from "@/lib/types/project-design"

function mapNumeric(value: number | string): number {
  return typeof value === "number" ? value : Number(value)
}

function isElementKind(value: string): value is ProjectDesignElementKind {
  return value === "node" || value === "nap"
}

function isSegmentType(value: string): value is ProjectDesignSegmentType {
  return (PROJECT_DESIGN_SEGMENT_TYPES as readonly string[]).includes(value)
}

export function mapProjectDesignElementRow(
  row: ProjectDesignElementRow
): ProjectDesignElement {
  if (!isElementKind(row.kind)) {
    throw new Error("PROJECT_DESIGN_ELEMENT_KIND_INVALID")
  }

  return {
    id: row.id,
    companyId: row.company_id,
    projectId: row.project_id,
    kind: row.kind,
    name: row.name,
    latitude: mapNumeric(row.latitude),
    longitude: mapNumeric(row.longitude),
    notes: row.notes,
    color: normalizeProjectDesignColor(
      row.color,
      row.kind === "nap" ? DEFAULT_NAP_COLOR : DEFAULT_NODE_COLOR
    ),
    icon: resolveElementIcon(row.kind, row.icon),
    gainM: parseProjectDesignGainMeters(row.gain_m ?? 0) ?? 0,
    displayOrder: row.display_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function mapCreateElementToInsert(
  input: CreateProjectDesignElementInput
): ProjectDesignElementInsert {
  return {
    company_id: input.companyId,
    project_id: input.projectId,
    kind: input.kind,
    name: input.name.trim(),
    latitude: input.latitude,
    longitude: input.longitude,
    notes: input.notes?.trim() ?? "",
    color: normalizeProjectDesignColor(
      input.color,
      input.kind === "nap" ? DEFAULT_NAP_COLOR : DEFAULT_NODE_COLOR
    ),
    icon: resolveElementIcon(input.kind, input.icon ?? defaultIconForKind(input.kind)),
    gain_m: parseProjectDesignGainMeters(input.gainM ?? 0) ?? 0,
    display_order: input.displayOrder ?? 0,
  }
}

export function mapUpdateElementToUpdate(
  input: UpdateProjectDesignElementInput
): ProjectDesignElementUpdate {
  const update: ProjectDesignElementUpdate = {}
  if (input.name !== undefined) update.name = input.name.trim()
  if (input.latitude !== undefined) update.latitude = input.latitude
  if (input.longitude !== undefined) update.longitude = input.longitude
  if (input.notes !== undefined) update.notes = input.notes
  if (input.color !== undefined) {
    update.color = normalizeProjectDesignColor(
      input.color,
      DEFAULT_NAP_COLOR
    )
  }
  if (input.icon !== undefined) update.icon = input.icon
  if (input.gainM !== undefined) {
    update.gain_m = parseProjectDesignGainMeters(input.gainM) ?? 0
  }
  if (input.displayOrder !== undefined) update.display_order = input.displayOrder
  return update
}

export function mapProjectDesignSegmentRow(
  row: ProjectDesignSegmentRow
): ProjectDesignSegment {
  const geometry = parseDesignGeometry(row.geometry)
  if (!geometry) {
    throw new Error("PROJECT_DESIGN_GEOMETRY_INVALID")
  }

  return {
    id: row.id,
    companyId: row.company_id,
    projectId: row.project_id,
    originElementId: row.origin_element_id,
    destinationElementId: row.destination_element_id,
    name: row.name,
    type: isSegmentType(row.type) ? row.type : "tendido",
    cableReference: row.cable_reference,
    color: normalizeProjectDesignColor(row.color, DEFAULT_SEGMENT_COLOR),
    notes: row.notes,
    geometry,
    plannedLengthM: mapNumeric(row.planned_length_m),
    displayOrder: row.display_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function mapCreateSegmentToInsert(
  input: CreateProjectDesignSegmentInput
): ProjectDesignSegmentInsert {
  return {
    company_id: input.companyId,
    project_id: input.projectId,
    origin_element_id: input.originElementId ?? null,
    destination_element_id: input.destinationElementId ?? null,
    name: input.name?.trim() ?? "",
    type: input.type ?? "tendido",
    cable_reference: input.cableReference?.trim() ?? "",
    color: normalizeProjectDesignColor(input.color, DEFAULT_SEGMENT_COLOR),
    notes: input.notes?.trim() ?? "",
    geometry: input.geometry as unknown as Json,
    planned_length_m: 0,
    display_order: input.displayOrder ?? 0,
  }
}

export function mapUpdateSegmentToUpdate(
  input: UpdateProjectDesignSegmentInput
): ProjectDesignSegmentUpdate {
  const update: ProjectDesignSegmentUpdate = {}
  if (input.originElementId !== undefined) {
    update.origin_element_id = input.originElementId
  }
  if (input.destinationElementId !== undefined) {
    update.destination_element_id = input.destinationElementId
  }
  if (input.name !== undefined) update.name = input.name.trim()
  if (input.type !== undefined) update.type = input.type
  if (input.cableReference !== undefined) {
    update.cable_reference = input.cableReference.trim()
  }
  if (input.color !== undefined) {
    update.color = normalizeProjectDesignColor(input.color, DEFAULT_SEGMENT_COLOR)
  }
  if (input.notes !== undefined) update.notes = input.notes
  if (input.geometry !== undefined) {
    update.geometry = input.geometry as unknown as Json
  }
  if (input.displayOrder !== undefined) update.display_order = input.displayOrder
  return update
}

export function mapProjectDesignGainRow(
  row: ProjectDesignGainRow
): ProjectDesignGain {
  return {
    id: row.id,
    companyId: row.company_id,
    projectId: row.project_id,
    segmentId: row.segment_id,
    latitude: mapNumeric(row.latitude),
    longitude: mapNumeric(row.longitude),
    gainM: parseProjectDesignGainMeters(row.gain_m) ?? 0,
    observations: row.observations?.trim() ?? "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function mapCreateGainToInsert(
  input: CreateProjectDesignGainInput
): ProjectDesignGainInsert {
  return {
    company_id: input.companyId,
    project_id: input.projectId,
    segment_id: input.segmentId,
    latitude: input.latitude,
    longitude: input.longitude,
    gain_m: parseProjectDesignGainMeters(input.gainM) ?? 0,
    observations: input.observations?.trim() || null,
  }
}

export function mapUpdateGainToUpdate(
  input: UpdateProjectDesignGainInput
): ProjectDesignGainUpdate {
  const update: ProjectDesignGainUpdate = {}
  if (input.gainM !== undefined) {
    update.gain_m = parseProjectDesignGainMeters(input.gainM) ?? 0
  }
  if (input.observations !== undefined) {
    update.observations = input.observations.trim() || null
  }
  if (input.latitude !== undefined) update.latitude = input.latitude
  if (input.longitude !== undefined) update.longitude = input.longitude
  return update
}

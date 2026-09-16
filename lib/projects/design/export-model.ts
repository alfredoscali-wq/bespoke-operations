import { formatCoordinate, hasCoordinates } from "@/lib/gps/coordinates"
import {
  formatGainMeters,
  formatPlannedLengthMeters,
} from "@/lib/gps/distance"
import {
  DEFAULT_SEGMENT_COLOR,
  resolveElementColor,
  resolveSegmentColor,
} from "@/lib/projects/design/colors"
import {
  isProjectDesignExportSectionEnabled,
  PROJECT_DESIGN_EXPORT_SECTION_ORDER,
  type ProjectDesignExportOptions,
  type ProjectDesignExportSectionId,
} from "@/lib/projects/design/export-options"
import {
  formatProjectDesignKindLabel,
  formatProjectDesignSegmentTypeLabel,
} from "@/lib/projects/design/labels"
import {
  buildProjectDesignMapViewModel,
  type ProjectDesignMapViewModel,
} from "@/lib/projects/design/map-view"
import {
  buildProjectDesignSummary,
  resolveProjectDesignSegmentLabel,
} from "@/lib/projects/design/summary"
import { PROJECT_STATUS_LABELS } from "@/lib/projects/constants"
import type {
  ProjectDesignElement,
  ProjectDesignGain,
  ProjectDesignSegment,
  ProjectDesignSnapshot,
} from "@/lib/types/project-design"
import type { Project } from "@/lib/types/projects"

export type ProjectDesignExportLegendItem = {
  kind: "node" | "nap" | "gain" | "trace"
  label: string
  color: string
  typeLabel?: string
}

export type ProjectDesignExportElementRow = {
  identifier: string
  name: string
  latitude: string
  longitude: string
  gainM: string
  notes: string
}

export type ProjectDesignExportTraceRow = {
  identifier: string
  type: string
  origin: string
  destination: string
  plannedLengthM: string
  notes: string
}

export type ProjectDesignExportGainRow = {
  identifier: string
  trace: string
  latitude: string
  longitude: string
  gainM: string
}

export type ProjectDesignExportSummaryRow = {
  label: string
  value: string
}

export type ProjectDesignExportHeader = {
  brand: "BESPOKE"
  title: "Diseño de Obra"
  code: string
  name: string
  status: string
  location: string | null
  exportedAt: string
  crs: "WGS84 / EPSG:4326"
}

export type ProjectDesignExportModel = {
  filename: string
  format: "pdf"
  orientation: ProjectDesignExportOptions["orientation"]
  header: ProjectDesignExportHeader
  summary: {
    nodeCount: number
    napCount: number
    segmentCount: number
    gainCount: number
    plannedLengthM: number
    traceGainM: number
    elementGainM: number
    totalCableM: number
    rows: ProjectDesignExportSummaryRow[]
  }
  map: ProjectDesignMapViewModel
  legend: ProjectDesignExportLegendItem[]
  nodes: ProjectDesignExportElementRow[]
  naps: ProjectDesignExportElementRow[]
  traces: ProjectDesignExportTraceRow[]
  gains: ProjectDesignExportGainRow[]
  notes: string | null
  includedSections: ProjectDesignExportSectionId[]
}

const CRS_LABEL = "WGS84 / EPSG:4326" as const

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

export function formatProjectDesignExportTimestamp(date: Date): string {
  if (Number.isNaN(date.getTime())) {
    return "—"
  }
  const pad = (value: number) => String(value).padStart(2, "0")
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function sanitizeProjectDesignExportFilenamePart(
  value: string
): string {
  const cleaned = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
  return cleaned
}

export function buildProjectDesignExportFilename(input: {
  code?: string | null
  projectId: string
}): string {
  const fromCode = sanitizeProjectDesignExportFilenamePart(input.code ?? "")
  const fromId = sanitizeProjectDesignExportFilenamePart(input.projectId)
  const slug = fromCode || fromId || "obra"
  return `diseno-obra-${slug}.pdf`
}

function dashIfEmpty(value: string): string {
  const trimmed = value.trim()
  return trimmed ? trimmed : "—"
}

function formatOptionalCoordinate(
  latitude: number,
  longitude: number,
  axis: "latitude" | "longitude"
): string {
  if (!hasCoordinates(latitude, longitude)) {
    return "—"
  }
  return formatCoordinate(axis === "latitude" ? latitude : longitude)
}

function elementIdentifier(
  element: Pick<ProjectDesignElement, "name" | "kind">
): string {
  const name = element.name.trim()
  return name || formatProjectDesignKindLabel(element.kind)
}

function elementNotes(element: Pick<ProjectDesignElement, "notes">): string {
  return element.notes.trim()
}

function buildElementRows(
  elements: ProjectDesignElement[],
  kind: "node" | "nap"
): ProjectDesignExportElementRow[] {
  return elements
    .filter((element) => element.kind === kind)
    .map((element) => ({
      identifier: elementIdentifier(element),
      name: elementIdentifier(element),
      latitude: formatOptionalCoordinate(
        element.latitude,
        element.longitude,
        "latitude"
      ),
      longitude: formatOptionalCoordinate(
        element.latitude,
        element.longitude,
        "longitude"
      ),
      gainM: formatGainMeters(element.gainM ?? 0),
      notes: elementNotes(element),
    }))
}

function elementNameById(
  elements: Pick<ProjectDesignElement, "id" | "name" | "kind">[],
  id: string | null
): string {
  if (!id) {
    return "—"
  }
  const match = elements.find((element) => element.id === id)
  if (!match) {
    return "—"
  }
  return elementIdentifier(match)
}

function buildTraceRows(
  segments: ProjectDesignSegment[],
  elements: ProjectDesignElement[]
): ProjectDesignExportTraceRow[] {
  return segments.map((segment) => ({
    identifier: resolveProjectDesignSegmentLabel(segment, elements),
    type: formatProjectDesignSegmentTypeLabel(segment.type),
    origin: elementNameById(elements, segment.originElementId),
    destination: elementNameById(elements, segment.destinationElementId),
    plannedLengthM: formatPlannedLengthMeters(segment.plannedLengthM),
    notes: segment.notes.trim(),
  }))
}

function buildGainRows(
  gains: ProjectDesignGain[],
  segments: ProjectDesignSegment[],
  elements: ProjectDesignElement[]
): ProjectDesignExportGainRow[] {
  return gains.map((gain, index) => {
    const segment = segments.find((item) => item.id === gain.segmentId)
    return {
      identifier: `G${index + 1}`,
      trace: segment
        ? resolveProjectDesignSegmentLabel(segment, elements)
        : "Tramo",
      latitude: formatOptionalCoordinate(
        gain.latitude,
        gain.longitude,
        "latitude"
      ),
      longitude: formatOptionalCoordinate(
        gain.latitude,
        gain.longitude,
        "longitude"
      ),
      gainM: formatGainMeters(gain.gainM),
    }
  })
}

function uniqueByKey<T>(items: T[], key: (item: T) => string): T[] {
  const seen = new Set<string>()
  const result: T[] = []
  for (const item of items) {
    const id = key(item)
    if (seen.has(id)) {
      continue
    }
    seen.add(id)
    result.push(item)
  }
  return result
}

export function buildProjectDesignExportLegend(
  snapshot: ProjectDesignSnapshot
): ProjectDesignExportLegendItem[] {
  const items: ProjectDesignExportLegendItem[] = []
  const nodes = snapshot.elements.filter((element) => element.kind === "node")
  const naps = snapshot.elements.filter((element) => element.kind === "nap")

  if (nodes.length > 0) {
    const colors = uniqueByKey(
      nodes.map((element) => resolveElementColor("node", element.color)),
      (color) => color
    )
    for (const color of colors) {
      items.push({
        kind: "node",
        label: colors.length > 1 ? `Nodo · ${color}` : "Nodo",
        color,
      })
    }
  }

  if (naps.length > 0) {
    const colors = uniqueByKey(
      naps.map((element) => resolveElementColor("nap", element.color)),
      (color) => color
    )
    for (const color of colors) {
      items.push({
        kind: "nap",
        label: colors.length > 1 ? `NAP · ${color}` : "NAP",
        color,
      })
    }
  }

  if (snapshot.gains.length > 0) {
    const color =
      resolveSegmentColor(snapshot.segments[0]?.color) || DEFAULT_SEGMENT_COLOR
    items.push({
      kind: "gain",
      label: "Punto de Ganancia",
      color,
    })
  }

  const traces = uniqueByKey(
    snapshot.segments.map((segment) => ({
      type: segment.type,
      color: resolveSegmentColor(segment.color),
      typeLabel: formatProjectDesignSegmentTypeLabel(segment.type),
    })),
    (item) => `${item.type}:${item.color}`
  )
  for (const trace of traces) {
    items.push({
      kind: "trace",
      label: `Traza · ${trace.typeLabel}`,
      color: trace.color,
      typeLabel: trace.typeLabel,
    })
  }

  return items
}

function buildSummaryRows(input: {
  project: Pick<Project, "code" | "name" | "status" | "location">
  nodeCount: number
  napCount: number
  segmentCount: number
  gainCount: number
  plannedLengthM: number
  traceGainM: number
  elementGainM: number
  totalCableM: number
}): ProjectDesignExportSummaryRow[] {
  const rows: ProjectDesignExportSummaryRow[] = [
    { label: "Código", value: dashIfEmpty(input.project.code) },
    { label: "Nombre", value: dashIfEmpty(input.project.name) },
    {
      label: "Estado",
      value: PROJECT_STATUS_LABELS[input.project.status] ?? input.project.status,
    },
  ]
  const location = input.project.location.trim()
  if (location) {
    rows.push({ label: "Localidad", value: location })
  }
  rows.push(
    { label: "Total Nodes", value: String(input.nodeCount) },
    { label: "Total NAPs", value: String(input.napCount) },
    { label: "Total trazas", value: String(input.segmentCount) },
    { label: "Total puntos de ganancia", value: String(input.gainCount) },
    {
      label: "Metros de tendido",
      value: formatPlannedLengthMeters(input.plannedLengthM),
    },
    {
      label: "Ganancias de trazas",
      value: formatGainMeters(input.traceGainM),
    },
    {
      label: "Ganancias de Nodes/NAPs",
      value: formatGainMeters(input.elementGainM),
    },
    {
      label: "Total de cable planificado",
      value: formatGainMeters(input.totalCableM),
    }
  )
  return rows
}

export function resolveProjectDesignExportSections(input: {
  options: ProjectDesignExportOptions
  legendCount: number
  nodeCount: number
  napCount: number
  traceCount: number
  gainCount: number
  notes: string | null
}): ProjectDesignExportSectionId[] {
  return PROJECT_DESIGN_EXPORT_SECTION_ORDER.filter((section) => {
    if (!isProjectDesignExportSectionEnabled(input.options, section)) {
      return false
    }
    if (section === "legend") {
      return input.legendCount > 0
    }
    if (section === "notes") {
      return Boolean(input.notes)
    }
    return true
  })
}

export function buildProjectDesignExportModel(input: {
  project: Pick<
    Project,
    | "id"
    | "code"
    | "name"
    | "status"
    | "location"
    | "description"
    | "latitude"
    | "longitude"
  >
  snapshot?: ProjectDesignSnapshot | null
  options: ProjectDesignExportOptions
  exportedAt?: Date
}): ProjectDesignExportModel {
  const snapshot = emptySnapshot(input.snapshot)
  const exportedAt = input.exportedAt ?? new Date()
  const totals = buildProjectDesignSummary(
    snapshot.elements,
    snapshot.segments,
    snapshot.gains
  )
  const notesRaw = input.project.description.trim()
  const notes = notesRaw ? notesRaw : null
  const legend = buildProjectDesignExportLegend(snapshot)
  const includedSections = resolveProjectDesignExportSections({
    options: input.options,
    legendCount: legend.length,
    nodeCount: totals.nodeCount,
    napCount: totals.napCount,
    traceCount: totals.segmentCount,
    gainCount: snapshot.gains.length,
    notes,
  })

  const map = buildProjectDesignMapViewModel({
    snapshot,
    projectLatitude: input.project.latitude,
    projectLongitude: input.project.longitude,
    highlight: null,
  })

  const location = input.project.location.trim() || null

  return {
    filename: buildProjectDesignExportFilename({
      code: input.project.code,
      projectId: input.project.id,
    }),
    format: "pdf",
    orientation: input.options.orientation,
    header: {
      brand: "BESPOKE",
      title: "Diseño de Obra",
      code: dashIfEmpty(input.project.code),
      name: dashIfEmpty(input.project.name),
      status: PROJECT_STATUS_LABELS[input.project.status] ?? input.project.status,
      location,
      exportedAt: formatProjectDesignExportTimestamp(exportedAt),
      crs: CRS_LABEL,
    },
    summary: {
      nodeCount: totals.nodeCount,
      napCount: totals.napCount,
      segmentCount: totals.segmentCount,
      gainCount: snapshot.gains.length,
      plannedLengthM: totals.plannedLengthM,
      traceGainM: totals.traceGainM,
      elementGainM: totals.elementGainM,
      totalCableM: totals.totalCableM,
      rows: buildSummaryRows({
        project: input.project,
        nodeCount: totals.nodeCount,
        napCount: totals.napCount,
        segmentCount: totals.segmentCount,
        gainCount: snapshot.gains.length,
        plannedLengthM: totals.plannedLengthM,
        traceGainM: totals.traceGainM,
        elementGainM: totals.elementGainM,
        totalCableM: totals.totalCableM,
      }),
    },
    map,
    legend,
    nodes: buildElementRows(snapshot.elements, "node"),
    naps: buildElementRows(snapshot.elements, "nap"),
    traces: buildTraceRows(snapshot.segments, snapshot.elements),
    gains: buildGainRows(snapshot.gains, snapshot.segments, snapshot.elements),
    notes,
    includedSections,
  }
}

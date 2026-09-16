export const PROJECT_DESIGN_ELEMENT_KINDS = ["node", "nap"] as const

export type ProjectDesignElementKind =
  (typeof PROJECT_DESIGN_ELEMENT_KINDS)[number]

export const PROJECT_DESIGN_SEGMENT_TYPES = ["tendido", "drop", "otro"] as const

export type ProjectDesignSegmentType =
  (typeof PROJECT_DESIGN_SEGMENT_TYPES)[number]

export const PROJECT_DESIGN_ELEMENT_ICONS = [
  "square",
  "circle",
  "marker",
  "diamond",
  "hexagon",
] as const

export type ProjectDesignElementIcon =
  (typeof PROJECT_DESIGN_ELEMENT_ICONS)[number]

export type ProjectDesignElement = {
  id: string
  companyId: string
  projectId: string
  kind: ProjectDesignElementKind
  name: string
  latitude: number
  longitude: number
  notes: string
  color: string
  icon: ProjectDesignElementIcon
  gainM: number
  displayOrder: number
  createdAt: string
  updatedAt: string
}

export type ProjectDesignSegment = {
  id: string
  companyId: string
  projectId: string
  originElementId: string | null
  destinationElementId: string | null
  name: string
  type: ProjectDesignSegmentType
  cableReference: string
  color: string
  notes: string
  geometry: Array<{ latitude: number; longitude: number }>
  plannedLengthM: number
  displayOrder: number
  createdAt: string
  updatedAt: string
}

export type ProjectDesignGain = {
  id: string
  companyId: string
  projectId: string
  segmentId: string
  latitude: number
  longitude: number
  gainM: number
  observations: string
  createdAt: string
  updatedAt: string
}

export type ProjectDesignSnapshot = {
  elements: ProjectDesignElement[]
  segments: ProjectDesignSegment[]
  gains: ProjectDesignGain[]
}

export type CreateProjectDesignElementInput = {
  companyId: string
  projectId: string
  kind: ProjectDesignElementKind
  name: string
  latitude: number
  longitude: number
  notes?: string
  color?: string
  icon?: ProjectDesignElementIcon
  gainM?: number
  displayOrder?: number
}

export type UpdateProjectDesignElementInput = {
  name?: string
  latitude?: number
  longitude?: number
  notes?: string
  color?: string
  icon?: ProjectDesignElementIcon
  gainM?: number
  displayOrder?: number
}

export type CreateProjectDesignSegmentInput = {
  companyId: string
  projectId: string
  originElementId?: string | null
  destinationElementId?: string | null
  name?: string
  type?: ProjectDesignSegmentType
  cableReference?: string
  color?: string
  notes?: string
  geometry: Array<{ latitude: number; longitude: number }>
  displayOrder?: number
}

export type UpdateProjectDesignSegmentInput = {
  originElementId?: string | null
  destinationElementId?: string | null
  name?: string
  type?: ProjectDesignSegmentType
  cableReference?: string
  color?: string
  notes?: string
  geometry?: Array<{ latitude: number; longitude: number }>
  displayOrder?: number
}

export type CreateProjectDesignGainInput = {
  companyId: string
  projectId: string
  segmentId: string
  latitude: number
  longitude: number
  gainM: number
  observations?: string
}

export type UpdateProjectDesignGainInput = {
  gainM?: number
  observations?: string
  latitude?: number
  longitude?: number
}

export type ProjectDesignTool =
  | "select"
  | "add-node"
  | "add-nap"
  | "draw-segment"
  | "add-gain"

export type ProjectDesignSelection =
  | { type: "element"; id: string }
  | { type: "segment"; id: string }
  | { type: "gain"; id: string }
  | null

export const PROJECT_DESIGN_MAP_HIGHLIGHT_KINDS = [
  "element",
  "segment",
] as const

export type ProjectDesignMapHighlightKind =
  (typeof PROJECT_DESIGN_MAP_HIGHLIGHT_KINDS)[number]

/**
 * Read-only map highlight. `id` is the current single-target API.
 * `ids` is reserved so a future Tendido OT can highlight several traces
 * without copying geometry onto the task.
 */
export type ProjectDesignMapHighlight = {
  kind: ProjectDesignMapHighlightKind
  id?: string
  ids?: readonly string[]
}

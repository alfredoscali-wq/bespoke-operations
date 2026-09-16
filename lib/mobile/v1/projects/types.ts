export type MobileProjectDesignWorkTypeDto = "tendido" | "node" | "nap"

export type MobileProjectDesignSegmentsSourceDto = {
  kind: "segments"
  segmentIds: string[]
}

export type MobileProjectDesignElementSourceDto = {
  kind: "node" | "nap"
  elementId: string
  identifier: string
}

export type MobileProjectDesignSourceDto =
  | MobileProjectDesignSegmentsSourceDto
  | MobileProjectDesignElementSourceDto

export type MobileProjectDesignCoordinateDto = {
  latitude: number
  longitude: number
}

export type MobileProjectDesignBoundingBoxDto = {
  south: number
  west: number
  north: number
  east: number
}

export type MobileProjectDesignSegmentDto = {
  id: string
  label: string
  type: "tendido" | "drop" | "otro"
  color: string
  cableReference: string
  coordinates: MobileProjectDesignCoordinateDto[]
  plannedLengthM: number
  originElementId: string | null
  destinationElementId: string | null
  notes: string
}

export type MobileProjectDesignElementDto = {
  id: string
  kind: "node" | "nap"
  identifier: string
  latitude: number
  longitude: number
  icon: string
  color: string
}

export type MobileProjectDesignGainDto = {
  id: string
  segmentId: string
  latitude: number
  longitude: number
  gainM: number
}

export type MobileProjectDesignMapDto = {
  projectId: string
  projectName: string
  designVersion: number
  updatedAt: string | null
  boundingBox: MobileProjectDesignBoundingBoxDto | null
  segments: MobileProjectDesignSegmentDto[]
  elements: MobileProjectDesignElementDto[]
  gains: MobileProjectDesignGainDto[]
}

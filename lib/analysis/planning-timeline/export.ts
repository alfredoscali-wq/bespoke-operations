/**
 * Export stubs for Timeline Operativo (Sprint 24).
 * Structure only — PDF / print / share not implemented yet.
 */

import type { PlanningTimelineReadModel } from "@/lib/analysis/planning-timeline/types"

export type PlanningTimelineExportFormat = "pdf" | "print" | "share"

export type PlanningTimelineExportRequest = {
  format: PlanningTimelineExportFormat
  model: PlanningTimelineReadModel
}

export type PlanningTimelineExportResult = {
  ready: false
  format: PlanningTimelineExportFormat
  message: string
}

export function preparePlanningTimelineExport(
  request: PlanningTimelineExportRequest
): PlanningTimelineExportResult {
  void request.model
  return {
    ready: false,
    format: request.format,
    message:
      "La exportación del Timeline Operativo estará disponible en un próximo sprint.",
  }
}

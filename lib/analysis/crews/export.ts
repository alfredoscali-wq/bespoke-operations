/**
 * Export stubs for CUADRILLAS (Sprint 25).
 */

import type { CrewsReadModel } from "@/lib/analysis/crews/types"

export type CrewsExportFormat = "pdf" | "csv" | "print" | "share"

export type CrewsExportRequest = {
  format: CrewsExportFormat
  model: CrewsReadModel
  selectedCrewId?: string | null
}

export type CrewsExportResult = {
  ready: false
  format: CrewsExportFormat
  message: string
}

export function prepareCrewsExport(
  request: CrewsExportRequest
): CrewsExportResult {
  void request.model
  void request.selectedCrewId
  return {
    ready: false,
    format: request.format,
    message:
      "La exportación de Cuadrillas estará disponible en un próximo sprint.",
  }
}

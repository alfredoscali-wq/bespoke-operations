/**
 * Export stubs for Producción de Cuadrillas (Sprint 21).
 * Structure only — PDF / CSV / print not implemented yet.
 */

import type { CrewProductionReadModel } from "@/lib/analysis/crew-production/types"

export type CrewProductionExportFormat = "pdf" | "csv" | "print"

export type CrewProductionExportRequest = {
  format: CrewProductionExportFormat
  model: CrewProductionReadModel
  selectedCrewId?: string | null
}

export type CrewProductionExportResult = {
  ready: false
  format: CrewProductionExportFormat
  message: string
}

/**
 * Prepares export payload. Implementation deferred to a later sprint.
 */
export function prepareCrewProductionExport(
  request: CrewProductionExportRequest
): CrewProductionExportResult {
  void request.model
  void request.selectedCrewId
  return {
    ready: false,
    format: request.format,
    message:
      "La exportación de Producción de Cuadrillas estará disponible en un próximo sprint.",
  }
}

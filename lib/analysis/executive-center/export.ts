/**
 * Export stubs for Centro Ejecutivo (Sprint 22).
 */

import type { ExecutiveCenterReadModel } from "@/lib/analysis/executive-center/types"

export type ExecutiveCenterExportFormat = "pdf" | "share" | "print"

export type ExecutiveCenterExportResult = {
  ready: false
  format: ExecutiveCenterExportFormat
  message: string
}

export function prepareExecutiveCenterExport(input: {
  format: ExecutiveCenterExportFormat
  model: ExecutiveCenterReadModel
}): ExecutiveCenterExportResult {
  void input.model
  return {
    ready: false,
    format: input.format,
    message:
      "La exportación del Centro Ejecutivo estará disponible en un próximo sprint.",
  }
}

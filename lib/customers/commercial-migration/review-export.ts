import * as XLSX from "xlsx"

import type { EnrichedMigrationCustomer } from "@/lib/customers/commercial-migration/review-types"
import {
  DUPLICATE_KIND_LABELS,
  getMigrationReviewPrimaryReason,
} from "@/lib/customers/commercial-migration/review-utils"
import {
  formatValidationStatusLabel,
} from "@/lib/customers/customer-validation"
import { formatCustomerTechnologyLabel } from "@/lib/customers/format"

function recordToExportRow(record: EnrichedMigrationCustomer) {
  return {
    Validación: record.effectiveValidationStatus
      ? formatValidationStatusLabel(record.effectiveValidationStatus)
      : "Descartado",
    "N° Cliente": record.externalCustomerCode,
    Nombre: record.name,
    DNI: record.dni,
    Teléfono: record.phone,
    Email: record.email,
    Dirección: record.address,
    Localidad: record.locality,
    Tecnología: formatCustomerTechnologyLabel(record.technology) ?? "",
    "Estado legacy": record.legacyClientState,
    Conexiones: record.totalConnectionCount,
    Motivo: getMigrationReviewPrimaryReason(record),
    Duplicados: record.duplicateMatches
      .map((kind) => DUPLICATE_KIND_LABELS[kind])
      .join(", "),
    Observaciones: record.observations,
    "Decisión manual": record.reviewAction ?? "",
  }
}

export function exportMigrationRecordsToXlsx(
  records: EnrichedMigrationCustomer[],
  filename: string
): void {
  const rows = records.map(recordToExportRow)
  const workbook = XLSX.utils.book_new()
  const sheet = XLSX.utils.json_to_sheet(rows)
  XLSX.utils.book_append_sheet(workbook, sheet, "Clientes")
  XLSX.writeFile(workbook, filename)
}

export function exportMigrationBucketsToXlsx(input: {
  activos: EnrichedMigrationCustomer[]
  revisar: EnrichedMigrationCustomer[]
  descartados: EnrichedMigrationCustomer[]
  prefix?: string
}): void {
  const stamp = new Date().toISOString().slice(0, 10)
  const prefix = input.prefix ?? "migracion-clientes"

  exportMigrationRecordsToXlsx(
    input.activos,
    `${prefix}-activos-${stamp}.xlsx`
  )
  exportMigrationRecordsToXlsx(
    input.revisar,
    `${prefix}-revisar-${stamp}.xlsx`
  )
  exportMigrationRecordsToXlsx(
    input.descartados,
    `${prefix}-descartados-${stamp}.xlsx`
  )
}

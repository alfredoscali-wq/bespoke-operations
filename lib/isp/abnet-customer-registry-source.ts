import "server-only"

import * as XLSX from "xlsx"

import { ABNET_CONNECTION_IMPORT_MAX_BYTES } from "@/lib/isp/abnet-connection-registry"
import { parseAbnetCustomerSheet } from "@/lib/isp/abnet-customer-registry"

export function readAbnetCustomerWorkbook(bytes: Uint8Array, fileName: string) {
  if (bytes.byteLength > ABNET_CONNECTION_IMPORT_MAX_BYTES) {
    return {
      records: [],
      issues: [{ rowNumber: 0, reason: "El archivo supera el tamaño permitido." }],
      headerRowNumber: 0,
      sourceName: fileName,
    }
  }
  const workbook = XLSX.read(bytes, { type: "array", cellDates: false })
  const sheetName = workbook.SheetNames.includes("Datos")
    ? "Datos"
    : workbook.SheetNames[0]
  if (!sheetName) {
    return {
      records: [],
      issues: [{ rowNumber: 0, reason: "El archivo no tiene hojas." }],
      headerRowNumber: 0,
      sourceName: fileName,
    }
  }
  const matrix = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
    header: 1,
    defval: null,
    raw: true,
  }) as unknown[][]
  const parsed = parseAbnetCustomerSheet(matrix)
  return { ...parsed, sourceName: fileName || sheetName }
}

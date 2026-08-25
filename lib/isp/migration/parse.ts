import { cellToString } from "@/lib/customers/customer-import/normalize"
import {
  ISP_MIGRATION_CATALOG_HEADERS,
  ISP_MIGRATION_CONNECTION_HEADERS,
  ISP_MIGRATION_CUSTOMER_HEADERS,
  ISP_MIGRATION_EQUIPMENT_HEADERS,
  ISP_MIGRATION_REQUIRED_SHEETS,
  ISP_MIGRATION_SERVICE_HEADERS,
  type IspMigrationSheetName,
} from "@/lib/isp/migration/constants"
import { normalizeMigrationKey } from "@/lib/isp/migration/maps"
import type {
  IspMigrationParsedRow,
  IspMigrationParsedWorkbook,
} from "@/lib/isp/migration/types"
import * as XLSX from "xlsx"

const SHEET_ALIASES: Record<string, IspMigrationSheetName> = {
  clientes: "CLIENTES",
  catalogo: "CATALOGO",
  catalogos: "CATALOGO",
  servicios: "SERVICIOS",
  conexiones: "CONEXIONES",
  equipamiento: "EQUIPAMIENTO",
  instrucciones: "INSTRUCCIONES",
}

function resolveSheetName(name: string): IspMigrationSheetName | null {
  return SHEET_ALIASES[normalizeMigrationKey(name)] ?? null
}

function headerIndex(
  headers: unknown[],
  expected: readonly string[]
): Map<string, number> {
  const map = new Map<string, number>()
  headers.forEach((header, index) => {
    const key = normalizeMigrationKey(cellToString(header)).replace(/ /g, "_")
    if (!key) return
    const match = expected.find((item) => item === key)
    if (match) map.set(match, index)
  })
  return map
}

function parseSheet(
  sheet: XLSX.WorkSheet | undefined,
  expected: readonly string[]
): IspMigrationParsedRow[] {
  if (!sheet) return []
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: "",
    raw: true,
  })
  if (matrix.length === 0) return []

  const columns = headerIndex(matrix[0] ?? [], expected)
  const rows: IspMigrationParsedRow[] = []

  for (let index = 1; index < matrix.length; index += 1) {
    const cells = matrix[index] ?? []
    const values: Record<string, string> = {}
    for (const header of expected) {
      const column = columns.get(header)
      values[header] = column == null ? "" : cellToString(cells[column])
    }
    rows.push({ rowNumber: index + 1, values })
  }

  return rows
}

export function parseIspMigrationWorkbook(
  buffer: ArrayBuffer | Buffer
): IspMigrationParsedWorkbook {
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true })
  const sheets: IspMigrationParsedWorkbook["sheets"] = {}
  const seen = new Set<IspMigrationSheetName>()

  for (const name of workbook.SheetNames) {
    const resolved = resolveSheetName(name)
    if (!resolved || seen.has(resolved)) continue
    seen.add(resolved)
    const sheet = workbook.Sheets[name]
    if (resolved === "CLIENTES") {
      sheets.CLIENTES = parseSheet(sheet, ISP_MIGRATION_CUSTOMER_HEADERS)
    } else if (resolved === "CATALOGO") {
      sheets.CATALOGO = parseSheet(sheet, ISP_MIGRATION_CATALOG_HEADERS)
    } else if (resolved === "SERVICIOS") {
      sheets.SERVICIOS = parseSheet(sheet, ISP_MIGRATION_SERVICE_HEADERS)
    } else if (resolved === "CONEXIONES") {
      sheets.CONEXIONES = parseSheet(sheet, ISP_MIGRATION_CONNECTION_HEADERS)
    } else if (resolved === "EQUIPAMIENTO") {
      sheets.EQUIPAMIENTO = parseSheet(sheet, ISP_MIGRATION_EQUIPMENT_HEADERS)
    } else {
      sheets.INSTRUCCIONES = []
    }
  }

  const missingRequiredSheets = ISP_MIGRATION_REQUIRED_SHEETS.filter(
    (sheet) => !seen.has(sheet)
  )

  return { sheets, missingRequiredSheets }
}

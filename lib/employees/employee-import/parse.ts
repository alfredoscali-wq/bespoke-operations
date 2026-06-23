import {
  getEmptyImportRowData,
  mapImportHeaders,
} from "@/lib/employees/employee-import/columns"
import type { EmployeeImportField } from "@/lib/employees/employee-import/types"
import {
  cellToOptionalDate,
  cellToString,
} from "@/lib/employees/employee-import/normalize"
import type { EmployeeImportRowData } from "@/lib/employees/employee-import/types"
import * as XLSX from "xlsx"

const DATA_SHEET_NAMES = ["empleados", "employees", "rrhh", "personal"]

function isRowEmpty(data: EmployeeImportRowData): boolean {
  return Object.values(data).every((value) => !String(value ?? "").trim())
}

function resolveDataSheetName(sheetNames: string[]): string | undefined {
  const normalizedNames = sheetNames.map((name) => ({
    original: name,
    normalized: name.trim().toLowerCase(),
  }))

  for (const preferred of DATA_SHEET_NAMES) {
    const match = normalizedNames.find((entry) => entry.normalized === preferred)
    if (match) {
      return match.original
    }
  }

  return sheetNames[0]
}

function applyFieldValue(
  data: EmployeeImportRowData,
  field: EmployeeImportField,
  rawValue: unknown
) {
  switch (field) {
    case "hireDate":
    case "birthDate":
      data[field] = cellToOptionalDate(rawValue) ?? ""
      break
    default:
      data[field] = cellToString(rawValue)
      break
  }
}

function rowArrayToData(
  cells: unknown[],
  columnMap: Partial<Record<number, EmployeeImportField>>
): EmployeeImportRowData {
  const data = getEmptyImportRowData()

  for (const [indexRaw, field] of Object.entries(columnMap)) {
    if (!field) continue
    const index = Number(indexRaw)
    applyFieldValue(data, field, cells[index])
  }

  return data
}

export async function parseEmployeeImportFile(
  file: File
): Promise<{ rows: { rowNumber: number; data: EmployeeImportRowData }[]; fileName: string }> {
  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer, {
    type: "array",
    cellDates: true,
  })

  const sheetName = resolveDataSheetName(workbook.SheetNames)
  if (!sheetName) {
    throw new Error("El archivo no contiene hojas de cálculo.")
  }

  const sheet = workbook.Sheets[sheetName]
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: "",
    raw: true,
  })

  if (matrix.length < 2) {
    throw new Error("El archivo no contiene filas de datos.")
  }

  const headerRow = matrix[0].map((cell) => cellToString(cell))
  const columnMap = mapImportHeaders(headerRow)

  if (Object.keys(columnMap).length === 0) {
    throw new Error(
      "No se reconocieron columnas válidas. Verifique los encabezados del Excel."
    )
  }

  const rows: { rowNumber: number; data: EmployeeImportRowData }[] = []

  matrix.slice(1).forEach((cells, index) => {
    if (!Array.isArray(cells)) return

    const data = rowArrayToData(cells, columnMap)
    if (isRowEmpty(data)) return

    rows.push({
      rowNumber: index + 2,
      data,
    })
  })

  if (rows.length === 0) {
    throw new Error("No se encontraron filas con datos para importar.")
  }

  return { rows, fileName: file.name }
}

import {
  getEmptyImportRowData,
  mapImportHeaders,
  type WorkOrderImportField,
} from "@/lib/tasks/work-order-import/columns"
import {
  cellToString,
  parseImportDate,
  resolveImportServiceType,
  resolveImportTechnology,
} from "@/lib/tasks/work-order-import/normalize"
import type { WorkOrderImportRowData } from "@/lib/tasks/work-order-import/types"
import * as XLSX from "xlsx"

function isRowEmpty(data: WorkOrderImportRowData): boolean {
  return Object.values(data).every((value) => !String(value ?? "").trim())
}

function applyFieldValue(
  data: WorkOrderImportRowData,
  field: WorkOrderImportField,
  rawValue: unknown
) {
  switch (field) {
    case "serviceType":
      data.serviceType = resolveImportServiceType(rawValue)
      break
    case "scheduledDate": {
      const parsed = parseImportDate(rawValue)
      data.scheduledDate = parsed ?? cellToString(rawValue)
      break
    }
    case "technology":
      data.technology = resolveImportTechnology(rawValue)
      break
    case "currentTechnology":
      data.currentTechnology = resolveImportTechnology(rawValue)
      break
    case "newTechnology":
      data.newTechnology = resolveImportTechnology(rawValue)
      break
    default:
      data[field] = cellToString(rawValue)
      break
  }
}

function rowArrayToData(
  cells: unknown[],
  columnMap: Partial<Record<number, WorkOrderImportField>>
): WorkOrderImportRowData {
  const data = getEmptyImportRowData()

  for (const [indexRaw, field] of Object.entries(columnMap)) {
    if (!field) continue
    const index = Number(indexRaw)
    applyFieldValue(data, field, cells[index])
  }

  return data
}

export async function parseWorkOrderImportFile(
  file: File
): Promise<{ rows: { rowNumber: number; data: WorkOrderImportRowData }[]; fileName: string }> {
  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer, {
    type: "array",
    cellDates: true,
  })

  const sheetName = workbook.SheetNames[0]
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

  const rows: { rowNumber: number; data: WorkOrderImportRowData }[] = []

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

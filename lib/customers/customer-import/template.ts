import { WORK_ORDER_TECHNOLOGY_OPTIONS } from "@/lib/tasks/work-order"
import * as XLSX from "xlsx"

export const CUSTOMER_IMPORT_TEMPLATE_HEADERS = [
  "codigo_externo",
  "nombre",
  "telefono",
  "email",
  "direccion",
  "localidad",
  "tecnologia",
  "estado",
] as const

export type CustomerImportTemplateRow = Record<
  (typeof CUSTOMER_IMPORT_TEMPLATE_HEADERS)[number],
  string
>

export type CustomerImportTemplateOptions = {
  fileName?: string
}

type SheetDataValidation = {
  type: "list"
  operator: "equal"
  sqref: string
  formula1: string
  allowBlank?: 1
  showDropDown?: true
}

const TEMPLATE_VERSION = "1.0"
const DATA_ROW_START = 2
const DATA_ROW_END = 1000

const STATUS_OPTIONS = ["Activo", "Inactivo"]

const COLUMN_INDEX = Object.fromEntries(
  CUSTOMER_IMPORT_TEMPLATE_HEADERS.map((header, index) => [header, index])
) as Record<(typeof CUSTOMER_IMPORT_TEMPLATE_HEADERS)[number], number>

function columnLetter(index: number): string {
  let letter = ""
  let num = index + 1

  while (num > 0) {
    const remainder = (num - 1) % 26
    letter = String.fromCharCode(65 + remainder) + letter
    num = Math.floor((num - 1) / 26)
  }

  return letter
}

function emptyTemplateRow(): CustomerImportTemplateRow {
  return Object.fromEntries(
    CUSTOMER_IMPORT_TEMPLATE_HEADERS.map((header) => [header, ""])
  ) as CustomerImportTemplateRow
}

function buildExampleRows(): CustomerImportTemplateRow[] {
  return [
    {
      ...emptyTemplateRow(),
      codigo_externo: "4987",
      nombre: "Juan Perez",
      telefono: "351123456",
      email: "juan@mail.com",
      direccion: "Mitre 123",
      localidad: "Córdoba",
      tecnologia: "Fibra Óptica",
      estado: "Activo",
    },
    {
      ...emptyTemplateRow(),
      codigo_externo: "4988",
      nombre: "Ana Gomez",
      telefono: "351987654",
      email: "ana@mail.com",
      direccion: "San Martín 50",
      localidad: "Córdoba",
      tecnologia: "Wireless",
      estado: "Activo",
    },
    {
      ...emptyTemplateRow(),
      codigo_externo: "4989",
      nombre: "Carlos Ruiz",
      telefono: "3514445566",
      email: "carlos@mail.com",
      direccion: "Belgrano 200",
      localidad: "Villa Carlos Paz",
      tecnologia: "Fibra Óptica",
      estado: "Activo",
    },
    {
      ...emptyTemplateRow(),
      codigo_externo: "4990",
      nombre: "María López",
      telefono: "3512223344",
      email: "",
      direccion: "Rivadavia 321",
      localidad: "Río Cuarto",
      tecnologia: "Wireless",
      estado: "Inactivo",
    },
    {
      ...emptyTemplateRow(),
      codigo_externo: "4991",
      nombre: "Pedro Sánchez",
      telefono: "3516667788",
      email: "pedro@mail.com",
      direccion: "Colón 890",
      localidad: "Córdoba",
      tecnologia: "Fibra Óptica",
      estado: "Activo",
    },
    {
      ...emptyTemplateRow(),
      codigo_externo: "",
      nombre: "Laura Fernández",
      telefono: "3517778899",
      email: "laura@mail.com",
      direccion: "Sarmiento 555",
      localidad: "Córdoba",
      tecnologia: "Wireless",
      estado: "Activo",
    },
  ]
}

function rowsToMatrix(rows: CustomerImportTemplateRow[]): string[][] {
  return rows.map((row) =>
    CUSTOMER_IMPORT_TEMPLATE_HEADERS.map((header) => row[header] ?? "")
  )
}

function buildCatalogRows() {
  const tecnologia = WORK_ORDER_TECHNOLOGY_OPTIONS.map((option) => option.label)
  const estado = STATUS_OPTIONS
  const maxRows = Math.max(tecnologia.length, estado.length)

  const rows: string[][] = [["tecnologia", "estado"]]

  for (let index = 0; index < maxRows; index += 1) {
    rows.push([tecnologia[index] ?? "", estado[index] ?? ""])
  }

  return {
    rows,
    tecnologiaCount: tecnologia.length,
    estadoCount: estado.length,
  }
}

function buildInstructionsSheet(): string[][] {
  return [
    ["Plantilla operativa — Importación de Clientes"],
    [`Versión ${TEMPLATE_VERSION}`],
    [""],
    ["Uso"],
    ["1. Complete filas en la hoja Clientes (desde fila 2)."],
    ["2. Use la hoja Catalogos como referencia de valores válidos."],
    ["3. tecnologia y estado tienen listas desplegables en Clientes."],
    ["4. Suba el archivo en Clientes → Importar Excel."],
    ["5. Revise y corrija en la mesa de despacho antes de importar."],
    [""],
    ["Reglas"],
    ["- No modifique los encabezados de la fila 1 en Clientes."],
    ["- nombre es obligatorio."],
    ["- codigo_externo no debe repetirse dentro del archivo ni en la base."],
    ["- CLI-XXXXXX (customer_number) se genera automáticamente al importar."],
    ["- Tecnología permitida: Fibra Óptica / Wireless."],
    ["- Estado permitido: Activo / Inactivo (default Activo si vacío)."],
    [""],
    ["Columnas opcionales"],
    ["- codigo_externo, telefono, email, direccion, localidad, tecnologia, estado"],
  ]
}

function applyListValidation(
  sheet: XLSX.WorkSheet,
  columnIndex: number,
  catalogColumn: "A" | "B",
  catalogRowCount: number
) {
  if (catalogRowCount <= 0) return

  const column = columnLetter(columnIndex)
  const validations =
    (sheet as XLSX.WorkSheet & { "!dataValidation"?: SheetDataValidation[] })[
      "!dataValidation"
    ] ?? []

  validations.push({
    type: "list",
    operator: "equal",
    sqref: `${column}${DATA_ROW_START}:${column}${DATA_ROW_END}`,
    formula1: `Catalogos!$${catalogColumn}$2:$${catalogColumn}$${catalogRowCount + 1}`,
    allowBlank: 1,
    showDropDown: true,
  })

  ;(sheet as XLSX.WorkSheet & { "!dataValidation"?: SheetDataValidation[] })[
    "!dataValidation"
  ] = validations
}

export function buildCustomerImportTemplateWorkbook(
  options: CustomerImportTemplateOptions = {}
): Blob {
  const workbook = XLSX.utils.book_new()

  const exampleRows = buildExampleRows()
  const customersSheet = XLSX.utils.aoa_to_sheet([
    [...CUSTOMER_IMPORT_TEMPLATE_HEADERS],
    ...rowsToMatrix(exampleRows),
  ])
  customersSheet["!cols"] = CUSTOMER_IMPORT_TEMPLATE_HEADERS.map((header) => ({
    wch: Math.max(header.length + 2, 18),
  }))

  const catalog = buildCatalogRows()
  const catalogSheet = XLSX.utils.aoa_to_sheet(catalog.rows)
  catalogSheet["!cols"] = [{ wch: 18 }, { wch: 14 }]

  applyListValidation(
    customersSheet,
    COLUMN_INDEX.tecnologia,
    "A",
    catalog.tecnologiaCount
  )
  applyListValidation(
    customersSheet,
    COLUMN_INDEX.estado,
    "B",
    catalog.estadoCount
  )

  const instructionsSheet = XLSX.utils.aoa_to_sheet(buildInstructionsSheet())
  instructionsSheet["!cols"] = [{ wch: 72 }]

  XLSX.utils.book_append_sheet(workbook, customersSheet, "Clientes")
  XLSX.utils.book_append_sheet(workbook, catalogSheet, "Catalogos")
  XLSX.utils.book_append_sheet(workbook, instructionsSheet, "Instrucciones")

  const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" })
  return new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  })
}

export function downloadCustomerImportTemplate(
  options: CustomerImportTemplateOptions = {}
) {
  const blob = buildCustomerImportTemplateWorkbook(options)
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = `${options.fileName ?? "plantilla-importacion-clientes"}.xlsx`
  anchor.click()
  URL.revokeObjectURL(url)
}

export const CUSTOMER_IMPORT_TEMPLATE_COLUMN_INDEX = COLUMN_INDEX

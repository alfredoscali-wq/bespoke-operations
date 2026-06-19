import {
  SERVICE_TECHNICAL_REASON_OPTIONS,
  WORK_ORDER_SERVICE_TYPE_OPTIONS,
  WORK_ORDER_TECHNOLOGY_OPTIONS,
} from "@/lib/tasks/work-order"
import * as XLSX from "xlsx"

/** Encabezados canónicos reconocidos por el importador. */
export const WORK_ORDER_IMPORT_TEMPLATE_HEADERS = [
  "tipo_orden",
  "empresa_cliente",
  "cliente",
  "telefono",
  "email",
  "direccion",
  "localidad",
  "provincia",
  "codigo_postal",
  "tecnologia",
  "fecha_programada",
  "cuadrilla",
  "numero_orden_cliente",
  "referencia_externa",
  "observaciones",
  "direccion_actual",
  "nueva_direccion",
  "localidad_actual",
  "nueva_localidad",
  "tecnologia_actual",
  "nueva_tecnologia",
  "motivo",
  "detalle",
  "motivo_baja",
  "equipo_retirar",
  "motivo_relevamiento",
  "detalle_postventa",
] as const

export type WorkOrderImportTemplateRow = Record<
  (typeof WORK_ORDER_IMPORT_TEMPLATE_HEADERS)[number],
  string
>

export type WorkOrderImportTemplateOptions = {
  crewNames?: string[]
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
const DEFAULT_CREW_NAMES = ["Cuadrilla Norte", "Cuadrilla Sur", "Cuadrilla Centro"]

const COLUMN_INDEX = Object.fromEntries(
  WORK_ORDER_IMPORT_TEMPLATE_HEADERS.map((header, index) => [header, index])
) as Record<(typeof WORK_ORDER_IMPORT_TEMPLATE_HEADERS)[number], number>

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

function emptyTemplateRow(): WorkOrderImportTemplateRow {
  return Object.fromEntries(
    WORK_ORDER_IMPORT_TEMPLATE_HEADERS.map((header) => [header, ""])
  ) as WorkOrderImportTemplateRow
}

function buildExampleRows(crewNames: string[]): WorkOrderImportTemplateRow[] {
  const [crewA, crewB, crewC] = [
    crewNames[0] ?? DEFAULT_CREW_NAMES[0],
    crewNames[1] ?? DEFAULT_CREW_NAMES[1],
    crewNames[2] ?? DEFAULT_CREW_NAMES[2],
  ]

  const base = {
    empresa_cliente: "ISP Demo",
    telefono: "3515550000",
    email: "cliente@email.com",
    direccion: "Av. Principal 100",
    localidad: "Córdoba",
    provincia: "Córdoba",
    codigo_postal: "5000",
    tecnologia: "Fibra Óptica",
    numero_orden_cliente: "",
    referencia_externa: "",
    observaciones: "",
    direccion_actual: "",
    nueva_direccion: "",
    localidad_actual: "",
    nueva_localidad: "",
    tecnologia_actual: "",
    nueva_tecnologia: "",
    motivo: "",
    detalle: "",
    motivo_baja: "",
    equipo_retirar: "",
    motivo_relevamiento: "",
    detalle_postventa: "",
  }

  return [
    {
      ...emptyTemplateRow(),
      ...base,
      tipo_orden: "Instalación Nueva",
      cliente: "Juan Pérez",
      telefono: "3515551234",
      email: "juan.perez@email.com",
      direccion: "Av. San Martín 123",
      fecha_programada: "2026-06-25",
      cuadrilla: crewA,
      numero_orden_cliente: "EXT-INS-001",
      referencia_externa: "CRM-1001",
      observaciones: "Portón negro, timbre lateral",
    },
    {
      ...emptyTemplateRow(),
      ...base,
      tipo_orden: "Cambio de Domicilio",
      cliente: "Ana Gómez",
      telefono: "3512223344",
      email: "",
      direccion: "",
      fecha_programada: "2026-06-26",
      cuadrilla: crewA,
      referencia_externa: "CRM-1002",
      observaciones: "Coordinar retiro en domicilio anterior",
      direccion_actual: "San Juan 100",
      nueva_direccion: "Av. Colón 2200",
      localidad_actual: "Córdoba",
      nueva_localidad: "Córdoba",
    },
    {
      ...emptyTemplateRow(),
      ...base,
      tipo_orden: "Cambio de Tecnología",
      cliente: "Roberto Díaz",
      telefono: "3514445566",
      fecha_programada: "2026-06-27",
      cuadrilla: crewB,
      referencia_externa: "CRM-1003",
      tecnologia_actual: "Wireless",
      nueva_tecnologia: "Fibra Óptica",
    },
    {
      ...emptyTemplateRow(),
      ...base,
      tipo_orden: "Service Técnico",
      cliente: "Carlos Ruiz",
      telefono: "3513339012",
      direccion: "Mitre 890",
      fecha_programada: "2026-06-28",
      cuadrilla: crewC,
      referencia_externa: "CRM-1004",
      motivo: "Sin conexión",
      detalle: "ONT sin link desde ayer",
    },
    {
      ...emptyTemplateRow(),
      ...base,
      tipo_orden: "Reconexión",
      cliente: "María López",
      telefono: "3514445678",
      email: "",
      direccion: "Belgrano 450",
      localidad: "Villa Carlos Paz",
      tecnologia: "Wireless",
      fecha_programada: "2026-06-29",
      cuadrilla: crewB,
      referencia_externa: "CRM-1005",
      observaciones: "Cliente solicita turno tarde",
    },
    {
      ...emptyTemplateRow(),
      ...base,
      tipo_orden: "Baja",
      cliente: "Pedro Sánchez",
      telefono: "3516667788",
      direccion: "Rivadavia 321",
      fecha_programada: "2026-06-30",
      cuadrilla: crewA,
      referencia_externa: "CRM-1006",
      motivo_baja: "Mudanza fuera de zona de cobertura",
    },
    {
      ...emptyTemplateRow(),
      ...base,
      tipo_orden: "Retiro de Equipo",
      cliente: "Laura Fernández",
      telefono: "3517778899",
      direccion: "Sarmiento 555",
      fecha_programada: "2026-07-01",
      cuadrilla: crewC,
      referencia_externa: "CRM-1007",
      equipo_retirar: "ONU + router WiFi",
    },
    {
      ...emptyTemplateRow(),
      ...base,
      tipo_orden: "Relevamiento",
      cliente: "Diego Morales",
      telefono: "3518889900",
      direccion: "Los Alamos 45",
      localidad: "Río Cuarto",
      fecha_programada: "2026-07-02",
      cuadrilla: crewB,
      referencia_externa: "CRM-1008",
      motivo_relevamiento: "Evaluar factibilidad técnica en zona nueva",
    },
    {
      ...emptyTemplateRow(),
      ...base,
      tipo_orden: "Postventa",
      cliente: "Silvia Torres",
      telefono: "3519990011",
      direccion: "Independencia 678",
      fecha_programada: "2026-07-03",
      cuadrilla: crewA,
      referencia_externa: "CRM-1009",
      detalle_postventa: "Consulta por velocidad contratada vs. real",
    },
  ]
}

function rowsToMatrix(rows: WorkOrderImportTemplateRow[]): string[][] {
  return rows.map((row) =>
    WORK_ORDER_IMPORT_TEMPLATE_HEADERS.map((header) => row[header] ?? "")
  )
}

function buildCatalogRows(crewNames: string[]) {
  const tipoOrden = WORK_ORDER_SERVICE_TYPE_OPTIONS.map((option) => option.label)
  const tecnologia = WORK_ORDER_TECHNOLOGY_OPTIONS.map((option) => option.label)
  const motivoService = SERVICE_TECHNICAL_REASON_OPTIONS.map(
    (option) => option.label
  )
  const cuadrilla =
    crewNames.length > 0 ? crewNames : [...DEFAULT_CREW_NAMES]

  const maxRows = Math.max(
    tipoOrden.length,
    tecnologia.length,
    motivoService.length,
    cuadrilla.length
  )

  const rows: string[][] = [["tipo_orden", "tecnologia", "motivo_service", "cuadrilla"]]

  for (let index = 0; index < maxRows; index += 1) {
    rows.push([
      tipoOrden[index] ?? "",
      tecnologia[index] ?? "",
      motivoService[index] ?? "",
      cuadrilla[index] ?? "",
    ])
  }

  return {
    rows,
    tipoOrdenCount: tipoOrden.length,
    tecnologiaCount: tecnologia.length,
    motivoCount: motivoService.length,
    cuadrillaCount: cuadrilla.length,
  }
}

function buildInstructionsSheet(crewNames: string[]): string[][] {
  const crews =
    crewNames.length > 0 ? crewNames.join(", ") : DEFAULT_CREW_NAMES.join(", ")

  return [
    ["Plantilla operativa — Importación de Órdenes de Trabajo"],
    [`Versión ${TEMPLATE_VERSION}`],
    [""],
    ["Uso"],
    ["1. Complete filas en la hoja Ordenes (desde fila 2)."],
    ["2. Use la hoja Catalogos como referencia de valores válidos."],
    ["3. tipo_orden y tecnologia tienen listas desplegables en Ordenes."],
    ["4. Suba el archivo en Tareas → Importar Excel."],
    ["5. Revise y corrija en la mesa de despacho antes de importar."],
    [""],
    ["Formato de fechas"],
    ["- Use exclusivamente AAAA-MM-DD (ISO), por ejemplo 2026-06-25."],
    [""],
    ["Columnas obligatorias (todas las filas)"],
    ["- tipo_orden, cliente, fecha_programada"],
    [""],
    ["Instalación Nueva"],
    ["- Crea el cliente automáticamente."],
    ["- Requiere direccion y tecnologia."],
    [""],
    ["Demás tipos"],
    ["- Requieren cliente existente en la base."],
    ["- Completar campos específicos según tipo (ver ejemplos en Ordenes)."],
    [""],
    ["Columnas extendidas"],
    ["- empresa_cliente, referencia_externa, numero_orden_cliente"],
    ["- provincia, codigo_postal"],
    [""],
    ["Cuadrillas configuradas en esta plantilla"],
    [`${crews}`],
    ["- Si la cuadrilla no existe al importar, la orden queda Sin cuadrilla."],
    [""],
    ["No modifique los encabezados de la fila 1 en Ordenes."],
  ]
}

function applyListValidation(
  sheet: XLSX.WorkSheet,
  columnIndex: number,
  catalogColumn: "A" | "B" | "C" | "D",
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

export function buildWorkOrderImportTemplateWorkbook(
  options: WorkOrderImportTemplateOptions = {}
): Blob {
  const crewNames = options.crewNames ?? []
  const workbook = XLSX.utils.book_new()

  const exampleRows = buildExampleRows(crewNames)
  const ordersSheet = XLSX.utils.aoa_to_sheet([
    [...WORK_ORDER_IMPORT_TEMPLATE_HEADERS],
    ...rowsToMatrix(exampleRows),
  ])
  ordersSheet["!cols"] = WORK_ORDER_IMPORT_TEMPLATE_HEADERS.map((header) => ({
    wch: Math.max(header.length + 2, 20),
  }))

  const catalog = buildCatalogRows(crewNames)
  const catalogSheet = XLSX.utils.aoa_to_sheet(catalog.rows)
  catalogSheet["!cols"] = [
    { wch: 28 },
    { wch: 18 },
    { wch: 22 },
    { wch: 24 },
  ]

  applyListValidation(
    ordersSheet,
    COLUMN_INDEX.tipo_orden,
    "A",
    catalog.tipoOrdenCount
  )
  applyListValidation(
    ordersSheet,
    COLUMN_INDEX.tecnologia,
    "B",
    catalog.tecnologiaCount
  )
  applyListValidation(
    ordersSheet,
    COLUMN_INDEX.tecnologia_actual,
    "B",
    catalog.tecnologiaCount
  )
  applyListValidation(
    ordersSheet,
    COLUMN_INDEX.nueva_tecnologia,
    "B",
    catalog.tecnologiaCount
  )
  applyListValidation(
    ordersSheet,
    COLUMN_INDEX.motivo,
    "C",
    catalog.motivoCount
  )
  applyListValidation(
    ordersSheet,
    COLUMN_INDEX.cuadrilla,
    "D",
    catalog.cuadrillaCount
  )

  const instructionsSheet = XLSX.utils.aoa_to_sheet(
    buildInstructionsSheet(crewNames)
  )
  instructionsSheet["!cols"] = [{ wch: 78 }]

  XLSX.utils.book_append_sheet(workbook, ordersSheet, "Ordenes")
  XLSX.utils.book_append_sheet(workbook, catalogSheet, "Catalogos")
  XLSX.utils.book_append_sheet(workbook, instructionsSheet, "Instrucciones")

  const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" })
  return new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  })
}

export function downloadWorkOrderImportTemplate(
  options: WorkOrderImportTemplateOptions = {}
) {
  const blob = buildWorkOrderImportTemplateWorkbook(options)
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = `${options.fileName ?? "plantilla-importacion-ordenes"}.xlsx`
  anchor.click()
  URL.revokeObjectURL(url)
}

export const WORK_ORDER_IMPORT_TEMPLATE_COLUMN_INDEX = COLUMN_INDEX

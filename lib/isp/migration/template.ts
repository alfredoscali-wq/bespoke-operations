import {
  ISP_MIGRATION_CATALOG_HEADERS,
  ISP_MIGRATION_CONNECTION_HEADERS,
  ISP_MIGRATION_CUSTOMER_HEADERS,
  ISP_MIGRATION_EQUIPMENT_HEADERS,
  ISP_MIGRATION_SERVICE_HEADERS,
  ISP_MIGRATION_TEMPLATE_FILENAME,
  ISP_MIGRATION_TEMPLATE_VERSION,
} from "@/lib/isp/migration/constants"
import * as XLSX from "xlsx"

type SheetDataValidation = {
  type: "list"
  operator: "equal"
  sqref: string
  formula1: string
  allowBlank?: 1
  showDropDown?: true
}

const DATA_ROW_START = 2
const DATA_ROW_END = 2000

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

function applyListValidation(
  sheet: XLSX.WorkSheet,
  columnIndex: number,
  options: string[]
) {
  const column = columnLetter(columnIndex)
  const validations =
    (sheet as XLSX.WorkSheet & { "!dataValidation"?: SheetDataValidation[] })[
      "!dataValidation"
    ] ?? []
  validations.push({
    type: "list",
    operator: "equal",
    sqref: `${column}${DATA_ROW_START}:${column}${DATA_ROW_END}`,
    formula1: `"${options.join(",")}"`,
    allowBlank: 1,
    showDropDown: true,
  })
  ;(sheet as XLSX.WorkSheet & { "!dataValidation"?: SheetDataValidation[] })[
    "!dataValidation"
  ] = validations
}

function sheetFromHeaders(
  headers: readonly string[],
  rows: string[][]
): XLSX.WorkSheet {
  const sheet = XLSX.utils.aoa_to_sheet([[...headers], ...rows])
  sheet["!autofilter"] = {
    ref: `${columnLetter(0)}1:${columnLetter(headers.length - 1)}${Math.max(rows.length + 1, 2)}`,
  }
  sheet["!cols"] = headers.map((header) => ({
    wch: Math.max(header.length + 2, 18),
  }))
  return sheet
}

function buildInstructions(): string[][] {
  return [
    ["Bespoke ISP — Plantilla de Migración"],
    [`Versión ${ISP_MIGRATION_TEMPLATE_VERSION}`],
    ["DATOS DE EJEMPLO"],
    [""],
    ["Qué representa esta migración"],
    [
      "La plantilla carga el ESTADO ACTUAL de los abonados del ISP al comenzar a usar Bespoke. No reconstruye clientes, servicios ni conexiones desde OT históricas.",
    ],
    [""],
    ["Hojas"],
    ["CLIENTES — una fila por cliente. Un cliente puede existir sin servicios."],
    ["CATALOGO — qué vende actualmente el ISP. No es el listado de abonados contratados."],
    ["SERVICIOS — qué tiene contratado cada cliente. Conserva snapshot de nombre, tecnología, velocidad y precio."],
    ["CONEXIONES — cómo está conectado cada servicio. Toda conexión requiere un servicio. Un servicio puede existir sin conexión."],
    ["EQUIPAMIENTO — opcional. No dispara provisioning."],
    [""],
    ["Cómo relacionar las hojas"],
    ["CLIENTES.cliente_id_externo → SERVICIOS.cliente_id_externo"],
    ["CATALOGO.catalogo_id_externo → SERVICIOS.catalogo_id_externo"],
    ["SERVICIOS.servicio_id_externo → CONEXIONES.servicio_id_externo"],
    ["CONEXIONES.conexion_id_externo → EQUIPAMIENTO.conexion_id_externo"],
    ["No use el nombre ni el DNI/CUIT como clave de relación."],
    [""],
    ["Campos obligatorios"],
    ["CLIENTES: cliente_id_externo, nombre_razon_social, tipo_cliente, dni_cuit, localidad, domicilio, estado_cliente"],
    ["SERVICIOS: servicio_id_externo, cliente_id_externo, catalogo_id_externo, estado_comercial"],
    ["CONEXIONES: conexion_id_externo, servicio_id_externo, tipo_conexion, estado_tecnico"],
    ["Los demás campos pueden quedar vacíos si el ISP no los utiliza."],
    [""],
    ["Valores controlados"],
    ["tipo_cliente: Particular | Empresa | Ambos"],
    ["estado_cliente: Activo | Suspendido | Baja | Pendiente"],
    ["estado_comercial: Activo | Suspendido | Baja | Pendiente de alta"],
    ["estado_tecnico: Provisionamiento pendiente | Provisionado | Error | Desconectado"],
    ["tipo_conexion: PPPoE | IP estática | DHCP | Otro"],
    ["tecnologia: FTTH | Wireless | Otra"],
    ["categoria: Internet | Empresarial | Conectividad | TV | Cámaras | Otros"],
    ["Mapeos inequívocos: PPP→PPPoE, IP FIJA/STATIC→IP estática. Si no se puede determinar, el archivo se rechaza para revisión."],
    [""],
    ["Catálogo vs abonados"],
    ["El precio del catálogo es lo que el ISP vende hoy. El precio del servicio es el precio contratado del cliente y no cambia si luego se actualiza el catálogo."],
    [""],
    ["DATOS DE EJEMPLO"],
    ["Las filas con identificadores EJEMPLO-... o marcadas como DATOS DE EJEMPLO son de demostración y se ignoran automáticamente al validar. No hace falta eliminarlas. No mezcle identificadores demo con abonados reales."],
    [""],
    ["No completar"],
    ["No infiera los abonados desde OT. No deje conexiones sin servicio. No deje servicios sin cliente."],
  ]
}

export function buildIspMigrationTemplateWorkbook(): ArrayBuffer {
  const workbook = XLSX.utils.book_new()

  const customers = sheetFromHeaders(ISP_MIGRATION_CUSTOMER_HEADERS, [
    [
      "EJEMPLO-CLI-001",
      "Juan Pérez",
      "Particular",
      "20123456",
      "3515551111",
      "3515551111",
      "juan@example.com",
      "Córdoba",
      "San Martín 100",
      "DATOS DE EJEMPLO",
      "Activo",
    ],
    [
      "EJEMPLO-CLI-002",
      "Cliente histórico sin servicio",
      "Particular",
      "27999888",
      "",
      "",
      "",
      "Córdoba",
      "Belgrano 50",
      "DATOS DE EJEMPLO — cliente sin servicio permitido",
      "Baja",
    ],
  ])
  applyListValidation(customers, 2, ["Particular", "Empresa", "Ambos"])
  applyListValidation(customers, 10, ["Activo", "Suspendido", "Baja", "Pendiente"])

  const catalog = sheetFromHeaders(ISP_MIGRATION_CATALOG_HEADERS, [
    [
      "EJEMPLO-CAT-001",
      "FTTH 50 Mb",
      "Internet",
      "Particular",
      "FTTH",
      "50",
      "50",
      "",
      "Mensual",
      "SIRO",
      "Sí",
      "PPPoE",
      "DATOS DE EJEMPLO — no inventar precio real",
      "Sí",
    ],
    [
      "EJEMPLO-CAT-002",
      "FTTH 100 Mb",
      "Internet",
      "Particular",
      "FTTH",
      "100",
      "100",
      "",
      "Mensual",
      "SIRO",
      "Sí",
      "PPPoE",
      "DATOS DE EJEMPLO",
      "Sí",
    ],
    [
      "EJEMPLO-CAT-003",
      "FTTH 300 Mb",
      "Internet",
      "Particular",
      "FTTH",
      "300",
      "300",
      "",
      "Mensual",
      "SIRO",
      "Sí",
      "PPPoE",
      "DATOS DE EJEMPLO",
      "Sí",
    ],
    [
      "EJEMPLO-CAT-004",
      "Wireless 20 Mb",
      "Internet",
      "Particular",
      "Wireless",
      "20",
      "",
      "",
      "Mensual",
      "SIRO",
      "Sí",
      "IP estática",
      "DATOS DE EJEMPLO — velocidad de subida según ISP",
      "Sí",
    ],
  ])
  applyListValidation(catalog, 2, [
    "Internet",
    "Empresarial",
    "Conectividad",
    "TV",
    "Cámaras",
    "Otros",
  ])
  applyListValidation(catalog, 3, ["Particular", "Empresa", "Ambos"])
  applyListValidation(catalog, 4, ["FTTH", "Wireless", "Otra"])
  applyListValidation(catalog, 8, ["Mensual"])
  applyListValidation(catalog, 9, ["SIRO"])
  applyListValidation(catalog, 10, ["Sí", "No"])
  applyListValidation(catalog, 13, ["Sí", "No"])

  const services = sheetFromHeaders(ISP_MIGRATION_SERVICE_HEADERS, [
    [
      "EJEMPLO-SER-001",
      "EJEMPLO-CLI-001",
      "EJEMPLO-CAT-003",
      "FTTH 300 Mb",
      "FTTH",
      "300",
      "300",
      "25000",
      "2024-03-01",
      "Activo",
      "SIRO",
      "DATOS DE EJEMPLO — precio contratado distinto al catálogo",
    ],
    [
      "EJEMPLO-SER-002",
      "EJEMPLO-CLI-001",
      "EJEMPLO-CAT-004",
      "Wireless 20 Mb",
      "Wireless",
      "20",
      "",
      "",
      "2025-01-10",
      "Pendiente de alta",
      "SIRO",
      "DATOS DE EJEMPLO — segundo servicio del mismo cliente, sin conexión",
    ],
  ])
  applyListValidation(services, 4, ["FTTH", "Wireless", "Otra"])
  applyListValidation(services, 9, [
    "Activo",
    "Suspendido",
    "Baja",
    "Pendiente de alta",
  ])
  applyListValidation(services, 10, ["SIRO", "Pendiente"])

  const connections = sheetFromHeaders(ISP_MIGRATION_CONNECTION_HEADERS, [
    [
      "EJEMPLO-CON-001",
      "EJEMPLO-SER-001",
      "PPPoE",
      "Provisionado",
      "juan.perez",
      "secret-example",
      "",
      "",
      "",
      "",
      "ftth-300",
      "core-1",
      "2024-03-02",
      "DATOS DE EJEMPLO",
    ],
  ])
  applyListValidation(connections, 2, ["PPPoE", "IP estática", "DHCP", "Otro"])
  applyListValidation(connections, 3, [
    "Provisionamiento pendiente",
    "Provisionado",
    "Error",
    "Desconectado",
  ])

  const equipment = sheetFromHeaders(ISP_MIGRATION_EQUIPMENT_HEADERS, [
    [
      "EJEMPLO-EQ-001",
      "EJEMPLO-CON-001",
      "ONU",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "DATOS DE EJEMPLO — hoja opcional",
    ],
  ])

  const instructions = XLSX.utils.aoa_to_sheet(buildInstructions())
  instructions["!cols"] = [{ wch: 110 }]

  XLSX.utils.book_append_sheet(workbook, customers, "CLIENTES")
  XLSX.utils.book_append_sheet(workbook, catalog, "CATALOGO")
  XLSX.utils.book_append_sheet(workbook, services, "SERVICIOS")
  XLSX.utils.book_append_sheet(workbook, connections, "CONEXIONES")
  XLSX.utils.book_append_sheet(workbook, equipment, "EQUIPAMIENTO")
  XLSX.utils.book_append_sheet(workbook, instructions, "INSTRUCCIONES")

  return XLSX.write(workbook, { bookType: "xlsx", type: "array" }) as ArrayBuffer
}

export function buildIspMigrationWorkbook(sheets: {
  CLIENTES?: string[][]
  CATALOGO?: string[][]
  SERVICIOS?: string[][]
  CONEXIONES?: string[][]
  EQUIPAMIENTO?: string[][]
}): ArrayBuffer {
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(
    workbook,
    sheetFromHeaders(ISP_MIGRATION_CUSTOMER_HEADERS, sheets.CLIENTES ?? []),
    "CLIENTES"
  )
  XLSX.utils.book_append_sheet(
    workbook,
    sheetFromHeaders(ISP_MIGRATION_CATALOG_HEADERS, sheets.CATALOGO ?? []),
    "CATALOGO"
  )
  XLSX.utils.book_append_sheet(
    workbook,
    sheetFromHeaders(ISP_MIGRATION_SERVICE_HEADERS, sheets.SERVICIOS ?? []),
    "SERVICIOS"
  )
  XLSX.utils.book_append_sheet(
    workbook,
    sheetFromHeaders(ISP_MIGRATION_CONNECTION_HEADERS, sheets.CONEXIONES ?? []),
    "CONEXIONES"
  )
  XLSX.utils.book_append_sheet(
    workbook,
    sheetFromHeaders(ISP_MIGRATION_EQUIPMENT_HEADERS, sheets.EQUIPAMIENTO ?? []),
    "EQUIPAMIENTO"
  )
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet([["DATOS DE EJEMPLO"], ["Plantilla de prueba"]]),
    "INSTRUCCIONES"
  )
  return XLSX.write(workbook, { bookType: "xlsx", type: "array" }) as ArrayBuffer
}

export { ISP_MIGRATION_TEMPLATE_FILENAME }

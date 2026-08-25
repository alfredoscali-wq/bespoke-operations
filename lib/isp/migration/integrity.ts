import { normalizeDni } from "@/lib/customers/normalization/dni"
import { parseImportDate } from "@/lib/tasks/work-order-import/normalize"
import {
  ISP_MIGRATION_HIDDEN_SECRET,
} from "@/lib/isp/migration/constants"
import {
  formatContractedSpeed,
  isExampleMigrationRow,
  mapCatalogBillingMethod,
  mapCatalogCategory,
  mapCatalogTechnology,
  mapCommercialStatus,
  mapConnectionType,
  mapCustomerStatus,
  mapCustomerType,
  mapBillingPeriod,
  mapServiceBillingMethod,
  mapTechnicalStatus,
  mapYesNo,
  isValidIpv4,
  parseConnectionTypesList,
  parseMigrationMoney,
  parseSpeedMbps,
} from "@/lib/isp/migration/maps"
import { displayMigrationIssueValue } from "@/lib/isp/migration/mask"
import type {
  IspMigrationExistingState,
  IspMigrationIssue,
  IspMigrationParsedWorkbook,
  IspMigrationSheetCounts,
  IspMigrationStagingRow,
  IspMigrationValidationResult,
} from "@/lib/isp/migration/types"

const EMPTY_COUNTS: IspMigrationSheetCounts = {
  total: 0,
  valid: 0,
  warnings: 0,
  errors: 0,
  examples: 0,
}

function issue(
  sheet: IspMigrationIssue["sheet"],
  rowNumber: number,
  field: string,
  value: string,
  level: IspMigrationIssue["level"],
  message: string,
  code?: string
): IspMigrationIssue {
  return {
    sheet,
    rowNumber,
    field,
    value: displayMigrationIssueValue(field, value),
    level,
    message,
    code,
  }
}

function emptySheetCounts(): IspMigrationValidationResult["counts"] {
  return {
    CLIENTES: { ...EMPTY_COUNTS },
    CATALOGO: { ...EMPTY_COUNTS },
    SERVICIOS: { ...EMPTY_COUNTS },
    CONEXIONES: { ...EMPTY_COUNTS },
    EQUIPAMIENTO: { ...EMPTY_COUNTS },
  }
}

function rowStatus(issues: IspMigrationIssue[]): "valid" | "warning" | "error" {
  if (issues.some((item) => item.level === "error")) return "error"
  if (issues.some((item) => item.level === "warning")) return "warning"
  return "valid"
}

function bump(
  counts: IspMigrationSheetCounts,
  status: "valid" | "warning" | "error"
) {
  counts.total += 1
  if (status === "error") counts.errors += 1
  else if (status === "warning") counts.warnings += 1
  else counts.valid += 1
}

function lower(value: string): string {
  return value.trim().toLowerCase()
}

function isBlankRow(values: Record<string, string>): boolean {
  return Object.values(values).every((value) => !value.trim())
}

function partitionRows(rows: { rowNumber: number; values: Record<string, string> }[]) {
  const real: typeof rows = []
  let examples = 0
  for (const row of rows) {
    if (isBlankRow(row.values)) continue
    if (isExampleMigrationRow(row.values)) {
      examples += 1
      continue
    }
    real.push(row)
  }
  return { real, examples }
}

function resolveRunStatus(input: {
  hasRealData: boolean
  missingRequiredSheets: number
  errorCount: number
}): IspMigrationValidationResult["runStatus"] {
  if (input.missingRequiredSheets > 0 || (input.hasRealData && input.errorCount > 0)) {
    return "rejected"
  }
  if (!input.hasRealData) return "no_real_data"
  return "pending_review"
}

export function resolveIspMigrationRunStatus(
  validation: Pick<
    IspMigrationValidationResult,
    "hasRealData" | "canImport" | "runStatus"
  >
): IspMigrationValidationResult["runStatus"] {
  return validation.runStatus
}

function duplicateMap(): Map<string, number[]> {
  return new Map()
}

function pushDuplicate(map: Map<string, number[]>, key: string, row: number) {
  const current = map.get(key) ?? []
  current.push(row)
  map.set(key, current)
}

export function didCopyCatalogPriceToContractedService(input: {
  catalogPrice: number | null
  contractedPrice: number | null
  copiedAutomatically?: boolean
}): boolean {
  if (!input.copiedAutomatically) return false
  if (input.catalogPrice == null || input.contractedPrice == null) return false
  return input.catalogPrice === input.contractedPrice
}

export function isHistoricalWorkOrderUsedForPortfolio(): boolean {
  return false
}

export function validateIspMigration(
  workbook: IspMigrationParsedWorkbook,
  existing: IspMigrationExistingState = {
    customers: [],
    catalog: [],
    services: [],
    connections: [],
    equipmentExternalCodes: [],
    completedFileHashes: [],
  },
  options?: { fileSha256?: string | null }
): IspMigrationValidationResult {
  const issues: IspMigrationIssue[] = []
  const stagingRows: IspMigrationStagingRow[] = []
  const counts = emptySheetCounts()

  for (const sheet of workbook.missingRequiredSheets) {
    issues.push(
      issue(
        "ARCHIVO",
        0,
        "hoja",
        sheet,
        "error",
        `Falta la hoja obligatoria ${sheet}.`,
        "missing_sheet"
      )
    )
  }

  const catalogPartition = partitionRows(workbook.sheets.CATALOGO ?? [])
  const customerPartition = partitionRows(workbook.sheets.CLIENTES ?? [])
  const servicePartition = partitionRows(workbook.sheets.SERVICIOS ?? [])
  const connectionPartition = partitionRows(workbook.sheets.CONEXIONES ?? [])
  const equipmentPartition = partitionRows(workbook.sheets.EQUIPAMIENTO ?? [])

  counts.CATALOGO.examples = catalogPartition.examples
  counts.CLIENTES.examples = customerPartition.examples
  counts.SERVICIOS.examples = servicePartition.examples
  counts.CONEXIONES.examples = connectionPartition.examples
  counts.EQUIPAMIENTO.examples = equipmentPartition.examples

  const catalogRows = catalogPartition.real
  const customerRows = customerPartition.real
  const serviceRows = servicePartition.real
  const connectionRows = connectionPartition.real
  const equipmentRows = equipmentPartition.real

  const catalogIds = new Set<string>()
  const catalogNames = new Set<string>()
  const customerIds = new Set<string>()
  const serviceIds = new Set<string>()
  const connectionIds = new Set<string>()
  const servicesByCustomer = new Map<string, number>()
  const connectionsByService = new Map<string, number>()

  const catalogDupes = duplicateMap()
  const catalogNameDupes = duplicateMap()
  const customerDupes = duplicateMap()
  const dniDupes = duplicateMap()
  const serviceDupes = duplicateMap()
  const connectionDupes = duplicateMap()
  const equipmentDupes = duplicateMap()
  const ipDupes = duplicateMap()
  const pppoeDupes = duplicateMap()

  const existingCatalogByCode = new Map(
    existing.catalog
      .filter((item) => item.externalCode)
      .map((item) => [lower(item.externalCode!), item])
  )
  const existingCatalogByName = new Map(
    existing.catalog.map((item) => [lower(item.name), item])
  )
  const existingCustomerByCode = new Map(
    existing.customers
      .filter((item) => item.externalCode)
      .map((item) => [lower(item.externalCode!), item])
  )
  const existingCustomerByDni = new Map(
    existing.customers
      .filter((item) => item.dniDigits)
      .map((item) => [item.dniDigits, item])
  )
  const existingServiceByCode = new Map(
    existing.services
      .filter((item) => item.externalCode)
      .map((item) => [lower(item.externalCode!), item])
  )
  const existingConnectionByCode = new Map(
    existing.connections
      .filter((item) => item.externalCode)
      .map((item) => [lower(item.externalCode!), item])
  )
  const existingIps = new Map(
    existing.connections
      .filter((item) => item.ip)
      .map((item) => [lower(item.ip!), item])
  )
  const existingPppoe = new Map(
    existing.connections
      .filter((item) => item.pppoeUsername)
      .map((item) => [lower(item.pppoeUsername!), item])
  )
  const existingEquipment = new Set(
    existing.equipmentExternalCodes.map((code) => lower(code))
  )

  for (const row of catalogRows) {
    const id = row.values.catalogo_id_externo?.trim() ?? ""
    if (id) {
      pushDuplicate(catalogDupes, lower(id), row.rowNumber)
      catalogIds.add(lower(id))
    }
    const name = row.values.nombre_servicio?.trim() ?? ""
    if (name) pushDuplicate(catalogNameDupes, lower(name), row.rowNumber)
  }
  for (const row of customerRows) {
    const id = row.values.cliente_id_externo?.trim() ?? ""
    if (id) {
      pushDuplicate(customerDupes, lower(id), row.rowNumber)
      customerIds.add(lower(id))
    }
    const dni = normalizeDni(row.values.dni_cuit)
    if (dni.isValid) pushDuplicate(dniDupes, dni.digits, row.rowNumber)
  }
  for (const row of serviceRows) {
    const id = row.values.servicio_id_externo?.trim() ?? ""
    if (id) {
      pushDuplicate(serviceDupes, lower(id), row.rowNumber)
      serviceIds.add(lower(id))
    }
    const customerId = lower(row.values.cliente_id_externo ?? "")
    if (customerId) {
      servicesByCustomer.set(
        customerId,
        (servicesByCustomer.get(customerId) ?? 0) + 1
      )
    }
  }
  for (const row of connectionRows) {
    const id = row.values.conexion_id_externo?.trim() ?? ""
    if (id) {
      pushDuplicate(connectionDupes, lower(id), row.rowNumber)
      connectionIds.add(lower(id))
    }
    const serviceId = lower(row.values.servicio_id_externo ?? "")
    if (serviceId) {
      connectionsByService.set(
        serviceId,
        (connectionsByService.get(serviceId) ?? 0) + 1
      )
    }
    const ip = row.values.ip?.trim() ?? ""
    if (ip) pushDuplicate(ipDupes, lower(ip), row.rowNumber)
    const user = row.values.usuario_pppoe?.trim() ?? ""
    if (user) pushDuplicate(pppoeDupes, lower(user), row.rowNumber)
  }
  for (const row of equipmentRows) {
    const id = row.values.equipamiento_id_externo?.trim() ?? ""
    if (id) pushDuplicate(equipmentDupes, lower(id), row.rowNumber)
  }

  const catalogNameByCode = new Map<string, string>()
  const catalogTechByCode = new Map<string, string>()

  for (const row of catalogRows) {
    const rowIssues: IspMigrationIssue[] = []
    const values = row.values
    const externalCode = values.catalogo_id_externo?.trim() ?? ""
    const name = values.nombre_servicio?.trim() ?? ""

    if (!externalCode) {
      rowIssues.push(
        issue(
          "CATALOGO",
          row.rowNumber,
          "catalogo_id_externo",
          "",
          "error",
          "El identificador externo del catálogo es obligatorio."
        )
      )
    } else if ((catalogDupes.get(lower(externalCode)) ?? []).length > 1) {
      rowIssues.push(
        issue(
          "CATALOGO",
          row.rowNumber,
          "catalogo_id_externo",
          externalCode,
          "error",
          "Identificador de catálogo duplicado en el archivo."
        )
      )
    }

    if (!name) {
      rowIssues.push(
        issue(
          "CATALOGO",
          row.rowNumber,
          "nombre_servicio",
          "",
          "error",
          "El nombre del servicio de catálogo es obligatorio."
        )
      )
    } else if ((catalogNameDupes.get(lower(name)) ?? []).length > 1) {
      rowIssues.push(
        issue(
          "CATALOGO",
          row.rowNumber,
          "nombre_servicio",
          name,
          "error",
          "Ya existe otro ítem de catálogo con este nombre en el archivo."
        )
      )
    }

    const category = mapCatalogCategory(values.categoria ?? "")
    if (!values.categoria?.trim()) {
      rowIssues.push(
        issue(
          "CATALOGO",
          row.rowNumber,
          "categoria",
          "",
          "error",
          "La categoría es obligatoria."
        )
      )
    } else if (!category) {
      rowIssues.push(
        issue(
          "CATALOGO",
          row.rowNumber,
          "categoria",
          values.categoria,
          "error",
          "Categoría no reconocida. Use Internet, Empresarial, Conectividad, TV, Cámaras u Otros."
        )
      )
    }

    const customerType = mapCustomerType(values.tipo_cliente ?? "")
    if (!values.tipo_cliente?.trim()) {
      rowIssues.push(
        issue(
          "CATALOGO",
          row.rowNumber,
          "tipo_cliente",
          "",
          "error",
          "El tipo de cliente es obligatorio."
        )
      )
    } else if (!customerType) {
      rowIssues.push(
        issue(
          "CATALOGO",
          row.rowNumber,
          "tipo_cliente",
          values.tipo_cliente,
          "error",
          "Tipo de cliente no reconocido. Use Particular, Empresa o Ambos."
        )
      )
    }

    const technology = mapCatalogTechnology(values.tecnologia ?? "")
    if (values.tecnologia?.trim() && !technology) {
      rowIssues.push(
        issue(
          "CATALOGO",
          row.rowNumber,
          "tecnologia",
          values.tecnologia,
          "error",
          "Tecnología no reconocida. Use FTTH, Wireless u Otra."
        )
      )
    }

    const download = parseSpeedMbps(values.velocidad_bajada ?? "")
    if (!download.ok) {
      rowIssues.push(
        issue(
          "CATALOGO",
          row.rowNumber,
          "velocidad_bajada",
          values.velocidad_bajada,
          "error",
          "Velocidad de bajada inválida."
        )
      )
    }
    const upload = parseSpeedMbps(values.velocidad_subida ?? "")
    if (!upload.ok) {
      rowIssues.push(
        issue(
          "CATALOGO",
          row.rowNumber,
          "velocidad_subida",
          values.velocidad_subida,
          "error",
          "Velocidad de subida inválida."
        )
      )
    } else if (upload.empty) {
      rowIssues.push(
        issue(
          "CATALOGO",
          row.rowNumber,
          "velocidad_subida",
          "",
          "warning",
          "Velocidad de subida no informada."
        )
      )
    }

    const price = parseMigrationMoney(values.precio_mensual ?? "")
    if (!price.ok) {
      rowIssues.push(
        issue(
          "CATALOGO",
          row.rowNumber,
          "precio_mensual",
          values.precio_mensual,
          "error",
          "Precio mensual inválido."
        )
      )
    }

    const period = mapBillingPeriod(values.periodicidad ?? "")
    if (values.periodicidad?.trim() && !period) {
      rowIssues.push(
        issue(
          "CATALOGO",
          row.rowNumber,
          "periodicidad",
          values.periodicidad,
          "error",
          "Periodicidad no reconocida. Use Mensual."
        )
      )
    }

    const billing = mapCatalogBillingMethod(values.medio_cobranza ?? "")
    if (values.medio_cobranza?.trim() && !billing) {
      rowIssues.push(
        issue(
          "CATALOGO",
          row.rowNumber,
          "medio_cobranza",
          values.medio_cobranza,
          "error",
          "Medio de cobranza de catálogo no reconocido. Use SIRO."
        )
      )
    }

    const requiresConnection = mapYesNo(values.requiere_conexion ?? "", true)
    if (values.requiere_conexion?.trim() && requiresConnection == null) {
      rowIssues.push(
        issue(
          "CATALOGO",
          row.rowNumber,
          "requiere_conexion",
          values.requiere_conexion,
          "error",
          "Indique Sí o No."
        )
      )
    }

    const connectionTypes = parseConnectionTypesList(values.tipos_conexion ?? "")
    if (!connectionTypes.ok) {
      rowIssues.push(
        issue(
          "CATALOGO",
          row.rowNumber,
          "tipos_conexion",
          values.tipos_conexion,
          "error",
          `Tipo de conexión no reconocido: ${connectionTypes.unknown.join(", ")}.`
        )
      )
    }

    const isActive = mapYesNo(values.activo ?? "", true)
    if (values.activo?.trim() && isActive == null) {
      rowIssues.push(
        issue(
          "CATALOGO",
          row.rowNumber,
          "activo",
          values.activo,
          "error",
          "Indique Sí o No."
        )
      )
    }

    if (externalCode && existingCatalogByCode.has(lower(externalCode))) {
      rowIssues.push(
        issue(
          "CATALOGO",
          row.rowNumber,
          "catalogo_id_externo",
          externalCode,
          "warning",
          "Ya existe un ítem de catálogo con este identificador. Se reutilizará."
        )
      )
    } else if (name && existingCatalogByName.has(lower(name))) {
      rowIssues.push(
        issue(
          "CATALOGO",
          row.rowNumber,
          "nombre_servicio",
          name,
          "warning",
          "Ya existe un ítem de catálogo con este nombre. Se reutilizará."
        )
      )
    }

    if (externalCode) {
      catalogNameByCode.set(lower(externalCode), name)
      catalogTechByCode.set(lower(externalCode), technology ?? "")
    }

    const status = rowStatus(rowIssues)
    bump(counts.CATALOGO, status)
    issues.push(...rowIssues)
    stagingRows.push({
      sheet: "CATALOGO",
      rowNumber: row.rowNumber,
      payload: {
        catalogo_id_externo: externalCode,
        nombre_servicio: name,
        descripcion: values.descripcion?.trim() ?? "",
        category: category ?? "internet",
        customer_type: customerType ?? "residential",
        technology: technology ?? "",
        download_speed_mbps: download.amount,
        upload_speed_mbps: upload.amount,
        monthly_price: price.amount,
        billing_period: period ?? "monthly",
        billing_method: billing ?? "siro",
        requires_connection: requiresConnection ?? true,
        allowed_connection_types: connectionTypes.types,
        is_active: isActive ?? true,
        _source: values,
      },
      validationStatus: status,
      issues: rowIssues,
    })
  }

  for (const row of customerRows) {
    const rowIssues: IspMigrationIssue[] = []
    const values = row.values
    const externalCode = values.cliente_id_externo?.trim() ?? ""
    const name = values.nombre_razon_social?.trim() ?? ""
    const dni = normalizeDni(values.dni_cuit)

    if (!externalCode) {
      rowIssues.push(
        issue(
          "CLIENTES",
          row.rowNumber,
          "cliente_id_externo",
          "",
          "error",
          "El identificador externo del cliente es obligatorio."
        )
      )
    } else if ((customerDupes.get(lower(externalCode)) ?? []).length > 1) {
      rowIssues.push(
        issue(
          "CLIENTES",
          row.rowNumber,
          "cliente_id_externo",
          externalCode,
          "error",
          "Identificador de cliente duplicado en el archivo."
        )
      )
    }

    if (!name) {
      rowIssues.push(
        issue(
          "CLIENTES",
          row.rowNumber,
          "nombre_razon_social",
          "",
          "error",
          "El nombre o razón social es obligatorio."
        )
      )
    }

    const customerType = mapCustomerType(values.tipo_cliente ?? "")
    if (!values.tipo_cliente?.trim()) {
      rowIssues.push(
        issue(
          "CLIENTES",
          row.rowNumber,
          "tipo_cliente",
          "",
          "error",
          "El tipo de cliente es obligatorio."
        )
      )
    } else if (!customerType) {
      rowIssues.push(
        issue(
          "CLIENTES",
          row.rowNumber,
          "tipo_cliente",
          values.tipo_cliente,
          "error",
          "Tipo de cliente no reconocido. Use Particular, Empresa o Ambos."
        )
      )
    }

    if (!values.dni_cuit?.trim()) {
      rowIssues.push(
        issue(
          "CLIENTES",
          row.rowNumber,
          "dni_cuit",
          "",
          "error",
          "El DNI/CUIT es obligatorio."
        )
      )
    } else if (!dni.isValid) {
      rowIssues.push(
        issue(
          "CLIENTES",
          row.rowNumber,
          "dni_cuit",
          values.dni_cuit,
          "error",
          "DNI/CUIT inválido. Debe tener entre 7 y 11 dígitos."
        )
      )
    } else if ((dniDupes.get(dni.digits) ?? []).length > 1) {
      rowIssues.push(
        issue(
          "CLIENTES",
          row.rowNumber,
          "dni_cuit",
          values.dni_cuit,
          "error",
          "DNI/CUIT duplicado en el archivo."
        )
      )
    }

    if (!values.localidad?.trim()) {
      rowIssues.push(
        issue(
          "CLIENTES",
          row.rowNumber,
          "localidad",
          "",
          "error",
          "La localidad es obligatoria."
        )
      )
    }
    if (!values.domicilio?.trim()) {
      rowIssues.push(
        issue(
          "CLIENTES",
          row.rowNumber,
          "domicilio",
          "",
          "error",
          "El domicilio es obligatorio."
        )
      )
    }

    const statusValue = mapCustomerStatus(values.estado_cliente ?? "")
    if (!values.estado_cliente?.trim()) {
      rowIssues.push(
        issue(
          "CLIENTES",
          row.rowNumber,
          "estado_cliente",
          "",
          "error",
          "El estado del cliente es obligatorio."
        )
      )
    } else if (!statusValue) {
      rowIssues.push(
        issue(
          "CLIENTES",
          row.rowNumber,
          "estado_cliente",
          values.estado_cliente,
          "error",
          "Estado de cliente no reconocido. Use Activo, Suspendido, Baja o Pendiente."
        )
      )
    }

    if (!values.email?.trim()) {
      rowIssues.push(
        issue(
          "CLIENTES",
          row.rowNumber,
          "email",
          "",
          "warning",
          "Cliente sin email."
        )
      )
    }

    if (externalCode && existingCustomerByCode.has(lower(externalCode))) {
      rowIssues.push(
        issue(
          "CLIENTES",
          row.rowNumber,
          "cliente_id_externo",
          externalCode,
          "warning",
          "El cliente ya existe. Se reutilizará para colgarle servicios migrados."
        )
      )
    } else if (dni.isValid && existingCustomerByDni.has(dni.digits)) {
      const match = existingCustomerByDni.get(dni.digits)!
      if (
        match.externalCode &&
        externalCode &&
        lower(match.externalCode) !== lower(externalCode)
      ) {
        rowIssues.push(
          issue(
            "CLIENTES",
            row.rowNumber,
            "dni_cuit",
            values.dni_cuit,
            "error",
            "El DNI/CUIT ya pertenece a otro cliente de esta empresa."
          )
        )
      } else {
        rowIssues.push(
          issue(
            "CLIENTES",
            row.rowNumber,
            "dni_cuit",
            values.dni_cuit,
            "warning",
            "Ya existe un cliente con este DNI/CUIT. Se reutilizará."
          )
        )
      }
    }

    const status = rowStatus(rowIssues)
    bump(counts.CLIENTES, status)
    issues.push(...rowIssues)
    stagingRows.push({
      sheet: "CLIENTES",
      rowNumber: row.rowNumber,
      payload: {
        cliente_id_externo: externalCode,
        nombre_razon_social: name,
        dni_cuit: values.dni_cuit?.trim() ?? "",
        telefono: values.telefono?.trim() ?? "",
        whatsapp: values.whatsapp?.trim() ?? "",
        email: values.email?.trim() ?? "",
        localidad: values.localidad?.trim() ?? "",
        domicilio: values.domicilio?.trim() ?? "",
        observaciones: values.observaciones?.trim() ?? "",
        customer_status: statusValue ?? "activo",
        tipo_cliente: values.tipo_cliente?.trim() ?? "",
        estado_cliente: values.estado_cliente?.trim() ?? "",
        _source: values,
      },
      validationStatus: status,
      issues: rowIssues,
    })
  }

  for (const row of serviceRows) {
    const rowIssues: IspMigrationIssue[] = []
    const values = row.values
    const externalCode = values.servicio_id_externo?.trim() ?? ""
    const customerCode = values.cliente_id_externo?.trim() ?? ""
    const catalogCode = values.catalogo_id_externo?.trim() ?? ""

    if (!externalCode) {
      rowIssues.push(
        issue(
          "SERVICIOS",
          row.rowNumber,
          "servicio_id_externo",
          "",
          "error",
          "El identificador externo del servicio es obligatorio."
        )
      )
    } else if ((serviceDupes.get(lower(externalCode)) ?? []).length > 1) {
      rowIssues.push(
        issue(
          "SERVICIOS",
          row.rowNumber,
          "servicio_id_externo",
          externalCode,
          "error",
          "Identificador de servicio duplicado en el archivo."
        )
      )
    }

    if (!customerCode) {
      rowIssues.push(
        issue(
          "SERVICIOS",
          row.rowNumber,
          "cliente_id_externo",
          "",
          "error",
          "Todo servicio contratado debe tener un cliente."
        )
      )
    } else if (
      !customerIds.has(lower(customerCode)) &&
      !existingCustomerByCode.has(lower(customerCode))
    ) {
      rowIssues.push(
        issue(
          "SERVICIOS",
          row.rowNumber,
          "cliente_id_externo",
          customerCode,
          "error",
          "No existe un cliente con este identificador."
        )
      )
    }

    if (!catalogCode) {
      rowIssues.push(
        issue(
          "SERVICIOS",
          row.rowNumber,
          "catalogo_id_externo",
          "",
          "error",
          "El identificador de catálogo es obligatorio."
        )
      )
    } else if (
      !catalogIds.has(lower(catalogCode)) &&
      !existingCatalogByCode.has(lower(catalogCode))
    ) {
      rowIssues.push(
        issue(
          "SERVICIOS",
          row.rowNumber,
          "catalogo_id_externo",
          catalogCode,
          "error",
          "No existe un servicio de catálogo con este identificador."
        )
      )
    }

    const commercial = mapCommercialStatus(values.estado_comercial ?? "")
    if (!values.estado_comercial?.trim()) {
      rowIssues.push(
        issue(
          "SERVICIOS",
          row.rowNumber,
          "estado_comercial",
          "",
          "error",
          "El estado comercial es obligatorio."
        )
      )
    } else if (!commercial) {
      rowIssues.push(
        issue(
          "SERVICIOS",
          row.rowNumber,
          "estado_comercial",
          values.estado_comercial,
          "error",
          "Estado comercial no reconocido. Use Activo, Suspendido, Baja o Pendiente de alta."
        )
      )
    }

    const price = parseMigrationMoney(values.precio_mensual ?? "")
    if (!price.ok) {
      rowIssues.push(
        issue(
          "SERVICIOS",
          row.rowNumber,
          "precio_mensual",
          values.precio_mensual,
          "error",
          "Precio mensual inválido."
        )
      )
    } else if (price.empty || price.amount === 0) {
      rowIssues.push(
        issue(
          "SERVICIOS",
          row.rowNumber,
          "precio_mensual",
          values.precio_mensual ?? "",
          "warning",
          "Servicio con precio mensual 0."
        )
      )
    }

    const download = parseSpeedMbps(values.velocidad_bajada ?? "")
    const upload = parseSpeedMbps(values.velocidad_subida ?? "")
    if (!download.ok) {
      rowIssues.push(
        issue(
          "SERVICIOS",
          row.rowNumber,
          "velocidad_bajada",
          values.velocidad_bajada,
          "error",
          "Velocidad de bajada inválida."
        )
      )
    }
    if (!upload.ok) {
      rowIssues.push(
        issue(
          "SERVICIOS",
          row.rowNumber,
          "velocidad_subida",
          values.velocidad_subida,
          "error",
          "Velocidad de subida inválida."
        )
      )
    } else if (upload.empty) {
      rowIssues.push(
        issue(
          "SERVICIOS",
          row.rowNumber,
          "velocidad_subida",
          "",
          "warning",
          "Velocidad de subida no informada."
        )
      )
    }

    let activationDate = ""
    if (values.fecha_alta?.trim()) {
      const parsed = parseImportDate(values.fecha_alta)
      if (!parsed) {
        rowIssues.push(
          issue(
            "SERVICIOS",
            row.rowNumber,
            "fecha_alta",
            values.fecha_alta,
            "error",
            "Fecha de alta inválida."
          )
        )
      } else {
        activationDate = parsed
      }
    }

    const resolvedTechnology =
      mapCatalogTechnology(values.tecnologia ?? "") ||
      catalogTechByCode.get(lower(catalogCode)) ||
      ""

    if (values.tecnologia?.trim() && !mapCatalogTechnology(values.tecnologia)) {
      rowIssues.push(
        issue(
          "SERVICIOS",
          row.rowNumber,
          "tecnologia",
          values.tecnologia,
          "error",
          "Tecnología no reconocida."
        )
      )
    }

    const billing = mapServiceBillingMethod(values.medio_cobranza ?? "")
    if (values.medio_cobranza?.trim() && !billing) {
      rowIssues.push(
        issue(
          "SERVICIOS",
          row.rowNumber,
          "medio_cobranza",
          values.medio_cobranza,
          "error",
          "Medio de cobranza no reconocido. Use SIRO o Pendiente."
        )
      )
    }

    if (externalCode && existingServiceByCode.has(lower(externalCode))) {
      rowIssues.push(
        issue(
          "SERVICIOS",
          row.rowNumber,
          "servicio_id_externo",
          externalCode,
          "warning",
          "Ya existe un servicio con este identificador. Se omitirá salvo reimportación explícita."
        )
      )
    }

    if (
      externalCode &&
      !connectionsByService.has(lower(externalCode))
    ) {
      rowIssues.push(
        issue(
          "SERVICIOS",
          row.rowNumber,
          "servicio_id_externo",
          externalCode,
          "warning",
          "Servicio sin conexión técnica."
        )
      )
    }

    const snapshotName =
      values.nombre_servicio?.trim() ||
      catalogNameByCode.get(lower(catalogCode)) ||
      existingCatalogByCode.get(lower(catalogCode))?.name ||
      ""

    if (!values.nombre_servicio?.trim() && snapshotName) {
      rowIssues.push(
        issue(
          "SERVICIOS",
          row.rowNumber,
          "nombre_servicio",
          snapshotName,
          "warning",
          "Nombre de servicio tomado del catálogo para el snapshot contratado."
        )
      )
    }

    const status = rowStatus(rowIssues)
    bump(counts.SERVICIOS, status)
    issues.push(...rowIssues)
    stagingRows.push({
      sheet: "SERVICIOS",
      rowNumber: row.rowNumber,
      payload: {
        servicio_id_externo: externalCode,
        cliente_id_externo: customerCode,
        catalogo_id_externo: catalogCode,
        nombre_servicio: snapshotName,
        technology: resolvedTechnology,
        contracted_speed: formatContractedSpeed(download.amount, upload.amount),
        monthly_price: price.amount,
        fecha_alta: activationDate,
        commercial_status: commercial ?? "active",
        billing_method: billing ?? "pending",
        observaciones: values.observaciones?.trim() ?? "",
        estado_comercial: values.estado_comercial?.trim() ?? "",
        tecnologia: values.tecnologia?.trim() ?? "",
        velocidad_bajada: values.velocidad_bajada?.trim() ?? "",
        velocidad_subida: values.velocidad_subida?.trim() ?? "",
        medio_cobranza: values.medio_cobranza?.trim() ?? "",
        _source: values,
      },
      validationStatus: status,
      issues: rowIssues,
    })
  }

  for (const row of connectionRows) {
    const rowIssues: IspMigrationIssue[] = []
    const values = row.values
    const externalCode = values.conexion_id_externo?.trim() ?? ""
    const serviceCode = values.servicio_id_externo?.trim() ?? ""
    const type = mapConnectionType(values.tipo_conexion ?? "")
    const technical = mapTechnicalStatus(values.estado_tecnico ?? "")

    if (!externalCode) {
      rowIssues.push(
        issue(
          "CONEXIONES",
          row.rowNumber,
          "conexion_id_externo",
          "",
          "error",
          "El identificador externo de la conexión es obligatorio."
        )
      )
    } else if ((connectionDupes.get(lower(externalCode)) ?? []).length > 1) {
      rowIssues.push(
        issue(
          "CONEXIONES",
          row.rowNumber,
          "conexion_id_externo",
          externalCode,
          "error",
          "Identificador de conexión duplicado en el archivo."
        )
      )
    }

    if (!serviceCode) {
      rowIssues.push(
        issue(
          "CONEXIONES",
          row.rowNumber,
          "servicio_id_externo",
          "",
          "error",
          "Toda conexión debe tener un servicio."
        )
      )
    } else if (
      !serviceIds.has(lower(serviceCode)) &&
      !existingServiceByCode.has(lower(serviceCode))
    ) {
      rowIssues.push(
        issue(
          "CONEXIONES",
          row.rowNumber,
          "servicio_id_externo",
          serviceCode,
          "error",
          "No existe un servicio con este identificador."
        )
      )
    } else if ((connectionsByService.get(lower(serviceCode)) ?? 0) > 1) {
      rowIssues.push(
        issue(
          "CONEXIONES",
          row.rowNumber,
          "servicio_id_externo",
          serviceCode,
          "error",
          "El modelo actual permite una sola conexión por servicio."
        )
      )
    }

    if (!values.tipo_conexion?.trim()) {
      rowIssues.push(
        issue(
          "CONEXIONES",
          row.rowNumber,
          "tipo_conexion",
          "",
          "error",
          "El tipo de conexión es obligatorio."
        )
      )
    } else if (!type) {
      rowIssues.push(
        issue(
          "CONEXIONES",
          row.rowNumber,
          "tipo_conexion",
          values.tipo_conexion,
          "error",
          "Tipo de conexión no reconocido. Use PPPoE, IP estática, DHCP u Otro."
        )
      )
    }

    if (!values.estado_tecnico?.trim()) {
      rowIssues.push(
        issue(
          "CONEXIONES",
          row.rowNumber,
          "estado_tecnico",
          "",
          "error",
          "El estado técnico es obligatorio."
        )
      )
    } else if (!technical) {
      rowIssues.push(
        issue(
          "CONEXIONES",
          row.rowNumber,
          "estado_tecnico",
          values.estado_tecnico,
          "error",
          "Estado técnico no reconocido. Use Provisionamiento pendiente, Provisionado, Error o Desconectado."
        )
      )
    }

    if (type === "pppoe") {
      if (!values.usuario_pppoe?.trim()) {
        rowIssues.push(
          issue(
            "CONEXIONES",
            row.rowNumber,
            "usuario_pppoe",
            "",
            "error",
            "El usuario PPPoE es obligatorio para este tipo de conexión."
          )
        )
      }
      if (!values.password_pppoe?.trim()) {
        rowIssues.push(
          issue(
            "CONEXIONES",
            row.rowNumber,
            "password_pppoe",
            "",
            "warning",
            "Contraseña PPPoE no informada."
          )
        )
      }
    }

    if (type === "static_ip") {
      if (!values.ip?.trim()) {
        rowIssues.push(
          issue(
            "CONEXIONES",
            row.rowNumber,
            "ip",
            "",
            "error",
            "La dirección IP es obligatoria para IP estática."
          )
        )
      } else if (!isValidIpv4(values.ip)) {
        rowIssues.push(
          issue(
            "CONEXIONES",
            row.rowNumber,
            "ip",
            values.ip,
            "error",
            "La dirección IP no tiene un formato IPv4 válido."
          )
        )
      }
    } else if (values.ip?.trim() && !isValidIpv4(values.ip)) {
      rowIssues.push(
        issue(
          "CONEXIONES",
          row.rowNumber,
          "ip",
          values.ip,
          "error",
          "La dirección IP no tiene un formato IPv4 válido."
        )
      )
    }

    if (values.ip?.trim() && (ipDupes.get(lower(values.ip)) ?? []).length > 1) {
      rowIssues.push(
        issue(
          "CONEXIONES",
          row.rowNumber,
          "ip",
          values.ip,
          "error",
          "Dirección IP duplicada en el archivo."
        )
      )
    }

    if (
      values.usuario_pppoe?.trim() &&
      (pppoeDupes.get(lower(values.usuario_pppoe)) ?? []).length > 1
    ) {
      rowIssues.push(
        issue(
          "CONEXIONES",
          row.rowNumber,
          "usuario_pppoe",
          values.usuario_pppoe,
          "error",
          "Usuario PPPoE duplicado en el archivo."
        )
      )
    }

    const existingByCode = externalCode
      ? existingConnectionByCode.get(lower(externalCode))
      : undefined
    if (existingByCode) {
      rowIssues.push(
        issue(
          "CONEXIONES",
          row.rowNumber,
          "conexion_id_externo",
          externalCode,
          "warning",
          "Ya existe una conexión con este identificador. Se omitirá salvo reimportación explícita."
        )
      )
    } else {
      if (
        values.ip?.trim() &&
        existingIps.has(lower(values.ip)) &&
        type === "static_ip"
      ) {
        rowIssues.push(
          issue(
            "CONEXIONES",
            row.rowNumber,
            "ip",
            values.ip,
            "error",
            "La dirección IP ya está asignada a otra conexión."
          )
        )
      }
      if (
        values.usuario_pppoe?.trim() &&
        existingPppoe.has(lower(values.usuario_pppoe))
      ) {
        rowIssues.push(
          issue(
            "CONEXIONES",
            row.rowNumber,
            "usuario_pppoe",
            values.usuario_pppoe,
            "error",
            "El usuario PPPoE ya está asignado a otra conexión."
          )
        )
      }
      const existingService = serviceCode
        ? existingServiceByCode.get(lower(serviceCode))
        : undefined
      if (existingService?.hasConnection) {
        rowIssues.push(
          issue(
            "CONEXIONES",
            row.rowNumber,
            "servicio_id_externo",
            serviceCode,
            "error",
            "El servicio ya tiene una conexión técnica."
          )
        )
      }
    }

    let provisionedAt = ""
    if (values.fecha_provisionamiento?.trim()) {
      const parsed = parseImportDate(values.fecha_provisionamiento)
      if (!parsed) {
        rowIssues.push(
          issue(
            "CONEXIONES",
            row.rowNumber,
            "fecha_provisionamiento",
            values.fecha_provisionamiento,
            "error",
            "Fecha de provisionamiento inválida."
          )
        )
      } else {
        provisionedAt = parsed
      }
    }

    const prefixRaw = values.prefijo?.trim() ?? ""
    let prefix: number | null = null
    if (prefixRaw) {
      const parsedPrefix = Number(prefixRaw)
      if (
        !Number.isInteger(parsedPrefix) ||
        parsedPrefix < 0 ||
        parsedPrefix > 128
      ) {
        rowIssues.push(
          issue(
            "CONEXIONES",
            row.rowNumber,
            "prefijo",
            prefixRaw,
            "error",
            "El prefijo debe ser un entero entre 0 y 128."
          )
        )
      } else {
        prefix = parsedPrefix
      }
    }

    const status = rowStatus(rowIssues)
    bump(counts.CONEXIONES, status)
    issues.push(...rowIssues)
    stagingRows.push({
      sheet: "CONEXIONES",
      rowNumber: row.rowNumber,
      payload: {
        conexion_id_externo: externalCode,
        servicio_id_externo: serviceCode,
        connection_type: type ?? "other",
        technical_status: technical ?? "pending_provision",
        usuario_pppoe: values.usuario_pppoe?.trim() ?? "",
        password_pppoe: values.password_pppoe ?? "",
        ip: values.ip?.trim() ?? "",
        prefijo: prefix,
        gateway: values.gateway?.trim() ?? "",
        vlan: values.vlan?.trim() ?? "",
        perfil_tecnico: values.perfil_tecnico?.trim() ?? "",
        core: values.core?.trim() ?? "",
        fecha_provisionamiento: provisionedAt,
        observaciones: values.observaciones?.trim() ?? "",
        tipo_conexion: values.tipo_conexion?.trim() ?? "",
        estado_tecnico: values.estado_tecnico?.trim() ?? "",
        _source: values,
      },
      validationStatus: status,
      issues: rowIssues,
    })
  }

  for (const row of equipmentRows) {
    const rowIssues: IspMigrationIssue[] = []
    const values = row.values
    const externalCode = values.equipamiento_id_externo?.trim() ?? ""
    const connectionCode = values.conexion_id_externo?.trim() ?? ""

    if (!externalCode) {
      rowIssues.push(
        issue(
          "EQUIPAMIENTO",
          row.rowNumber,
          "equipamiento_id_externo",
          "",
          "error",
          "El identificador externo del equipamiento es obligatorio cuando hay una fila."
        )
      )
    } else if ((equipmentDupes.get(lower(externalCode)) ?? []).length > 1) {
      rowIssues.push(
        issue(
          "EQUIPAMIENTO",
          row.rowNumber,
          "equipamiento_id_externo",
          externalCode,
          "error",
          "Identificador de equipamiento duplicado en el archivo."
        )
      )
    }

    if (!connectionCode) {
      rowIssues.push(
        issue(
          "EQUIPAMIENTO",
          row.rowNumber,
          "conexion_id_externo",
          "",
          "error",
          "El equipamiento debe referenciar una conexión existente."
        )
      )
    } else if (
      !connectionIds.has(lower(connectionCode)) &&
      !existingConnectionByCode.has(lower(connectionCode))
    ) {
      rowIssues.push(
        issue(
          "EQUIPAMIENTO",
          row.rowNumber,
          "conexion_id_externo",
          connectionCode,
          "error",
          "No existe una conexión con este identificador."
        )
      )
    }

    if (externalCode && existingEquipment.has(lower(externalCode))) {
      rowIssues.push(
        issue(
          "EQUIPAMIENTO",
          row.rowNumber,
          "equipamiento_id_externo",
          externalCode,
          "warning",
          "El equipamiento ya existe. Se omitirá."
        )
      )
    }

    const status = rowStatus(rowIssues)
    bump(counts.EQUIPAMIENTO, status)
    issues.push(...rowIssues)
    stagingRows.push({
      sheet: "EQUIPAMIENTO",
      rowNumber: row.rowNumber,
      payload: {
        equipamiento_id_externo: externalCode,
        conexion_id_externo: connectionCode,
        tipo_equipo: values.tipo_equipo?.trim() ?? "",
        marca: values.marca?.trim() ?? "",
        modelo: values.modelo?.trim() ?? "",
        numero_serie: values.numero_serie?.trim() ?? "",
        mac: values.mac?.trim() ?? "",
        ip_gestion: values.ip_gestion?.trim() ?? "",
        olt: values.olt?.trim() ?? "",
        pon: values.pon?.trim() ?? "",
        puerto: values.puerto?.trim() ?? "",
        torre: values.torre?.trim() ?? "",
        sector: values.sector?.trim() ?? "",
        cpe: values.cpe?.trim() ?? "",
        onu: values.onu?.trim() ?? "",
        ont: values.ont?.trim() ?? "",
        observaciones: values.observaciones?.trim() ?? "",
        _source: values,
      },
      validationStatus: status,
      issues: rowIssues,
    })
  }

  const hasData =
    customerRows.length +
      catalogRows.length +
      serviceRows.length +
      connectionRows.length >
    0
  const examplesIgnored =
    counts.CLIENTES.examples +
    counts.CATALOGO.examples +
    counts.SERVICIOS.examples +
    counts.CONEXIONES.examples +
    counts.EQUIPAMIENTO.examples

  const errorCount = issues.filter((item) => item.level === "error").length
  const warningCount = issues.filter((item) => item.level === "warning").length
  const duplicateCompletedRun = Boolean(
    options?.fileSha256 &&
      existing.completedFileHashes.includes(options.fileSha256)
  )

  const importableCustomers = stagingRows.filter(
    (row) => row.sheet === "CLIENTES" && row.validationStatus !== "error"
  ).length
  const importableCatalog = stagingRows.filter(
    (row) => row.sheet === "CATALOGO" && row.validationStatus !== "error"
  ).length
  const importableServices = stagingRows.filter(
    (row) => row.sheet === "SERVICIOS" && row.validationStatus !== "error"
  ).length
  const importableConnections = stagingRows.filter(
    (row) => row.sheet === "CONEXIONES" && row.validationStatus !== "error"
  ).length
  const importableEquipment = stagingRows.filter(
    (row) => row.sheet === "EQUIPAMIENTO" && row.validationStatus !== "error"
  ).length

  const customersWithoutService = customerRows.filter((row) => {
    const id = lower(row.values.cliente_id_externo ?? "")
    return id && !servicesByCustomer.has(id)
  }).length
  const servicesWithoutConnection = serviceRows.filter((row) => {
    const id = lower(row.values.servicio_id_externo ?? "")
    return id && !connectionsByService.has(id)
  }).length

  const canImport =
    errorCount === 0 && workbook.missingRequiredSheets.length === 0 && hasData
  const runStatus = resolveRunStatus({
    hasRealData: hasData,
    missingRequiredSheets: workbook.missingRequiredSheets.length,
    errorCount,
  })

  return {
    issues,
    counts,
    stagingRows,
    preview: {
      customers: importableCustomers,
      catalog: importableCatalog,
      services: importableServices,
      connections: importableConnections,
      equipment: importableEquipment,
      warnings: warningCount,
      errors: errorCount,
      customersWithoutService,
      servicesWithoutConnection,
      examplesIgnored,
    },
    canImport,
    hasRealData: hasData,
    runStatus,
    duplicateCompletedRun,
  }
}

export function assertPasswordNotInIssues(
  issues: IspMigrationIssue[]
): boolean {
  return issues.every((item) => {
    if (item.field !== "password_pppoe") return true
    return !item.value || item.value === ISP_MIGRATION_HIDDEN_SECRET
  })
}

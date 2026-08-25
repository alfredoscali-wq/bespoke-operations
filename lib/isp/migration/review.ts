import {
  ISP_MIGRATION_CATALOG_HEADERS,
  ISP_MIGRATION_CONNECTION_HEADERS,
  ISP_MIGRATION_CUSTOMER_HEADERS,
  ISP_MIGRATION_EQUIPMENT_HEADERS,
  ISP_MIGRATION_HIDDEN_SECRET,
  ISP_MIGRATION_SERVICE_HEADERS,
} from "@/lib/isp/migration/constants"
import { ISP_CONNECTION_TYPE_LABELS } from "@/lib/isp/labels"
import { ISP_MIGRATION_SENSITIVE_FIELDS } from "@/lib/isp/migration/constants"
import type { IspConnectionType } from "@/lib/isp/constants"
import type {
  IspMigrationIssue,
  IspMigrationParsedRow,
  IspMigrationParsedWorkbook,
} from "@/lib/isp/migration/types"

export type IspMigrationStoredRow = {
  id: string
  sheet: "CLIENTES" | "CATALOGO" | "SERVICIOS" | "CONEXIONES" | "EQUIPAMIENTO"
  rowNumber: number
  payload: Record<string, unknown>
  validationStatus: "valid" | "warning" | "error"
  issues: IspMigrationIssue[]
}

export type IspMigrationReviewItem = {
  key: string
  customerRowId: string | null
  serviceRowId: string | null
  connectionRowId: string | null
  subscriberName: string
  dni: string
  serviceName: string
  connectionLabel: string
  status: "valid" | "warning" | "error"
  issues: IspMigrationIssue[]
  editable: {
    nombre_razon_social: string
    dni_cuit: string
    localidad: string
    domicilio: string
    estado_cliente: string
    nombre_servicio: string
    estado_comercial: string
    precio_mensual: string
    tipo_conexion: string
    estado_tecnico: string
    ip: string
    usuario_pppoe: string
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }
  return {}
}

function cell(value: unknown): string {
  if (value == null) return ""
  return String(value)
}

function sourceValues(payload: Record<string, unknown>): Record<string, string> {
  const source = asRecord(payload._source)
  if (Object.keys(source).length > 0) {
    const fromSource: Record<string, string> = {}
    for (const [key, value] of Object.entries(source)) {
      if (key === "_source" || typeof value === "object") continue
      fromSource[key] = cell(value)
    }
    return fromSource
  }

  const merged: Record<string, string> = {}
  for (const [key, value] of Object.entries(payload)) {
    if (key === "_source" || key === "allowed_connection_types") continue
    if (typeof value === "object" && value !== null) continue
    merged[key] = cell(value)
  }
  return merged
}

function worstStatus(
  statuses: Array<"valid" | "warning" | "error" | undefined>
): "valid" | "warning" | "error" {
  if (statuses.includes("error")) return "error"
  if (statuses.includes("warning")) return "warning"
  return "valid"
}

export function storedRowsToParsedWorkbook(
  rows: IspMigrationStoredRow[]
): IspMigrationParsedWorkbook {
  const bySheet: IspMigrationParsedWorkbook["sheets"] = {
    CLIENTES: [],
    CATALOGO: [],
    SERVICIOS: [],
    CONEXIONES: [],
    EQUIPAMIENTO: [],
  }

  for (const row of rows) {
    const values = sourceValues(row.payload)
    const parsed: IspMigrationParsedRow = {
      rowNumber: row.rowNumber,
      values,
    }
    if (row.sheet === "CLIENTES") bySheet.CLIENTES?.push(parsed)
    if (row.sheet === "CATALOGO") bySheet.CATALOGO?.push(parsed)
    if (row.sheet === "SERVICIOS") bySheet.SERVICIOS?.push(parsed)
    if (row.sheet === "CONEXIONES") bySheet.CONEXIONES?.push(parsed)
    if (row.sheet === "EQUIPAMIENTO") bySheet.EQUIPAMIENTO?.push(parsed)
  }

  return { sheets: bySheet, missingRequiredSheets: [] }
}

export function applyCorrectionsToPayload(
  payload: Record<string, unknown>,
  fields: Record<string, string>
): Record<string, unknown> {
  const next = { ...payload }
  const source = { ...sourceValues(payload) }
  for (const [field, raw] of Object.entries(fields)) {
    if ((ISP_MIGRATION_SENSITIVE_FIELDS as readonly string[]).includes(field)) {
      if (!raw || raw === ISP_MIGRATION_HIDDEN_SECRET) continue
    }
    source[field] = raw
    next[field] = raw
    if (field === "nombre_razon_social") next.nombre_razon_social = raw
    if (field === "dni_cuit") next.dni_cuit = raw
    if (field === "estado_cliente") next.estado_cliente = raw
    if (field === "nombre_servicio") next.nombre_servicio = raw
    if (field === "precio_mensual") next.monthly_price = raw
    if (field === "estado_comercial") next.estado_comercial = raw
    if (field === "tipo_conexion") next.tipo_conexion = raw
    if (field === "estado_tecnico") next.estado_tecnico = raw
  }
  next._source = source
  return next
}

export function buildMigrationReviewItems(
  rows: IspMigrationStoredRow[]
): IspMigrationReviewItem[] {
  const customers = rows.filter((row) => row.sheet === "CLIENTES")
  const services = rows.filter((row) => row.sheet === "SERVICIOS")
  const connections = rows.filter((row) => row.sheet === "CONEXIONES")
  const items: IspMigrationReviewItem[] = []

  for (const customer of customers) {
    const customerValues = sourceValues(customer.payload)
    const customerCode = cell(customer.payload.cliente_id_externo).toLowerCase()
    const relatedServices = services.filter(
      (row) => cell(row.payload.cliente_id_externo).toLowerCase() === customerCode
    )

    if (relatedServices.length === 0) {
      items.push(
        toReviewItem({
          customer,
          service: null,
          connection: null,
          customerValues,
        })
      )
      continue
    }

    for (const service of relatedServices) {
      const serviceCode = cell(service.payload.servicio_id_externo).toLowerCase()
      const connection =
        connections.find(
          (row) =>
            cell(row.payload.servicio_id_externo).toLowerCase() === serviceCode
        ) ?? null
      items.push(
        toReviewItem({
          customer,
          service,
          connection,
          customerValues,
        })
      )
    }
  }

  const linkedServiceIds = new Set(
    items.map((item) => item.serviceRowId).filter((id): id is string => Boolean(id))
  )
  for (const service of services) {
    if (linkedServiceIds.has(service.id)) continue
    const serviceCode = cell(service.payload.servicio_id_externo).toLowerCase()
    const connection =
      connections.find(
        (row) =>
          cell(row.payload.servicio_id_externo).toLowerCase() === serviceCode
      ) ?? null
    items.push(
      toReviewItem({
        customer: null,
        service,
        connection,
        customerValues: {},
      })
    )
  }

  const linkedConnectionIds = new Set(
    items
      .map((item) => item.connectionRowId)
      .filter((id): id is string => Boolean(id))
  )
  for (const connection of connections) {
    if (linkedConnectionIds.has(connection.id)) continue
    items.push(
      toReviewItem({
        customer: null,
        service: null,
        connection,
        customerValues: {},
      })
    )
  }

  return items
}

function toReviewItem(input: {
  customer: IspMigrationStoredRow | null
  service: IspMigrationStoredRow | null
  connection: IspMigrationStoredRow | null
  customerValues: Record<string, string>
}): IspMigrationReviewItem {
  const serviceValues = input.service
    ? sourceValues(input.service.payload)
    : {}
  const connectionValues = input.connection
    ? sourceValues(input.connection.payload)
    : {}
  const connectionType = cell(
    input.connection?.payload.connection_type ?? connectionValues.tipo_conexion
  ) as IspConnectionType
  const connectionLabel = input.connection
    ? ISP_CONNECTION_TYPE_LABELS[connectionType] ||
      connectionValues.tipo_conexion ||
      "—"
    : "—"

  const issues = [
    ...(input.customer?.issues ?? []),
    ...(input.service?.issues ?? []),
    ...(input.connection?.issues ?? []),
  ]

  return {
    key: [
      input.customer?.id ?? "none",
      input.service?.id ?? "none",
      input.connection?.id ?? "none",
    ].join(":"),
    customerRowId: input.customer?.id ?? null,
    serviceRowId: input.service?.id ?? null,
    connectionRowId: input.connection?.id ?? null,
    subscriberName:
      cell(input.customer?.payload.nombre_razon_social) ||
      input.customerValues.nombre_razon_social ||
      cell(input.service?.payload.cliente_id_externo) ||
      "—",
    dni: cell(input.customer?.payload.dni_cuit) || input.customerValues.dni_cuit,
    serviceName:
      cell(input.service?.payload.nombre_servicio) ||
      serviceValues.nombre_servicio ||
      "—",
    connectionLabel,
    status: worstStatus([
      input.customer?.validationStatus,
      input.service?.validationStatus,
      input.connection?.validationStatus,
    ]),
    issues,
    editable: {
      nombre_razon_social:
        cell(input.customer?.payload.nombre_razon_social) ||
        input.customerValues.nombre_razon_social,
      dni_cuit:
        cell(input.customer?.payload.dni_cuit) || input.customerValues.dni_cuit,
      localidad:
        cell(input.customer?.payload.localidad) ||
        input.customerValues.localidad,
      domicilio:
        cell(input.customer?.payload.domicilio) ||
        input.customerValues.domicilio,
      estado_cliente:
        input.customerValues.estado_cliente ||
        cell(input.customer?.payload.estado_cliente),
      nombre_servicio: serviceValues.nombre_servicio || "",
      estado_comercial: serviceValues.estado_comercial || "",
      precio_mensual: cell(input.service?.payload.monthly_price),
      tipo_conexion: connectionValues.tipo_conexion || "",
      estado_tecnico: connectionValues.estado_tecnico || "",
      ip: connectionValues.ip || "",
      usuario_pppoe: connectionValues.usuario_pppoe || "",
    },
  }
}

export function applyReviewPatches(
  rows: IspMigrationStoredRow[],
  patch: {
    customerRowId: string | null
    serviceRowId: string | null
    connectionRowId: string | null
    fields: Record<string, string>
  }
): IspMigrationStoredRow[] {
  const customerFields = [
    "nombre_razon_social",
    "dni_cuit",
    "localidad",
    "domicilio",
    "estado_cliente",
  ]
  const serviceFields = [
    "nombre_servicio",
    "estado_comercial",
    "precio_mensual",
  ]
  const connectionFields = [
    "tipo_conexion",
    "estado_tecnico",
    "ip",
    "usuario_pppoe",
  ]

  function pick(keys: string[]) {
    const next: Record<string, string> = {}
    for (const key of keys) {
      if (key in patch.fields) next[key] = patch.fields[key] ?? ""
    }
    return next
  }

  return rows.map((row) => {
    if (patch.customerRowId && row.id === patch.customerRowId) {
      return {
        ...row,
        payload: applyCorrectionsToPayload(row.payload, pick(customerFields)),
      }
    }
    if (patch.serviceRowId && row.id === patch.serviceRowId) {
      return {
        ...row,
        payload: applyCorrectionsToPayload(row.payload, pick(serviceFields)),
      }
    }
    if (patch.connectionRowId && row.id === patch.connectionRowId) {
      return {
        ...row,
        payload: applyCorrectionsToPayload(row.payload, pick(connectionFields)),
      }
    }
    return row
  })
}

export function filterReviewItems(
  items: IspMigrationReviewItem[],
  filter: "all" | "valid" | "warning" | "error"
): IspMigrationReviewItem[] {
  if (filter === "all") return items
  return items.filter((item) => item.status === filter)
}

export const ISP_MIGRATION_REVIEW_HEADERS = {
  customers: ISP_MIGRATION_CUSTOMER_HEADERS,
  catalog: ISP_MIGRATION_CATALOG_HEADERS,
  services: ISP_MIGRATION_SERVICE_HEADERS,
  connections: ISP_MIGRATION_CONNECTION_HEADERS,
  equipment: ISP_MIGRATION_EQUIPMENT_HEADERS,
}

import { abnetNumberFromExternalCode } from "@/lib/isp/abnet-master-universe"

export const ABNET_CONNECTION_IMPORT_MAX_BYTES = 8 * 1024 * 1024
export const ABNET_CONNECTION_IMPORT_MAX_ROWS = 20_000

export const ABNET_CONNECTION_STATUSES = [
  "activa",
  "morosa",
  "pendiente",
  "inactiva",
  "suspendida",
  "bloqueada",
  "desconocida",
] as const

export type AbnetConnectionStatus = (typeof ABNET_CONNECTION_STATUSES)[number]

export const ABNET_TRISTATE = ["si", "no", "desconocido"] as const
export type AbnetTristate = (typeof ABNET_TRISTATE)[number]

export type AbnetTvPackage = "basica" | "basica_pack" | "full" | "desconocido"

export type AbnetConnectionRecord = {
  abnetConnectionId: string
  abnetCustomerNumber: string
  abnetClientId: string
  customerName: string
  serviceType: string
  nodeName: string
  planName: string
  connectionStatus: AbnetConnectionStatus
  rawStatus: string
  gratis: AbnetTristate
  incobrable: AbnetTristate
  companyLabel: string
  altaAt: string | null
  bajaRegisteredAt: string | null
  bajaEffectiveAt: string | null
  bajaReason: string
  suspensionFrom: string | null
  suspensionUntil: string | null
  suspensionReason: string
  replacedConnectionId: string
}

export type AbnetConnectionParseIssue = {
  rowNumber: number
  reason: string
}

export type AbnetConnectionParseResult = {
  records: AbnetConnectionRecord[]
  issues: AbnetConnectionParseIssue[]
  headerRowNumber: number
}

const IGNORED_SENSITIVE_HEADERS = new Set([
  "password",
  "usuario",
  "ip",
  "macaddress",
  "domicilio",
  "email",
  "telefono",
  "lat",
  "lng",
])

export function foldAbnetHeader(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
}

export function parseAbnetTristate(value: unknown): AbnetTristate {
  const folded = foldAbnetHeader(value)
  if (!folded) return "desconocido"
  if (folded === "si" || folded === "yes" || folded === "true" || folded === "1") return "si"
  if (folded === "no" || folded === "false" || folded === "0") return "no"
  return "desconocido"
}

export function parseAbnetConnectionStatus(value: unknown): AbnetConnectionStatus {
  const folded = foldAbnetHeader(value)
  if (folded === "activa" || folded === "activo") return "activa"
  if (folded === "morosa" || folded === "moroso") return "morosa"
  if (folded === "pendiente") return "pendiente"
  if (folded === "inactiva" || folded === "inactivo") return "inactiva"
  if (folded === "suspendida" || folded === "suspendido") return "suspendida"
  if (folded === "bloqueada" || folded === "bloqueado") return "bloqueada"
  if (!folded) return "desconocida"
  return "desconocida"
}

export function abnetConnectionStatusLabel(status: AbnetConnectionStatus): string {
  if (status === "activa") return "Activa"
  if (status === "morosa") return "Morosa"
  if (status === "pendiente") return "Pendiente"
  if (status === "inactiva") return "Inactiva"
  if (status === "suspendida") return "Suspendida"
  if (status === "bloqueada") return "Bloqueada"
  return "Desconocida"
}

export function abnetGratisLabel(value: AbnetTristate): string {
  if (value === "si") return "Gratuita"
  if (value === "no") return "Paga"
  return "Gratuidad desconocida"
}

function cellText(value: unknown): string {
  if (value == null) return ""
  return String(value).trim()
}

function headerIndex(header: readonly unknown[], names: readonly string[]): number {
  const folded = header.map((cell) => foldAbnetHeader(cell))
  for (const name of names) {
    const index = folded.indexOf(name)
    if (index >= 0) return index
  }
  return -1
}

function parseTimestamp(value: unknown): string | null {
  const text = cellText(value)
  if (!text) return null
  const parsed = Date.parse(text.includes("T") ? text : text.replace(" ", "T"))
  if (!Number.isFinite(parsed)) return null
  return new Date(parsed).toISOString()
}

export function findAbnetConnectionHeader(matrix: readonly (readonly unknown[])[]): number {
  const limit = Math.min(matrix.length, 5)
  for (let index = 0; index < limit; index += 1) {
    const header = matrix[index] ?? []
    const hasId = headerIndex(header, ["id"]) >= 0
    const hasNumber = headerIndex(header, ["ncliente", "numerocliente"]) >= 0
    const hasStatus = headerIndex(header, ["estado"]) >= 0
    const hasGratis = headerIndex(header, ["gratis"]) >= 0
    if (hasId && hasNumber && hasStatus && hasGratis) return index
  }
  return -1
}

export function parseAbnetConnectionSheet(
  matrix: readonly (readonly unknown[])[]
): AbnetConnectionParseResult {
  const headerRowNumber = findAbnetConnectionHeader(matrix)
  if (headerRowNumber < 0) {
    return {
      records: [],
      issues: [
        {
          rowNumber: 1,
          reason:
            "Faltan encabezados Id, N° Cliente, Estado y Gratis en la hoja Datos.",
        },
      ],
      headerRowNumber: 0,
    }
  }
  const header = matrix[headerRowNumber] ?? []
  const idIndex = headerIndex(header, ["id"])
  const numberIndex = headerIndex(header, ["ncliente", "numerocliente"])
  const nameIndex = headerIndex(header, ["cliente", "nombre"])
  const typeIndex = headerIndex(header, ["tipo"])
  const nodeIndex = headerIndex(header, ["nodo"])
  const planIndex = headerIndex(header, ["plan"])
  const statusIndex = headerIndex(header, ["estado"])
  const clientIndex = headerIndex(header, ["idclientes"])
  const gratisIndex = headerIndex(header, ["gratis"])
  const incobrableIndex = headerIndex(header, ["incobrable"])
  const companyIndex = headerIndex(header, ["empresa"])
  const altaIndex = headerIndex(header, ["fechaalta"])
  const bajaRegisteredIndex = headerIndex(header, ["fecharegistrobaja"])
  const bajaEffectiveIndex = headerIndex(header, ["fechaefectivabaja"])
  const bajaReasonIndex = headerIndex(header, ["motivobaja"])
  const suspensionFromIndex = headerIndex(header, ["suspensiondesde"])
  const suspensionUntilIndex = headerIndex(header, ["suspensionhasta"])
  const suspensionReasonIndex = headerIndex(header, ["suspensionmotivo"])
  const replacedIndex = headerIndex(header, ["idconexionreemplazada"])

  const records: AbnetConnectionRecord[] = []
  const issues: AbnetConnectionParseIssue[] = []
  const seenIds = new Set<string>()
  let dataRows = 0

  for (let index = headerRowNumber + 1; index < matrix.length; index += 1) {
    const line = matrix[index] ?? []
    const rowNumber = index + 1
    const values = line.map(cellText)
    if (values.every((value) => value === "")) continue
    dataRows += 1
    if (dataRows > ABNET_CONNECTION_IMPORT_MAX_ROWS) {
      issues.push({
        rowNumber,
        reason: `El archivo supera ${ABNET_CONNECTION_IMPORT_MAX_ROWS} conexiones.`,
      })
      break
    }
    const connectionId = cellText(line[idIndex])
    const customerNumber = abnetNumberFromExternalCode(cellText(line[numberIndex]))
    if (!connectionId) {
      issues.push({ rowNumber, reason: "La conexión no tiene Id." })
      continue
    }
    if (!customerNumber || customerNumber === "99999999") {
      issues.push({ rowNumber, reason: "N° Cliente ausente o no utilizable." })
      continue
    }
    if (seenIds.has(connectionId)) {
      issues.push({ rowNumber, reason: `El Id ${connectionId} está repetido en el archivo.` })
      continue
    }
    seenIds.add(connectionId)
    const rawStatus = cellText(line[statusIndex])
    records.push({
      abnetConnectionId: connectionId,
      abnetCustomerNumber: customerNumber,
      abnetClientId: clientIndex >= 0 ? cellText(line[clientIndex]) : "",
      customerName: nameIndex >= 0 ? cellText(line[nameIndex]) : "",
      serviceType: typeIndex >= 0 ? cellText(line[typeIndex]) : "",
      nodeName: nodeIndex >= 0 ? cellText(line[nodeIndex]) : "",
      planName: planIndex >= 0 ? cellText(line[planIndex]) : "",
      connectionStatus: parseAbnetConnectionStatus(rawStatus),
      rawStatus,
      gratis: parseAbnetTristate(gratisIndex >= 0 ? line[gratisIndex] : null),
      incobrable: parseAbnetTristate(incobrableIndex >= 0 ? line[incobrableIndex] : null),
      companyLabel: companyIndex >= 0 ? cellText(line[companyIndex]) : "",
      altaAt: altaIndex >= 0 ? parseTimestamp(line[altaIndex]) : null,
      bajaRegisteredAt:
        bajaRegisteredIndex >= 0 ? parseTimestamp(line[bajaRegisteredIndex]) : null,
      bajaEffectiveAt:
        bajaEffectiveIndex >= 0 ? parseTimestamp(line[bajaEffectiveIndex]) : null,
      bajaReason: bajaReasonIndex >= 0 ? cellText(line[bajaReasonIndex]) : "",
      suspensionFrom:
        suspensionFromIndex >= 0 ? parseTimestamp(line[suspensionFromIndex]) : null,
      suspensionUntil:
        suspensionUntilIndex >= 0 ? parseTimestamp(line[suspensionUntilIndex]) : null,
      suspensionReason:
        suspensionReasonIndex >= 0 ? cellText(line[suspensionReasonIndex]) : "",
      replacedConnectionId: replacedIndex >= 0 ? cellText(line[replacedIndex]) : "",
    })
  }

  if (dataRows === 0 && issues.length === 0) {
    issues.push({ rowNumber: headerRowNumber + 1, reason: "El archivo no tiene conexiones." })
  }
  return { records, issues, headerRowNumber: headerRowNumber + 1 }
}

export function connectionStoredWithoutSecrets(record: AbnetConnectionRecord): boolean {
  const keys = Object.keys(record)
  return keys.every((key) => !IGNORED_SENSITIVE_HEADERS.has(foldAbnetHeader(key)))
}

export type AbnetConnectionImportPlan = {
  valid: number
  invalid: number
  created: number
  updated: number
  unchanged: number
  issues: AbnetConnectionParseIssue[]
  records: AbnetConnectionRecord[]
}

function sameConnection(left: AbnetConnectionRecord, right: AbnetConnectionRecord): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}

export function planAbnetConnectionImport(
  existing: readonly AbnetConnectionRecord[],
  parsed: AbnetConnectionParseResult
): AbnetConnectionImportPlan {
  const current = new Map(existing.map((row) => [row.abnetConnectionId, row]))
  let created = 0
  let updated = 0
  let unchanged = 0
  for (const record of parsed.records) {
    const previous = current.get(record.abnetConnectionId)
    if (!previous) created += 1
    else if (sameConnection(previous, record)) unchanged += 1
    else updated += 1
  }
  return {
    valid: parsed.records.length,
    invalid: parsed.issues.length,
    created,
    updated,
    unchanged,
    issues: parsed.issues,
    records: parsed.issues.length === 0 ? parsed.records : [],
  }
}

export function applyAbnetConnectionImport(
  existing: readonly AbnetConnectionRecord[],
  plan: AbnetConnectionImportPlan
): { records: AbnetConnectionRecord[] } | { error: string } {
  if (plan.invalid > 0 || plan.records.length !== plan.valid) {
    return { error: "La importación no se aplicó porque hay filas inválidas." }
  }
  const next = new Map(existing.map((row) => [row.abnetConnectionId, row]))
  for (const record of plan.records) next.set(record.abnetConnectionId, record)
  return { records: [...next.values()] }
}

/**
 * conexiones gratis.xlsx is a subset. A row is discarded only when the same
 * connection Id is already in the general padrón.
 */
export function mergeGratisConnectionSubset(
  general: readonly AbnetConnectionRecord[],
  subset: readonly AbnetConnectionRecord[]
): AbnetConnectionRecord[] {
  const ids = new Set(general.map((row) => row.abnetConnectionId))
  return [...general, ...subset.filter((row) => !ids.has(row.abnetConnectionId))]
}

export function importedTvPackage(planName: string): AbnetTvPackage {
  const folded = foldAbnetHeader(planName)
  if (!folded) return "desconocido"
  if (folded.includes("futbol")) return "basica_pack"
  if (folded.includes("packfull") || folded.includes("tvfull")) return "full"
  if (folded.includes("tvbasico") || folded.includes("tvbasica")) return "basica"
  return "desconocido"
}

export function resolveTvPackage(input: {
  bespokePackFutbol: boolean
  bespokeFull: boolean
  importedPlan: string | null
}): AbnetTvPackage {
  if (input.bespokePackFutbol) return "basica_pack"
  if (input.bespokeFull) return "full"
  if (!input.importedPlan) return "desconocido"
  return importedTvPackage(input.importedPlan)
}

export function tvPackageLabel(value: AbnetTvPackage): string {
  if (value === "basica") return "TV Básica"
  if (value === "basica_pack") return "TV Básica + Pack Fútbol"
  if (value === "full") return "TV Full"
  return "TV pendiente de revisión"
}

const BLOCKED_UPSELL = new Set<AbnetConnectionStatus>([
  "morosa",
  "suspendida",
  "bloqueada",
  "pendiente",
  "inactiva",
  "desconocida",
])

export function automaticTvUpsellAllowed(input: {
  connectionStatus: AbnetConnectionStatus | null
  gratis: AbnetTristate | null
  tvPackage: AbnetTvPackage
  severalConnections: boolean
}): boolean {
  if (input.severalConnections) return false
  if (!input.connectionStatus || input.connectionStatus !== "activa") return false
  if (BLOCKED_UPSELL.has(input.connectionStatus)) return false
  if (input.gratis !== "no") return false
  return input.tvPackage === "basica"
}

export type AbnetRegistryLink =
  | "sin_numero"
  | "vinculado"
  | "revision"
  | "ausente"

export function classifyAbnetRegistryLink(input: {
  externalCode: string | null | undefined
  sharedNumber: boolean
  connectionCount: number
}): { link: AbnetRegistryLink; note: string } {
  const number = abnetNumberFromExternalCode(input.externalCode)
  if (!number || number === "99999999") {
    return {
      link: "sin_numero",
      note: "Ficha Bespoke sin número ABNet utilizable. No es una baja.",
    }
  }
  if (input.sharedNumber) {
    return {
      link: "revision",
      note: "El número ABNet está en más de una ficha. Requiere revisión manual.",
    }
  }
  if (input.connectionCount > 0) {
    return {
      link: "vinculado",
      note: `Padrón ABNet vinculado: ${input.connectionCount} ${input.connectionCount === 1 ? "conexión" : "conexiones"}. No reemplaza los servicios técnicos de Bespoke.`,
    }
  }
  return {
    link: "ausente",
    note: "Sin conexión en el padrón actual — revisar posible baja",
  }
}

export function canConfirmAbnetConnectionImport(session: {
  systemRole?: string | null
  roleCode?: string | null
} | null): boolean {
  if (!session) return false
  return session.systemRole === "administrador" || session.roleCode === "administrador"
}

export function registryRecordKey(record: Pick<AbnetConnectionRecord, "abnetConnectionId">) {
  return record.abnetConnectionId
}

export type AbnetRegistryPadronOverlay = {
  connectionCount: number
  connectionIds: string[]
  connectionStatus: AbnetConnectionStatus | null
  connectionLabel: string | null
  gratis: AbnetTristate | null
  gratisLabel: string | null
  tvPackage: AbnetTvPackage
  tvPackageLabel: string
  upsellAllowed: boolean
}

export function overlayAbnetRegistryOnPadron(input: {
  customerNumber: string
  planName: string
  bespokePackFutbol: boolean
  bespokeFull: boolean
  connections: readonly Pick<
    AbnetConnectionRecord,
    "abnetConnectionId" | "abnetCustomerNumber" | "connectionStatus" | "gratis" | "planName"
  >[]
}): AbnetRegistryPadronOverlay | null {
  const number = abnetNumberFromExternalCode(input.customerNumber)
  const matches = number
    ? input.connections.filter((row) => row.abnetCustomerNumber === number)
    : []
  if (matches.length === 0) return null
  const samePlan = matches.filter(
    (row) => foldAbnetHeader(row.planName) === foldAbnetHeader(input.planName)
  )
  const chosen = samePlan.length === 1 ? samePlan : matches.length === 1 ? matches : []
  const statuses = [...new Set(matches.map((row) => row.connectionStatus))]
  const gratisValues = [...new Set((chosen.length ? chosen : matches).map((row) => row.gratis))]
  const status = chosen.length === 1 ? chosen[0].connectionStatus : statuses.length === 1 ? statuses[0] : null
  const gratis = gratisValues.length === 1 ? gratisValues[0] : null
  const importedPlan = chosen.length === 1 ? chosen[0].planName : null
  const tvPackage = resolveTvPackage({
    bespokePackFutbol: input.bespokePackFutbol,
    bespokeFull: input.bespokeFull,
    importedPlan,
  })
  const several = matches.length > 1 && chosen.length !== 1
  return {
    connectionCount: matches.length,
    connectionIds: matches.map((row) => row.abnetConnectionId),
    connectionStatus: status,
    connectionLabel: several
      ? `${matches.length} conexiones`
      : status
        ? abnetConnectionStatusLabel(status)
        : "Estado de conexión mixto",
    gratis,
    gratisLabel: gratis ? abnetGratisLabel(gratis) : "Gratuidad distinta entre conexiones",
    tvPackage,
    tvPackageLabel: tvPackageLabel(tvPackage),
    upsellAllowed: automaticTvUpsellAllowed({
      connectionStatus: status,
      gratis,
      tvPackage,
      severalConnections: several || matches.length > 1,
    }),
  }
}

export function summarizeRegistryOverlay(
  rows: readonly {
    abnetCustomerNumber?: string
    registryConnectionIds?: readonly string[]
  }[]
): { connections: number; customers: number } | null {
  const ids = new Set<string>()
  const numbers = new Set<string>()
  for (const row of rows) {
    const connectionIds = row.registryConnectionIds ?? []
    if (connectionIds.length === 0) continue
    for (const id of connectionIds) ids.add(id)
    const number = abnetNumberFromExternalCode(row.abnetCustomerNumber)
    if (number) numbers.add(number)
  }
  if (ids.size === 0) return null
  return { connections: ids.size, customers: numbers.size }
}

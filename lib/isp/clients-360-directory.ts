import {
  abnetConnectionStatusLabel,
  abnetGratisLabel,
  classifyAbnetRegistryLink,
  resolveTvPackage,
  tvPackageLabel,
  type AbnetConnectionStatus,
  type AbnetTristate,
} from "@/lib/isp/abnet-connection-registry"
import { catalogCodeForAbnetTvRepresentation } from "@/lib/isp/abnet-residential-load"
import { completeAbnetPersonalProfile, type AbnetCustomerRecord } from "@/lib/isp/abnet-customer-registry"
import { abnetNumberFromExternalCode } from "@/lib/isp/abnet-master-universe"

export const CLIENTS360_PADRON_ABSENCE_NOTE =
  "Sin conexión en el padrón actual — revisar posible baja"
export const CLIENTS360_SEVERAL_PLANS_LABEL = "Varios planes comerciales"
export const CLIENTS360_UNKNOWN_PLAN_LABEL = "Plan no determinado"
export const CLIENTS360_MULTIPLE_CONNECTION_IDS_NOTE =
  "Varios Id de conexión quedan sujetos a revisión comercial."

const INTERNET_PLAN_LABEL = {
  "FTTH-50-TV-BASICO": "FTTH 50 Mb",
  "FTTH-100-TV-BASICO": "FTTH 100 Mb",
  "FTTH-300-TV-BASICO": "FTTH 300 Mb",
  "WIRELESS-20-TV-BASICO": "Wireless 20 Mb",
} as const

export type Clients360PersonOrigin = "bespoke" | "padron"

export type Clients360PersonLink =
  | "vinculado"
  | "revision"
  | "ausente"
  | "sin_numero"
  | "importado"

export type Clients360DirectoryCustomer = {
  id: string
  name: string
  externalCode: string | null
  locality: string | null
  status: string
  inUniverse: boolean
  dni?: string | null
  phone?: string | null
  email?: string | null
  customerNumber?: string | null
  address?: string | null
  contractedPlan?: string | null
  bespokePackFutbol?: boolean
  bespokeTvFull?: boolean
}

export type Clients360DirectoryConnection = {
  abnetConnectionId: string
  abnetCustomerNumber: string
  customerName: string
  connectionStatus: AbnetConnectionStatus
  gratis: AbnetTristate
  planName: string
  serviceType: string
  nodeName: string
}

export type Clients360DirectoryEntry = {
  id: string
  origin: Clients360PersonOrigin
  link: Clients360PersonLink
  name: string
  externalCode: string | null
  customerId: string | null
  locality: string | null
  status: string
  listStatus: "activo" | "suspendido" | "baja" | "pendiente" | null
  serviceCount: number
  technicalConnectionCount: number
  registryConnectionCount: number
  registryConnectionIds: string[]
  registryStatusLabel: string | null
  registryGratisLabel: string | null
  commercialPlanLabel: string
  note: string
  dni: string | null
  phone: string | null
  email: string | null
  address: string | null
  bespokeCustomerNumber: string | null
}

const UNUSABLE_NUMBER = "99999999"

export function clients360PadronRowId(customerNumber: string): string {
  return `abnet-${customerNumber}`
}

export function clients360PadronNumberFromId(id: string): string | null {
  const match = /^abnet-(\d+)$/.exec(id)
  if (!match || match[1] === "0") return null
  return match[1]
}

function usableNumber(code: string | null | undefined): string | null {
  const number = abnetNumberFromExternalCode(code)
  if (!number || number === UNUSABLE_NUMBER) return null
  return number
}

function connectionSummary(rows: readonly Clients360DirectoryConnection[]): {
  count: number
  ids: string[]
  statusLabel: string | null
  gratisLabel: string | null
} {
  const ids = rows.map((row) => row.abnetConnectionId)
  if (rows.length === 0) {
    return { count: 0, ids, statusLabel: null, gratisLabel: null }
  }
  const statuses = [...new Set(rows.map((row) => row.connectionStatus))]
  const gratis = [...new Set(rows.map((row) => row.gratis))]
  const statusLabel =
    rows.length > 1 && statuses.length > 1
      ? `${rows.length} conexiones`
      : rows.length > 1
        ? `${rows.length} conexiones · ${abnetConnectionStatusLabel(statuses[0])}`
        : abnetConnectionStatusLabel(statuses[0])
  const gratisLabel =
    gratis.length === 1
      ? abnetGratisLabel(gratis[0])
      : "Gratuidad distinta entre conexiones"
  return { count: rows.length, ids, statusLabel, gratisLabel }
}

function displayName(rows: readonly Clients360DirectoryConnection[], fallback: string): string {
  const named = rows.find((row) => row.customerName.trim())
  return named?.customerName.trim() || fallback
}

export function commercialPlanName(input: {
  planName: string
  serviceType: string
  bespokePackFutbol?: boolean
  bespokeTvFull?: boolean
}): string {
  const catalogCode = catalogCodeForAbnetTvRepresentation(input.serviceType, input.planName)
  const internet = catalogCode ? INTERNET_PLAN_LABEL[catalogCode] : null
  const tv = resolveTvPackage({
    bespokePackFutbol: input.bespokePackFutbol === true,
    bespokeFull: input.bespokeTvFull === true,
    importedPlan: input.planName,
  })
  const tvText = tv === "desconocido" ? null : tvPackageLabel(tv)
  if (internet && tvText) return `${internet} + ${tvText}`
  const raw = input.planName.trim()
  return raw || CLIENTS360_UNKNOWN_PLAN_LABEL
}

export function presentCommercialPlans(input: {
  connections: readonly Pick<
    Clients360DirectoryConnection,
    "planName" | "serviceType" | "gratis"
  >[]
  bespokePackFutbol?: boolean
  bespokeTvFull?: boolean
}): string {
  if (input.connections.length === 0) return CLIENTS360_PADRON_ABSENCE_NOTE
  const names = input.connections.map((row) =>
    commercialPlanName({
      planName: row.planName,
      serviceType: row.serviceType,
      bespokePackFutbol: input.bespokePackFutbol,
      bespokeTvFull: input.bespokeTvFull,
    })
  )
  const distinct = [...new Set(names)]
  if (distinct.length > 1) return CLIENTS360_SEVERAL_PLANS_LABEL
  const gratis = new Set(input.connections.map((row) => row.gratis))
  let label = distinct[0] ?? CLIENTS360_UNKNOWN_PLAN_LABEL
  if (input.connections.length > 1) {
    label = `${label} · ${input.connections.length} conexiones`
  }
  if (gratis.size === 1 && [...gratis][0] === "si") label = `${label} · Gratuita`
  return label
}

function withConnectionReview(note: string, count: number): string {
  if (count < 2) return note
  return `${note} ${CLIENTS360_MULTIPLE_CONNECTION_IDS_NOTE}`
}

function entryFromCustomer(
  customer: Clients360DirectoryCustomer,
  rows: readonly Clients360DirectoryConnection[],
  shared: boolean
): Clients360DirectoryEntry {
  const summary = connectionSummary(rows)
  const classified = classifyAbnetRegistryLink({
    externalCode: customer.externalCode,
    sharedNumber: shared,
    connectionCount: summary.count,
  })
  return {
    id: customer.id,
    origin: "bespoke",
    link: classified.link,
    name: customer.name,
    externalCode: customer.externalCode,
    customerId: customer.id,
    locality: customer.locality,
    status: customer.status,
    listStatus: null,
    serviceCount: 0,
    technicalConnectionCount: 0,
    registryConnectionCount: summary.count,
    registryConnectionIds: summary.ids,
    registryStatusLabel: summary.statusLabel,
    registryGratisLabel: summary.gratisLabel,
    commercialPlanLabel:
      classified.link === "sin_numero"
        ? classified.note
        : presentCommercialPlans({
            connections: rows,
            bespokePackFutbol: customer.bespokePackFutbol,
            bespokeTvFull: customer.bespokeTvFull,
          }),
    note: withConnectionReview(classified.note, summary.count),
    dni: customer.dni ?? null,
    phone: customer.phone ?? null,
    email: customer.email ?? null,
    address: customer.address?.trim() || null,
    bespokeCustomerNumber: customer.customerNumber?.trim() || null,
  }
}

export function clients360EntryForCustomer(
  customer: Clients360DirectoryCustomer
): Clients360DirectoryEntry {
  return entryFromCustomer(customer, [], false)
}

function entryFromPadron(
  number: string,
  rows: readonly Clients360DirectoryConnection[],
  link: "importado" | "revision"
): Clients360DirectoryEntry {
  const summary = connectionSummary(rows)
  const note =
    link === "revision"
      ? "El número ABNet está en más de una ficha. Requiere revisión manual."
      : "Registro importado de ABNet. Sin ficha Bespoke vinculada. No es un servicio técnico."
  return {
    id: clients360PadronRowId(number),
    origin: "padron",
    link,
    name: displayName(rows, `Abonado ${number}`),
    externalCode: number,
    customerId: null,
    locality: null,
    status: "",
    listStatus: null,
    serviceCount: 0,
    technicalConnectionCount: 0,
    registryConnectionCount: summary.count,
    registryConnectionIds: summary.ids,
    registryStatusLabel: summary.statusLabel,
    registryGratisLabel: summary.gratisLabel,
    commercialPlanLabel: presentCommercialPlans({ connections: rows }),
    note: withConnectionReview(note, summary.count),
    dni: null,
    phone: null,
    email: null,
    address: null,
    bespokeCustomerNumber: null,
  }
}

export function applyAbnetPersonalDirectory(
  entries: readonly Clients360DirectoryEntry[],
  records: readonly AbnetCustomerRecord[]
): Clients360DirectoryEntry[] {
  if (records.length === 0) return [...entries]
  const byNumber = new Map(records.map((record) => [record.customerNumber, record]))
  return entries.map((entry) => {
    const number = abnetNumberFromExternalCode(entry.externalCode)
    const record = number ? byNumber.get(number) ?? null : null
    const completed = completeAbnetPersonalProfile(entry, record)
    return { ...entry, ...completed }
  })
}

export function buildClients360Directory(input: {
  universeCustomers: readonly Clients360DirectoryCustomer[]
  liveCustomers: readonly Clients360DirectoryCustomer[]
  records: readonly Clients360DirectoryConnection[]
}): Clients360DirectoryEntry[] {
  const byNumber = new Map<string, Clients360DirectoryConnection[]>()
  for (const record of input.records) {
    const number = abnetNumberFromExternalCode(record.abnetCustomerNumber)
    if (!number) continue
    const group = byNumber.get(number) ?? []
    group.push(record)
    byNumber.set(number, group)
  }

  const liveByNumber = new Map<string, Clients360DirectoryCustomer[]>()
  for (const customer of input.liveCustomers) {
    const number = usableNumber(customer.externalCode)
    if (!number) continue
    const group = liveByNumber.get(number) ?? []
    group.push(customer)
    liveByNumber.set(number, group)
  }

  const entries: Clients360DirectoryEntry[] = []
  const shownCustomerIds = new Set<string>()

  for (const customer of input.universeCustomers) {
    const number = usableNumber(customer.externalCode)
    const matches = number ? liveByNumber.get(number) ?? [] : []
    const shared = matches.length > 1
    const rows = number && !shared ? byNumber.get(number) ?? [] : number && shared ? byNumber.get(number) ?? [] : []
    entries.push(entryFromCustomer(customer, rows, shared))
    shownCustomerIds.add(customer.id)
  }

  const numbers = [...byNumber.keys()].sort((left, right) =>
    left.localeCompare(right, "es", { numeric: true })
  )
  for (const number of numbers) {
    const matches = liveByNumber.get(number) ?? []
    const rows = byNumber.get(number) ?? []
    if (matches.length === 1) {
      if (shownCustomerIds.has(matches[0].id)) continue
      entries.push(entryFromCustomer(matches[0], rows, false))
      shownCustomerIds.add(matches[0].id)
      continue
    }
    if (matches.length > 1) {
      if (matches.some((customer) => shownCustomerIds.has(customer.id))) continue
      entries.push(entryFromPadron(number, rows, "revision"))
      continue
    }
    entries.push(entryFromPadron(number, rows, "importado"))
  }

  entries.sort((left, right) => left.name.localeCompare(right.name, "es") || left.id.localeCompare(right.id))
  return entries
}

export function applyClients360DirectoryRemovals(
  entries: readonly Clients360DirectoryEntry[],
  removedCustomerIds: ReadonlySet<string>,
  removedAbnetNumbers: ReadonlySet<string>
): Clients360DirectoryEntry[] {
  const visible = entries.filter(
    (entry) => !entry.customerId || !removedCustomerIds.has(entry.customerId)
  )
  return visible.filter((entry) => {
    if (entry.origin !== "padron") return true
    const number = abnetNumberFromExternalCode(entry.externalCode)
    if (!number || !removedAbnetNumbers.has(number)) return true
    return visible.some(
      (item) =>
        item.origin === "bespoke" &&
        abnetNumberFromExternalCode(item.externalCode) === number
    )
  })
}

function fold(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
}

export function filterClients360Directory(
  entries: readonly Clients360DirectoryEntry[],
  input: {
    search?: string
    locality?: string
    status?: string
    minServices?: number
    minConnections?: number
  }
): Clients360DirectoryEntry[] {
  const search = fold(input.search?.trim() ?? "")
  const locality = input.locality?.trim().toLowerCase() ?? ""
  const status = input.status?.trim().toLowerCase() ?? "all"
  const minServices = input.minServices ?? 0
  const minConnections = input.minConnections ?? 0

  return entries.filter((entry) => {
    if (locality && locality !== "all" && (entry.locality ?? "").trim().toLowerCase() !== locality) {
      return false
    }
    if (search) {
      const haystack = fold(
        [
          entry.name,
          entry.externalCode ?? "",
          entry.dni ?? "",
          entry.phone ?? "",
          entry.email ?? "",
          entry.id,
          entry.bespokeCustomerNumber ?? "",
          ...entry.registryConnectionIds,
        ].join(" ")
      )
      if (!haystack.includes(search)) return false
    }
    if (status && status !== "all" && entry.listStatus !== status) return false
    if (entry.serviceCount < minServices) return false
    if (entry.technicalConnectionCount < minConnections) return false
    return true
  })
}

export function paginateClients360Directory(
  entries: readonly Clients360DirectoryEntry[],
  page: number,
  pageSize: number
): { entries: Clients360DirectoryEntry[]; page: number; pageSize: number; total: number } {
  const total = entries.length
  const size = Math.max(1, pageSize)
  const pageCount = Math.max(1, Math.ceil(total / size))
  const current = Math.min(Math.max(1, page), pageCount)
  const from = (current - 1) * size
  return {
    entries: entries.slice(from, from + size),
    page: current,
    pageSize: size,
    total,
  }
}

export function padronExportTables(input: {
  records: readonly Clients360DirectoryConnection[]
  liveCustomers?: readonly Clients360DirectoryCustomer[]
}): {
  subscribers: {
    number: string
    name: string
    origin: string
    link: string
    connections: number
    status: string
    gratis: string
    plan: string
    note: string
  }[]
  connections: {
    id: string
    number: string
    name: string
    status: string
    gratis: string
    plan: string
    node: string
  }[]
} {
  const entries = buildClients360Directory({
    universeCustomers: [],
    liveCustomers: input.liveCustomers ?? [],
    records: input.records,
  })
  return {
    subscribers: entries.map((entry) => ({
      number: entry.externalCode ?? "",
      name: entry.name,
      origin: entry.origin === "bespoke" ? "Ficha Bespoke" : "Padrón ABNet",
      link: entry.link,
      connections: entry.registryConnectionCount,
      status: entry.registryStatusLabel ?? "",
      gratis: entry.registryGratisLabel ?? "",
      plan: entry.commercialPlanLabel,
      note: entry.note,
    })),
    connections: input.records.map((row) => ({
      id: row.abnetConnectionId,
      number: row.abnetCustomerNumber,
      name: row.customerName,
      status: abnetConnectionStatusLabel(row.connectionStatus),
      gratis: abnetGratisLabel(row.gratis),
      plan: row.planName,
      node: row.nodeName,
    })),
  }
}

export function summarizeClients360Directory(entries: readonly Clients360DirectoryEntry[]): {
  subscribers: number
  bespokeSubscribers: number
  padronSubscribers: number
  connections: number
} {
  const connectionIds = new Set<string>()
  let bespokeSubscribers = 0
  let padronSubscribers = 0
  for (const entry of entries) {
    if (entry.origin === "bespoke") bespokeSubscribers += 1
    else padronSubscribers += 1
    for (const id of entry.registryConnectionIds) connectionIds.add(id)
  }
  return {
    subscribers: entries.length,
    bespokeSubscribers,
    padronSubscribers,
    connections: connectionIds.size,
  }
}

export type Clients360RegistryConnectionView = {
  id: string
  planName: string
  nodeName: string
  statusLabel: string
  gratisLabel: string
}

export type Clients360RegistrySubscriberView = {
  origin: Clients360PersonOrigin
  link: Clients360PersonLink
  note: string
  linkedCustomerId: string | null
  commercialPlanLabel: string
  connections: Clients360RegistryConnectionView[]
}

export function registrySubscriberView(input: {
  records: readonly Clients360DirectoryConnection[]
  externalCode?: string | null
  customerNumber?: string | null
  liveCustomerIds?: readonly string[]
  bespokePackFutbol?: boolean
  bespokeTvFull?: boolean
}): Clients360RegistrySubscriberView | null {
  const number = abnetNumberFromExternalCode(input.customerNumber ?? input.externalCode)
  if (!number) return null
  const rows = input.records.filter(
    (row) => abnetNumberFromExternalCode(row.abnetCustomerNumber) === number
  )
  if (rows.length === 0 && !input.externalCode) return null
  const liveIds = input.liveCustomerIds ?? []
  const shared = liveIds.length > 1
  const link: Clients360PersonLink =
    liveIds.length > 1
      ? "revision"
      : liveIds.length === 1
        ? "vinculado"
        : rows.length > 0
          ? "importado"
          : "ausente"
  const classified =
    link === "importado"
      ? {
          note: "Registro importado de ABNet. Sin ficha Bespoke vinculada. No es un servicio técnico.",
        }
      : classifyAbnetRegistryLink({
          externalCode: input.externalCode ?? number,
          sharedNumber: shared,
          connectionCount: rows.length,
        })
  return {
    origin: liveIds.length === 1 ? "bespoke" : "padron",
    link,
    note: classified.note,
    linkedCustomerId: liveIds.length === 1 ? liveIds[0] : null,
    commercialPlanLabel: presentCommercialPlans({
      connections: rows,
      bespokePackFutbol: input.bespokePackFutbol,
      bespokeTvFull: input.bespokeTvFull,
    }),
    connections: rows.map((row) => ({
      id: row.abnetConnectionId,
      planName: commercialPlanName({
        planName: row.planName,
        serviceType: row.serviceType,
        bespokePackFutbol: input.bespokePackFutbol,
        bespokeTvFull: input.bespokeTvFull,
      }),
      nodeName: row.nodeName,
      statusLabel: abnetConnectionStatusLabel(row.connectionStatus),
      gratisLabel: abnetGratisLabel(row.gratis),
    })),
  }
}

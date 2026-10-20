import type { SupabaseClient } from "@supabase/supabase-js"

import { escapeCustomerSearchPattern } from "@/lib/customers/customer-list"
import { isPendingActivationListCustomer } from "@/lib/customers/customer-operational"
import {
  CUSTOMER_STATUS_PENDING_ACTIVATION,
  isCustomerStatusActive,
} from "@/lib/customers/format"
import { resolveIspCustomerListPageSize } from "@/lib/isp/customer-list-load"
import {
  getClients360CommercialUniverse,
  isCustomerInClients360Universe,
} from "@/lib/isp/clients-360-universe"
import { excludeRemovedSubscriberIds } from "@/lib/isp/subscriber-removal"
import { listRemovedIspSubscriberCustomerIds } from "@/lib/isp/subscriber-removal-queries"
import { BESPOKE_PRODUCTION_COMPANY_ID } from "@/lib/supabase/company.constants"
import {
  abnetRegistryNoteForExternal,
  loadAbnetRegistryNoteContext,
  loadLiveAbnetCustomers,
} from "@/lib/isp/abnet-connection-registry-read"
import type {
  AbnetConnectionStatus,
  AbnetTristate,
} from "@/lib/isp/abnet-connection-registry"
import { abnetNumberFromExternalCode } from "@/lib/isp/abnet-master-universe"
import { completeAbnetPersonalProfile } from "@/lib/isp/abnet-customer-registry"
import { loadAbnetCustomerRegistry } from "@/lib/isp/abnet-customer-registry-read"
import {
  appendReleasedActivationCustomers,
  filterPendingActivationCustomers,
  pageClients360Rows,
  presentPendingActivationListItem,
  releasedInstallationCustomerIds,
  withoutPendingActivationEntries,
} from "@/lib/isp/clients-360-activation"
import {
  applyAbnetPersonalDirectory,
  applyClients360DirectoryRemovals,
  buildClients360Directory,
  clients360PadronNumberFromId,
  filterClients360Directory,
  paginateClients360Directory,
  registrySubscriberView,
  summarizeClients360Directory,
  type Clients360DirectoryEntry,
} from "@/lib/isp/clients-360-directory"
import {
  findCatalogItemForWorkOrder,
  isIspCatalogCategory,
} from "@/lib/isp/catalog-integrity"
import { getIspCatalogItem, listIspCatalogForOt } from "@/lib/isp/catalog-queries"
import {
  ISP_BILLING_PLACEHOLDER,
  NEW_INSTALLATION_SERVICE_TYPE,
} from "@/lib/isp/constants"
import {
  deriveCustomerServiceOverview,
  deriveIspSubscriberListStatus,
} from "@/lib/isp/integrity"
import { isWorkOrderEligibleForIspOnboarding } from "@/lib/isp/migration/cutoff"
import { getIspOnboardingCutoff } from "@/lib/isp/migration/queries"
import { mapIspConnectionRow, mapIspServiceRow } from "@/lib/isp/mapper"
import { sortSubscriberServices } from "@/lib/isp/subscriber-service-integrity"
import { buildIspPrefillFromWorkOrder } from "@/lib/isp/ot-prefill"
import { ISP_CONNECTION_TYPE_LABELS } from "@/lib/isp/labels"
import type {
  IspActivityEvent,
  IspAtencionSummary,
  IspConnectionDetail,
  IspConnectionListItem,
  IspCustomerDetail,
  IspCustomerHeader,
  IspCustomerListItem,
  IspExistingCustomerMatch,
  IspOnboardingPayload,
  IspOnboardingResult,
  IspOtPrefill,
  IspService,
  IspServiceWithConnection,
  IspWorkOrderSummary,
} from "@/lib/isp/types"
import { getCustomerById } from "@/lib/supabase/customers.queries"
import type { Database } from "@/lib/supabase/database.types"
import {
  fetchTaskById,
  fetchWorkOrdersByCustomerId,
} from "@/lib/supabase/tasks.queries"
import { TASK_STATUS_LABELS } from "@/lib/tasks/constants"
import { getTaskTechnologyLabel } from "@/lib/tasks/commercial-plan"
import {
  resolveWorkOrderTechnologyFromTask,
  WORK_ORDER_SERVICE_TYPE_OPTIONS,
} from "@/lib/tasks/work-order"
import type { Customer } from "@/lib/types/customers"
import type { Task } from "@/lib/types/tasks"

export type IspQueriesClient = SupabaseClient<Database>

function mapCustomerHeader(
  customer: Customer,
  abnetRegistryNote: string | null = null
): IspCustomerHeader {
  return {
    id: customer.id,
    name: customer.name,
    dni: customer.dni ?? null,
    phone: customer.phone ?? null,
    whatsapp: customer.whatsapp ?? null,
    email: customer.email ?? null,
    address: customer.address ?? null,
    locality: customer.locality ?? null,
    status: customer.status,
    createdAt: customer.createdAt,
    updatedAt: customer.updatedAt,
    externalCustomerCode: customer.externalCustomerCode ?? null,
    technology: customer.technology ?? null,
    abnetRegistryNote,
  }
}

async function withAbnetPersonalFields(
  client: IspQueriesClient,
  companyId: string,
  customer: IspCustomerHeader
): Promise<IspCustomerHeader> {
  const personal = await loadAbnetCustomerRegistry(client, companyId)
  if (personal.error && !personal.missing) throw new Error(personal.error.message)
  const number = abnetNumberFromExternalCode(customer.externalCustomerCode)
  const record =
    number && !personal.missing
      ? personal.records.find((row) => row.customerNumber === number) ?? null
      : null
  const completed = completeAbnetPersonalProfile(
    {
      name: customer.name,
      externalCode: customer.externalCustomerCode ?? null,
      dni: customer.dni,
      phone: customer.phone,
      email: customer.email,
      address: customer.address,
      locality: customer.locality,
      note: customer.abnetRegistryNote ?? "",
    },
    record
  )
  return {
    ...customer,
    name: completed.name,
    dni: completed.dni,
    phone: completed.phone,
    email: completed.email,
    address: completed.address,
    locality: completed.locality,
    abnetRegistryNote: completed.note || null,
  }
}

function workOrderTypeLabel(serviceType: string | null | undefined): string | null {
  if (!serviceType) return null
  return (
    WORK_ORDER_SERVICE_TYPE_OPTIONS.find((option) => option.value === serviceType)
      ?.label ?? serviceType
  )
}

async function fetchServicesForCustomers(
  client: IspQueriesClient,
  companyId: string,
  customerIds: string[]
): Promise<IspService[]> {
  if (customerIds.length === 0) return []
  const { data, error } = await client
    .from("isp_services")
    .select("*")
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .in("customer_id", customerIds)

  if (error) throw new Error(error.message)
  return (data ?? []).map(mapIspServiceRow)
}

async function fetchConnectionsForServices(
  client: IspQueriesClient,
  companyId: string,
  services: IspService[]
) {
  if (services.length === 0) return []
  const { data, error } = await client
    .from("isp_connections")
    .select("*")
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .in(
      "service_id",
      services.map((service) => service.id)
    )

  if (error) throw new Error(error.message)
  const customerByService = new Map(
    services.map((service) => [service.id, service.customerId])
  )
  return (data ?? []).map((row) =>
    mapIspConnectionRow(row, customerByService.get(row.service_id) ?? "")
  )
}

const ISP_CUSTOMER_ID_CHUNK = 80
const ISP_CUSTOMER_LIST_SELECT =
  "id, name, dni, phone, whatsapp, email, address, locality, status, created_at, updated_at, external_customer_code, customer_number"

function chunkIds(ids: string[], size = ISP_CUSTOMER_ID_CHUNK): string[][] {
  const chunks: string[][] = []
  for (let index = 0; index < ids.length; index += size) {
    chunks.push(ids.slice(index, index + size))
  }
  return chunks
}

async function listActiveSubscriberCustomerIds(
  client: IspQueriesClient,
  companyId: string
): Promise<string[]> {
  const ids: string[] = []
  const pageSize = 1000

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await client
      .from("isp_subscribers")
      .select("customer_id")
      .eq("company_id", companyId)
      .is("deleted_at", null)
      .order("customer_id", { ascending: true })
      .range(from, from + pageSize - 1)

    if (error) throw new Error(error.message)

    const rows = data ?? []
    for (const row of rows) {
      if (row.customer_id) ids.push(row.customer_id)
    }
    if (rows.length < pageSize) break
  }

  return [...new Set(ids)]
}

type IspCustomerListRow = {
  id: string
  name: string
  dni: string | null
  phone: string | null
  whatsapp: string | null
  email: string | null
  address: string | null
  locality: string | null
  status: string
  created_at: string
  updated_at: string
  external_customer_code: string | null
  customer_number: string | null
}

type ServiceListSnap = {
  id: string
  customerId: string
  commercialStatus: string
  updatedAt: string
}

type ConnectionListSnap = {
  serviceId: string
  technicalStatus: string
  updatedAt: string
}

type PendingActivationRow = IspCustomerListRow & {
  contracted_plan: string | null
}

const PENDING_ACTIVATION_SELECT = `${ISP_CUSTOMER_LIST_SELECT}, contracted_plan`

function compareIspCustomerListRows(
  left: Pick<IspCustomerListRow, "name" | "id">,
  right: Pick<IspCustomerListRow, "name" | "id">
) {
  const byName = left.name.localeCompare(right.name, "es")
  if (byName !== 0) return byName
  return left.id.localeCompare(right.id)
}

async function loadPendingActivationCustomerRows(
  client: IspQueriesClient,
  companyId: string
): Promise<PendingActivationRow[]> {
  const rows: PendingActivationRow[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await client
      .from("customers")
      .select(PENDING_ACTIVATION_SELECT)
      .eq("company_id", companyId)
      .eq("status", CUSTOMER_STATUS_PENDING_ACTIVATION)
      .or("external_customer_code.is.null,external_customer_code.eq.")
      .is("deleted_at", null)
      .order("name", { ascending: true })
      .range(from, from + 999)
    if (error) throw new Error(error.message)
    const batch = (data ?? []) as PendingActivationRow[]
    for (const row of batch) {
      if (
        isPendingActivationListCustomer({
          status: row.status,
          externalCustomerCode: row.external_customer_code ?? undefined,
        })
      ) {
        rows.push(row)
      }
    }
    if (batch.length < 1000) break
  }
  return rows
}

async function loadReleasedInstallationCustomerIds(
  client: IspQueriesClient,
  companyId: string
): Promise<Set<string>> {
  const tasks: { customerId: string; metadata: unknown }[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await client
      .from("tasks")
      .select("customer_id, task_metadata")
      .eq("company_id", companyId)
      .eq("service_type", NEW_INSTALLATION_SERVICE_TYPE)
      .eq("status", "finalizada")
      .is("deleted_at", null)
      .order("id", { ascending: true })
      .range(from, from + 999)
    if (error) throw new Error(error.message)
    const batch = data ?? []
    for (const row of batch) {
      tasks.push({ customerId: row.customer_id ?? "", metadata: row.task_metadata })
    }
    if (batch.length < 1000) break
  }
  return releasedInstallationCustomerIds(tasks)
}

async function loadCustomerRowsByIds(
  client: IspQueriesClient,
  companyId: string,
  ids: readonly string[]
): Promise<IspCustomerListRow[]> {
  const rows: IspCustomerListRow[] = []
  for (const part of chunkIds([...ids])) {
    const { data, error } = await client
      .from("customers")
      .select(ISP_CUSTOMER_LIST_SELECT)
      .eq("company_id", companyId)
      .in("id", part)
      .is("deleted_at", null)
    if (error) throw new Error(error.message)
    rows.push(...(data ?? []))
  }
  return rows
}

function pendingActivationListItem(row: PendingActivationRow): IspCustomerListItem {
  return presentPendingActivationListItem({
    id: row.id,
    name: row.name,
    dni: row.dni,
    phone: row.phone,
    whatsapp: row.whatsapp,
    email: row.email,
    address: row.address,
    locality: row.locality,
    status: row.status,
    createdAt: row.created_at,
    externalCustomerCode: row.external_customer_code,
    bespokeCustomerNumber: row.customer_number,
    contractedPlan: row.contracted_plan,
  })
}

function pagePendingActivationCustomers(
  rows: PendingActivationRow[],
  input: { search?: string; locality?: string; page?: number; pageSize?: number },
  pendingActivation: number
) {
  const filtered = filterPendingActivationCustomers(
    rows.map((row) => ({
      row,
      name: row.name,
      dni: row.dni,
      phone: row.phone,
      email: row.email,
      address: row.address,
      locality: row.locality,
      externalCustomerCode: row.external_customer_code,
      bespokeCustomerNumber: row.customer_number,
    })),
    input
  ).map((item) => item.row)
  const pageSize = resolveIspCustomerListPageSize(input.pageSize)
  const page = pageClients360Rows(filtered, input.page ?? 1, pageSize)
  const localities = [
    ...new Set(
      rows
        .map((row) => row.locality?.trim())
        .filter((value): value is string => Boolean(value))
    ),
  ].sort((left, right) => left.localeCompare(right, "es"))
  return {
    customers: page.rows.map(pendingActivationListItem),
    localities,
    total: page.total,
    page: page.page,
    pageSize: page.pageSize,
    pendingActivation,
  }
}

async function loadServiceSnaps(
  client: IspQueriesClient,
  companyId: string,
  customerIds: ReadonlySet<string>
) {
  const snaps: ServiceListSnap[] = []
  if (customerIds.size === 0) return snaps
  if (customerIds.size <= 200) {
    for (const part of chunkIds([...customerIds])) {
      const { data, error } = await client
        .from("isp_services")
        .select("id, customer_id, commercial_status, updated_at")
        .eq("company_id", companyId)
        .is("deleted_at", null)
        .in("customer_id", part)
      if (error) throw new Error(error.message)
      for (const row of data ?? []) {
        snaps.push({
          id: row.id,
          customerId: row.customer_id,
          commercialStatus: row.commercial_status,
          updatedAt: row.updated_at,
        })
      }
    }
    return snaps
  }

  for (let from = 0; ; from += 1000) {
    const { data, error } = await client
      .from("isp_services")
      .select("id, customer_id, commercial_status, updated_at")
      .eq("company_id", companyId)
      .is("deleted_at", null)
      .order("id", { ascending: true })
      .range(from, from + 999)
    if (error) throw new Error(error.message)
    const batch = data ?? []
    for (const row of batch) {
      if (!customerIds.has(row.customer_id)) continue
      snaps.push({
        id: row.id,
        customerId: row.customer_id,
        commercialStatus: row.commercial_status,
        updatedAt: row.updated_at,
      })
    }
    if (batch.length < 1000) break
  }
  return snaps
}

async function loadConnectionSnaps(
  client: IspQueriesClient,
  companyId: string,
  serviceIds: ReadonlySet<string>
) {
  const snaps: ConnectionListSnap[] = []
  if (serviceIds.size === 0) return snaps
  if (serviceIds.size <= 200) {
    for (const part of chunkIds([...serviceIds])) {
      const { data, error } = await client
        .from("isp_connections")
        .select("service_id, technical_status, updated_at")
        .eq("company_id", companyId)
        .is("deleted_at", null)
        .in("service_id", part)
      if (error) throw new Error(error.message)
      for (const row of data ?? []) {
        snaps.push({
          serviceId: row.service_id,
          technicalStatus: row.technical_status,
          updatedAt: row.updated_at,
        })
      }
    }
    return snaps
  }

  for (let from = 0; ; from += 1000) {
    const { data, error } = await client
      .from("isp_connections")
      .select("service_id, technical_status, updated_at")
      .eq("company_id", companyId)
      .is("deleted_at", null)
      .order("id", { ascending: true })
      .range(from, from + 999)
    if (error) throw new Error(error.message)
    const batch = data ?? []
    for (const row of batch) {
      if (!serviceIds.has(row.service_id)) continue
      snaps.push({
        serviceId: row.service_id,
        technicalStatus: row.technical_status,
        updatedAt: row.updated_at,
      })
    }
    if (batch.length < 1000) break
  }
  return snaps
}

function mapIspCustomerListRow(
  row: IspCustomerListRow,
  services: readonly ServiceListSnap[],
  connections: readonly ConnectionListSnap[],
  abnetRegistryNote: string | null = null
): IspCustomerListItem {
  const customerServices = services.filter((service) => service.customerId === row.id)
  const serviceIds = new Set(customerServices.map((service) => service.id))
  const customerConnections = connections.filter((connection) =>
    serviceIds.has(connection.serviceId)
  )
  const lastActivityAt =
    [
      row.updated_at,
      ...customerServices.map((service) => service.updatedAt),
      ...customerConnections.map((connection) => connection.updatedAt),
    ]
      .filter(Boolean)
      .sort()
      .at(-1) ?? null

  return {
    id: row.id,
    name: row.name,
    dni: row.dni,
    phone: row.phone,
    whatsapp: row.whatsapp,
    email: row.email,
    address: row.address,
    locality: row.locality,
    status: row.status,
    createdAt: row.created_at,
    externalCustomerCode: row.external_customer_code,
    bespokeCustomerNumber: row.customer_number,
    serviceCount: customerServices.length,
    connectionCount: customerConnections.length,
    listStatus: deriveIspSubscriberListStatus({
      customerStatus: row.status,
      commercialStatuses: customerServices.map((service) => service.commercialStatus),
    }),
    serviceOverview: deriveCustomerServiceOverview({
      serviceCount: customerServices.length,
      connectionCount: customerConnections.length,
      hasPendingProvision: customerConnections.some(
        (connection) => connection.technicalStatus === "pending_provision"
      ),
      hasActiveCommercial: customerServices.some(
        (service) => service.commercialStatus === "active"
      ),
    }),
    accountSituation: null,
    lastActivityAt,
    abnetRegistryNote,
  }
}

async function loadRemovedAbnetNumbers(
  client: IspQueriesClient,
  companyId: string,
  removedIds: ReadonlySet<string>
) {
  const numbers = new Set<string>()
  const ids = [...removedIds]
  for (let index = 0; index < ids.length; index += 200) {
    const part = ids.slice(index, index + 200)
    const { data, error } = await client
      .from("customers")
      .select("external_customer_code")
      .eq("company_id", companyId)
      .in("id", part)
    if (error) throw new Error(error.message)
    for (const row of data ?? []) {
      const number = abnetNumberFromExternalCode(row.external_customer_code)
      if (number && number !== "99999999") numbers.add(number)
    }
  }
  return numbers
}

async function loadUniverseCustomerRows(
  client: IspQueriesClient,
  companyId: string,
  memberIds: ReadonlySet<string>
) {
  const customerRows: IspCustomerListRow[] = []
  if (memberIds.size === 0) return customerRows
  for (let from = 0; ; from += 1000) {
    const { data, error } = await client
      .from("customers")
      .select(ISP_CUSTOMER_LIST_SELECT)
      .eq("company_id", companyId)
      .is("deleted_at", null)
      .order("id", { ascending: true })
      .range(from, from + 999)
    if (error) throw new Error(error.message)
    const batch = data ?? []
    for (const row of batch) {
      if (memberIds.has(row.id)) customerRows.push(row)
    }
    if (batch.length < 1000) break
  }
  return customerRows
}

function applyTechnicalCounts(
  entries: readonly Clients360DirectoryEntry[],
  services: readonly ServiceListSnap[],
  connections: readonly ConnectionListSnap[]
): Clients360DirectoryEntry[] {
  return entries.map((entry) => {
    if (!entry.customerId) return entry
    const customerServices = services.filter((service) => service.customerId === entry.customerId)
    const serviceIds = new Set(customerServices.map((service) => service.id))
    const customerConnections = connections.filter((connection) =>
      serviceIds.has(connection.serviceId)
    )
    return {
      ...entry,
      serviceCount: customerServices.length,
      technicalConnectionCount: customerConnections.length,
      listStatus: deriveIspSubscriberListStatus({
        customerStatus: entry.status,
        commercialStatuses: customerServices.map((service) => service.commercialStatus),
      }),
    }
  })
}

type LooseRows = {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (column: string, value: string) => LooseFilter
      in: (column: string, values: string[]) => LooseFilter
    }
  }
}

type LooseFilter = {
  eq: (column: string, value: string) => LooseFilter
  in: (column: string, values: string[]) => LooseFilter
  is: (column: string, value: null) => LooseFilter
  order: (column: string, options: { ascending: boolean }) => LooseFilter
  range: (
    from: number,
    to: number
  ) => PromiseLike<{
    data: Record<string, string | null>[] | null
    error: { message: string } | null
  }>
  then: PromiseLike<{
    data: Record<string, string | null>[] | null
    error: { message: string } | null
  }>["then"]
}

function looseRows(client: IspQueriesClient): LooseRows {
  return client as unknown as LooseRows
}

async function loadBespokeTvFlags(
  client: IspQueriesClient,
  companyId: string,
  customerId?: string
): Promise<Map<string, { packFutbol: boolean; tvFull: boolean }>> {
  const flags = new Map<string, { packFutbol: boolean; tvFull: boolean }>()
  const services: { id: string; customerId: string; status: string }[] = []
  for (let from = 0; ; from += 1000) {
    let query = client
      .from("isp_services")
      .select("id, customer_id, commercial_status")
      .eq("company_id", companyId)
      .is("deleted_at", null)
      .order("id", { ascending: true })
    if (customerId) query = query.eq("customer_id", customerId)
    const { data, error } = await query.range(from, from + 999)
    if (error) return flags
    const batch = data ?? []
    for (const row of batch) {
      services.push({
        id: row.id,
        customerId: row.customer_id,
        status: row.commercial_status,
      })
    }
    if (batch.length < 1000) break
  }
  const activeServices = services.filter((row) => row.status === "active")
  if (activeServices.length === 0) return flags
  const customerByService = new Map(activeServices.map((row) => [row.id, row.customerId]))
  const assignments: { serviceId: string; componentId: string; status: string }[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await looseRows(client)
      .from("isp_service_components")
      .select("service_id, component_id, status")
      .eq("company_id", companyId)
      .eq("status", "active")
      .is("deleted_at", null)
      .order("id", { ascending: true })
      .range(from, from + 999)
    if (error) return flags
    const batch = data ?? []
    for (const row of batch) {
      if (!row.service_id || !row.component_id || !customerByService.has(row.service_id)) continue
      assignments.push({
        serviceId: row.service_id,
        componentId: row.component_id,
        status: row.status ?? "",
      })
    }
    if (batch.length < 1000) break
  }
  if (assignments.length === 0) return flags
  const componentIds = [...new Set(assignments.map((row) => row.componentId))]
  const codes = new Map<string, string>()
  for (let index = 0; index < componentIds.length; index += 200) {
    const part = componentIds.slice(index, index + 200)
    const { data, error } = await looseRows(client)
      .from("isp_commercial_components")
      .select("id, code")
      .eq("company_id", companyId)
      .in("id", part)
      .is("deleted_at", null)
    if (error) return flags
    for (const row of data ?? []) {
      if (!row.id) continue
      codes.set(row.id, String(row.code ?? "").trim().toUpperCase())
    }
  }
  for (const assignment of assignments) {
    const owner = customerByService.get(assignment.serviceId)
    const code = codes.get(assignment.componentId)
    if (!owner || !code) continue
    const current = flags.get(owner) ?? { packFutbol: false, tvFull: false }
    if (code === "PACK-FUTBOL") current.packFutbol = true
    if (code === "TV-FULL-UPGRADE") current.tvFull = true
    flags.set(owner, current)
  }
  return flags
}

function directoryEntryToListItem(
  entry: Clients360DirectoryEntry,
  row: IspCustomerListRow | undefined
): IspCustomerListItem {
  const technicalConnections = entry.technicalConnectionCount
  return {
    id: entry.id,
    name: entry.name,
    dni: row?.dni ?? entry.dni,
    phone: row?.phone ?? entry.phone,
    whatsapp: row?.whatsapp ?? null,
    email: row?.email ?? entry.email,
    address: row?.address ?? entry.address,
    locality: entry.locality,
    status: row?.status ?? entry.status,
    createdAt: row?.created_at ?? "",
    externalCustomerCode: entry.externalCode,
    bespokeCustomerNumber: entry.bespokeCustomerNumber,
    serviceCount: entry.serviceCount,
    connectionCount: entry.origin === "padron" ? 0 : technicalConnections,
    listStatus: entry.listStatus ?? "pendiente",
    serviceOverview: entry.commercialPlanLabel,
    accountSituation: null,
    lastActivityAt: row?.updated_at ?? null,
    abnetRegistryNote: entry.note,
    directoryOrigin: entry.origin,
    registryLink: entry.link,
    commercialPlanLabel: entry.commercialPlanLabel,
    registryConnectionCount: entry.registryConnectionCount,
    registryStatusLabel: entry.registryStatusLabel,
    registryGratisLabel: entry.registryGratisLabel,
  }
}

async function listIspCustomersIncludingPadron(
  client: IspQueriesClient,
  companyId: string,
  input: {
    search?: string
    status?: string
    locality?: string
    minServices?: number
    minConnections?: number
    page?: number
    pageSize?: number
  },
  registryRecords: readonly {
    abnetConnectionId: string
    abnetCustomerNumber: string
    customerName: string
    connectionStatus: AbnetConnectionStatus
    gratis: AbnetTristate
    planName: string
    serviceType: string
    nodeName: string
  }[],
  activation: {
    pendingIds: ReadonlySet<string>
    releasedIds: ReadonlySet<string>
    pendingActivation: number
  }
) {
  const pageSize = resolveIspCustomerListPageSize(input.pageSize)
  const requestedPage = Math.max(1, Math.floor(input.page ?? 1))
  const removedIds = await listRemovedIspSubscriberCustomerIds(client, companyId)
  const removedAbnetNumbers = await loadRemovedAbnetNumbers(client, companyId, removedIds)
  const memberIds =
    companyId === BESPOKE_PRODUCTION_COMPANY_ID
      ? excludeRemovedSubscriberIds(getClients360CommercialUniverse(), removedIds)
      : await listActiveSubscriberCustomerIds(client, companyId)
  const memberSet = new Set(memberIds)
  const universeRows = await loadUniverseCustomerRows(client, companyId, memberSet)
  const live = await loadLiveAbnetCustomers(client, companyId)
  if (live.error) throw new Error(live.error.message)
  const rowsById = new Map(universeRows.map((row) => [row.id, row]))
  const tvFlags = await loadBespokeTvFlags(client, companyId)
  const tvFor = (customerId: string) => tvFlags.get(customerId)
  let entries = buildClients360Directory({
    universeCustomers: universeRows.map((row) => ({
      id: row.id,
      name: row.name,
      externalCode: row.external_customer_code,
      locality: row.locality,
      status: row.status,
      inUniverse: true,
      dni: row.dni,
      phone: row.phone,
      email: row.email,
      customerNumber: row.customer_number,
      bespokePackFutbol: tvFor(row.id)?.packFutbol === true,
      bespokeTvFull: tvFor(row.id)?.tvFull === true,
    })),
    liveCustomers: live.customers
      .filter((row) => !removedIds.has(row.id))
      .map((row) => ({
      ...row,
      inUniverse: memberSet.has(row.id),
      bespokePackFutbol: tvFor(row.id)?.packFutbol === true,
      bespokeTvFull: tvFor(row.id)?.tvFull === true,
    })),
    records: registryRecords,
  })
  const personal = await loadAbnetCustomerRegistry(client, companyId)
  if (personal.error && !personal.missing) throw new Error(personal.error.message)
  entries = applyAbnetPersonalDirectory(entries, personal.missing ? [] : personal.records)
  entries = applyClients360DirectoryRemovals(entries, removedIds, removedAbnetNumbers)
  entries = withoutPendingActivationEntries(entries, activation.pendingIds)
  const released = appendReleasedActivationCustomers(
    entries,
    live.customers
      .filter((row) => !removedIds.has(row.id))
      .map((row) => ({
        ...row,
        externalCode: row.externalCode,
        inUniverse: memberSet.has(row.id),
      })),
    activation.releasedIds,
    removedIds
  )
  entries = released.entries
  entries = filterClients360Directory(entries, {
    search: input.search,
    locality: input.locality,
  })
  const statusFilter = input.status?.trim().toLowerCase() ?? "all"
  const minServices = input.minServices ?? 0
  const minConnections = input.minConnections ?? 0
  const needsServiceFilter =
    (statusFilter !== "" && statusFilter !== "all") || minServices > 0 || minConnections > 0
  if (needsServiceFilter) {
    const ids = entries
      .map((entry) => entry.customerId)
      .filter((id): id is string => Boolean(id))
    const services = await loadServiceSnaps(client, companyId, new Set(ids))
    const connections = await loadConnectionSnaps(
      client,
      companyId,
      new Set(services.map((service) => service.id))
    )
    entries = filterClients360Directory(
      applyTechnicalCounts(entries, services, connections),
      { status: statusFilter, minServices, minConnections }
    )
  }
  const summary = summarizeClients360Directory(entries)
  const page = paginateClients360Directory(entries, requestedPage, pageSize)
  let pageEntries = page.entries
  if (!needsServiceFilter) {
    const ids = pageEntries
      .map((entry) => entry.customerId)
      .filter((id): id is string => Boolean(id))
    if (ids.length > 0) {
      const services = await loadServiceSnaps(client, companyId, new Set(ids))
      const connections = await loadConnectionSnaps(
        client,
        companyId,
        new Set(services.map((service) => service.id))
      )
      const counted = new Map(
        applyTechnicalCounts(pageEntries, services, connections).map((entry) => [entry.id, entry])
      )
      pageEntries = pageEntries.map((entry) => counted.get(entry.id) ?? entry)
    }
  }
  const localities = [
    ...new Set(
      entries
        .map((entry) => entry.locality?.trim())
        .filter((value): value is string => Boolean(value))
    ),
  ].sort((left, right) => left.localeCompare(right, "es"))
  return {
    customers: pageEntries.map((entry) => {
      const item = directoryEntryToListItem(
        entry,
        entry.customerId ? rowsById.get(entry.customerId) : undefined
      )
      if (!entry.customerId || !released.addedIds.has(entry.customerId)) return item
      const contracted = live.customers
        .find((customer) => customer.id === entry.customerId)
        ?.contractedPlan?.trim()
      return {
        ...item,
        activationState: "released" as const,
        commercialPlanLabel: contracted || undefined,
        serviceOverview: contracted || item.serviceOverview,
      }
    }),
    localities,
    total: summary.subscribers,
    page: page.page,
    pageSize: page.pageSize,
    bespokeSubscribers: summary.bespokeSubscribers,
    padronSubscribers: summary.padronSubscribers,
    connectionTotal: summary.connections,
    pendingActivation: activation.pendingActivation,
  }
}

export async function listIspCustomers(
  client: IspQueriesClient,
  companyId: string,
  input: {
    search?: string
    status?: string
    locality?: string
    minServices?: number
    minConnections?: number
    page?: number
    pageSize?: number
    activation?: "pending"
  }
): Promise<{
  customers: IspCustomerListItem[]
  localities: string[]
  total: number
  page: number
  pageSize: number
  bespokeSubscribers?: number
  padronSubscribers?: number
  connectionTotal?: number
  pendingActivation: number
}> {
  const pendingRows = await loadPendingActivationCustomerRows(client, companyId)
  const pendingActivation = pendingRows.length
  if (input.activation === "pending") {
    return pagePendingActivationCustomers(pendingRows, input, pendingActivation)
  }
  const releasedIds = await loadReleasedInstallationCustomerIds(client, companyId)
  const pendingIds = new Set(pendingRows.map((row) => row.id))
  const activation = { pendingIds, releasedIds, pendingActivation }
  const registryContext = await loadAbnetRegistryNoteContext(client, companyId)
  if (registryContext) {
    return listIspCustomersIncludingPadron(
      client,
      companyId,
      input,
      registryContext.records,
      activation
    )
  }
  function emptyIspCustomerList() {
    return { customers: [], localities: [] }
  }

  async function loadCustomerListRows(
    memberIds: ReadonlySet<string>,
    pattern: string
  ) {
    const customerRows: IspCustomerListRow[] = []
    for (let from = 0; ; from += 1000) {
      let query = client
        .from("customers")
        .select(ISP_CUSTOMER_LIST_SELECT)
        .eq("company_id", companyId)
        .is("deleted_at", null)
        .order("id", { ascending: true })
        .range(from, from + 999)
      if (pattern) {
        query = query.or(
          `name.ilike.${pattern},dni.ilike.${pattern},phone.ilike.${pattern},whatsapp.ilike.${pattern},email.ilike.${pattern},external_customer_code.ilike.${pattern},customer_number.ilike.${pattern}`
        )
      }
      const { data, error } = await query
      if (error) throw new Error(error.message)
      const batch = data ?? []
      for (const row of batch) {
        if (memberIds.has(row.id)) customerRows.push(row)
      }
      if (batch.length < 1000) break
    }
    customerRows.sort(compareIspCustomerListRows)
    return customerRows
  }

  const pageSize = resolveIspCustomerListPageSize(input.pageSize)
  const requestedPage = Math.max(1, Math.floor(input.page ?? 1))
  const removedIds = new Set(await listRemovedIspSubscriberCustomerIds(client, companyId))
  const memberIds =
    companyId === BESPOKE_PRODUCTION_COMPANY_ID
      ? excludeRemovedSubscriberIds(getClients360CommercialUniverse(), removedIds)
      : await listActiveSubscriberCustomerIds(client, companyId)
  const search = input.search?.trim() ?? ""
  const pattern = search ? escapeCustomerSearchPattern(search) : ""
  let customers =
    memberIds.length === 0
      ? []
      : await loadCustomerListRows(new Set(memberIds), pattern)
  customers = customers.filter((row) => !pendingIds.has(row.id))
  const beforeReleased = new Set(customers.map((row) => row.id))
  const missingReleased = [...releasedIds].filter(
    (id) => !beforeReleased.has(id) && !pendingIds.has(id) && !removedIds.has(id)
  )
  if (missingReleased.length > 0) {
    const needle = search.toLowerCase()
    const extra = await loadCustomerRowsByIds(client, companyId, missingReleased)
    for (const row of extra) {
      if (!isCustomerStatusActive(row.status) || pendingIds.has(row.id)) continue
      if (needle) {
        const haystack = [
          row.name,
          row.dni,
          row.phone,
          row.whatsapp,
          row.email,
          row.external_customer_code,
          row.customer_number,
          row.address,
          row.locality,
        ]
          .join(" ")
          .toLowerCase()
        if (!haystack.includes(needle)) continue
      }
      customers.push(row)
    }
    customers.sort(compareIspCustomerListRows)
  }
  const releasedAdditions = new Set(
    customers.map((row) => row.id).filter((id) => !beforeReleased.has(id))
  )
  if (customers.length === 0) {
    return { ...emptyIspCustomerList(), total: 0, page: 1, pageSize, pendingActivation }
  }
  const localities = [
    ...new Set(
      customers
        .map((row) => row.locality?.trim())
        .filter((value): value is string => Boolean(value))
    ),
  ].sort((left, right) => left.localeCompare(right, "es"))

  const localityFilter = input.locality?.trim().toLowerCase() ?? ""
  const located =
    localityFilter && localityFilter !== "all"
      ? customers.filter(
          (row) => (row.locality ?? "").trim().toLowerCase() === localityFilter
        )
      : customers

  const statusFilter = input.status?.trim().toLowerCase() ?? "all"
  const minServices = input.minServices ?? 0
  const minConnections = input.minConnections ?? 0
  const needsServiceFilter =
    (statusFilter !== "" && statusFilter !== "all") ||
    minServices > 0 ||
    minConnections > 0

  let matched = located
  let services: ServiceListSnap[] = []
  let connections: ConnectionListSnap[] = []
  if (needsServiceFilter) {
    services = await loadServiceSnaps(
      client,
      companyId,
      new Set(located.map((row) => row.id))
    )
    connections = await loadConnectionSnaps(
      client,
      companyId,
      new Set(services.map((service) => service.id))
    )
    matched = located.filter((row) => {
      const item = mapIspCustomerListRow(row, services, connections)
      if (statusFilter && statusFilter !== "all" && item.listStatus !== statusFilter) {
        return false
      }
      if (item.serviceCount < minServices) return false
      if (item.connectionCount < minConnections) return false
      return true
    })
  }

  const total = matched.length
  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  const page = Math.min(requestedPage, pageCount)
  const from = (page - 1) * pageSize
  const pageRows = matched.slice(from, from + pageSize)
  if (!needsServiceFilter && pageRows.length > 0) {
    services = await loadServiceSnaps(
      client,
      companyId,
      new Set(pageRows.map((row) => row.id))
    )
    connections = await loadConnectionSnaps(
      client,
      companyId,
      new Set(services.map((service) => service.id))
    )
  }

  const registryNotes = await loadAbnetRegistryNoteContext(client, companyId)

  return {
    customers: pageRows.map((row) => {
      const item = mapIspCustomerListRow(
        row,
        services,
        connections,
        abnetRegistryNoteForExternal(registryNotes, row.external_customer_code)
      )
      if (!releasedAdditions.has(row.id)) return item
      return { ...item, activationState: "released" as const, directoryOrigin: "bespoke" as const }
    }),
    localities,
    total,
    page,
    pageSize,
    pendingActivation,
  }
}

async function customerVisibleThroughActivation(
  client: IspQueriesClient,
  companyId: string,
  customerId: string
): Promise<boolean> {
  const { data, error } = await client
    .from("customers")
    .select("status, external_customer_code")
    .eq("id", customerId)
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return false
  if (
    isPendingActivationListCustomer({
      status: data.status,
      externalCustomerCode: data.external_customer_code ?? undefined,
    })
  ) {
    return true
  }
  if (!isCustomerStatusActive(data.status)) return false
  const tasks = await client
    .from("tasks")
    .select("task_metadata")
    .eq("company_id", companyId)
    .eq("customer_id", customerId)
    .eq("service_type", NEW_INSTALLATION_SERVICE_TYPE)
    .eq("status", "finalizada")
    .is("deleted_at", null)
    .limit(20)
  if (tasks.error) throw new Error(tasks.error.message)
  return releasedInstallationCustomerIds(
    (tasks.data ?? []).map((row) => ({
      customerId,
      metadata: row.task_metadata,
    }))
  ).has(customerId)
}

export async function getIspCustomerDetail(
  client: IspQueriesClient,
  companyId: string,
  customerId: string
): Promise<IspCustomerDetail | null> {
  const { data: membership, error: memberError } = await client
    .from("isp_subscribers")
    .select("deleted_at")
    .eq("company_id", companyId)
    .eq("customer_id", customerId)
    .maybeSingle()

  if (memberError) throw new Error(memberError.message)
  if (membership?.deleted_at) return null
  const member = membership != null && membership.deleted_at == null
  const inCommercialUniverse =
    companyId === BESPOKE_PRODUCTION_COMPANY_ID &&
    isCustomerInClients360Universe(customerId)
  if (!member && !inCommercialUniverse) {
    const visible = await customerVisibleThroughActivation(client, companyId, customerId)
    if (!visible) return null
  }

  const customerResult = await getCustomerById(client, customerId)
  if (customerResult.error || !customerResult.data) return null

  const services = await fetchServicesForCustomers(client, companyId, [customerId])
  const connections = await fetchConnectionsForServices(client, companyId, services)
  const catalogIds = [
    ...new Set(
      services
        .map((service) => service.catalogId)
        .filter((id): id is string => Boolean(id))
    ),
  ]
  const catalogById = new Map<string, string>()
  if (catalogIds.length > 0) {
    const { data: catalogRows, error: catalogError } = await client
      .from("isp_service_catalog")
      .select("id, category")
      .eq("company_id", companyId)
      .in("id", catalogIds)
    if (catalogError) throw new Error(catalogError.message)
    for (const row of catalogRows ?? []) {
      catalogById.set(row.id, row.category)
    }
  }

  const servicesWithConnection: IspServiceWithConnection[] = services.map(
    (service) => {
      const category = service.catalogId
        ? catalogById.get(service.catalogId)
        : null
      return {
        ...service,
        catalogCategory:
          category && isIspCatalogCategory(category) ? category : null,
        connection:
          connections.find((connection) => connection.serviceId === service.id) ??
          null,
      }
    }
  )

  const workOrders = await loadRelatedWorkOrders(
    client,
    companyId,
    customerResult.data,
    servicesWithConnection
  )
  const atenciones = await fetchIspAtenciones(client, companyId, customerId)
  const lastWorkOrder = workOrders[0] ?? null
  const registryNotes = await loadAbnetRegistryNoteContext(client, companyId)
  const abnetRegistryNote = abnetRegistryNoteForExternal(
    registryNotes,
    customerResult.data.externalCustomerCode
  )
  const customer = await withAbnetPersonalFields(
    client,
    companyId,
    mapCustomerHeader(customerResult.data, abnetRegistryNote)
  )
  const tvFlags = await loadBespokeTvFlags(client, companyId, customerId)
  const tv = tvFlags.get(customerId)
  const registrySubscriber = registryNotes
    ? registrySubscriberView({
        records: registryNotes.records,
        externalCode: customerResult.data.externalCustomerCode,
        bespokePackFutbol: tv?.packFutbol,
        bespokeTvFull: tv?.tvFull,
        liveCustomerIds: (() => {
          const number = abnetNumberFromExternalCode(customerResult.data.externalCustomerCode)
          if (!number || number === "99999999") return []
          if (registryNotes.shared.has(number)) return [`${customerId}-a`, `${customerId}-b`]
          return (registryNotes.counts.get(number) ?? 0) > 0 ? [customerId] : []
        })(),
      })
    : null

  return {
    customer,
    kpis: {
      serviceCount: services.length,
      connectionCount: connections.length,
      accountSituation: ISP_BILLING_PLACEHOLDER,
      pendingAtenciones: atenciones.filter(
        (item) => item.status && item.status !== "resuelta"
      ).length,
      lastWorkOrderLabel: lastWorkOrder
        ? `${lastWorkOrder.code} · ${lastWorkOrder.status}`
        : null,
    },
    services: sortSubscriberServices(servicesWithConnection),
    workOrders,
    atenciones,
    activity: buildActivity({
      customer,
      services: servicesWithConnection,
      workOrders,
      atenciones,
    }),
    registrySubscriber,
  }
}

export async function getPadronSubscriberDetail(
  client: IspQueriesClient,
  companyId: string,
  rowId: string
): Promise<IspCustomerDetail | null> {
  const number = clients360PadronNumberFromId(rowId)
  if (!number) return null
  const registry = await loadAbnetRegistryNoteContext(client, companyId)
  if (!registry) return null
  const live = await loadLiveAbnetCustomers(client, companyId)
  if (live.error) throw new Error(live.error.message)
  const usable = number !== "99999999"
  const matches = usable
    ? live.customers.filter(
        (row) => abnetNumberFromExternalCode(row.externalCode) === number
      )
    : []
  const view = registrySubscriberView({
    records: registry.records,
    customerNumber: number,
    externalCode: usable ? number : null,
    liveCustomerIds: matches.map((row) => row.id),
  })
  if (!view || view.connections.length === 0) return null
  const named = registry.records.find(
    (row) =>
      abnetNumberFromExternalCode(row.abnetCustomerNumber) === number &&
      row.customerName.trim()
  )
  const customer = await withAbnetPersonalFields(client, companyId, {
    id: rowId,
    name: named?.customerName.trim() || `Abonado ${number}`,
    dni: null,
    phone: null,
    whatsapp: null,
    email: null,
    address: null,
    locality: null,
    status: "",
    createdAt: "",
    updatedAt: "",
    externalCustomerCode: number,
    abnetRegistryNote: view.note,
  })
  return {
    customer,
    kpis: {
      serviceCount: 0,
      connectionCount: 0,
      accountSituation: null,
      pendingAtenciones: null,
      lastWorkOrderLabel: null,
    },
    services: [],
    workOrders: [],
    atenciones: [],
    activity: [],
    registrySubscriber: view,
  }
}

function mapWorkOrderSummary(task: Task): IspWorkOrderSummary {
  return {
    id: task.id,
    code: task.code,
    type: workOrderTypeLabel(task.serviceType),
    status: TASK_STATUS_LABELS[task.status] ?? task.status,
    date: task.dueDate || task.startDate || task.createdAt || null,
    technology: getTaskTechnologyLabel(task),
    plan: task.contractedPlan ?? null,
    crew: task.crew || null,
  }
}

async function fetchIspAtenciones(
  client: IspQueriesClient,
  companyId: string,
  customerId: string
): Promise<IspAtencionSummary[]> {
  const { data, error } = await client
    .from("customer_atenciones")
    .select("id, created_at, updated_at, motivo, resultado, status")
    .eq("company_id", companyId)
    .eq("customer_id", customerId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(100)

  if (error) return []
  return (data ?? []).map((row) => ({
    id: row.id,
    date: row.created_at,
    motivo: row.motivo,
    resultado: row.resultado,
    status: row.status,
    lastActivityAt: row.updated_at,
  }))
}

function buildActivity(input: {
  customer: IspCustomerHeader
  services: IspServiceWithConnection[]
  workOrders: IspWorkOrderSummary[]
  atenciones: IspAtencionSummary[]
}): IspActivityEvent[] {
  const events: IspActivityEvent[] = []

  if (
    input.customer.updatedAt &&
    input.customer.updatedAt !== input.customer.createdAt
  ) {
    events.push({
      id: `admin-${input.customer.id}`,
      occurredAt: input.customer.updatedAt,
      label: "Datos del cliente actualizados",
      kind: "admin",
    })
  }
  for (const order of input.workOrders) {
    events.push({
      id: `wo-${order.id}`,
      occurredAt: order.date ?? "",
      label: `OT ${order.code} · ${order.status}`,
      kind: "work_order",
    })
  }
  for (const atencion of input.atenciones) {
    events.push({
      id: `at-${atencion.id}`,
      occurredAt: atencion.lastActivityAt ?? atencion.date,
      label: `Atención ${atencion.motivo ?? ""}`.trim(),
      kind: "atencion",
    })
  }
  for (const service of input.services) {
    events.push({
      id: `sv-${service.id}`,
      occurredAt: service.createdAt,
      label: `Servicio ${service.planName} creado`,
      kind: "service",
    })
    if (service.connection) {
      const typeLabel =
        ISP_CONNECTION_TYPE_LABELS[service.connection.connectionType] ??
        service.connection.connectionType
      events.push({
        id: `cn-${service.connection.id}`,
        occurredAt: service.connection.createdAt,
        label: `Conexión ${typeLabel} registrada`,
        kind: "connection",
      })
    }
  }

  return events
    .filter((event) => event.occurredAt)
    .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt))
}

export async function listIspConnections(
  client: IspQueriesClient,
  companyId: string,
  filters: {
    search?: string
    commercialStatus?: string
    technicalStatus?: string
    technology?: string
    connectionType?: string
    coreName?: string
  }
): Promise<IspConnectionListItem[]> {
  const { data: connectionRows, error } = await client
    .from("isp_connections")
    .select("*")
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(500)

  if (error) throw new Error(error.message)
  if (!connectionRows?.length) return []

  const services = await client
    .from("isp_services")
    .select("*")
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .in(
      "id",
      connectionRows.map((row) => row.service_id)
    )
  if (services.error) throw new Error(services.error.message)

  const mappedServices = (services.data ?? []).map(mapIspServiceRow)
  const serviceById = new Map(mappedServices.map((service) => [service.id, service]))
  const customers = await client
    .from("customers")
    .select("id, name")
    .eq("company_id", companyId)
    .in(
      "id",
      mappedServices.map((service) => service.customerId)
    )
  if (customers.error) throw new Error(customers.error.message)
  const customerNameById = new Map(
    (customers.data ?? []).map((row) => [row.id, row.name])
  )

  return connectionRows
    .map((row) => {
      const service = serviceById.get(row.service_id)
      if (!service) return null
      const connection = mapIspConnectionRow(row, service.customerId)
      return {
        id: connection.id,
        customerId: service.customerId,
        customerName: customerNameById.get(service.customerId) ?? "Cliente",
        serviceId: service.id,
        technology: service.technology,
        planName: service.planName,
        connectionType: connection.connectionType,
        ipAddress: connection.ipAddress,
        coreName: connection.coreName,
        commercialStatus: service.commercialStatus,
        technicalStatus: connection.technicalStatus,
        healthLabel: "Sin datos de monitoreo disponibles",
      } satisfies IspConnectionListItem
    })
    .filter((item): item is IspConnectionListItem => Boolean(item))
    .filter((item) => {
      const search = filters.search?.trim().toLowerCase()
      if (
        search &&
        !item.customerName.toLowerCase().includes(search) &&
        !item.planName.toLowerCase().includes(search) &&
        !(item.ipAddress ?? "").toLowerCase().includes(search) &&
        !(item.coreName ?? "").toLowerCase().includes(search)
      ) {
        return false
      }
      if (
        filters.commercialStatus &&
        filters.commercialStatus !== "all" &&
        item.commercialStatus !== filters.commercialStatus
      ) {
        return false
      }
      if (
        filters.technicalStatus &&
        filters.technicalStatus !== "all" &&
        item.technicalStatus !== filters.technicalStatus
      ) {
        return false
      }
      if (
        filters.technology &&
        filters.technology !== "all" &&
        item.technology !== filters.technology
      ) {
        return false
      }
      if (
        filters.connectionType &&
        filters.connectionType !== "all" &&
        item.connectionType !== filters.connectionType
      ) {
        return false
      }
      if (
        filters.coreName?.trim() &&
        (item.coreName ?? "").toLowerCase() !==
          filters.coreName.trim().toLowerCase()
      ) {
        return false
      }
      return true
    })
}

export async function getIspConnectionDetail(
  client: IspQueriesClient,
  companyId: string,
  connectionId: string
): Promise<IspConnectionDetail | null> {
  const { data, error } = await client
    .from("isp_connections")
    .select("*")
    .eq("company_id", companyId)
    .eq("id", connectionId)
    .is("deleted_at", null)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) return null

  const { data: serviceRow, error: serviceError } = await client
    .from("isp_services")
    .select("*")
    .eq("id", data.service_id)
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .maybeSingle()

  if (serviceError) throw new Error(serviceError.message)
  if (!serviceRow) return null

  const customerResult = await getCustomerById(client, serviceRow.customer_id)
  if (customerResult.error || !customerResult.data) return null

  const service = mapIspServiceRow(serviceRow)
  const registryNotes = await loadAbnetRegistryNoteContext(client, companyId)
  return {
    customer: mapCustomerHeader(
      customerResult.data,
      abnetRegistryNoteForExternal(registryNotes, customerResult.data.externalCustomerCode)
    ),
    service,
    connection: mapIspConnectionRow(data, service.customerId),
  }
}

export async function createIspOnboarding(
  client: IspQueriesClient,
  payload: IspOnboardingPayload
): Promise<IspOnboardingResult> {
  const { data, error } = await client.rpc("create_isp_onboarding", {
    p_payload: {
      reuseExistingCustomer: payload.reuseExistingCustomer ?? false,
      existingCustomerId: payload.existingCustomerId ?? null,
      includeService: payload.includeService,
      includeConnection: payload.includeConnection,
      sourceTaskId: payload.sourceTaskId ?? null,
      customer: payload.customer,
      service: payload.service,
      connection: payload.connection,
    },
  })

  if (error) throw new Error(error.message)

  const result = (data ?? {}) as {
    customerId?: string
    serviceId?: string | null
    connectionId?: string | null
    reusedExistingCustomer?: boolean
    requiresConfirmation?: boolean
    existingCustomer?: IspExistingCustomerMatch
  }

  return {
    customerId: result.customerId ?? "",
    serviceId: result.serviceId ?? null,
    connectionId: result.connectionId ?? null,
    reusedExistingCustomer: Boolean(result.reusedExistingCustomer),
    existingCustomer: result.existingCustomer,
    requiresConfirmation: Boolean(result.requiresConfirmation),
  }
}

export async function listExistingCustomersByDni(
  client: IspQueriesClient,
  companyId: string,
  dni: string
): Promise<IspExistingCustomerMatch[]> {
  const digits = dni.replace(/\D/g, "")
  if (digits.length < 7) return []

  const { data, error } = await client
    .from("customers")
    .select("id, name, dni, phone")
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .limit(80)

  if (error) throw new Error(error.message)
  return (data ?? [])
    .filter((row) => (row.dni ?? "").replace(/\D/g, "") === digits)
    .map((row) => ({
      id: row.id,
      name: row.name,
      dni: row.dni,
      phone: row.phone,
    }))
}

export async function buildIspPrefillForTask(
  client: IspQueriesClient,
  companyId: string,
  taskId: string
): Promise<IspOtPrefill | null> {
  const taskResult = await fetchTaskById(client, taskId)
  if (taskResult.error || !taskResult.data) return null

  const existingCustomers = await listExistingCustomersByDni(
    client,
    companyId,
    taskResult.data.customerDni ?? ""
  )

  let catalogItem = null
  if (taskResult.data.serviceCatalogId) {
    catalogItem = await getIspCatalogItem(
      client,
      companyId,
      taskResult.data.serviceCatalogId
    )
  }
  if (!catalogItem) {
    const catalogItems = await listIspCatalogForOt(
      client,
      companyId,
      taskResult.data.serviceCatalogId
    )
    catalogItem = findCatalogItemForWorkOrder(catalogItems, {
      catalogId: taskResult.data.serviceCatalogId,
      otTechnology: resolveWorkOrderTechnologyFromTask(taskResult.data),
      contractedPlan: taskResult.data.contractedPlan,
    })
  }

  return buildIspPrefillFromWorkOrder({
    task: taskResult.data,
    existingCustomers,
    catalogItem,
  })
}


async function loadRelatedWorkOrders(
  client: IspQueriesClient,
  _companyId: string,
  customer: Customer,
  services: IspServiceWithConnection[]
): Promise<IspWorkOrderSummary[]> {
  const byId = new Map<string, Task>()

  const linked = await fetchWorkOrdersByCustomerId(client, customer.id)
  for (const task of linked.data ?? []) {
    byId.set(task.id, task)
  }

  const sourceTaskIds = [
    ...new Set(
      services
        .map((service) => service.sourceTaskId)
        .filter((id): id is string => Boolean(id))
    ),
  ]
  for (const taskId of sourceTaskIds) {
    if (byId.has(taskId)) continue
    const result = await fetchTaskById(client, taskId)
    if (result.data) byId.set(result.data.id, result.data)
  }

  return [...byId.values()]
    .sort((left, right) =>
      (right.dueDate || right.startDate || "").localeCompare(
        left.dueDate || left.startDate || ""
      )
    )
    .map(mapWorkOrderSummary)
}

export type IspNewInstallationCandidate = {
  id: string
  code: string
  customerName: string | null
  customerDni: string | null
  status: string
}

export async function listCompletedNewInstallationTasks(
  client: IspQueriesClient,
  companyId: string
): Promise<IspNewInstallationCandidate[]> {
  const [{ data, error }, cutoffAt, linked] = await Promise.all([
    client
      .from("tasks")
      .select(
        "id, code, customer_name, customer_dni, status, service_type, closed_at, completed_at, due_date, created_at"
      )
      .eq("company_id", companyId)
      .eq("service_type", NEW_INSTALLATION_SERVICE_TYPE)
      .in("status", ["finalizada", "cerrada"])
      .is("deleted_at", null)
      .order("due_date", { ascending: false })
      .limit(80),
    getIspOnboardingCutoff(client, companyId).catch((cause: unknown) => {
      const message = cause instanceof Error ? cause.message : String(cause)
      if (/isp_company_settings|schema cache|does not exist/i.test(message)) {
        return null
      }
      throw cause
    }),
    client
      .from("isp_services")
      .select("source_task_id")
      .eq("company_id", companyId)
      .is("deleted_at", null)
      .not("source_task_id", "is", null),
  ])

  if (error) throw new Error(error.message)
  if (linked.error) throw new Error(linked.error.message)

  const linkedSourceTaskIds = (linked.data ?? [])
    .map((row) => row.source_task_id)
    .filter((id): id is string => Boolean(id))

  return (data ?? [])
    .filter((row) =>
      isWorkOrderEligibleForIspOnboarding({
        task: {
          id: row.id,
          closedAt: row.closed_at,
          completedAt: row.completed_at,
          dueDate: row.due_date,
          createdAt: row.created_at,
        },
        cutoffAt,
        linkedSourceTaskIds,
      })
    )
    .slice(0, 30)
    .map((row) => ({
      id: row.id,
      code: row.code,
      customerName: row.customer_name,
      customerDni: row.customer_dni,
      status: row.status,
    }))
}

export async function getIspWorkOrder(client: IspQueriesClient, taskId: string) {
  return fetchTaskById(client, taskId)
}

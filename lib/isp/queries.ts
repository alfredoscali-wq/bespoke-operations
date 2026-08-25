import type { SupabaseClient } from "@supabase/supabase-js"

import { escapeCustomerSearchPattern } from "@/lib/customers/customer-list"
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

function mapCustomerHeader(customer: Customer): IspCustomerHeader {
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
  "id, name, dni, phone, whatsapp, email, address, locality, status, created_at, updated_at, external_customer_code"

function chunkIds(ids: string[], size = ISP_CUSTOMER_ID_CHUNK): string[][] {
  const chunks: string[][] = []
  for (let index = 0; index < ids.length; index += size) {
    chunks.push(ids.slice(index, index + size))
  }
  return chunks
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
  }
): Promise<{ customers: IspCustomerListItem[]; localities: string[] }> {
  const { data: members, error: memberError } = await client
    .from("isp_subscribers")
    .select("customer_id")
    .eq("company_id", companyId)
    .is("deleted_at", null)

  if (memberError) throw new Error(memberError.message)

  const memberIds = [
    ...new Set((members ?? []).map((row) => row.customer_id).filter(Boolean)),
  ]
  if (memberIds.length === 0) {
    return { customers: [], localities: [] }
  }

  const search = input.search?.trim()
  const pattern = search ? escapeCustomerSearchPattern(search) : ""
  const customerRows: Array<{
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
  }> = []

  for (const part of chunkIds(memberIds)) {
    let query = client
      .from("customers")
      .select(ISP_CUSTOMER_LIST_SELECT)
      .eq("company_id", companyId)
      .is("deleted_at", null)
      .in("id", part)

    if (pattern) {
      query = query.or(
        `name.ilike.${pattern},dni.ilike.${pattern},phone.ilike.${pattern},whatsapp.ilike.${pattern},email.ilike.${pattern},external_customer_code.ilike.${pattern}`
      )
    }

    const { data, error } = await query
    if (error) throw new Error(error.message)
    customerRows.push(...(data ?? []))
  }

  const customers = customerRows
    .sort((left, right) => left.name.localeCompare(right.name, "es"))
    .slice(0, 400)

  if (customers.length === 0) {
    return { customers: [], localities: [] }
  }

  // Company-scoped reads avoid PostgREST `.in(uuid…)` URLs that exceed
  // proxy limits and surface as `TypeError: fetch failed`.
  const [services, connectionRows] = await Promise.all([
    client
      .from("isp_services")
      .select("*")
      .eq("company_id", companyId)
      .is("deleted_at", null),
    client
      .from("isp_connections")
      .select("*")
      .eq("company_id", companyId)
      .is("deleted_at", null),
  ])
  if (services.error) throw new Error(services.error.message)
  if (connectionRows.error) throw new Error(connectionRows.error.message)

  const mappedServices = (services.data ?? []).map(mapIspServiceRow)
  const customerByService = new Map(
    mappedServices.map((service) => [service.id, service.customerId])
  )
  const connections = (connectionRows.data ?? []).map((row) =>
    mapIspConnectionRow(row, customerByService.get(row.service_id) ?? "")
  )

  const mapped = customers.map((row) => {
    const customerServices = mappedServices.filter(
      (service) => service.customerId === row.id
    )
    const customerConnections = connections.filter((connection) =>
      customerServices.some((service) => service.id === connection.serviceId)
    )
    const lastActivityAt = [
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
      serviceCount: customerServices.length,
      connectionCount: customerConnections.length,
      listStatus: deriveIspSubscriberListStatus({
        customerStatus: row.status,
        commercialStatuses: customerServices.map(
          (service) => service.commercialStatus
        ),
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
    } satisfies IspCustomerListItem
  })

  const localities = [
    ...new Set(
      mapped
        .map((item) => item.locality?.trim())
        .filter((value): value is string => Boolean(value))
    ),
  ].sort((left, right) => left.localeCompare(right, "es"))

  const localityFilter = input.locality?.trim().toLowerCase() ?? ""
  const statusFilter = input.status?.trim().toLowerCase() ?? "all"
  const minServices = input.minServices ?? 0
  const minConnections = input.minConnections ?? 0

  const filtered = mapped.filter((item) => {
    if (statusFilter && statusFilter !== "all" && item.listStatus !== statusFilter) {
      return false
    }
    if (
      localityFilter &&
      localityFilter !== "all" &&
      (item.locality ?? "").trim().toLowerCase() !== localityFilter
    ) {
      return false
    }
    if (item.serviceCount < minServices) return false
    if (item.connectionCount < minConnections) return false
    return true
  })

  return { customers: filtered, localities }
}

export async function getIspCustomerDetail(
  client: IspQueriesClient,
  companyId: string,
  customerId: string
): Promise<IspCustomerDetail | null> {
  const { data: member, error: memberError } = await client
    .from("isp_subscribers")
    .select("id")
    .eq("company_id", companyId)
    .eq("customer_id", customerId)
    .is("deleted_at", null)
    .maybeSingle()

  if (memberError) throw new Error(memberError.message)
  if (!member) return null

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

  return {
    customer: mapCustomerHeader(customerResult.data),
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
      customer: mapCustomerHeader(customerResult.data),
      services: servicesWithConnection,
      workOrders,
      atenciones,
    }),
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
  return {
    customer: mapCustomerHeader(customerResult.data),
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

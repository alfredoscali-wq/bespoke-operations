import type { SupabaseClient } from "@supabase/supabase-js"

import {
  isCommercialSolicitudPriorityCode,
  isCommercialSolicitudResolutionCode,
  isCommercialSolicitudStatusCode,
  COMMERCIAL_SOLICITUD_RESOLUTION_RESULTING_STATUS,
  type CommercialSolicitudPriorityCode,
  type CommercialSolicitudResolutionCode,
  type CommercialSolicitudStatusCode,
} from "@/lib/commercial/solicitud-catalogs"
import type {
  CommercialSolicitud,
  CreateCommercialSolicitudInput,
  UpdateCommercialSolicitudInput,
} from "@/lib/types/commercial-solicitudes"

type SolicitudRow = {
  id: string
  company_id: string
  opportunity_id: string
  code: string
  request_type_id: string
  product_plan: string
  priority: string
  status: string
  resolution_code: string | null
  observations: string
  responsible_employee_id: string | null
  work_order_id: string | null
  created_by: string | null
  updated_by: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

type TypeLookup = { name: string; color: string }
type EmployeeLookup = {
  first_name: string | null
  last_name: string | null
  employee_code: string | null
  preferred_name?: string | null
}

type RepoError = { code: string; message: string }
type RepoResult<T> =
  | { data: T; error: null }
  | { data: null; error: RepoError }

export type CommercialSolicitudesClient = SupabaseClient

const TABLE = "commercial_solicitudes" as never

function mapError(error: { code?: string; message: string }): RepoError {
  return {
    code: error.code ?? "UNKNOWN",
    message: error.message,
  }
}

function resolveEmployeeName(employee: EmployeeLookup | null): string | null {
  if (!employee) return null
  const preferred = employee.preferred_name?.trim() ?? ""
  if (preferred) return preferred
  const full =
    `${employee.first_name ?? ""} ${employee.last_name ?? ""}`.trim()
  return full || employee.employee_code?.trim() || null
}

function asStatus(value: string): CommercialSolicitudStatusCode {
  return isCommercialSolicitudStatusCode(value) ? value : "nueva"
}

function asPriority(value: string): CommercialSolicitudPriorityCode {
  return isCommercialSolicitudPriorityCode(value) ? value : "normal"
}

function asResolution(
  value: string | null
): CommercialSolicitudResolutionCode | null {
  if (!value) return null
  return isCommercialSolicitudResolutionCode(value) ? value : null
}

function mapRow(
  row: SolicitudRow,
  typeLookup: Map<string, TypeLookup>,
  employeeLookup: Map<string, EmployeeLookup>
): CommercialSolicitud {
  const type = typeLookup.get(row.request_type_id) ?? null
  const employee = row.responsible_employee_id
    ? employeeLookup.get(row.responsible_employee_id) ?? null
    : null

  return {
    id: row.id,
    companyId: row.company_id,
    opportunityId: row.opportunity_id,
    code: row.code,
    requestTypeId: row.request_type_id,
    requestTypeName: type?.name ?? null,
    requestTypeColor: type?.color ?? null,
    productPlan: row.product_plan ?? "",
    priority: asPriority(row.priority),
    status: asStatus(row.status),
    resolutionCode: asResolution(row.resolution_code),
    observations: row.observations ?? "",
    responsibleEmployeeId: row.responsible_employee_id,
    responsibleEmployeeName: resolveEmployeeName(employee),
    workOrderId: row.work_order_id,
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  }
}

async function loadLookups(
  client: CommercialSolicitudesClient,
  companyId: string,
  rows: SolicitudRow[]
): Promise<{
  types: Map<string, TypeLookup>
  employees: Map<string, EmployeeLookup>
}> {
  const typeIds = [...new Set(rows.map((row) => row.request_type_id))]
  const employeeIds = [
    ...new Set(
      rows
        .map((row) => row.responsible_employee_id)
        .filter((id): id is string => Boolean(id))
    ),
  ]

  const types = new Map<string, TypeLookup>()
  const employees = new Map<string, EmployeeLookup>()

  if (typeIds.length > 0) {
    const { data } = await client
      .from("commercial_solicitud_type_defs" as never)
      .select("id, name, color")
      .eq("company_id", companyId)
      .in("id", typeIds)

    for (const row of (data ?? []) as Array<{
      id: string
      name: string
      color: string
    }>) {
      types.set(row.id, { name: row.name, color: row.color })
    }
  }

  if (employeeIds.length > 0) {
    const { data } = await client
      .from("employees")
      .select("id, first_name, last_name, employee_code, preferred_name")
      .eq("company_id", companyId)
      .in("id", employeeIds)

    for (const row of (data ?? []) as Array<{
      id: string
      first_name: string | null
      last_name: string | null
      employee_code: string | null
      preferred_name: string | null
    }>) {
      employees.set(row.id, {
        first_name: row.first_name,
        last_name: row.last_name,
        employee_code: row.employee_code,
        preferred_name: row.preferred_name,
      })
    }
  }

  return { types, employees }
}

export async function listCommercialSolicitudesByOpportunity(
  client: CommercialSolicitudesClient,
  companyId: string,
  opportunityId: string
): Promise<RepoResult<CommercialSolicitud[]>> {
  const { data, error } = await client
    .from(TABLE)
    .select("*")
    .eq("company_id", companyId)
    .eq("opportunity_id", opportunityId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })

  if (error) return { data: null, error: mapError(error) }

  const rows = (data ?? []) as SolicitudRow[]
  const lookups = await loadLookups(client, companyId, rows)
  return {
    data: rows.map((row) => mapRow(row, lookups.types, lookups.employees)),
    error: null,
  }
}

export async function getCommercialSolicitudById(
  client: CommercialSolicitudesClient,
  companyId: string,
  id: string
): Promise<RepoResult<CommercialSolicitud>> {
  const { data, error } = await client
    .from(TABLE)
    .select("*")
    .eq("company_id", companyId)
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle()

  if (error) return { data: null, error: mapError(error) }
  if (!data) {
    return {
      data: null,
      error: { code: "NOT_FOUND", message: "Solicitud no encontrada." },
    }
  }

  const row = data as SolicitudRow
  const lookups = await loadLookups(client, companyId, [row])
  return { data: mapRow(row, lookups.types, lookups.employees), error: null }
}

export async function createCommercialSolicitud(
  client: CommercialSolicitudesClient,
  companyId: string,
  input: CreateCommercialSolicitudInput,
  actor: { employeeId: string | null }
): Promise<RepoResult<CommercialSolicitud>> {
  if (!input.opportunityId?.trim()) {
    return {
      data: null,
      error: { code: "VALIDATION", message: "Cliente no resuelto." },
    }
  }
  if (!input.requestTypeId?.trim()) {
    return {
      data: null,
      error: { code: "VALIDATION", message: "Seleccioná el tipo de solicitud." },
    }
  }

  const priority = input.priority ?? "normal"
  if (!isCommercialSolicitudPriorityCode(priority)) {
    return {
      data: null,
      error: { code: "VALIDATION", message: "Prioridad inválida." },
    }
  }

  const { data: typeRow, error: typeError } = await client
    .from("commercial_solicitud_type_defs" as never)
    .select("id")
    .eq("id", input.requestTypeId)
    .eq("company_id", companyId)
    .eq("is_active", true)
    .is("deleted_at", null)
    .maybeSingle()

  if (typeError) return { data: null, error: mapError(typeError) }
  if (!typeRow) {
    return {
      data: null,
      error: {
        code: "VALIDATION",
        message: "Tipo de solicitud inválido o inactivo.",
      },
    }
  }

  const insertPayload = {
    company_id: companyId,
    opportunity_id: input.opportunityId,
    code: "",
    request_type_id: input.requestTypeId,
    product_plan: input.productPlan?.trim() ?? "",
    priority,
    status: "nueva",
    resolution_code: null,
    observations: input.observations?.trim() ?? "",
    responsible_employee_id: actor.employeeId,
    work_order_id: null,
    created_by: actor.employeeId,
    updated_by: actor.employeeId,
  }

  const { data, error } = await client
    .from(TABLE)
    .insert(insertPayload as never)
    .select("*")
    .single()

  if (error || !data) {
    return {
      data: null,
      error: mapError(error ?? { message: "No se pudo crear la solicitud." }),
    }
  }

  const row = data as SolicitudRow
  const lookups = await loadLookups(client, companyId, [row])
  return { data: mapRow(row, lookups.types, lookups.employees), error: null }
}

export async function updateCommercialSolicitud(
  client: CommercialSolicitudesClient,
  companyId: string,
  id: string,
  input: UpdateCommercialSolicitudInput,
  actor: { employeeId: string | null }
): Promise<RepoResult<CommercialSolicitud>> {
  const patch: Record<string, unknown> = {
    updated_by: actor.employeeId,
  }

  if (input.requestTypeId !== undefined) {
    if (!input.requestTypeId.trim()) {
      return {
        data: null,
        error: {
          code: "VALIDATION",
          message: "Seleccioná el tipo de solicitud.",
        },
      }
    }
    patch.request_type_id = input.requestTypeId
  }
  if (input.productPlan !== undefined) {
    patch.product_plan = input.productPlan.trim()
  }
  if (input.priority !== undefined) {
    if (!isCommercialSolicitudPriorityCode(input.priority)) {
      return {
        data: null,
        error: { code: "VALIDATION", message: "Prioridad inválida." },
      }
    }
    patch.priority = input.priority
  }
  if (input.observations !== undefined) {
    patch.observations = input.observations.trim()
  }
  if (input.status !== undefined) {
    if (!isCommercialSolicitudStatusCode(input.status)) {
      return {
        data: null,
        error: { code: "VALIDATION", message: "Estado inválido." },
      }
    }
    patch.status = input.status
  }
  if (input.resolutionCode !== undefined) {
    if (
      input.resolutionCode != null &&
      !isCommercialSolicitudResolutionCode(input.resolutionCode)
    ) {
      return {
        data: null,
        error: { code: "VALIDATION", message: "Resolución inválida." },
      }
    }
    patch.resolution_code = input.resolutionCode
  }
  if (input.workOrderId !== undefined) {
    patch.work_order_id = input.workOrderId
  }

  const { data, error } = await client
    .from(TABLE)
    .update(patch as never)
    .eq("id", id)
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .select("*")
    .maybeSingle()

  if (error) return { data: null, error: mapError(error) }
  if (!data) {
    return {
      data: null,
      error: { code: "NOT_FOUND", message: "Solicitud no encontrada." },
    }
  }

  const row = data as SolicitudRow
  const lookups = await loadLookups(client, companyId, [row])
  return { data: mapRow(row, lookups.types, lookups.employees), error: null }
}

export async function resolveCommercialSolicitud(
  client: CommercialSolicitudesClient,
  companyId: string,
  id: string,
  resolutionCode: CommercialSolicitudResolutionCode,
  actor: { employeeId: string | null }
): Promise<RepoResult<CommercialSolicitud>> {
  if (!isCommercialSolicitudResolutionCode(resolutionCode)) {
    return {
      data: null,
      error: { code: "VALIDATION", message: "Seleccioná una resolución." },
    }
  }

  return updateCommercialSolicitud(
    client,
    companyId,
    id,
    {
      resolutionCode,
      status: COMMERCIAL_SOLICITUD_RESOLUTION_RESULTING_STATUS[resolutionCode],
    },
    actor
  )
}

export async function linkCommercialSolicitudToWorkOrder(
  client: CommercialSolicitudesClient,
  companyId: string,
  id: string,
  workOrderId: string,
  actor: { employeeId: string | null }
): Promise<RepoResult<CommercialSolicitud>> {
  if (!workOrderId.trim()) {
    return {
      data: null,
      error: { code: "VALIDATION", message: "OT no resuelta." },
    }
  }

  return updateCommercialSolicitud(
    client,
    companyId,
    id,
    {
      workOrderId,
      status: "ot_generada",
      resolutionCode: "venta_concretada",
    },
    actor
  )
}

export async function cancelCommercialSolicitud(
  client: CommercialSolicitudesClient,
  companyId: string,
  id: string,
  actor: { employeeId: string | null }
): Promise<RepoResult<CommercialSolicitud>> {
  return resolveCommercialSolicitud(client, companyId, id, "cancelada", actor)
}

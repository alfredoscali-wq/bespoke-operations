import type { SupabaseClient } from "@supabase/supabase-js"

import type {
  CommercialTerritorialActivity,
  CreateCommercialTerritorialActivityInput,
} from "@/lib/types/commercial-territorial-activity"

type ActivityRow = {
  id: string
  company_id: string
  code: string
  activity_type_id: string
  description: string
  observations: string
  latitude: number
  longitude: number
  location_source: string | null
  related_opportunity_id: string | null
  employee_id: string | null
  created_by: string | null
  updated_by: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

type TypeLookup = {
  name: string
  color: string
  icon: string | null
}

type EmployeeLookup = {
  first_name: string | null
  last_name: string | null
  employee_code: string | null
}

type RepoError = { code: string; message: string }
type RepoResult<T> =
  | { data: T; error: null }
  | { data: null; error: RepoError }

function mapError(error: { code?: string; message: string }): RepoError {
  return {
    code: error.code ?? "UNKNOWN",
    message: error.message,
  }
}

function resolveEmployeeName(employee: EmployeeLookup | null): string | null {
  if (!employee) return null
  const full =
    `${employee.first_name ?? ""} ${employee.last_name ?? ""}`.trim()
  return full || employee.employee_code?.trim() || null
}

function mapRow(
  row: ActivityRow,
  typeLookup: Map<string, TypeLookup>,
  employeeLookup: Map<string, EmployeeLookup>
): CommercialTerritorialActivity {
  const type = typeLookup.get(row.activity_type_id) ?? null
  const employee = row.employee_id
    ? employeeLookup.get(row.employee_id) ?? null
    : null

  return {
    id: row.id,
    companyId: row.company_id,
    code: row.code,
    activityTypeId: row.activity_type_id,
    activityTypeName: type?.name ?? null,
    activityTypeColor: type?.color ?? null,
    activityTypeIcon: type?.icon ?? null,
    description: row.description,
    observations: row.observations ?? "",
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    locationSource: row.location_source,
    relatedOpportunityId: row.related_opportunity_id,
    employeeId: row.employee_id,
    employeeName: resolveEmployeeName(employee),
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  }
}

/** Loose client: table lands via migration ahead of generated Database types. */
export type CommercialTerritorialActivitiesClient = SupabaseClient

const TABLE = "commercial_territorial_activities" as never

async function loadLookups(
  client: CommercialTerritorialActivitiesClient,
  companyId: string,
  rows: ActivityRow[]
): Promise<{
  types: Map<string, TypeLookup>
  employees: Map<string, EmployeeLookup>
}> {
  const typeIds = [...new Set(rows.map((row) => row.activity_type_id))]
  const employeeIds = [
    ...new Set(
      rows
        .map((row) => row.employee_id)
        .filter((id): id is string => Boolean(id))
    ),
  ]

  const types = new Map<string, TypeLookup>()
  const employees = new Map<string, EmployeeLookup>()

  if (typeIds.length > 0) {
    const { data } = await client
      .from("commercial_territorial_activity_types" as never)
      .select("id, name, color, icon")
      .eq("company_id", companyId)
      .in("id", typeIds)

    for (const row of (data ?? []) as Array<{
      id: string
      name: string
      color: string
      icon: string | null
    }>) {
      types.set(row.id, {
        name: row.name,
        color: row.color,
        icon: row.icon,
      })
    }
  }

  if (employeeIds.length > 0) {
    const { data } = await client
      .from("employees")
      .select("id, first_name, last_name, employee_code")
      .eq("company_id", companyId)
      .in("id", employeeIds)

    for (const row of (data ?? []) as Array<{
      id: string
      first_name: string | null
      last_name: string | null
      employee_code: string | null
    }>) {
      employees.set(row.id, {
        first_name: row.first_name,
        last_name: row.last_name,
        employee_code: row.employee_code,
      })
    }
  }

  return { types, employees }
}

export async function listCommercialTerritorialActivities(
  client: CommercialTerritorialActivitiesClient,
  companyId: string,
  options?: {
    activityTypeIds?: string[]
    limit?: number
  }
): Promise<RepoResult<CommercialTerritorialActivity[]>> {
  let query = client
    .from(TABLE)
    .select("*")
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(options?.limit ?? 500)

  if (options?.activityTypeIds && options.activityTypeIds.length > 0) {
    query = query.in("activity_type_id", options.activityTypeIds)
  }

  const { data, error } = await query
  if (error) {
    return { data: null, error: mapError(error) }
  }

  const rows = (data ?? []) as ActivityRow[]
  const lookups = await loadLookups(client, companyId, rows)

  return {
    data: rows.map((row) => mapRow(row, lookups.types, lookups.employees)),
    error: null,
  }
}

export async function countCommercialTerritorialActivities(
  client: CommercialTerritorialActivitiesClient,
  companyId: string,
  window: { fromIso: string; toIso: string }
): Promise<RepoResult<number>> {
  const { count, error } = await client
    .from(TABLE)
    .select("id", { count: "exact", head: true })
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .gte("created_at", window.fromIso)
    .lt("created_at", window.toIso)

  if (error) {
    return { data: null, error: mapError(error) }
  }

  return { data: count ?? 0, error: null }
}

export async function getCommercialTerritorialActivityById(
  client: CommercialTerritorialActivitiesClient,
  companyId: string,
  id: string
): Promise<RepoResult<CommercialTerritorialActivity>> {
  const { data, error } = await client
    .from(TABLE)
    .select("*")
    .eq("company_id", companyId)
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle()

  if (error) {
    return { data: null, error: mapError(error) }
  }
  if (!data) {
    return {
      data: null,
      error: { code: "NOT_FOUND", message: "Actividad no encontrada." },
    }
  }

  const row = data as ActivityRow
  const lookups = await loadLookups(client, companyId, [row])
  return {
    data: mapRow(row, lookups.types, lookups.employees),
    error: null,
  }
}

export async function createCommercialTerritorialActivity(
  client: CommercialTerritorialActivitiesClient,
  companyId: string,
  input: CreateCommercialTerritorialActivityInput,
  actor: { employeeId: string | null }
): Promise<RepoResult<CommercialTerritorialActivity>> {
  const description = input.description.trim()
  if (!description) {
    return {
      data: null,
      error: { code: "VALIDATION", message: "Ingrese la descripción." },
    }
  }
  if (!input.activityTypeId?.trim()) {
    return {
      data: null,
      error: { code: "VALIDATION", message: "Seleccione el tipo de actividad." },
    }
  }
  if (
    !Number.isFinite(input.latitude) ||
    !Number.isFinite(input.longitude) ||
    input.latitude < -90 ||
    input.latitude > 90 ||
    input.longitude < -180 ||
    input.longitude > 180
  ) {
    return {
      data: null,
      error: { code: "VALIDATION", message: "Ubicación GPS inválida." },
    }
  }

  const { data: typeRow, error: typeError } = await client
    .from("commercial_territorial_activity_types" as never)
    .select("id")
    .eq("id", input.activityTypeId)
    .eq("company_id", companyId)
    .eq("is_active", true)
    .is("deleted_at", null)
    .maybeSingle()

  if (typeError) {
    return { data: null, error: mapError(typeError) }
  }
  if (!typeRow) {
    return {
      data: null,
      error: {
        code: "VALIDATION",
        message: "Tipo de actividad inválido o inactivo.",
      },
    }
  }

  const insertPayload = {
    company_id: companyId,
    code: "",
    activity_type_id: input.activityTypeId,
    description,
    observations: input.observations?.trim() ?? "",
    latitude: Number(input.latitude.toFixed(7)),
    longitude: Number(input.longitude.toFixed(7)),
    location_source: input.locationSource?.trim() || null,
    related_opportunity_id: input.relatedOpportunityId?.trim() || null,
    employee_id: actor.employeeId,
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
      error: mapError(error ?? { message: "No se pudo crear la actividad." }),
    }
  }

  const row = data as ActivityRow
  const lookups = await loadLookups(client, companyId, [row])
  return {
    data: mapRow(row, lookups.types, lookups.employees),
    error: null,
  }
}

export async function softDeleteCommercialTerritorialActivity(
  client: CommercialTerritorialActivitiesClient,
  companyId: string,
  id: string,
  actor: { employeeId: string | null }
): Promise<RepoResult<true>> {
  const { error } = await client
    .from(TABLE)
    .update({
      deleted_at: new Date().toISOString(),
      updated_by: actor.employeeId,
    } as never)
    .eq("id", id)
    .eq("company_id", companyId)
    .is("deleted_at", null)

  if (error) {
    return { data: null, error: mapError(error) }
  }

  return { data: true, error: null }
}

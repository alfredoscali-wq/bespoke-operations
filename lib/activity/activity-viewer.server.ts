import "server-only"

import { formatActivityAreaLabel } from "@/lib/activity/activity-viewer-labels"
import {
  ACTIVITY_VIEWER_PAGE_SIZE,
  type ActivityViewerEntry,
  type ActivityViewerQuery,
  type ActivityViewerQueryResult,
  type ActivityViewerStats,
} from "@/lib/activity/activity-viewer-types"
import type { SupabaseAdminClient } from "@/lib/supabase/admin"

type ActivityEventDbRow = {
  id: string
  company_id: string
  employee_id: string | null
  actor_type: string
  module: string
  entity_type: string
  entity_id: string | null
  action: string
  detail: string
  metadata: Record<string, unknown> | null
  origin: string
  correlation_id: string | null
  severity: string
  created_at: string
}

type EmployeeLookupRow = {
  id: string
  first_name: string
  last_name: string
  preferred_name: string | null
  role_id: string | null
  system_role: string
}

type RoleLookupRow = {
  id: string
  code: string
  name: string
}

function resolveTodayRange(reference = new Date()): { from: string; to: string } {
  const start = new Date(reference)
  start.setHours(0, 0, 0, 0)
  const end = new Date(reference)
  end.setHours(23, 59, 59, 999)

  return {
    from: start.toISOString(),
    to: end.toISOString(),
  }
}

function formatEmployeeDisplayName(row: EmployeeLookupRow): string {
  const preferred = row.preferred_name?.trim()
  if (preferred) return preferred
  return `${row.first_name} ${row.last_name}`.trim() || row.id
}

async function resolveEmployeeIdsForFilters(
  client: SupabaseAdminClient,
  input: ActivityViewerQuery
): Promise<string[] | null> {
  const constraints: string[][] = []

  if (input.employeeId) {
    constraints.push([input.employeeId])
  }

  if (input.userSearch?.trim()) {
    const term = input.userSearch.trim()
    const pattern = `%${term}%`

    const { data, error } = await client
      .from("employees")
      .select("id")
      .eq("company_id", input.companyId)
      .is("deleted_at", null)
      .or(
        [
          `id.eq.${term}`,
          `first_name.ilike.${pattern}`,
          `last_name.ilike.${pattern}`,
          `preferred_name.ilike.${pattern}`,
          `email.ilike.${pattern}`,
        ].join(",")
      )

    if (error) {
      throw new Error(
        `No se pudo filtrar usuarios de Activity Engine: ${error.message}`
      )
    }

    constraints.push((data ?? []).map((row) => row.id))
  }

  if (input.area) {
    const { data: roles, error: rolesError } = await client
      .from("company_roles")
      .select("id")
      .eq("company_id", input.companyId)
      .eq("code", input.area)

    if (rolesError) {
      throw new Error(
        `No se pudo filtrar áreas de Activity Engine: ${rolesError.message}`
      )
    }

    const roleIds = (roles ?? []).map((row) => row.id)
    if (roleIds.length === 0) {
      return []
    }

    const { data: employees, error: employeesError } = await client
      .from("employees")
      .select("id")
      .eq("company_id", input.companyId)
      .is("deleted_at", null)
      .in("role_id", roleIds)

    if (employeesError) {
      throw new Error(
        `No se pudo filtrar empleados por área: ${employeesError.message}`
      )
    }

    constraints.push((employees ?? []).map((row) => row.id))
  }

  if (constraints.length === 0) {
    return null
  }

  let intersection = new Set(constraints[0])
  for (let index = 1; index < constraints.length; index += 1) {
    const next = new Set(constraints[index])
    intersection = new Set([...intersection].filter((id) => next.has(id)))
  }

  return [...intersection]
}

async function loadEmployeeContext(
  client: SupabaseAdminClient,
  companyId: string,
  employeeIds: string[]
): Promise<{
  employeesById: Map<string, EmployeeLookupRow>
  rolesById: Map<string, RoleLookupRow>
}> {
  const employeesById = new Map<string, EmployeeLookupRow>()
  const rolesById = new Map<string, RoleLookupRow>()

  if (employeeIds.length === 0) {
    return { employeesById, rolesById }
  }

  const { data: employees, error } = await client
    .from("employees")
    .select("id, first_name, last_name, preferred_name, role_id, system_role")
    .eq("company_id", companyId)
    .in("id", employeeIds)

  if (error) {
    throw new Error(
      `No se pudieron cargar usuarios de Activity Engine: ${error.message}`
    )
  }

  for (const row of employees ?? []) {
    employeesById.set(row.id, row as EmployeeLookupRow)
  }

  const roleIds = [
    ...new Set(
      [...employeesById.values()]
        .map((row) => row.role_id)
        .filter((id): id is string => Boolean(id))
    ),
  ]

  if (roleIds.length === 0) {
    return { employeesById, rolesById }
  }

  const { data: roles, error: rolesError } = await client
    .from("company_roles")
    .select("id, code, name")
    .eq("company_id", companyId)
    .in("id", roleIds)

  if (rolesError) {
    throw new Error(
      `No se pudieron cargar áreas de Activity Engine: ${rolesError.message}`
    )
  }

  for (const row of roles ?? []) {
    rolesById.set(row.id, row as RoleLookupRow)
  }

  return { employeesById, rolesById }
}

function mapViewerEntry(input: {
  row: ActivityEventDbRow
  companyName: string
  employee: EmployeeLookupRow | null
  role: RoleLookupRow | null
}): ActivityViewerEntry {
  const { row, companyName, employee, role } = input
  const areaCode = role?.code ?? employee?.system_role ?? null

  return {
    id: row.id,
    createdAt: row.created_at,
    employeeId: row.employee_id,
    userName: employee
      ? formatEmployeeDisplayName(employee)
      : row.employee_id
        ? row.employee_id
        : row.actor_type === "system" || row.actor_type === "service"
          ? "Sistema"
          : "—",
    companyId: row.company_id,
    companyName,
    areaCode,
    areaLabel: role?.name ?? formatActivityAreaLabel(areaCode),
    module: row.module,
    action: row.action,
    entityType: row.entity_type,
    entityId: row.entity_id,
    detail: row.detail,
    origin: row.origin,
    severity: row.severity,
    correlationId: row.correlation_id,
    metadata:
      row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
        ? (row.metadata as Record<string, unknown>)
        : {},
    actorType: row.actor_type,
  }
}

export async function queryActivityEvents(
  client: SupabaseAdminClient,
  input: ActivityViewerQuery
): Promise<ActivityViewerQueryResult> {
  const offset = Math.max(input.offset ?? 0, 0)
  const limit = Math.min(
    Math.max(input.limit ?? ACTIVITY_VIEWER_PAGE_SIZE, 1),
    200
  )

  const employeeIds = await resolveEmployeeIdsForFilters(client, input)
  if (employeeIds && employeeIds.length === 0) {
    return {
      entries: [],
      total: 0,
      offset,
      limit,
      hasMore: false,
    }
  }

  let query = client
    .from("activity_events")
    .select("*", { count: "exact" })
    .eq("company_id", input.companyId)
    .order("created_at", { ascending: false })

  if (input.from) {
    query = query.gte("created_at", input.from)
  }
  if (input.to) {
    query = query.lte("created_at", input.to)
  }
  if (input.module) {
    query = query.eq("module", input.module)
  }
  if (input.action) {
    query = query.eq("action", input.action)
  }
  if (input.origin) {
    query = query.eq("origin", input.origin)
  }
  if (employeeIds) {
    query = query.in("employee_id", employeeIds)
  }

  const { data, error, count } = await query.range(offset, offset + limit - 1)

  if (error) {
    throw new Error(
      `No se pudo consultar activity_events: ${error.message}`
    )
  }

  const rows = (data ?? []) as ActivityEventDbRow[]
  const total = count ?? 0

  const { data: companyRow, error: companyError } = await client
    .from("companies")
    .select("name")
    .eq("id", input.companyId)
    .maybeSingle()

  if (companyError) {
    throw new Error(
      `No se pudo cargar la empresa del Activity Viewer: ${companyError.message}`
    )
  }

  const companyName = companyRow?.name ?? input.companyId
  const eventEmployeeIds = [
    ...new Set(
      rows
        .map((row) => row.employee_id)
        .filter((id): id is string => Boolean(id))
    ),
  ]
  const { employeesById, rolesById } = await loadEmployeeContext(
    client,
    input.companyId,
    eventEmployeeIds
  )

  const entries = rows.map((row) => {
    const employee = row.employee_id
      ? (employeesById.get(row.employee_id) ?? null)
      : null
    const role =
      employee?.role_id != null
        ? (rolesById.get(employee.role_id) ?? null)
        : null

    return mapViewerEntry({
      row,
      companyName,
      employee,
      role,
    })
  })

  return {
    entries,
    total,
    offset,
    limit,
    hasMore: offset + entries.length < total,
  }
}

export async function queryActivityViewerStats(
  client: SupabaseAdminClient,
  companyId: string
): Promise<ActivityViewerStats> {
  const today = resolveTodayRange()
  const lastHourFrom = new Date(Date.now() - 60 * 60 * 1000).toISOString()

  const [
    eventsTodayResult,
    eventsLastHourResult,
    activeUsersResult,
    modulesResult,
  ] = await Promise.all([
    client
      .from("activity_events")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId)
      .gte("created_at", today.from)
      .lte("created_at", today.to),
    client
      .from("activity_events")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId)
      .gte("created_at", lastHourFrom),
    client
      .from("activity_events")
      .select("employee_id")
      .eq("company_id", companyId)
      .gte("created_at", today.from)
      .lte("created_at", today.to)
      .not("employee_id", "is", null),
    client
      .from("activity_events")
      .select("module")
      .eq("company_id", companyId)
      .gte("created_at", today.from)
      .lte("created_at", today.to),
  ])

  if (eventsTodayResult.error) {
    throw new Error(
      `No se pudo calcular eventos de hoy: ${eventsTodayResult.error.message}`
    )
  }
  if (eventsLastHourResult.error) {
    throw new Error(
      `No se pudo calcular eventos de la última hora: ${eventsLastHourResult.error.message}`
    )
  }
  if (activeUsersResult.error) {
    throw new Error(
      `No se pudo calcular usuarios activos: ${activeUsersResult.error.message}`
    )
  }
  if (modulesResult.error) {
    throw new Error(
      `No se pudo calcular módulos activos: ${modulesResult.error.message}`
    )
  }

  const activeUsersToday = new Set(
    (activeUsersResult.data ?? [])
      .map((row) => row.employee_id)
      .filter(Boolean)
  ).size

  const modulesActiveToday = new Set(
    (modulesResult.data ?? []).map((row) => row.module).filter(Boolean)
  ).size

  return {
    eventsToday: eventsTodayResult.count ?? 0,
    eventsLastHour: eventsLastHourResult.count ?? 0,
    activeUsersToday,
    modulesActiveToday,
  }
}

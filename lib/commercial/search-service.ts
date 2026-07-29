import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import {
  COMMERCIAL_SEARCH_LIMIT_PER_GROUP,
  type CommercialSearchGroup,
  type CommercialSearchResponse,
  type CommercialSearchResultItem,
} from "@/lib/types/commercial-search"

type PersonRow = {
  id: string
  first_name: string
  last_name: string
  company_name: string
  document_number: string
  phone: string
  mobile: string
  email: string
  notes: string
}

type OpportunityRow = {
  id: string
  code: string
  title: string
  description: string
  person_id: string
  etiqueta_id: string | null
  updated_at: string
}

type EtiquetaRow = {
  id: string
  name: string
  color: string
}

type ActivityRow = {
  id: string
  code: string
  description: string
  observations: string
  activity_type_id: string
  employee_id: string | null
  created_at: string
}

type ActivityTypeRow = {
  id: string
  name: string
  color: string
}

type EmployeeRow = {
  id: string
  first_name: string | null
  last_name: string | null
  employee_code: string | null
}

function normalizeQuery(raw: string): string {
  return raw.trim().replace(/\s+/g, " ")
}

/** Escape ILIKE wildcards; strip commas that break PostgREST `.or()` filters. */
function sanitizeIlikeTerm(raw: string): string {
  return raw
    .replace(/,/g, " ")
    .replace(/\\/g, "\\\\")
    .replace(/%/g, "\\%")
    .replace(/_/g, "\\_")
    .replace(/"/g, "")
    .trim()
}

function ilikeOr(columns: string[], pattern: string): string {
  const quoted = `"${pattern}"`
  return columns.map((column) => `${column}.ilike.${quoted}`).join(",")
}

function includesInsensitive(haystack: string, needle: string): boolean {
  return haystack.toLocaleLowerCase("es").includes(needle.toLocaleLowerCase("es"))
}

function resolvePersonDisplayName(person: PersonRow): string {
  const company = person.company_name.trim()
  if (company) return company
  const full = `${person.first_name} ${person.last_name}`.trim()
  return full || "Cliente"
}

function resolvePhone(person: PersonRow): string {
  return person.phone.trim() || person.mobile.trim() || ""
}

function formatRelativeTime(iso: string): string {
  const timestamp = new Date(iso).getTime()
  if (!Number.isFinite(timestamp)) return ""
  const deltaMs = Date.now() - timestamp
  if (deltaMs < 0) return "hace un momento"
  const minutes = Math.floor(deltaMs / 60_000)
  if (minutes < 1) return "hace un momento"
  if (minutes < 60) return `hace ${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `hace ${hours} h`
  const days = Math.floor(hours / 24)
  if (days < 30) return `hace ${days} día${days === 1 ? "" : "s"}`
  const months = Math.floor(days / 30)
  if (months < 12) return `hace ${months} mes${months === 1 ? "" : "es"}`
  const years = Math.floor(days / 365)
  return `hace ${years} año${years === 1 ? "" : "s"}`
}

function personMatches(person: PersonRow, query: string): boolean {
  const fields = [
    person.first_name,
    person.last_name,
    person.company_name,
    person.document_number,
    person.phone,
    person.mobile,
    person.email,
    person.notes,
    `${person.first_name} ${person.last_name}`.trim(),
  ]
  return fields.some((field) => includesInsensitive(field ?? "", query))
}

function opportunityTextMatches(row: OpportunityRow, query: string): boolean {
  return (
    includesInsensitive(row.title ?? "", query) ||
    includesInsensitive(row.description ?? "", query) ||
    includesInsensitive(row.code ?? "", query)
  )
}

/**
 * Unified commercial search — RLS via authenticated Supabase client.
 * Future: swap in-memory / ILIKE matching for Postgres full-text (tsvector).
 */
export async function searchCommercialModule(
  client: SupabaseClient,
  companyId: string,
  rawQuery: string,
  options?: { limitPerGroup?: number }
): Promise<CommercialSearchResponse> {
  const query = normalizeQuery(rawQuery)
  const limit = options?.limitPerGroup ?? COMMERCIAL_SEARCH_LIMIT_PER_GROUP

  if (query.length < 2) {
    return { query, groups: [], clients: [], activities: [] }
  }

  const [clients, activities] = await Promise.all([
    searchClients(client, companyId, query, limit),
    searchActivities(client, companyId, query, limit),
  ])

  const groups: CommercialSearchGroup[] = []
  if (clients.length > 0) {
    groups.push({ key: "clients", label: "Clientes", items: clients })
  }
  if (activities.length > 0) {
    groups.push({
      key: "activities",
      label: "Actividad Comercial",
      items: activities,
    })
  }

  return { query, groups, clients, activities }
}

async function searchClients(
  client: SupabaseClient,
  companyId: string,
  query: string,
  limit: number
): Promise<CommercialSearchResultItem[]> {
  const pattern = `%${sanitizeIlikeTerm(query)}%`

  const [peopleResult, etiquetasResult, opportunitiesResult] = await Promise.all([
    client
      .from("commercial_people")
      .select(
        "id, first_name, last_name, company_name, document_number, phone, mobile, email, notes"
      )
      .eq("company_id", companyId)
      .is("deleted_at", null)
      .or(
        ilikeOr(
          [
            "first_name",
            "last_name",
            "company_name",
            "document_number",
            "phone",
            "mobile",
            "email",
            "notes",
          ],
          pattern
        )
      )
      .limit(80),
    client
      .from("commercial_etiquetas" as never)
      .select("id, name, color")
      .eq("company_id", companyId)
      .is("deleted_at", null)
      .ilike("name", pattern)
      .limit(40),
    client
      .from("commercial_opportunities")
      .select("id, code, title, description, person_id, etiqueta_id, updated_at")
      .eq("company_id", companyId)
      .is("deleted_at", null)
      .or(ilikeOr(["title", "description", "code"], pattern))
      .order("updated_at", { ascending: false })
      .limit(80),
  ])

  const matchedPeople = (peopleResult.data ?? []) as PersonRow[]
  const matchedEtiquetas = (etiquetasResult.data ?? []) as EtiquetaRow[]
  const matchedByText = (opportunitiesResult.data ?? []) as OpportunityRow[]

  const personIds = new Set(matchedPeople.map((row) => row.id))
  const etiquetaIds = new Set(matchedEtiquetas.map((row) => row.id))

  const opportunityIds = new Set<string>()
  for (const row of matchedByText) opportunityIds.add(row.id)

  // Opportunities linked to matching people / etiquetas (extra fetch).
  const extraFilters: PromiseLike<{ data: unknown }>[] = []
  if (personIds.size > 0) {
    extraFilters.push(
      client
        .from("commercial_opportunities")
        .select("id, code, title, description, person_id, etiqueta_id, updated_at")
        .eq("company_id", companyId)
        .is("deleted_at", null)
        .in("person_id", [...personIds])
        .order("updated_at", { ascending: false })
        .limit(80)
    )
  }
  if (etiquetaIds.size > 0) {
    extraFilters.push(
      client
        .from("commercial_opportunities")
        .select("id, code, title, description, person_id, etiqueta_id, updated_at")
        .eq("company_id", companyId)
        .is("deleted_at", null)
        .in("etiqueta_id", [...etiquetaIds])
        .order("updated_at", { ascending: false })
        .limit(80)
    )
  }

  const extraResults = await Promise.all(extraFilters)
  const opportunityById = new Map<string, OpportunityRow>()
  for (const row of matchedByText) opportunityById.set(row.id, row)
  for (const result of extraResults) {
    for (const row of (result.data ?? []) as OpportunityRow[]) {
      opportunityById.set(row.id, row)
      opportunityIds.add(row.id)
    }
  }

  if (opportunityById.size === 0) return []

  const allPersonIds = [
    ...new Set([...opportunityById.values()].map((row) => row.person_id)),
  ]
  const allEtiquetaIds = [
    ...new Set(
      [...opportunityById.values()]
        .map((row) => row.etiqueta_id)
        .filter((id): id is string => Boolean(id))
    ),
  ]

  const [allPeopleResult, allEtiquetasResult] = await Promise.all([
    allPersonIds.length > 0
      ? client
          .from("commercial_people")
          .select(
            "id, first_name, last_name, company_name, document_number, phone, mobile, email, notes"
          )
          .eq("company_id", companyId)
          .in("id", allPersonIds)
      : Promise.resolve({ data: [] as PersonRow[] }),
    allEtiquetaIds.length > 0
      ? client
          .from("commercial_etiquetas" as never)
          .select("id, name, color")
          .eq("company_id", companyId)
          .in("id", allEtiquetaIds)
      : Promise.resolve({ data: [] as EtiquetaRow[] }),
  ])

  const peopleById = new Map(
    ((allPeopleResult.data ?? []) as PersonRow[]).map((row) => [row.id, row])
  )
  const etiquetasById = new Map(
    ((allEtiquetasResult.data ?? []) as EtiquetaRow[]).map((row) => [row.id, row])
  )

  const ranked = [...opportunityById.values()]
    .map((opportunity) => {
      const person = peopleById.get(opportunity.person_id)
      if (!person) return null

      const etiqueta = opportunity.etiqueta_id
        ? etiquetasById.get(opportunity.etiqueta_id) ?? null
        : null

      const matches =
        personMatches(person, query) ||
        opportunityTextMatches(opportunity, query) ||
        (etiqueta ? includesInsensitive(etiqueta.name, query) : false)

      if (!matches) return null

      const phone = resolvePhone(person)
      const item: CommercialSearchResultItem = {
        id: opportunity.id,
        category: "clients",
        title: resolvePersonDisplayName(person),
        subtitle: phone
          ? `📞 ${phone}`
          : opportunity.code || opportunity.title || null,
        badge: etiqueta
          ? { label: etiqueta.name, color: etiqueta.color }
          : null,
        meta: opportunity.code,
        payload: {
          kind: "client",
          opportunityId: opportunity.id,
        },
      }
      return { item, updatedAt: opportunity.updated_at }
    })
    .filter((entry): entry is { item: CommercialSearchResultItem; updatedAt: string } =>
      Boolean(entry)
    )
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, limit)
    .map((entry) => entry.item)

  return ranked
}

async function searchActivities(
  client: SupabaseClient,
  companyId: string,
  query: string,
  limit: number
): Promise<CommercialSearchResultItem[]> {
  const pattern = `%${sanitizeIlikeTerm(query)}%`

  const [activitiesResult, typesResult] = await Promise.all([
    client
      .from("commercial_territorial_activities" as never)
      .select(
        "id, code, description, observations, activity_type_id, employee_id, created_at"
      )
      .eq("company_id", companyId)
      .is("deleted_at", null)
      .or(ilikeOr(["description", "observations", "code"], pattern))
      .order("created_at", { ascending: false })
      .limit(80),
    client
      .from("commercial_territorial_activity_types" as never)
      .select("id, name, color")
      .eq("company_id", companyId)
      .is("deleted_at", null)
      .ilike("name", pattern)
      .limit(40),
  ])

  const byText = (activitiesResult.data ?? []) as unknown as ActivityRow[]
  const matchedTypes = (typesResult.data ?? []) as unknown as ActivityTypeRow[]
  const typeIds = matchedTypes.map((row) => row.id)

  let byType: ActivityRow[] = []
  if (typeIds.length > 0) {
    const { data } = await client
      .from("commercial_territorial_activities" as never)
      .select(
        "id, code, description, observations, activity_type_id, employee_id, created_at"
      )
      .eq("company_id", companyId)
      .is("deleted_at", null)
      .in("activity_type_id", typeIds)
      .order("created_at", { ascending: false })
      .limit(80)
    byType = (data ?? []) as unknown as ActivityRow[]
  }

  // Employee name match — load recent activities and filter by employee name.
  const { data: recentForEmployees } = await client
    .from("commercial_territorial_activities" as never)
    .select(
      "id, code, description, observations, activity_type_id, employee_id, created_at"
    )
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .not("employee_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(150)

  const recentRows = (recentForEmployees ?? []) as unknown as ActivityRow[]
  const employeeIds = [
    ...new Set(
      recentRows
        .map((row) => row.employee_id)
        .filter((id): id is string => Boolean(id))
    ),
  ]

  const employeesById = new Map<string, EmployeeRow>()
  if (employeeIds.length > 0) {
    const { data: employees } = await client
      .from("employees")
      .select("id, first_name, last_name, employee_code")
      .eq("company_id", companyId)
      .in("id", employeeIds)
    for (const row of (employees ?? []) as EmployeeRow[]) {
      employeesById.set(row.id, row)
    }
  }

  const byEmployee = recentRows.filter((row) => {
    if (!row.employee_id) return false
    const employee = employeesById.get(row.employee_id)
    if (!employee) return false
    const name =
      `${employee.first_name ?? ""} ${employee.last_name ?? ""}`.trim() ||
      employee.employee_code ||
      ""
    return includesInsensitive(name, query)
  })

  const activityById = new Map<string, ActivityRow>()
  for (const row of [...byText, ...byType, ...byEmployee]) {
    activityById.set(row.id, row)
  }
  if (activityById.size === 0) return []

  const allTypeIds = [
    ...new Set([...activityById.values()].map((row) => row.activity_type_id)),
  ]
  const typesById = new Map(
    matchedTypes.map((row) => [row.id, row] as const)
  )
  const missingTypeIds = allTypeIds.filter((id) => !typesById.has(id))
  if (missingTypeIds.length > 0) {
    const { data } = await client
      .from("commercial_territorial_activity_types" as never)
      .select("id, name, color")
      .eq("company_id", companyId)
      .in("id", missingTypeIds)
    for (const row of (data ?? []) as unknown as ActivityTypeRow[]) {
      typesById.set(row.id, row)
    }
  }

  return [...activityById.values()]
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, limit)
    .map((row) => {
      const type = typesById.get(row.activity_type_id)
      const employee = row.employee_id
        ? employeesById.get(row.employee_id)
        : null
      const employeeName = employee
        ? `${employee.first_name ?? ""} ${employee.last_name ?? ""}`.trim() ||
          employee.employee_code
        : null

      return {
        id: row.id,
        category: "activities" as const,
        title: row.description.trim() || type?.name || row.code,
        subtitle: type?.name
          ? `📍 ${type.name}${employeeName ? ` · ${employeeName}` : ""}`
          : employeeName,
        badge: type ? { label: type.name, color: type.color } : null,
        meta: formatRelativeTime(row.created_at),
        payload: {
          kind: "activity",
          activityId: row.id,
        },
      }
    })
}

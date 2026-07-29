import type { SupabaseClient } from "@supabase/supabase-js"

import {
  mapCommercialOpportunityRowToOpportunity,
  mapCommercialPersonRowToPerson,
  mapCreateCommercialOpportunityPayloadToInsert,
  mapCreateCommercialPersonPayloadToInsert,
  mapUpdateCommercialOpportunityPayloadToUpdate,
  mapUpdateCommercialPersonPayloadToUpdate,
  resolveCommercialPersonDisplayName,
} from "@/lib/supabase/commercial.mapper"
import type { Database } from "@/lib/supabase/database.types"
import type {
  CommercialMapOpportunity,
  CommercialMapQuery,
  CommercialOpportunity,
  CommercialOpportunityListItem,
  CommercialPerson,
} from "@/lib/types/commercial"
import type {
  BulkAssignCommercialOpportunitiesPayload,
  CommercialRepositoryResult,
  CreateCommercialOpportunityPayload,
  CreateCommercialPersonPayload,
  UpdateCommercialOpportunityPayload,
  UpdateCommercialPersonPayload,
} from "@/lib/types/supabase/commercial"

export type SupabaseCommercialClient = SupabaseClient<Database>

const PERSON_SELECT = "*"
/** `*` includes etiqueta_id after migration; name/color enriched client-side. */
const OPPORTUNITY_SELECT = "*"

export function mapSupabaseCommercialError(error: {
  code?: string
  message: string
}) {
  if (error.code === "23503") {
    return {
      code: "VALIDATION" as const,
      message: "Referencia inválida para el expediente comercial.",
    }
  }

  if (error.code === "23514" || error.code === "23502") {
    return {
      code: "VALIDATION" as const,
      message: error.message,
    }
  }

  return {
    code: "UNKNOWN" as const,
    message: error.message,
  }
}

export async function fetchCommercialPeople(
  client: SupabaseCommercialClient,
  companyId: string
): Promise<CommercialRepositoryResult<CommercialPerson[]>> {
  const { data, error } = await client
    .from("commercial_people")
    .select(PERSON_SELECT)
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })

  if (error) {
    return { data: null, error: mapSupabaseCommercialError(error) }
  }

  return {
    data: (data ?? []).map(mapCommercialPersonRowToPerson),
    error: null,
  }
}

export async function fetchCommercialPersonById(
  client: SupabaseCommercialClient,
  id: string
): Promise<CommercialRepositoryResult<CommercialPerson>> {
  const { data, error } = await client
    .from("commercial_people")
    .select(PERSON_SELECT)
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle()

  if (error) {
    return { data: null, error: mapSupabaseCommercialError(error) }
  }

  if (!data) {
    return {
      data: null,
      error: { code: "NOT_FOUND", message: "Persona no encontrada." },
    }
  }

  return {
    data: mapCommercialPersonRowToPerson(data),
    error: null,
  }
}

export async function insertCommercialPerson(
  client: SupabaseCommercialClient,
  payload: CreateCommercialPersonPayload
): Promise<CommercialRepositoryResult<CommercialPerson>> {
  const { data, error } = await client
    .from("commercial_people")
    .insert(mapCreateCommercialPersonPayloadToInsert(payload))
    .select(PERSON_SELECT)
    .single()

  if (error) {
    return { data: null, error: mapSupabaseCommercialError(error) }
  }

  return {
    data: mapCommercialPersonRowToPerson(data),
    error: null,
  }
}

export async function patchCommercialPerson(
  client: SupabaseCommercialClient,
  id: string,
  payload: UpdateCommercialPersonPayload
): Promise<CommercialRepositoryResult<CommercialPerson>> {
  const update = mapUpdateCommercialPersonPayloadToUpdate(payload)

  if (Object.keys(update).length === 0) {
    return {
      data: null,
      error: { code: "VALIDATION", message: "No hay cambios para guardar." },
    }
  }

  const { data, error } = await client
    .from("commercial_people")
    .update(update)
    .eq("id", id)
    .is("deleted_at", null)
    .select(PERSON_SELECT)
    .maybeSingle()

  if (error) {
    return { data: null, error: mapSupabaseCommercialError(error) }
  }

  if (!data) {
    return {
      data: null,
      error: { code: "NOT_FOUND", message: "Persona no encontrada." },
    }
  }

  return {
    data: mapCommercialPersonRowToPerson(data),
    error: null,
  }
}

export async function softDeleteCommercialPerson(
  client: SupabaseCommercialClient,
  id: string,
  deletedBy?: string | null
): Promise<CommercialRepositoryResult<CommercialPerson>> {
  const { data, error } = await client
    .from("commercial_people")
    .update({
      deleted_at: new Date().toISOString(),
      deleted_by: deletedBy ?? null,
    })
    .eq("id", id)
    .is("deleted_at", null)
    .select(PERSON_SELECT)
    .maybeSingle()

  if (error) {
    return { data: null, error: mapSupabaseCommercialError(error) }
  }

  if (!data) {
    return {
      data: null,
      error: { code: "NOT_FOUND", message: "Persona no encontrada." },
    }
  }

  return {
    data: mapCommercialPersonRowToPerson(data),
    error: null,
  }
}

/**
 * Find an active prospect by exact email (case-insensitive) or exact phone/mobile.
 * Email match wins when both could match different people.
 */
export async function findCommercialPersonByContact(
  client: SupabaseCommercialClient,
  companyId: string,
  contact: { email?: string; phone?: string; mobile?: string }
): Promise<CommercialRepositoryResult<CommercialPerson | null>> {
  const email = contact.email?.trim().toLowerCase() ?? ""
  const phones = [
    ...new Set(
      [contact.phone, contact.mobile]
        .map((value) => value?.trim() ?? "")
        .filter(Boolean)
    ),
  ]

  if (email) {
    const { data, error } = await client
      .from("commercial_people")
      .select(PERSON_SELECT)
      .eq("company_id", companyId)
      .is("deleted_at", null)
      .ilike("email", email)
      .order("created_at", { ascending: true })
      .limit(1)

    if (error) {
      return { data: null, error: mapSupabaseCommercialError(error) }
    }

    if (data?.[0]) {
      return {
        data: mapCommercialPersonRowToPerson(data[0]),
        error: null,
      }
    }
  }

  for (const phone of phones) {
    const byPhone = await client
      .from("commercial_people")
      .select(PERSON_SELECT)
      .eq("company_id", companyId)
      .is("deleted_at", null)
      .eq("phone", phone)
      .order("created_at", { ascending: true })
      .limit(1)

    if (byPhone.error) {
      return { data: null, error: mapSupabaseCommercialError(byPhone.error) }
    }

    if (byPhone.data?.[0]) {
      return {
        data: mapCommercialPersonRowToPerson(byPhone.data[0]),
        error: null,
      }
    }

    const byMobile = await client
      .from("commercial_people")
      .select(PERSON_SELECT)
      .eq("company_id", companyId)
      .is("deleted_at", null)
      .eq("mobile", phone)
      .order("created_at", { ascending: true })
      .limit(1)

    if (byMobile.error) {
      return { data: null, error: mapSupabaseCommercialError(byMobile.error) }
    }

    if (byMobile.data?.[0]) {
      return {
        data: mapCommercialPersonRowToPerson(byMobile.data[0]),
        error: null,
      }
    }
  }

  return { data: null, error: null }
}

export async function fetchCommercialOpportunities(
  client: SupabaseCommercialClient,
  companyId: string
): Promise<CommercialRepositoryResult<CommercialOpportunityListItem[]>> {
  const { data, error } = await client
    .from("commercial_opportunities")
    .select(OPPORTUNITY_SELECT)
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })

  if (error) {
    return { data: null, error: mapSupabaseCommercialError(error) }
  }

  const opportunities = (data ?? []).map(mapCommercialOpportunityRowToOpportunity)
  const personIds = [...new Set(opportunities.map((row) => row.personId))]

  const personNameById = new Map<string, string>()
  if (personIds.length > 0) {
    const { data: people, error: peopleError } = await client
      .from("commercial_people")
      .select("id, person_type, first_name, last_name, company_name")
      .eq("company_id", companyId)
      .in("id", personIds)

    if (peopleError) {
      return { data: null, error: mapSupabaseCommercialError(peopleError) }
    }

    for (const person of people ?? []) {
      personNameById.set(
        person.id,
        resolveCommercialPersonDisplayName({
          personType: person.person_type,
          firstName: person.first_name,
          lastName: person.last_name,
          companyName: person.company_name,
        })
      )
    }
  }

  return {
    data: opportunities.map((opportunity) => ({
      ...opportunity,
      personDisplayName:
        personNameById.get(opportunity.personId) ?? "Persona",
    })),
    error: null,
  }
}

export async function fetchCommercialOpportunityById(
  client: SupabaseCommercialClient,
  id: string
): Promise<CommercialRepositoryResult<CommercialOpportunity>> {
  const { data, error } = await client
    .from("commercial_opportunities")
    .select(OPPORTUNITY_SELECT)
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle()

  if (error) {
    return { data: null, error: mapSupabaseCommercialError(error) }
  }

  if (!data) {
    return {
      data: null,
      error: { code: "NOT_FOUND", message: "Oportunidad no encontrada." },
    }
  }

  return {
    data: mapCommercialOpportunityRowToOpportunity(data),
    error: null,
  }
}

export async function insertCommercialOpportunity(
  client: SupabaseCommercialClient,
  payload: CreateCommercialOpportunityPayload
): Promise<CommercialRepositoryResult<CommercialOpportunity>> {
  if (!payload.personId?.trim()) {
    return {
      data: null,
      error: {
        code: "VALIDATION",
        message: "La oportunidad requiere una persona.",
      },
    }
  }

  if (!payload.title?.trim()) {
    return {
      data: null,
      error: {
        code: "VALIDATION",
        message: "La oportunidad requiere un título.",
      },
    }
  }

  const insert = mapCreateCommercialOpportunityPayloadToInsert(payload)

  // code is assigned by DB trigger when omitted; PostgREST needs a placeholder
  // only when the column is NOT NULL without default — trigger fills before insert.
  const { data, error } = await client
    .from("commercial_opportunities")
    .insert({
      ...insert,
      code: insert.code ?? "",
    } as never)
    .select(OPPORTUNITY_SELECT)
    .single()

  if (error) {
    return { data: null, error: mapSupabaseCommercialError(error) }
  }

  return {
    data: mapCommercialOpportunityRowToOpportunity(data),
    error: null,
  }
}

export async function patchCommercialOpportunity(
  client: SupabaseCommercialClient,
  id: string,
  payload: UpdateCommercialOpportunityPayload
): Promise<CommercialRepositoryResult<CommercialOpportunity>> {
  const update = mapUpdateCommercialOpportunityPayloadToUpdate(payload)

  if (Object.keys(update).length === 0) {
    return {
      data: null,
      error: { code: "VALIDATION", message: "No hay cambios para guardar." },
    }
  }

  const { data, error } = await client
    .from("commercial_opportunities")
    .update(update as never)
    .eq("id", id)
    .is("deleted_at", null)
    .select(OPPORTUNITY_SELECT)
    .maybeSingle()

  if (error) {
    return { data: null, error: mapSupabaseCommercialError(error) }
  }

  if (!data) {
    return {
      data: null,
      error: { code: "NOT_FOUND", message: "Oportunidad no encontrada." },
    }
  }

  return {
    data: mapCommercialOpportunityRowToOpportunity(data),
    error: null,
  }
}

export async function softDeleteCommercialOpportunity(
  client: SupabaseCommercialClient,
  id: string,
  deletedBy?: string | null
): Promise<CommercialRepositoryResult<CommercialOpportunity>> {
  const { data, error } = await client
    .from("commercial_opportunities")
    .update({
      deleted_at: new Date().toISOString(),
      deleted_by: deletedBy ?? null,
    })
    .eq("id", id)
    .is("deleted_at", null)
    .select(OPPORTUNITY_SELECT)
    .maybeSingle()

  if (error) {
    return { data: null, error: mapSupabaseCommercialError(error) }
  }

  if (!data) {
    return {
      data: null,
      error: { code: "NOT_FOUND", message: "Oportunidad no encontrada." },
    }
  }

  return {
    data: mapCommercialOpportunityRowToOpportunity(data),
    error: null,
  }
}

const MAP_OPPORTUNITY_SELECT =
  "id, code, title, status, priority, latitude, longitude, assigned_employee_id, updated_at, etiqueta_id, person:commercial_people!commercial_opportunities_person_id_fkey(first_name, last_name, company_name, person_type, phone, mobile)"

type CommercialMapQueryRow = {
  id: string
  code: string
  title: string
  status: string
  priority: string
  latitude: number | null
  longitude: number | null
  assigned_employee_id: string | null
  updated_at: string
  etiqueta_id?: string | null
  person?: {
    first_name: string
    last_name: string
    company_name: string
    person_type: string
    phone: string
    mobile: string
  } | null
}

function mapCommercialMapOpportunityRow(
  row: CommercialMapQueryRow
): CommercialMapOpportunity | null {
  if (row.latitude == null || row.longitude == null) return null

  const personName = resolveCommercialPersonDisplayName({
    personType:
      (row.person?.person_type as "individual" | "company") ?? "individual",
    firstName: row.person?.first_name ?? "",
    lastName: row.person?.last_name ?? "",
    companyName: row.person?.company_name ?? "",
  })

  return {
    id: row.id,
    code: row.code,
    title: row.title,
    status: row.status as CommercialMapOpportunity["status"],
    priority: row.priority as CommercialMapOpportunity["priority"],
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    assignedEmployeeId: row.assigned_employee_id,
    personName,
    companyName: row.person?.company_name?.trim() ?? "",
    updatedAt: row.updated_at,
    etiquetaId: row.etiqueta_id ?? null,
    etiquetaName: null,
    etiquetaColor: null,
  }
}

export async function fetchCommercialMapOpportunities(
  client: SupabaseCommercialClient,
  companyId: string,
  query: CommercialMapQuery
): Promise<CommercialRepositoryResult<CommercialMapOpportunity[]>> {
  const { bounds } = query
  if (
    !Number.isFinite(bounds.north) ||
    !Number.isFinite(bounds.south) ||
    !Number.isFinite(bounds.east) ||
    !Number.isFinite(bounds.west)
  ) {
    return {
      data: null,
      error: { code: "VALIDATION", message: "Bounds de mapa inválidos." },
    }
  }

  let builder = client
    .from("commercial_opportunities")
    .select(MAP_OPPORTUNITY_SELECT)
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .not("latitude", "is", null)
    .not("longitude", "is", null)
    .gte("latitude", Math.min(bounds.south, bounds.north))
    .lte("latitude", Math.max(bounds.south, bounds.north))
    .gte("longitude", Math.min(bounds.west, bounds.east))
    .lte("longitude", Math.max(bounds.west, bounds.east))
    .order("updated_at", { ascending: false })
    .limit(500)

  if (query.assignment === "assigned") {
    builder = builder.not("assigned_employee_id", "is", null)
  } else if (query.assignment === "unassigned") {
    builder = builder.is("assigned_employee_id", null)
  }

  if (query.assignedEmployeeId?.trim()) {
    builder = builder.eq(
      "assigned_employee_id",
      query.assignedEmployeeId.trim()
    )
  }

  if (query.status) {
    builder = builder.eq("status", query.status)
  }
  if (query.priority) {
    builder = builder.eq("priority", query.priority)
  }
  if (query.source) {
    builder = builder.eq("source", query.source)
  }

  const { data, error } = await builder

  if (error) {
    return { data: null, error: mapSupabaseCommercialError(error) }
  }

  const rows = (data ?? []) as unknown as CommercialMapQueryRow[]
  const search = query.search?.trim().toLowerCase() ?? ""
  const mapped = rows
    .map((row) => mapCommercialMapOpportunityRow(row))
    .filter((entry): entry is CommercialMapOpportunity => entry != null)

  if (!search) {
    return { data: mapped, error: null }
  }

  const filtered = mapped.filter((entry) => {
    const row = rows.find((candidate) => candidate.id === entry.id)
    const phone =
      `${row?.person?.phone ?? ""} ${row?.person?.mobile ?? ""}`.toLowerCase()
    return (
      entry.code.toLowerCase().includes(search) ||
      entry.title.toLowerCase().includes(search) ||
      entry.personName.toLowerCase().includes(search) ||
      entry.companyName.toLowerCase().includes(search) ||
      phone.includes(search)
    )
  })

  return { data: filtered, error: null }
}

export async function bulkAssignCommercialOpportunities(
  client: SupabaseCommercialClient,
  companyId: string,
  payload: BulkAssignCommercialOpportunitiesPayload
): Promise<CommercialRepositoryResult<CommercialOpportunity[]>> {
  const ids = [
    ...new Set(payload.opportunityIds.map((id) => id.trim()).filter(Boolean)),
  ]
  if (ids.length === 0) {
    return {
      data: null,
      error: {
        code: "VALIDATION",
        message: "Seleccione al menos una oportunidad.",
      },
    }
  }

  const { data, error } = await client
    .from("commercial_opportunities")
    .update({
      assigned_employee_id: payload.assignedEmployeeId,
      updated_by: payload.updatedBy ?? null,
    })
    .eq("company_id", companyId)
    .in("id", ids)
    .is("deleted_at", null)
    .select(OPPORTUNITY_SELECT)

  if (error) {
    return { data: null, error: mapSupabaseCommercialError(error) }
  }

  return {
    data: (data ?? []).map(mapCommercialOpportunityRowToOpportunity),
    error: null,
  }
}

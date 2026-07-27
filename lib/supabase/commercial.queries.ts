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
  CommercialOpportunity,
  CommercialOpportunityListItem,
  CommercialPerson,
} from "@/lib/types/commercial"
import type {
  CommercialRepositoryResult,
  CreateCommercialOpportunityPayload,
  CreateCommercialPersonPayload,
  UpdateCommercialOpportunityPayload,
  UpdateCommercialPersonPayload,
} from "@/lib/types/supabase/commercial"

export type SupabaseCommercialClient = SupabaseClient<Database>

const PERSON_SELECT = "*"
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
      error: { code: "NOT_FOUND", message: "Prospecto no encontrado." },
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
      error: { code: "NOT_FOUND", message: "Prospecto no encontrado." },
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
      error: { code: "NOT_FOUND", message: "Prospecto no encontrado." },
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
        personNameById.get(opportunity.personId) ?? "Prospecto",
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
        message: "La oportunidad requiere un prospecto.",
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
    })
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
    .update(update)
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
